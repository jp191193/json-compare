import { Prec, RangeSetBuilder, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, gutter, GutterMarker, type DecorationSet } from '@codemirror/view'
import type { DiffHunk } from './diffHunks'
import type { DiffChange, DiffLine } from './lineDiff'

export interface LineCopyGutter {
  side: 'left' | 'right'
  changes: DiffChange[]
  onCopy: (changeIndex: number) => void
}

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

function changeStartLines(changes: DiffChange[]): Map<number, number> {
  const byLine = new Map<number, number>()
  changes.forEach((change, index) => {
    const previous = byLine.get(change.start)
    if (previous === undefined || change.end - change.start <= changes[previous].end - changes[previous].start) {
      byLine.set(change.start, index)
    }
  })
  return byLine
}

function copyGutter(copy: LineCopyGutter): Extension {
  const byLine = changeStartLines(copy.changes)
  const glyph = copy.side === 'left' ? '→' : '←'
  const title = copy.side === 'left' ? 'Move this change to the right' : 'Move this change to the left'

  class CopyArrow extends GutterMarker {
    changeIndex: number

    constructor(changeIndex: number) {
      super()
      this.changeIndex = changeIndex
    }

    eq(other: GutterMarker) {
      return other instanceof CopyArrow && this.changeIndex === other.changeIndex
    }

    toDOM() {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'cm-copy-arrow'
      button.textContent = glyph
      button.title = title
      button.setAttribute('aria-label', title)
      const changeIndex = this.changeIndex
      button.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation()
      })
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        copy.onCopy(changeIndex)
      })
      return button
    }
  }

  class CopySpacer extends GutterMarker {
    toDOM() {
      const span = document.createElement('span')
      span.className = 'cm-copy-arrow'
      span.textContent = glyph
      return span
    }
  }

  const extension = gutter({
    class: 'cm-copy-gutter',
    side: copy.side === 'left' ? 'after' : 'before',
    lineMarker(view, line) {
      const index = view.state.doc.lineAt(line.from).number - 1
      const changeIndex = byLine.get(index)
      if (changeIndex === undefined) return null
      return new CopyArrow(changeIndex)
    },
    initialSpacer: () => new CopySpacer(),
  })
  // Keep the left-pointing arrow on the outer edge of the right editor, next to the other file.
  return copy.side === 'right' ? Prec.highest(extension) : extension
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

export function lineHighlightExtension(
  lines: DiffLine[],
  currentHunk?: DiffHunk | null,
  copy?: LineCopyGutter | null,
): Extension {
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
  const extensions: Extension[] = [field, diffGutter(lines)]
  if (copy && copy.changes.length > 0) extensions.push(copyGutter(copy))
  return extensions
}
