import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { ApiError, exportShareUrl, getShare } from '../lib/api'
import type { ShareRecord } from '../lib/types'
import { buildLineDiff } from '../lib/lineDiff'
import { useSyncedScroll } from '../lib/useSyncedScroll'
import { JsonEditor } from '../components/JsonEditor'
import { StatsBadges } from '../components/StatsBadges'
import { CopyButton } from '../components/CopyButton'

interface SharePageProps {
  theme: 'light' | 'dark'
}

export function SharePage({ theme }: SharePageProps) {
  const { id = '' } = useParams()
  const [record, setRecord] = useState<ShareRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold">Shared diff — {record.id}</h1>
          <span className="text-xs text-[var(--text-muted)]">
            Created {new Date(record.createdAt).toLocaleString()} · Expires{' '}
            {new Date(record.expiresAt).toLocaleString()}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatsBadges stats={record.delta.stats} />
          <CopyButton text={window.location.href} label="Copy link" />
          <a
            href={exportShareUrl(record.id, 'json')}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-2)]"
          >
            Export JSON
          </a>
          <a
            href={exportShareUrl(record.id, 'text')}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-2)]"
          >
            Export text
          </a>
        </div>
      </div>

      {!record.delta.modified && (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-center text-sm text-[var(--text-muted)]">
          No differences — both sides are identical.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-muted)]">Left JSON</label>
            <CopyButton text={leftCopyText} />
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <JsonEditor
              ref={leftEditorRef}
              value={built.left.text}
              theme={theme}
              readOnly
              highlightLines={built.left.lines}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-muted)]">Right JSON</label>
            <CopyButton text={rightCopyText} />
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <JsonEditor
              ref={rightEditorRef}
              value={built.right.text}
              theme={theme}
              readOnly
              highlightLines={built.right.lines}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
