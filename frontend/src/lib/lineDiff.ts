export type LineStatus = 'unchanged' | 'added' | 'removed' | 'modified' | 'moved' | 'placeholder'

export interface DiffLine {
  text: string
  status: LineStatus
}

export interface SideResult {
  text: string
  lines: DiffLine[]
}

type Row =
  | { kind: 'common'; leftKey: string | number; rightKey: string | number }
  | { kind: 'leftOnly'; leftKey: string | number }
  | { kind: 'rightOnly'; rightKey: string | number }

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i
  }
  return -1
}

function pushValueLines(
  lines: DiffLine[],
  value: unknown,
  status: LineStatus,
  indent: string,
  keyPrefix: string,
  comma: string,
) {
  if (value !== null && typeof value === 'object') {
    const jsonLines = JSON.stringify(value, null, 2).split('\n')
    jsonLines.forEach((line, i) => {
      let text = i === 0 ? indent + keyPrefix + line : indent + line
      if (i === jsonLines.length - 1) text += comma
      lines.push({ text, status })
    })
  } else {
    lines.push({ text: indent + keyPrefix + JSON.stringify(value) + comma, status })
  }
}

function statusForDeltaEntry(entry: unknown[]): LineStatus {
  if (entry.length === 1) return 'added'
  if (entry.length === 2) return 'modified'
  if (entry.length === 3) {
    if (entry[2] === 0) return 'removed'
    if (entry[2] === 3) return 'moved'
    if (entry[2] === 2) return 'modified'
  }
  return 'unchanged'
}

