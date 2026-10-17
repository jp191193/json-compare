import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EditorView } from '@codemirror/view'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { ApiError, exportShareUrl, getShare } from '../lib/api'
import type { ShareRecord } from '../lib/types'
import { buildLineDiff, countChangeKinds, formatChangeList } from '../lib/lineDiff'
import { useUnchangedCollapse } from '../lib/useUnchangedCollapse'
import { useSyncedScroll } from '../lib/useSyncedScroll'
import { JsonSideEditor } from '../components/JsonSideEditor'
import { ChangesPanel } from '../components/ChangesPanel'
import { ResultsBar } from '../components/ResultsBar'
import { CopyButton } from '../components/CopyButton'

interface SharePageProps {
  theme: 'light' | 'dark'
}

export function SharePage({ theme }: SharePageProps) {
  const { id = '' } = useParams()
  const [record, setRecord] = useState<ShareRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChange, setSelectedChange] = useState<number | null>(null)
  const [copiedChanges, setCopiedChanges] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getShare(id)
      .then((res) => {
        if (!cancelled) setRecord(res)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.message : 'Failed to load share.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const built = useMemo(() => {
    if (!record) return null
    return buildLineDiff(record.left, record.right, record.delta.delta)
  }, [record])

  const leftEditorRef = useRef<ReactCodeMirrorRef>(null)
  const rightEditorRef = useRef<ReactCodeMirrorRef>(null)
  useSyncedScroll(leftEditorRef, rightEditorRef, Boolean(built))
  const collapse = useUnchangedCollapse(built?.left.lines, built?.right.lines)

  const counts = useMemo(() => countChangeKinds(built?.changes ?? []), [built])

  useEffect(() => {
    setSelectedChange(built && built.changes.length > 0 ? 0 : null)
  }, [built])

  function scrollToChange(index: number) {
    const change = built?.changes[index]
    if (!change) return
    setSelectedChange(index)
    requestAnimationFrame(() => {
      for (const ref of [leftEditorRef.current, rightEditorRef.current]) {
        const view = ref?.view
        if (!view) continue
        const docLine = Math.min(Math.max(change.start + 1, 1), view.state.doc.lines)
        const line = view.state.doc.line(docLine)
        view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) })
      }
    })
  }

  const leftCopyText = useMemo(
    () => (built ? built.left.lines.filter((l) => l.status !== 'placeholder').map((l) => l.text).join('\n') : ''),
    [built],
  )
  const rightCopyText = useMemo(
    () => (built ? built.right.lines.filter((l) => l.status !== 'placeholder').map((l) => l.text).join('\n') : ''),
    [built],
  )

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-[var(--text-muted)]">Loading share…</div>
  }

  if (error || !record || !built) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-lg border border-[var(--removed-fg)]/30 bg-[var(--removed-bg)] px-4 py-3 text-sm text-[var(--removed-fg)]">
          {error ?? 'Share not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold">Shared diff — {record.id}</h1>
          <span className="text-xs text-[var(--text-muted)]">
            Created {new Date(record.createdAt).toLocaleString()} · Expires{' '}
            {new Date(record.expiresAt).toLocaleString()}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {collapse.canCollapse && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={collapse.enabled}
                onChange={(e) => collapse.setEnabled(e.target.checked)}
              />
              Collapse unchanged
            </label>
          )}
          <CopyButton text={window.location.href} label="Copy link" />
          <a
            href={exportShareUrl(record.id, 'text')}
            className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
          >
            Export text
          </a>
        </div>
      </div>

      <ResultsBar
        compared
        total={built.changes.length}
        added={counts.added}
        removed={counts.removed}
        modified={counts.modified}
        typeChanged={counts.type}
        moved={counts.moved}
        index={selectedChange}
        onPrev={() => scrollToChange(selectedChange === null || selectedChange === 0 ? built.changes.length - 1 : selectedChange - 1)}
        onNext={() => scrollToChange(selectedChange === null ? 0 : (selectedChange + 1) % Math.max(built.changes.length, 1))}
        onExport={() => {
          window.location.href = exportShareUrl(record.id, 'json')
        }}
        onCopy={() => {
          void navigator.clipboard.writeText(formatChangeList(built.changes)).then(() => {
            setCopiedChanges(true)
            window.setTimeout(() => setCopiedChanges(false), 1500)
          })
        }}
        copyLabel={copiedChanges ? 'Copied' : 'Copy…'}
      />

      {!record.delta.modified && (
        <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-center text-sm text-[var(--text-muted)]">
          No differences — both sides are identical.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:h-[calc(100vh-11.5rem)] xl:min-h-[560px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
        <JsonSideEditor
          side="Left"
          value={built.left.text}
          copyText={leftCopyText}
          onChange={() => {}}
          onError={() => {}}
          theme={theme}
          readOnly
          highlightLines={built.left.lines}
          currentHunk={
            selectedChange !== null && built.changes[selectedChange]
              ? { start: built.changes[selectedChange].start, end: built.changes[selectedChange].end }
              : null
          }
          collapsedFolds={collapse.visibleFolds}
          onExpandFold={collapse.expandFold}
          editorRef={leftEditorRef}
        />
        <JsonSideEditor
          side="Right"
          value={built.right.text}
          copyText={rightCopyText}
          onChange={() => {}}
          onError={() => {}}
          theme={theme}
          readOnly
          highlightLines={built.right.lines}
          currentHunk={
            selectedChange !== null && built.changes[selectedChange]
              ? { start: built.changes[selectedChange].start, end: built.changes[selectedChange].end }
              : null
          }
          collapsedFolds={collapse.visibleFolds}
          onExpandFold={collapse.expandFold}
          editorRef={rightEditorRef}
        />
        <ChangesPanel changes={built.changes} selectedIndex={selectedChange} onSelect={scrollToChange} />
      </div>
    </div>
  )
}
