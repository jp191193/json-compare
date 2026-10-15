import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { foldKey, lineRangeOffsets, type UnchangedFold } from './collapseUnchanged'
import type { DiffLine } from './lineDiff'

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

export function collapseUnchangedExtension(
  lines: DiffLine[],
  folds: UnchangedFold[],
  onExpand: (id: string) => void,
): Extension {
  if (folds.length === 0) return []

  const builder = new RangeSetBuilder<Decoration>()
  for (const fold of folds) {
    const range = lineRangeOffsets(lines, fold.start, fold.end)
    if (!range) continue
    const count = fold.end - fold.start + 1
    builder.add(
      range.from,
      range.to,
      Decoration.replace({
        widget: new UnchangedCollapseWidget(count, foldKey(fold), onExpand),
        block: true,
      }),
    )
  }
  return EditorView.decorations.of(builder.finish())
}
