import { forwardRef, useMemo } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import type { UnchangedFold } from '../lib/collapseUnchanged'
import { collapseUnchangedExtension } from '../lib/collapseUnchangedExtension'
import type { DiffHunk } from '../lib/diffHunks'
import type { DiffChange, DiffLine } from '../lib/lineDiff'
import { lineHighlightExtension, type LineCopyGutter } from '../lib/lineHighlightExtension'

interface JsonEditorProps {
  value: string
  onChange?: (value: string) => void
  theme: 'light' | 'dark'
  placeholder?: string
  readOnly?: boolean
  highlightLines?: DiffLine[]
  currentHunk?: DiffHunk | null
  collapsedFolds?: UnchangedFold[]
  onExpandFold?: (id: string) => void
  copySide?: LineCopyGutter['side']
  copyChanges?: DiffChange[]
  onCopyChange?: (changeIndex: number) => void
}

const baseTheme = EditorView.theme({
  '&': {
    fontSize: '12.5px',
    backgroundColor: 'var(--editor-bg)',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    caretColor: 'var(--text)',
  },
  '.cm-scroller': { overflow: 'auto', overflowAnchor: 'none' },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-gutter)',
    color: 'var(--text-muted)',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
})

export const JsonEditor = forwardRef<ReactCodeMirrorRef, JsonEditorProps>(function JsonEditor(
  {
    value,
    onChange,
    theme,
    placeholder,
    readOnly,
    highlightLines,
    currentHunk,
    collapsedFolds,
    onExpandFold,
    copySide,
    copyChanges,
    onCopyChange,
  },
  ref,
) {
  const extensions = useMemo(() => {
    const ext = [json(), linter(jsonParseLinter()), lintGutter(), baseTheme]
    if (highlightLines) {
      const copy =
        copySide && copyChanges && onCopyChange
          ? { side: copySide, changes: copyChanges, onCopy: onCopyChange }
          : null
      ext.push(lineHighlightExtension(highlightLines, currentHunk, copy))
    }
    if (highlightLines && collapsedFolds?.length && onExpandFold) {
      ext.push(collapseUnchangedExtension(collapsedFolds, onExpandFold))
    }
    return ext
  }, [highlightLines, currentHunk, collapsedFolds, onExpandFold, copySide, copyChanges, onCopyChange])

  return (
    <CodeMirror
      ref={ref}
      value={value}
      onChange={onChange}
      theme={theme}
      placeholder={placeholder}
      readOnly={readOnly}
      height="100%"
      extensions={extensions}
      basicSetup={{
        foldGutter: true,
        lintKeymap: true,
      }}
    />
  )
})
