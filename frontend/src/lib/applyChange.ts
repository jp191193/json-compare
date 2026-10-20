import type { DiffChange } from './lineDiff'

export type CopyDirection = 'to-left' | 'to-right'

function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

function sideKey(change: DiffChange, side: 'left' | 'right'): string | number | undefined {
  return side === 'left' ? change.leftKey : change.rightKey
}

function parentSegments(change: DiffChange, side: 'left' | 'right'): Array<string | number> {
  return side === 'left' ? change.leftParent : change.rightParent
}

function valueAt(root: unknown, segments: Array<string | number>): unknown {
  let current = root
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment as string]
  }
  return current
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function matchesContainer(value: unknown, container: DiffChange['container']): boolean {
  return container === 'array' ? Array.isArray(value) : isObject(value)
}

function removeAt(container: unknown, kind: DiffChange['container'], key: string | number | undefined) {
  if (key === undefined) return
  if (kind === 'array' && Array.isArray(container) && typeof key === 'number') {
    if (key >= 0 && key < container.length) container.splice(key, 1)
    return
  }
  if (kind === 'object' && isObject(container)) delete container[String(key)]
}

function insertObjectKey(target: Record<string, unknown>, source: Record<string, unknown>, key: string, value: unknown) {
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    target[key] = value
    return
  }

  const sourceKeys = Object.keys(source)
  const pos = sourceKeys.indexOf(key)
  const targetKeys = Object.keys(target)
  let insertAt = targetKeys.length

  if (pos >= 0) {
    for (let i = pos + 1; i < sourceKeys.length; i++) {
      const idx = targetKeys.indexOf(sourceKeys[i])
      if (idx !== -1) {
        insertAt = idx
        break
      }
    }
    if (insertAt === targetKeys.length) {
      for (let i = pos - 1; i >= 0; i--) {
        const idx = targetKeys.indexOf(sourceKeys[i])
        if (idx !== -1) {
          insertAt = idx + 1
          break
        }
      }
    }
  }

  const next: Record<string, unknown> = {}
  let placed = false
  for (let i = 0; i < targetKeys.length; i++) {
    if (i === insertAt) {
      next[key] = value
      placed = true
    }
    next[targetKeys[i]] = target[targetKeys[i]]
  }
  if (!placed) next[key] = value

  for (const existing of targetKeys) delete target[existing]
  Object.assign(target, next)
}

function insertAt(
  target: unknown,
  source: unknown,
  kind: DiffChange['container'],
  key: string | number,
  value: unknown,
) {
  if (kind === 'array' && Array.isArray(target) && typeof key === 'number') {
    const index = Math.max(0, Math.min(key, target.length))
    target.splice(index, 0, value)
    return
  }
  if (kind === 'object' && isObject(target) && isObject(source)) {
    insertObjectKey(target, source, String(key), value)
  }
}

function writeSide(targetRoot: unknown, sourceRoot: unknown, change: DiffChange, targetSide: 'left' | 'right') {
  const sourceSide = targetSide === 'left' ? 'right' : 'left'
  const targetParent = valueAt(targetRoot, parentSegments(change, targetSide))
  const sourceParent = valueAt(sourceRoot, parentSegments(change, sourceSide))
  if (!matchesContainer(targetParent, change.container) || !matchesContainer(sourceParent, change.container)) return

  const sourceKey = sideKey(change, sourceSide)
  const targetKey = sideKey(change, targetSide)

  if (
    change.kind === 'moved' &&
    change.container === 'array' &&
    typeof sourceKey === 'number' &&
    typeof targetKey === 'number' &&
    Array.isArray(targetParent) &&
    Array.isArray(sourceParent)
  ) {
    const value = cloneJson(sourceParent[sourceKey])
    targetParent.splice(targetKey, 1)
    targetParent.splice(Math.min(sourceKey, targetParent.length), 0, value)
    return
  }

  const deleting =
    (change.kind === 'removed' && targetSide === 'left') || (change.kind === 'added' && targetSide === 'right')
  if (deleting) {
    removeAt(targetParent, change.container, targetKey)
    return
  }

  if (sourceKey === undefined) return
  const value = cloneJson((sourceParent as Record<string, unknown>)[sourceKey as string])
  if (targetKey === undefined) {
    insertAt(targetParent, sourceParent, change.container, sourceKey, value)
    return
  }
  ;(targetParent as Record<string, unknown>)[targetKey as string] = value
}

/** Copy one compared value from one document onto the other. */
export function copyChange(
  left: unknown,
  right: unknown,
  change: DiffChange,
  direction: CopyDirection,
): { left: unknown; right: unknown } {
  const nextLeft = cloneJson(left)
  const nextRight = cloneJson(right)
  if (direction === 'to-left') writeSide(nextLeft, right, change, 'left')
  else writeSide(nextRight, left, change, 'right')
  return { left: nextLeft, right: nextRight }
}
