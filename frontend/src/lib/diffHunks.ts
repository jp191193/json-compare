import type { DiffLine } from './lineDiff'

export interface DiffHunk {
  /** Inclusive 0-based line index of the first changed row. */
  start: number
  /** Inclusive 0-based line index of the last changed row. */
  end: number
}

function isContentChange(line: DiffLine | undefined): boolean {
  return Boolean(line && line.status !== 'unchanged' && line.status !== 'placeholder')
}

/** A row is a change if either pane has a real (non-placeholder) difference. */
export function isChangeRow(left: DiffLine | undefined, right: DiffLine | undefined): boolean {
  return isContentChange(left) || isContentChange(right)
}

/** Contiguous runs of change rows — one navigation stop per hunk. */
export function findDiffHunks(leftLines: DiffLine[], rightLines: DiffLine[]): DiffHunk[] {
  const len = Math.max(leftLines.length, rightLines.length)
  const hunks: DiffHunk[] = []
  let i = 0
  while (i < len) {
    if (!isChangeRow(leftLines[i], rightLines[i])) {
      i++
      continue
    }
    const start = i
    i++
    while (i < len && isChangeRow(leftLines[i], rightLines[i])) i++
    hunks.push({ start, end: i - 1 })
  }
  return hunks
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('.cm-editor, [contenteditable="true"]')) return true
  return target.closest('input, textarea, select') !== null
}
