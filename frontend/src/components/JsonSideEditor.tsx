import { useRef, useState, type DragEvent, type Ref } from 'react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
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
  editorRef: Ref<ReactCodeMirrorRef>
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
  editorRef,
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text-muted)]">{label}</span>
        <div className="flex items-center gap-1.5">
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
          <button
            type="button"
            className={TOOL_BTN}
            onClick={handleFormat}
            aria-label={`Format ${label}`}
          >
            Format
          </button>
          <CopyButton text={copyText} />
        </div>
      </div>
      <div
        role="group"
        aria-label={`${label} editor. Drop a JSON file here.`}
        onDragEnter={handleDragEnter}
        onDragOverCapture={handleDragOver}
        onDragLeave={handleDragLeave}
        onDropCapture={handleDrop}
        className={`relative overflow-hidden rounded-lg border transition ${
          dragOver
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]'
            : 'border-[var(--border)]'
        }`}
      >
        <JsonEditor
          ref={editorRef}
          value={value}
          onChange={onChange}
          theme={theme}
          highlightLines={highlightLines}
          currentHunk={currentHunk}
        />
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--accent-soft)] text-sm font-medium text-[var(--accent)]">
            Drop JSON file
          </div>
        )}
      </div>
    </div>
  )
}
