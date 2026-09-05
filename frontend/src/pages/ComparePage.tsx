import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import type { DiffResult } from '../lib/types'
import { buildLineDiff, type DiffLine } from '../lib/lineDiff'
import { parseIgnoreKeys, stripIgnoredKeys, findIgnoredKeysPresent } from '../lib/ignoreKeys'
import { ClientDiffError, compareJson } from '../lib/clientDiff'
import {
  HASH_SHARE_HARD_LIMIT,
  HASH_SHARE_SOFT_LIMIT,
  decodeHashShare,
  encodeHashShare,
} from '../lib/hashShare'
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

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function ComparePage({ theme }: ComparePageProps) {
  const [left, setLeft] = useState(SAMPLE_LEFT)
  const [right, setRight] = useState(SAMPLE_RIGHT)
  const [leftLines, setLeftLines] = useState<DiffLine[] | undefined>(undefined)
  const [rightLines, setRightLines] = useState<DiffLine[] | undefined>(undefined)
  const [result, setResult] = useState<DiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareWarning, setShareWarning] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const [ignoreKeysInput, setIgnoreKeysInput] = useState(() => localStorage.getItem('ignoreKeys') ?? '')
  const [strippedFound, setStrippedFound] = useState<string[]>([])

  const applyingHash = useRef(false)

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

  function clearHash() {
    if (applyingHash.current) return
    if (!window.location.hash) return
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }

  const applyCompare = useCallback((parsedLeft: unknown, parsedRight: unknown, ignoreInput: string) => {
    const ignoreSet = parseIgnoreKeys(ignoreInput)
    const l = stripIgnoredKeys(parsedLeft, ignoreSet)
    const r = stripIgnoredKeys(parsedRight, ignoreSet)
    const res = compareJson(l, r)
    const built = buildLineDiff(parsedLeft, parsedRight, res.delta)
    setResult(res)
    setLeft(built.left.text)
    setRight(built.right.text)
    setLeftLines(built.left.lines)
    setRightLines(built.right.lines)
    setStrippedFound([
      ...new Set([...findIgnoredKeysPresent(parsedLeft, ignoreSet), ...findIgnoredKeysPresent(parsedRight, ignoreSet)]),
    ])
    return res
  }, [])

  function handleLeftChange(value: string) {
    setLeft(value)
    if (result) clearDiff()
    setShareUrl(null)
    setShareWarning(null)
    clearHash()
  }

  function handleRightChange(value: string) {
    setRight(value)
    if (result) clearDiff()
    setShareUrl(null)
    setShareWarning(null)
    clearHash()
  }

  function handleIgnoreKeysChange(value: string) {
    setIgnoreKeysInput(value)
    if (result) clearDiff()
    setShareUrl(null)
    setShareWarning(null)
    clearHash()
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

  function handleCompare() {
    setError(null)
    setShareUrl(null)
    setShareWarning(null)
    const parsed = parseInputs()
    if (!parsed) return
    try {
      applyCompare(parsed.l, parsed.r, ignoreKeysInput)
    } catch (e) {
      if (e instanceof ClientDiffError) {
        setError(e.side ? `${e.message} (${e.side} side)` : e.message)
      } else {
        setError('Something went wrong while comparing.')
      }
      clearDiff()
    }
  }

  async function handleShare() {
    setError(null)
    setShareWarning(null)
    const parsed = parseInputs()
    if (!parsed) return

    setSharing(true)
    applyingHash.current = true
    try {
      try {
        applyCompare(parsed.l, parsed.r, ignoreKeysInput)
      } catch (e) {
        if (e instanceof ClientDiffError) {
          setError(e.side ? `${e.message} (${e.side} side)` : e.message)
        } else {
          setError('Fix the JSON before creating a share link.')
        }
        return
      }

      const encoded = await encodeHashShare({
        v: 1,
        left: parsed.l,
        right: parsed.r,
        ignoreKeys: ignoreKeysInput,
      })
      const next = `${window.location.pathname}${window.location.search}#${encoded}`
      const url = `${window.location.origin}${next}`
      if (url.length > HASH_SHARE_HARD_LIMIT) {
        setError('Payloads are too large for a URL share. Trim the JSON or compare without sharing.')
        return
      }
      history.replaceState(null, '', next)
      setShareUrl(url)
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // Clipboard can fail in some embedded browsers; the link is still shown.
      }
      if (url.length > HASH_SHARE_SOFT_LIMIT) {
        setShareWarning('This link is long — some chat apps may truncate it.')
      }
    } finally {
      applyingHash.current = false
      setSharing(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadFromHash() {
      const payload = await decodeHashShare(window.location.hash)
      if (!payload || cancelled) return
      applyingHash.current = true
      try {
        setError(null)
        setShareUrl(`${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`)
        setIgnoreKeysInput(payload.ignoreKeys ?? '')
        applyCompare(payload.left, payload.right, payload.ignoreKeys ?? '')
      } catch (e) {
        if (e instanceof ClientDiffError) {
          setLeft(pretty(payload.left))
          setRight(pretty(payload.right))
          setError(e.message)
        } else {
          setError('Could not restore this share link.')
        }
        clearDiff()
      } finally {
        applyingHash.current = false
      }
    }

    void loadFromHash()
    window.addEventListener('hashchange', loadFromHash)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', loadFromHash)
    }
  }, [applyCompare])

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
          className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:opacity-90"
        >
          Compare
        </button>

        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>Ignore keys</span>
          <input
            type="text"
            placeholder="updatedAt, requestId, _id"
            value={ignoreKeysInput}
            onChange={(e) => handleIgnoreKeysChange(e.target.value)}
            title="Comma-separated key names, matched at any nesting depth. Matching keys are excluded from the comparison but stay in the editors."
            className="w-56 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
          />
        </div>

        <button
          onClick={() => void handleShare()}
          disabled={sharing}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm font-semibold transition hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          {sharing ? 'Copying…' : 'Copy share link'}
        </button>

        {result && <StatsBadges stats={result.stats} />}
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

      {shareUrl && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">Share link ready</span>
            <a href={shareUrl} className="truncate text-sm text-[var(--accent)] underline underline-offset-2">
              {shareUrl}
            </a>
            <span className="text-xs text-[var(--text-muted)]">
              Encoded in the URL fragment — JSON never leaves this browser.
            </span>
            {shareWarning && <span className="text-xs text-[var(--modified-fg)]">{shareWarning}</span>}
          </div>
          <CopyButton text={shareUrl} label="Copy link" />
        </div>
      )}
    </div>
  )
}
