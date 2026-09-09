import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { ApiError, createShare, postDiff } from '../lib/api'
import type { DiffResult } from '../lib/types'
import { findDiffHunks, isEditableTarget, type DiffHunk } from '../lib/diffHunks'
import { buildLineDiff, type DiffLine } from '../lib/lineDiff'
import { parseIgnoreKeys, stripIgnoredKeys, findIgnoredKeysPresent } from '../lib/ignoreKeys'
import { useSyncedScroll } from '../lib/useSyncedScroll'
import { JsonSideEditor } from '../components/JsonSideEditor'
import { StatsBadges } from '../components/StatsBadges'
import { CopyButton } from '../components/CopyButton'
import { ALICE_EXAMPLE, COMPARE_EXAMPLES, type CompareExample } from '../lib/examples'

const NAV_BTN =
  'rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50'

function scrollEditorToLine(ref: ReactCodeMirrorRef | null, lineIndex: number) {
  const view = ref?.view
  if (!view) return
  const docLine = Math.min(Math.max(lineIndex + 1, 1), view.state.doc.lines)
  const line = view.state.doc.line(docLine)
  view.dispatch({
    effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
  })
}

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
  const [left, setLeft] = useState(ALICE_EXAMPLE.left)
  const [right, setRight] = useState(ALICE_EXAMPLE.right)
  const [loadedExample, setLoadedExample] = useState(ALICE_EXAMPLE.id)
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

  const [currentHunkIndex, setCurrentHunkIndex] = useState<number | null>(null)

  const leftEditorRef = useRef<ReactCodeMirrorRef>(null)
  const rightEditorRef = useRef<ReactCodeMirrorRef>(null)
  const loadedExampleRef = useRef(ALICE_EXAMPLE.id)
  useSyncedScroll(leftEditorRef, rightEditorRef, Boolean(leftLines && rightLines))

  const hunks = useMemo(
    () => (leftLines && rightLines ? findDiffHunks(leftLines, rightLines) : []),
    [leftLines, rightLines],
  )
  const currentHunk: DiffHunk | null =
    currentHunkIndex !== null ? (hunks[currentHunkIndex] ?? null) : null

  function markExampleIfStillMatching(side: 'left' | 'right', value: string) {
    const example = COMPARE_EXAMPLES.find((e) => e.id === loadedExampleRef.current)
    if (!example) return
    const expected = side === 'left' ? example.left : example.right
    if (value === expected) return
    loadedExampleRef.current = ''
    setLoadedExample('')
  }

  const leftCopyText = useMemo(() => cleanText(left, leftLines), [left, leftLines])
  const rightCopyText = useMemo(() => cleanText(right, rightLines), [right, rightLines])

  function clearDiff() {
    setResult(null)
    setLeftLines(undefined)
    setRightLines(undefined)
    setStrippedFound([])
    setCurrentHunkIndex(null)
  }

  function scrollToHunk(hunk: DiffHunk) {
    scrollEditorToLine(leftEditorRef.current, hunk.start)
    scrollEditorToLine(rightEditorRef.current, hunk.start)
  }

  const goToHunk = useCallback(
    (index: number) => {
      if (hunks.length === 0) return
      const next = ((index % hunks.length) + hunks.length) % hunks.length
      setCurrentHunkIndex(next)
      const hunk = hunks[next]
      requestAnimationFrame(() => scrollToHunk(hunk))
    },
    [hunks],
  )

  const goNextHunk = useCallback(() => {
    if (hunks.length === 0) return
    goToHunk(currentHunkIndex === null ? 0 : currentHunkIndex + 1)
  }, [currentHunkIndex, goToHunk, hunks.length])

  const goPrevHunk = useCallback(() => {
    if (hunks.length === 0) return
    goToHunk(currentHunkIndex === null || currentHunkIndex === 0 ? hunks.length - 1 : currentHunkIndex - 1)
  }, [currentHunkIndex, goToHunk, hunks.length])

  useEffect(() => {
    if (!leftLines || !rightLines) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        if (e.key === 'ArrowDown') goNextHunk()
        else goPrevHunk()
        return
      }
      if (e.altKey || e.metaKey || e.ctrlKey) return
      if (isEditableTarget(e.target)) return
      if (e.key === 'n' || e.key === 'j') {
        e.preventDefault()
        goNextHunk()
      } else if (e.key === 'p' || e.key === 'k') {
        e.preventDefault()
        goPrevHunk()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [goNextHunk, goPrevHunk, leftLines, rightLines])

  function handleLeftChange(value: string) {
    setLeft(value)
    markExampleIfStillMatching('left', value)
    if (result) clearDiff()
  }

  function handleRightChange(value: string) {
    setRight(value)
    markExampleIfStillMatching('right', value)
    if (result) clearDiff()
  }

  function handleIgnoreKeysChange(value: string) {
    setIgnoreKeysInput(value)
    if (result) clearDiff()
  }

  function loadExample(example: CompareExample) {
    loadedExampleRef.current = example.id
    setLoadedExample(example.id)
    setLeft(example.left)
    setRight(example.right)
    setIgnoreKeysInput(example.ignoreKeys)
    setError(null)
    setShare(null)
    clearDiff()
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
      setCurrentHunkIndex(null)
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
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">JSON Compare</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Side-by-side JSON diff for API responses and configs. Ignore volatile keys, then share a
            link.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">Load example</span>
          {COMPARE_EXAMPLES.map((example) => {
            const selected = loadedExample === example.id
            return (
              <button
                key={example.id}
                type="button"
                onClick={() => loadExample(example)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selected
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {example.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <JsonSideEditor
          side="Left"
          value={left}
          copyText={leftCopyText}
          onChange={handleLeftChange}
          onError={setError}
          theme={theme}
          highlightLines={leftLines}
          currentHunk={currentHunk}
          editorRef={leftEditorRef}
        />
        <JsonSideEditor
          side="Right"
          value={right}
          copyText={rightCopyText}
          onChange={handleRightChange}
          onError={setError}
          theme={theme}
          highlightLines={rightLines}
          currentHunk={currentHunk}
          editorRef={rightEditorRef}
        />
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

        {leftLines && rightLines && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goPrevHunk}
              disabled={hunks.length === 0}
              aria-label="Previous change"
              className={NAV_BTN}
            >
              Previous
            </button>
            <span
              className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums text-[var(--text-muted)]"
              aria-live="polite"
            >
              {hunks.length === 0
                ? '0 / 0'
                : currentHunkIndex === null
                  ? `— / ${hunks.length}`
                  : `${currentHunkIndex + 1} / ${hunks.length}`}
            </span>
            <button
              type="button"
              onClick={goNextHunk}
              disabled={hunks.length === 0}
              aria-label="Next change"
              className={NAV_BTN}
            >
              Next
            </button>
            <span className="text-xs text-[var(--text-muted)]">Alt+↓ / Alt+↑</span>
          </div>
        )}

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

      <section className="border-t border-[var(--border)] pt-8" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-lg font-semibold">
          FAQ
        </h2>
        <dl className="mt-4 grid gap-5 text-sm md:grid-cols-3">
          <div>
            <dt className="font-medium">Can I compare JSON files?</dt>
            <dd className="mt-1 text-[var(--text-muted)]">
              Drop or open a .json file on each side, or paste into the editors, then click Compare.
              The tool expects JSON objects.
            </dd>
          </div>
          <div>
            <dt className="font-medium">What do ignore keys do?</dt>
            <dd className="mt-1 text-[var(--text-muted)]">
              Comma-separated names such as{' '}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-xs">updatedAt</code>,{' '}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-xs">requestId</code>, or{' '}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 text-xs">_id</code> are
              matched at any nesting depth and stripped from the comparison and
              from share links, so timestamps and request IDs do not clutter the diff.
            </dd>
          </div>
          <div>
            <dt className="font-medium">How long do share links last?</dt>
            <dd className="mt-1 text-[var(--text-muted)]">
              You set a TTL in hours when creating a link (default 24 hours, maximum 30 days). After
              that the share expires and the URL no longer loads.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