// Aligns two sibling key-order arrays via LCS so common keys stay row-paired,
// preserving each side's own relative order for its one-sided keys.
function alignObjectKeys(leftKeys: string[], rightKeys: string[]): Row[] {
  const n = leftKeys.length
  const m = rightKeys.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        leftKeys[i] === rightKeys[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows: Row[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (leftKeys[i] === rightKeys[j]) {
      rows.push({ kind: 'common', leftKey: leftKeys[i], rightKey: rightKeys[j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: 'leftOnly', leftKey: leftKeys[i] })
      i++
    } else {
      rows.push({ kind: 'rightOnly', rightKey: rightKeys[j] })
      j++
    }
  }
  while (i < n) rows.push({ kind: 'leftOnly', leftKey: leftKeys[i++] })
  while (j < m) rows.push({ kind: 'rightOnly', rightKey: rightKeys[j++] })
  return rows
}

type ArraySlot = { kind: 'survivor' | 'moved'; oldIdx: number } | { kind: 'added' }

// Aligns array indices using jsondiffpatch's own `_t:'a'` edit script (not a
// generic value diff), so insertions/removals/moves land at their true
// position instead of being appended to the end of the container.
function alignArrayIndices(
  leftLen: number,
  rightLen: number,
  delta: Record<string, unknown> | null,
): { rows: Row[]; movedOld: Set<number> } {
  if (!delta) {
    const rows: Row[] = []
    for (let i = 0; i < Math.min(leftLen, rightLen); i++) rows.push({ kind: 'common', leftKey: i, rightKey: i })
    return { rows, movedOld: new Set() }
  }

  const removedOld = new Set<number>()
  const movedOldToNew = new Map<number, number>()
  const addedNew = new Set<number>()

  for (const rawKey of Object.keys(delta)) {
    if (rawKey === '_t') continue
    const entry = delta[rawKey]
    if (rawKey.startsWith('_')) {
      const oldIdx = Number(rawKey.slice(1))
      if (Array.isArray(entry) && entry.length === 3) {
        if (entry[2] === 0) removedOld.add(oldIdx)
        else if (entry[2] === 3) movedOldToNew.set(oldIdx, entry[1] as number)
      }
    } else if (Array.isArray(entry) && entry.length === 1) {
      addedNew.add(Number(rawKey))
    }
  }

  const survivors: number[] = []
  for (let i = 0; i < leftLen; i++) {
    if (!removedOld.has(i) && !movedOldToNew.has(i)) survivors.push(i)
  }

  const insertions: { newIndex: number; slot: ArraySlot }[] = []
  for (const newIndex of addedNew) insertions.push({ newIndex, slot: { kind: 'added' } })
  for (const [oldIdx, newIndex] of movedOldToNew) insertions.push({ newIndex, slot: { kind: 'moved', oldIdx } })
  insertions.sort((a, b) => a.newIndex - b.newIndex)

  const working: ArraySlot[] = survivors.map((oldIdx) => ({ kind: 'survivor', oldIdx }))
  for (const { newIndex, slot } of insertions) {
    working.splice(Math.min(newIndex, working.length), 0, slot)
  }

  const removedSorted = [...removedOld].sort((a, b) => a - b)
  let removedPtr = 0
  const rows: Row[] = []
  working.forEach((slot, rightIdx) => {
    if (slot.kind === 'added') {
      rows.push({ kind: 'rightOnly', rightKey: rightIdx })
      return
    }
    while (removedPtr < removedSorted.length && removedSorted[removedPtr] < slot.oldIdx) {
      rows.push({ kind: 'leftOnly', leftKey: removedSorted[removedPtr] })
      removedPtr++
    }
    rows.push({ kind: 'common', leftKey: slot.oldIdx, rightKey: rightIdx })
  })
  while (removedPtr < removedSorted.length) {
    rows.push({ kind: 'leftOnly', leftKey: removedSorted[removedPtr++] })
  }

  return { rows, movedOld: new Set(movedOldToNew.keys()) }
}

// Walks left/right together so every row is emitted to both sides at once —
// either as matching real content, or as a real line on one side paired with
// a blank 'placeholder' line on the other — guaranteeing leftLines.length
// stays exactly equal to rightLines.length at every point in the walk.
function buildRows(
  leftValue: unknown,
  rightValue: unknown,
  delta: Record<string, unknown> | null,
  depth: number,
  leftLines: DiffLine[],
  rightLines: DiffLine[],
) {
  const indent = '  '.repeat(depth)
  const childIndent = '  '.repeat(depth + 1)
  const isArray = Array.isArray(leftValue)
  const leftObj = leftValue as Record<string, unknown>
  const rightObj = rightValue as Record<string, unknown>
  const leftArr = leftValue as unknown[]
  const rightArr = rightValue as unknown[]

  leftLines.push({ text: indent + (isArray ? '[' : '{'), status: 'unchanged' })
  rightLines.push({ text: indent + (isArray ? '[' : '{'), status: 'unchanged' })

  let rows: Row[]
  let movedOld: Set<number>
  if (isArray) {
    const aligned = alignArrayIndices(leftArr.length, rightArr.length, delta)
    rows = aligned.rows
    movedOld = aligned.movedOld
  } else {
    rows = alignObjectKeys(Object.keys(leftObj), Object.keys(rightObj))
    movedOld = new Set()
  }

  const lastLeftRowIdx = findLastIndex(rows, (r) => r.kind !== 'rightOnly')
  const lastRightRowIdx = findLastIndex(rows, (r) => r.kind !== 'leftOnly')

  rows.forEach((row, rowIdx) => {
    const leftLenBefore = leftLines.length
    const rightLenBefore = rightLines.length
    const leftComma = rowIdx === lastLeftRowIdx ? '' : ','
    const rightComma = rowIdx === lastRightRowIdx ? '' : ','

    if (row.kind === 'leftOnly') {
      const lv = isArray ? leftArr[row.leftKey as number] : leftObj[row.leftKey as string]
      const keyPrefix = isArray ? '' : `${JSON.stringify(String(row.leftKey))}: `
      pushValueLines(leftLines, lv, 'removed', childIndent, keyPrefix, leftComma)
    } else if (row.kind === 'rightOnly') {
      const rv = isArray ? rightArr[row.rightKey as number] : rightObj[row.rightKey as string]
      const keyPrefix = isArray ? '' : `${JSON.stringify(String(row.rightKey))}: `
      pushValueLines(rightLines, rv, 'added', childIndent, keyPrefix, rightComma)
    } else {
      const lv = isArray ? leftArr[row.leftKey as number] : leftObj[row.leftKey as string]
      const rv = isArray ? rightArr[row.rightKey as number] : rightObj[row.rightKey as string]
      const leftKeyPrefix = isArray ? '' : `${JSON.stringify(String(row.leftKey))}: `
      const rightKeyPrefix = isArray ? '' : `${JSON.stringify(String(row.rightKey))}: `

      if (isArray && movedOld.has(row.leftKey as number)) {
        pushValueLines(leftLines, lv, 'moved', childIndent, leftKeyPrefix, leftComma)
        pushValueLines(rightLines, rv, 'moved', childIndent, rightKeyPrefix, rightComma)
      } else {
        const deltaEntry = delta ? (isArray ? delta[String(row.rightKey)] : delta[row.leftKey as string]) : undefined

        if (deltaEntry === undefined) {
          pushValueLines(leftLines, lv, 'unchanged', childIndent, leftKeyPrefix, leftComma)
          pushValueLines(rightLines, rv, 'unchanged', childIndent, rightKeyPrefix, rightComma)
        } else if (Array.isArray(deltaEntry)) {
          const status = statusForDeltaEntry(deltaEntry)
          pushValueLines(leftLines, lv, status, childIndent, leftKeyPrefix, leftComma)
          pushValueLines(rightLines, rv, status, childIndent, rightKeyPrefix, rightComma)
        } else {
          const subLeft: DiffLine[] = []
          const subRight: DiffLine[] = []
          buildRows(lv, rv, deltaEntry as Record<string, unknown>, depth + 1, subLeft, subRight)
          subLeft[0] = { ...subLeft[0], text: childIndent + leftKeyPrefix + subLeft[0].text.trimStart() }
          subRight[0] = { ...subRight[0], text: childIndent + rightKeyPrefix + subRight[0].text.trimStart() }
          const lastSubLeft = subLeft.length - 1
          const lastSubRight = subRight.length - 1
          subLeft[lastSubLeft] = { ...subLeft[lastSubLeft], text: subLeft[lastSubLeft].text + leftComma }
          subRight[lastSubRight] = { ...subRight[lastSubRight], text: subRight[lastSubRight].text + rightComma }
          leftLines.push(...subLeft)
          rightLines.push(...subRight)
        }
      }
    }

    const leftGained = leftLines.length - leftLenBefore
    const rightGained = rightLines.length - rightLenBefore
    if (leftGained > rightGained) {
      for (let k = 0; k < leftGained - rightGained; k++) rightLines.push({ text: '', status: 'placeholder' })
    } else if (rightGained > leftGained) {
      for (let k = 0; k < rightGained - leftGained; k++) leftLines.push({ text: '', status: 'placeholder' })
    }
  })

  leftLines.push({ text: indent + (isArray ? ']' : '}'), status: 'unchanged' })
  rightLines.push({ text: indent + (isArray ? ']' : '}'), status: 'unchanged' })
}

export function buildLineDiff(
  left: unknown,
  right: unknown,
  delta: Record<string, unknown> | null,
): { left: SideResult; right: SideResult } {
  const leftLines: DiffLine[] = []
  const rightLines: DiffLine[] = []
  buildRows(left, right, delta, 0, leftLines, rightLines)
  return {
    left: { text: leftLines.map((l) => l.text).join('\n'), lines: leftLines },
    right: { text: rightLines.map((l) => l.text).join('\n'), lines: rightLines },
  }
}
