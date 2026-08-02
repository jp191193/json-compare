import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { ApiError, createShare, postDiff } from '../lib/api'
import type { DiffResult } from '../lib/types'
import { buildLineDiff, type DiffLine } from '../lib/lineDiff'
import { parseIgnoreKeys, stripIgnoredKeys, findIgnoredKeysPresent } from '../lib/ignoreKeys'
import { useSyncedScroll } from '../lib/useSyncedScroll'
import { JsonEditor } from '../components/JsonEditor'
import { StatsBadges } from '../components/StatsBadges'
import { CopyButton } from '../components/CopyButton'

const SAMPLE_LEFT = `{
  "name": "Alice",
  "age": 30,
  "active": true
}`

const SAMPLE_RIGHT = `{
  "name": "Alice",
  "age": 31,
  "role": "admin"
}`

interface ComparePageProps {
  theme: 'light' | 'dark'
}

function cleanText(text: string, lines: DiffLine[] | undefined): string {
  if (!lines) return text
  return lines
    .filter((l) => l.status !== 'placeholder')
    .map((l) => l.text)
    .join('\n')
}

export function ComparePage({ theme }: ComparePageProps) {
  const [left, setLeft] = useState(SAMPLE_LEFT)
  const [right, setRight] = useState(SAMPLE_RIGHT)
  const [leftLines, setLeftLines] = useState<DiffLine[] | undefined>(undefined)
  const [rightLines, setRightLines] = useState<DiffLine[] | undefined>(undefined)
  const [result, setResult] = useState<DiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [ttlHours, setTtlHours] = useState('24')
  const [share, setShare] = useState<{ id: string; url: string; expiresAt: string } | null>(null)
  const [sharing, setSharing] = useState(false)

  const [ignoreKeysInput, setIgnoreKeysInput] = useState(() => localStorage.getItem('ignoreKeys') ?? '')
  const [strippedFound, setStrippedFound] = useState<string[]>([])

  useEffect(() => {
    localStorage.setItem('ignoreKeys', ignoreKeysInput)
  }, [ignoreKeysInput])

  const leftEditorRef = useRef<ReactCodeMirrorRef>(null)
  const rightEditorRef = useRef<ReactCodeMirrorRef>(null)
  useSyncedScroll(leftEditorRef, rightEditorRef, Boolean(leftLines && rightLines))

  const leftCopyText = useMemo(() => cleanText(left, leftLines), [left, leftLines])
  const rightCopyText = useMemo(() => cleanText(right, rightLines), [right, rightLines])

  function clearDiff() {
    setResult(null)
    setLeftLines(undefined)
    setRightLines(undefined)
    setStrippedFound([])
  }

  function handleLeftChange(value: string) {
    setLeft(value)
    if (result) clearDiff()
  }

  function handleRightChange(value: string) {
    setRight(value)
    if (result) clearDiff()
  }

  function handleIgnoreKeysChange(value: string) {
    setIgnoreKeysInput(value)
    if (result) clearDiff()
  }

  function parseInputs(): { l: unknown; r: unknown } | null {
    let l: unknown
    let r: unknown
    try {
      l = JSON.parse(left)
    } catch {
      setError('Left JSON is invalid — fix the highlighted error before comparing.')
      return null
    }
    try {
      r = JSON.parse(right)
    } catch {
      setError('Right JSON is invalid — fix the highlighted error before comparing.')
      return null
    }
    return { l, r }
  }

  async function handleCompare() {
    setError(null)
    setShare(null)
    const parsed = parseInputs()
    if (!parsed) return

    const ignoreSet = parseIgnoreKeys(ignoreKeysInput)
    const l = stripIgnoredKeys(parsed.l, ignoreSet)
    const r = stripIgnoredKeys(parsed.r, ignoreSet)

    setLoading(true)
    try {
      const res = await postDiff(l, r)
      // Build the displayed diff from the full (unstripped) values, not the
      // ignore-filtered ones sent to the backend — otherwise ignored keys are
      // permanently deleted from the editors instead of just excluded from
      // the comparison, and un-ignoring them later has nothing left to show.
      // Since the backend never saw an ignored key, `res.delta` has no entry
      // for it, so it naturally renders as a plain unchanged line here.
      const built = buildLineDiff(parsed.l, parsed.r, res.delta)
      setResult(res)
      setLeft(built.left.text)
      setRight(built.right.text)
      setLeftLines(built.left.lines)
      setRightLines(built.right.lines)
      setStrippedFound([
        ...new Set([...findIgnoredKeysPresent(parsed.l, ignoreSet), ...findIgnoredKeysPresent(parsed.r, ignoreSet)]),
      ])
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.side ? `${e.message} (${e.side} side)` : e.message)
      } else {
        setError('Something went wrong while comparing.')
      }
      clearDiff()
    } finally {
      setLoading(false)
    }
  }

  async function handleShare() {
    setError(null)
    const parsed = parseInputs()
    if (!parsed) return

    const hours = ttlHours.trim() ? Number(ttlHours) : undefined
    if (hours !== undefined && (!Number.isFinite(hours) || hours <= 0)) {
      setError('TTL hours must be a positive number.')
      return
    }

    const ignoreSet = parseIgnoreKeys(ignoreKeysInput)
    const l = stripIgnoredKeys(parsed.l, ignoreSet)
    const r = stripIgnoredKeys(parsed.r, ignoreSet)

    setSharing(true)
    try {
      const res = await createShare(l, r, hours)
      setShare(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create share link.')
    } finally {
      setSharing(false)
    }
  }

  function shareLink() {
    if (!share) return ''
    return `${window.location.origin}/share/${share.id}`
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--text-muted)]">Left JSON</label>
            <CopyButton text={leftCopyText} />
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <JsonEditor
              ref={leftEditorRef}
              value={left}
              onChange={handleLeftChange}
              theme={theme}
              highlightLines={leftLines}
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
              value={right}
              onChange={handleRightChange}
              theme={theme}
              highlightLines={rightLines}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCompare}
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Comparing…' : 'Compare'}
        </button>

        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>Share TTL (hours)</span>
          <input
            type="number"
            min={1}
            value={ttlHours}
            onChange={(e) => setTtlHours(e.target.value)}
            className="w-20 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>Ignore keys</span>
          <input
            type="text"
            placeholder="updatedAt, requestId, _id"
            value={ignoreKeysInput}
            onChange={(e) => handleIgnoreKeysChange(e.target.value)}
            title="Comma-separated key names, matched at any nesting depth. Matching keys are removed entirely before comparing or sharing — they will not appear in the JSON below after Compare."
            className="w-56 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
          />
        </div>

        <button
          onClick={handleShare}
          disabled={sharing}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-semibold transition hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          {sharing ? 'Creating link…' : 'Create share link'}
        </button>

        {result && (
          <StatsBadges stats={result.stats} />
        )}
      </div>

      {strippedFound.length > 0 && (
        <div className="text-xs text-[var(--text-muted)]">
          Stripped from comparison: {strippedFound.join(', ')}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--removed-fg)]/30 bg-[var(--removed-bg)] px-4 py-3 text-sm text-[var(--removed-fg)]">
          {error}
        </div>
      )}

      {result && !result.modified && (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-center text-sm text-[var(--text-muted)]">
          No differences — both sides are identical.
        </div>
      )}

      {share && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Share link ready</span>
            <a href={shareLink()} className="text-sm text-[var(--accent)] underline underline-offset-2">
              {shareLink()}
            </a>
            <span className="text-xs text-[var(--text-muted)]">
              Expires {new Date(share.expiresAt).toLocaleString()}
            </span>
          </div>
          <CopyButton text={shareLink()} label="Copy link" />
        </div>
      )}
    </div>
  )
}
