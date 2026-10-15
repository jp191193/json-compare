import { isChangeRow } from './diffHunks'
import type { DiffLine } from './lineDiff'

export interface UnchangedFold {
  /** Inclusive 0-based line index of the first hidden row. */
  start: number
  /** Inclusive 0-based line index of the last hidden row. */
  end: number
}

export const COLLAPSE_CONTEXT = 2
export const COLLAPSE_MIN_LINES = 4

export function foldKey(fold: UnchangedFold): string {
  return `${fold.start}:${fold.end}`
}

/**
 * Long runs of unchanged (or placeholder) rows, leaving `context` visible
 * lines next to each change. Identical payloads yield no folds.
 */
export function findUnchangedFolds(
  leftLines: DiffLine[],
  rightLines: DiffLine[],
  context = COLLAPSE_CONTEXT,
  minLines = COLLAPSE_MIN_LINES,
): UnchangedFold[] {
  const len = Math.max(leftLines.length, rightLines.length)
  if (len === 0) return []

  let hasChange = false
  for (let i = 0; i < len; i++) {
    if (isChangeRow(leftLines[i], rightLines[i])) {
      hasChange = true
      break
    }
  }
  if (!hasChange) return []

  const folds: UnchangedFold[] = []
  let i = 0
  while (i < len) {
    if (isChangeRow(leftLines[i], rightLines[i])) {
      i++
      continue
    }
    const runStart = i
    i++
    while (i < len && !isChangeRow(leftLines[i], rightLines[i])) i++
    const runEnd = i

    let foldStart = runStart
    let foldEnd = runEnd
    if (runStart > 0) foldStart += context
    if (runEnd < len) foldEnd -= context

    if (foldEnd - foldStart >= minLines) {
      folds.push({ start: foldStart, end: foldEnd - 1 })
    }
  }
  return folds
}

export function lineRangeOffsets(lines: DiffLine[], start: number, end: number): { from: number; to: number } | null {
  if (start < 0 || end < start || end >= lines.length) return null
  let from = 0
  for (let i = 0; i < start; i++) from += lines[i].text.length + 1
  let to = from
  for (let i = start; i <= end; i++) {
    to += lines[i].text.length
    if (i < lines.length - 1) to += 1
  }
  if (to <= from) return null
  return { from, to }
}
