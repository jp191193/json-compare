import { forwardRef, useMemo } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import type { DiffLine } from '../lib/lineDiff'
import { lineHighlightExtension } from '../lib/lineHighlightExtension'

interface JsonEditorProps {
  value: string
  onChange?: (value: string) => void
  theme: 'light' | 'dark'
  placeholder?: string
  readOnly?: boolean
  highlightLines?: DiffLine[]
}

const baseTheme = EditorView.theme({
  '&': { fontSize: '13px' },
  '.cm-content': { fontFamily: 'ui-monospace, SF Mono, Menlo, Consolas, monospace' },
  '.cm-scroller': { overflow: 'auto' },
})

export const JsonEditor = forwardRef<ReactCodeMirrorRef, JsonEditorProps>(function JsonEditor(
  { value, onChange, theme, placeholder, readOnly, highlightLines },
  ref,
) {
  const extensions = useMemo(() => {
    const ext = [json(), linter(jsonParseLinter()), lintGutter(), baseTheme]
    if (highlightLines) ext.push(lineHighlightExtension(highlightLines))
    return ext
  }, [highlightLines])

  return (
    <CodeMirror
      ref={ref}
      value={value}
      onChange={onChange}
      theme={theme}
      placeholder={placeholder}
      readOnly={readOnly}
      height="320px"
      extensions={extensions}
      basicSetup={{
        foldGutter: true,
        lintKeymap: true,
      }}
    />
  )
})
