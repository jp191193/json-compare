import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import type { DiffHunk } from './diffHunks'
import type { DiffLine } from './lineDiff'

const CLASS_BY_STATUS: Partial<Record<DiffLine['status'], string>> = {
  added: 'cm-line-added',
  removed: 'cm-line-removed',
  modified: 'cm-line-modified',
  moved: 'cm-line-moved',
  placeholder: 'cm-line-placeholder',
}

export function lineHighlightExtension(lines: DiffLine[], currentHunk?: DiffHunk | null): Extension {
  const builder = new RangeSetBuilder<Decoration>()
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const statusClass = CLASS_BY_STATUS[line.status] ?? ''
    const inHunk = currentHunk && i >= currentHunk.start && i <= currentHunk.end
    const className = [statusClass, inHunk ? 'cm-line-current-hunk' : ''].filter(Boolean).join(' ')
    if (className) {
      builder.add(offset, offset, Decoration.line({ class: className }))
    }
    offset += line.text.length + 1 // +1 for the joining newline
  }
  return EditorView.decorations.of(builder.finish())
}
