import { RangeSetBuilder, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, gutter, GutterMarker, type DecorationSet } from '@codemirror/view'
import type { DiffHunk } from './diffHunks'
import type { DiffLine } from './lineDiff'

const CLASS_BY_STATUS: Partial<Record<DiffLine['status'], string>> = {
  added: 'cm-line-added',
  removed: 'cm-line-removed',
  modified: 'cm-line-modified',
  type: 'cm-line-type',
  moved: 'cm-line-moved',
  placeholder: 'cm-line-placeholder',
}

const MARK: Partial<Record<DiffLine['status'], string>> = {
  added: '+',
  removed: '−',
  modified: '~',
  type: '≠',
  moved: '↔',
}

class DiffMark extends GutterMarker {
  status: string

  constructor(status: string) {
    super()
    this.status = status
  }

  eq(other: GutterMarker) {
    return other instanceof DiffMark && this.status === other.status
  }

  toDOM() {
    const el = document.createElement('span')
    el.className = `cm-diff-mark cm-diff-mark-${this.status}`
    el.textContent = MARK[this.status as DiffLine['status']] ?? ''
    return el
  }
}

function diffGutter(lines: DiffLine[]): Extension {
  return gutter({
    class: 'cm-diff-gutter',
    lineMarker(view, line) {
      const index = view.state.doc.lineAt(line.from).number - 1
      const status = lines[index]?.status
      if (!status || !MARK[status]) return null
      return new DiffMark(status)
    },
    initialSpacer: () => new DiffMark('modified'),
  })
}

function lineDecorations(viewDocLines: number, docLineFrom: (lineNo: number) => number, lines: DiffLine[], currentHunk?: DiffHunk | null) {
  const builder = new RangeSetBuilder<Decoration>()
  const count = Math.min(lines.length, viewDocLines)
  for (let i = 0; i < count; i++) {
    const line = lines[i]
    const statusClass = CLASS_BY_STATUS[line.status] ?? ''
    const inHunk = currentHunk && i >= currentHunk.start && i <= currentHunk.end
    const className = [statusClass, inHunk ? 'cm-line-current-hunk' : ''].filter(Boolean).join(' ')
    if (!className) continue
    const pos = docLineFrom(i + 1)
    builder.add(pos, pos, Decoration.line({ class: className }))
  }
  return builder.finish()
}

export function lineHighlightExtension(lines: DiffLine[], currentHunk?: DiffHunk | null): Extension {
  const field = StateField.define<DecorationSet>({
    create(state) {
      return lineDecorations(state.doc.lines, (n) => state.doc.line(n).from, lines, currentHunk)
    },
    update(deco, tr) {
      if (!tr.docChanged) return deco
      return lineDecorations(tr.state.doc.lines, (n) => tr.state.doc.line(n).from, lines, currentHunk)
    },
    provide: (f) => EditorView.decorations.from(f),
  })
  return [field, diffGutter(lines)]
}
