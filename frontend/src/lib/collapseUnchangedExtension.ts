import { RangeSetBuilder, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { foldKey, type UnchangedFold } from './collapseUnchanged'

class UnchangedCollapseWidget extends WidgetType {
  count: number
  id: string
  onExpand: (id: string) => void

  constructor(count: number, id: string, onExpand: (id: string) => void) {
    super()
    this.count = count
    this.id = id
    this.onExpand = onExpand
  }

  eq(other: WidgetType) {
    return other instanceof UnchangedCollapseWidget && this.count === other.count && this.id === other.id
  }

  toDOM() {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-collapse-unchanged'
    button.textContent = `⋯ ${this.count} unchanged lines`
    button.title = 'Show unchanged lines'
    button.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.onExpand(this.id)
    })
    return button
  }

  ignoreEvent() {
    return false
  }

  get estimatedHeight() {
    return 24
  }
}

function foldDecorations(state: EditorState, folds: UnchangedFold[], onExpand: (id: string) => void) {
  const builder = new RangeSetBuilder<Decoration>()
  const sorted = [...folds].sort((a, b) => a.start - b.start || a.end - b.end)
  for (const fold of sorted) {
    if (fold.start < 0 || fold.end < fold.start || fold.end >= state.doc.lines) continue
    const from = state.doc.line(fold.start + 1).from
    const to = fold.end + 1 < state.doc.lines ? state.doc.line(fold.end + 2).from : state.doc.line(fold.end + 1).to
    if (to <= from) continue
    builder.add(
      from,
      to,
      Decoration.replace({
        widget: new UnchangedCollapseWidget(fold.end - fold.start + 1, foldKey(fold), onExpand),
        block: true,
      }),
    )
  }
  return builder.finish()
}

export function collapseUnchangedExtension(
  folds: UnchangedFold[],
  onExpand: (id: string) => void,
): Extension {
  if (folds.length === 0) return []

  return StateField.define<DecorationSet>({
    create(state) {
      return foldDecorations(state, folds, onExpand)
    },
    update(deco, tr) {
      if (!tr.docChanged) return deco
      return foldDecorations(tr.state, folds, onExpand)
    },
    provide: (f) => EditorView.decorations.from(f),
  })
}
