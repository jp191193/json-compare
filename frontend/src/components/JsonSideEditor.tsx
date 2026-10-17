import { useRef, useState, type DragEvent, type Ref } from 'react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import type { UnchangedFold } from '../lib/collapseUnchanged'
import type { DiffHunk } from '../lib/diffHunks'
import type { DiffLine } from '../lib/lineDiff'
import { readJsonFile, type JsonSide } from '../lib/readJsonFile'
import { CopyButton } from './CopyButton'
import { JsonEditor } from './JsonEditor'

const TOOL_BTN =
  'rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]'

interface JsonSideEditorProps {
  side: JsonSide
  value: string
  copyText: string
  onChange: (value: string) => void
  onError: (message: string | null) => void
  theme: 'light' | 'dark'
  highlightLines?: DiffLine[]
  currentHunk?: DiffHunk | null
  collapsedFolds?: UnchangedFold[]
  onExpandFold?: (id: string) => void
  editorRef: Ref<ReactCodeMirrorRef>
  readOnly?: boolean
}

export function JsonSideEditor({
  side,
  value,
  copyText,
  onChange,
  onError,
  theme,
  highlightLines,
  currentHunk,
  collapsedFolds,
  onExpandFold,
  editorRef,
  readOnly,
}: JsonSideEditorProps) {
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const label = `${side} JSON`
  const fileInputId = `open-${side.toLowerCase()}-json-file`

  async function applyFile(file: File) {
    const result = await readJsonFile(file, side)
    if (result.status === 'reject') {
      onError(result.error)
      return
    }
    onChange(result.text)
    onError(result.status === 'invalid' ? result.error : null)
  }

  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function hasFiles(e: DragEvent) {
    return Array.from(e.dataTransfer.types).includes('Files')
  }

  function handleDragEnter(e: DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current += 1
    setDragOver(true)
  }

  function handleDragOver(e: DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(e: DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragOver(false)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = 0
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void applyFile(file)
  }

  function handleFormat() {
    try {
      const formatted = JSON.stringify(JSON.parse(value), null, 2)
      onChange(formatted)
      onError(null)
    } catch {
      onError(`${side} JSON is invalid — fix the highlighted error before comparing.`)
    }
  }

  return (
    <div
      role="group"
      aria-label={`${label} editor. Drop a JSON file here.`}
      onDragEnter={readOnly ? undefined : handleDragEnter}
      onDragOverCapture={readOnly ? undefined : handleDragOver}
      onDragLeave={readOnly ? undefined : handleDragLeave}
      onDropCapture={readOnly ? undefined : handleDrop}
      className={`flex h-[min(68vh,760px)] min-h-[420px] flex-col overflow-hidden rounded-lg border bg-[var(--editor-bg)] transition xl:h-full xl:min-h-0 ${
        dragOver ? 'border-[var(--select)] ring-2 ring-[var(--select)]' : 'border-[var(--border)]'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-[var(--text)]">{side}</span>
        <div className="flex items-center gap-1.5">
          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label={`Open ${label} file`}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  resetFileInput()
                  if (file) void applyFile(file)
                }}
              />
              <button
                type="button"
                className={TOOL_BTN}
                onClick={() => fileInputRef.current?.click()}
                aria-controls={fileInputId}
              >
                Open file
              </button>
              <button type="button" className={TOOL_BTN} onClick={handleFormat} aria-label={`Format ${label}`}>
                Format
              </button>
            </>
          )}
          <CopyButton text={copyText} />
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
        <JsonEditor
          ref={editorRef}
          value={value}
          onChange={readOnly ? undefined : onChange}
          theme={theme}
          readOnly={readOnly}
          highlightLines={highlightLines}
          currentHunk={currentHunk}
          collapsedFolds={collapsedFolds}
          onExpandFold={onExpandFold}
        />
        </div>
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--accent-soft)] text-sm font-medium text-[var(--accent)]">
            Drop JSON file
          </div>
        )}
      </div>
    </div>
  )
}
