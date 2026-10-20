import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { ApiError, createShare, postDiff } from '../lib/api'
import type { DiffResult } from '../lib/types'
import { isEditableTarget, type DiffHunk } from '../lib/diffHunks'
import { copyChange, type CopyDirection } from '../lib/applyChange'
import { buildLineDiff, countChangeKinds, formatChangeList, type DiffChange, type DiffLine } from '../lib/lineDiff'
import { useUnchangedCollapse } from '../lib/useUnchangedCollapse'
import { parseIgnoreKeys, stripIgnoredKeys, findIgnoredKeysPresent } from '../lib/ignoreKeys'
import { useSyncedScroll } from '../lib/useSyncedScroll'
import { JsonSideEditor } from '../components/JsonSideEditor'
import { ChangesPanel } from '../components/ChangesPanel'
import { ResultsBar } from '../components/ResultsBar'
import { CopyButton } from '../components/CopyButton'
import { ALICE_EXAMPLE, COMPARE_EXAMPLES, loadHugePayload, type CompareExample } from '../lib/examples'

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
  const [changes, setChanges] = useState<DiffChange[]>([])
  const [selectedChange, setSelectedChange] = useState<number | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [result, setResult] = useState<DiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingExample, setLoadingExample] = useState<string | null>(null)

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
  const diffSeq = useRef(0)
  const copying = useRef(false)
  const applyCopyRef = useRef<(index: number, direction: CopyDirection) => void>(() => {})
  const scrollRestore = useRef<{ left: number; right: number } | null>(null)
  const loadedExampleRef = useRef(ALICE_EXAMPLE.id)
  useSyncedScroll(leftEditorRef, rightEditorRef, Boolean(leftLines && rightLines))
  const collapse = useUnchangedCollapse(leftLines, rightLines)

  const currentChange = selectedChange !== null ? (changes[selectedChange] ?? null) : null
  const currentHunk = useMemo<DiffHunk | null>(() => {
    if (!currentChange) return null
    return { start: currentChange.start, end: currentChange.end }
  }, [currentChange])
  const counts = useMemo(() => countChangeKinds(changes), [changes])

  function markExampleIfStillMatching(side: 'left' | 'right', value: string) {
    const example = COMPARE_EXAMPLES.find((e) => e.id === loadedExampleRef.current)
    if (!example) return
    const expected = side === 'left' ? example.left : example.right
    if (value === expected) return
    loadedExampleRef.current = ''
    setLoadedExample('')
  }

  useEffect(() => {
    const snap = scrollRestore.current
    if (!snap) return
    scrollRestore.current = null
    const leftScroll = leftEditorRef.current?.view?.scrollDOM
    const rightScroll = rightEditorRef.current?.view?.scrollDOM
    if (leftScroll) leftScroll.scrollTop = snap.left
    if (rightScroll) rightScroll.scrollTop = snap.right
  }, [left, right])

  const leftCopyText = useMemo(() => cleanText(left, leftLines), [left, leftLines])
  const rightCopyText = useMemo(() => cleanText(right, rightLines), [right, rightLines])

  function clearDiff() {
    setResult(null)
    setLeftLines(undefined)
    setRightLines(undefined)
    setChanges([])
    setStrippedFound([])
    setSelectedChange(null)
  }

  const selectChange = useCallback((index: number, scroll: boolean) => {
    if (changes.length === 0) return
    const next = ((index % changes.length) + changes.length) % changes.length
    setSelectedChange(next)
    if (!scroll) return
    const change = changes[next]
    requestAnimationFrame(() => {
      scrollEditorToLine(leftEditorRef.current, change.start)
      scrollEditorToLine(rightEditorRef.current, change.start)
    })
  }, [changes])

  const goNextChange = useCallback(() => {
    if (changes.length === 0) return
    selectChange(selectedChange === null ? 0 : selectedChange + 1, true)
  }, [changes.length, selectChange, selectedChange])

  const goPrevChange = useCallback(() => {
    if (changes.length === 0) return
    selectChange(selectedChange === null || selectedChange === 0 ? changes.length - 1 : selectedChange - 1, true)
  }, [changes.length, selectChange, selectedChange])

  useEffect(() => {
    if (!leftLines || !rightLines) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        if (e.key === 'ArrowDown') goNextChange()
        else goPrevChange()
        return
      }
      if (e.altKey || e.metaKey || e.ctrlKey) return
      if (isEditableTarget(e.target)) return
      if (e.key === 'n' || e.key === 'j') {
        e.preventDefault()
        goNextChange()
      } else if (e.key === 'p' || e.key === 'k') {
        e.preventDefault()
        goPrevChange()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [goNextChange, goPrevChange, leftLines, rightLines])

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

  async function loadExample(example: CompareExample) {
    loadedExampleRef.current = example.id
    setLoadedExample(example.id)
    setError(null)
    setShare(null)
    clearDiff()

    let next = example
    if (example.id === 'huge-payload') {
      setLoadingExample(example.id)
      try {
        next = await loadHugePayload()
      } catch {
        if (loadedExampleRef.current === example.id) {
          loadedExampleRef.current = ''
          setLoadedExample('')
          setError('Could not load the huge payload.')
        }
        return
      } finally {
        setLoadingExample((current) => (current === example.id ? null : current))
      }
      if (loadedExampleRef.current !== example.id) return
    }

    setLeft(next.left)
    setRight(next.right)
    setIgnoreKeysInput(next.ignoreKeys)
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

  function nearestChangeIndex(nextChanges: DiffChange[], anchorLine: number) {
    if (nextChanges.length === 0) return null
    let best = 0
    let bestDistance = Math.abs(nextChanges[0].start - anchorLine)
    for (let i = 1; i < nextChanges.length; i++) {
      const distance = Math.abs(nextChanges[i].start - anchorLine)
      if (distance < bestDistance) {
        best = i
        bestDistance = distance
      }
    }
    return best
  }

  async function runCompare(
    leftText: string,
    rightText: string,
    options?: { quiet?: boolean; anchorLine?: number },
  ) {
    const seq = ++diffSeq.current
    setError(null)
    setShare(null)

    let l: unknown
    let r: unknown
    try {
      l = JSON.parse(leftText)
    } catch {
      setError('Left JSON is invalid — fix the highlighted error before comparing.')
      return
    }
    try {
      r = JSON.parse(rightText)
    } catch {
      setError('Right JSON is invalid — fix the highlighted error before comparing.')
      return
    }

    const ignoreSet = parseIgnoreKeys(ignoreKeysInput)
    if (!options?.quiet) setLoading(true)
    try {
      const res = await postDiff(stripIgnoredKeys(l, ignoreSet), stripIgnoredKeys(r, ignoreSet))
      if (seq !== diffSeq.current) return
      // Build the displayed diff from the full (unstripped) values, not the
      // ignore-filtered ones sent to the backend — otherwise ignored keys are
      // permanently deleted from the editors instead of just excluded from
      // the comparison, and un-ignoring them later has nothing left to show.
      // Since the backend never saw an ignored key, `res.delta` has no entry
      // for it, so it naturally renders as a plain unchanged line here.
      const built = buildLineDiff(l, r, res.delta)
      if (options?.quiet) {
        scrollRestore.current = {
          left: leftEditorRef.current?.view?.scrollDOM.scrollTop ?? 0,
          right: rightEditorRef.current?.view?.scrollDOM.scrollTop ?? 0,
        }
      }
      setResult(res)
      setLeft(built.left.text)
      setRight(built.right.text)
      setLeftLines(built.left.lines)
      setRightLines(built.right.lines)
      setChanges(built.changes)
      setSelectedChange(
        options?.anchorLine !== undefined
          ? nearestChangeIndex(built.changes, options.anchorLine)
          : built.changes.length > 0
            ? 0
            : null,
      )
      setStrippedFound([
        ...new Set([...findIgnoredKeysPresent(l, ignoreSet), ...findIgnoredKeysPresent(r, ignoreSet)]),
      ])
    } catch (e) {
      if (seq !== diffSeq.current) return
      if (e instanceof ApiError) {
        setError(e.side ? `${e.message} (${e.side} side)` : e.message)
      } else {
        setError('Something went wrong while comparing.')
      }
      if (!options?.quiet) clearDiff()
    } finally {
      if (!options?.quiet && seq === diffSeq.current) setLoading(false)
    }
  }

  async function handleCompare() {
    await runCompare(left, right)
  }

  async function applyCopy(index: number, direction: CopyDirection) {
    if (copying.current) return
    const change = changes[index]
    if (!change) return

    let parsedLeft: unknown
    let parsedRight: unknown
    try {
      parsedLeft = JSON.parse(left)
      parsedRight = JSON.parse(right)
    } catch {
      setError('Could not copy this change because the JSON is invalid.')
      return
    }

    const next = copyChange(parsedLeft, parsedRight, change, direction)
    const leftText = JSON.stringify(next.left, null, 2)
    const rightText = JSON.stringify(next.right, null, 2)
    copying.current = true
    markExampleIfStillMatching('left', leftText)
    markExampleIfStillMatching('right', rightText)
    try {
      await runCompare(leftText, rightText, { quiet: true, anchorLine: change.start })
    } finally {
      copying.current = false
    }
  }

  applyCopyRef.current = (index, direction) => {
    void applyCopy(index, direction)
  }

  const copyFromLeft = useCallback((index: number) => {
    applyCopyRef.current(index, 'to-right')
  }, [])

  const copyFromRight = useCallback((index: number) => {
    applyCopyRef.current(index, 'to-left')
  }, [])

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

  const [copiedChanges, setCopiedChanges] = useState(false)

  function exportDelta() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result.delta ?? {}, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'diff.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function copyChanges() {
    await navigator.clipboard.writeText(formatChangeList(changes))
    setCopiedChanges(true)
    window.setTimeout(() => setCopiedChanges(false), 1500)
  }

  return (
    <div className={`flex flex-col gap-3 px-4 py-3 ${fullscreen ? 'fixed inset-0 z-50 overflow-auto bg-[var(--bg)]' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleCompare}
          disabled={loading}
          className="rounded-md bg-[var(--select)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Comparing…' : 'Compare'}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          Ignore keys
          <input
            type="text"
            placeholder="updatedAt, requestId"
            value={ignoreKeysInput}
            onChange={(e) => handleIgnoreKeysChange(e.target.value)}
            title="Comma-separated key names, matched at any nesting depth"
            className="w-44 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)]"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          TTL
          <input
            type="number"
            min={1}
            value={ttlHours}
            onChange={(e) => setTtlHours(e.target.value)}
            aria-label="Share TTL in hours"
            className="w-16 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)]"
          />
        </label>
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
        <div className="flex flex-wrap items-center gap-1.5">
          {COMPARE_EXAMPLES.map((example) => {
            const selected = loadedExample === example.id
            return (
              <button
                key={example.id}
                type="button"
                onClick={() => void loadExample(example)}
                aria-pressed={selected}
                disabled={loadingExample === example.id}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-60 ${
                  selected
                    ? 'border-[var(--select)] bg-[color-mix(in_srgb,var(--select)_12%,transparent)] text-[var(--select)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {loadingExample === example.id ? 'Loading…' : example.label}
              </button>
            )
          })}
        </div>
      </div>

      <ResultsBar
        compared={Boolean(result)}
        total={changes.length}
        added={counts.added}
        removed={counts.removed}
        modified={counts.modified}
        typeChanged={counts.type}
        moved={counts.moved}
        index={selectedChange}
        onPrev={goPrevChange}
        onNext={goNextChange}
        onExport={exportDelta}
        onCopy={() => void copyChanges()}
        copyLabel={copiedChanges ? 'Copied' : 'Copy…'}
        onShare={() => void handleShare()}
        sharing={sharing}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((value) => !value)}
      />

      {(error || strippedFound.length > 0 || (result && !result.modified) || share) && (
        <div className="flex flex-col gap-2">
          {strippedFound.length > 0 && (
            <div className="text-xs text-[var(--text-muted)]">Stripped from comparison: {strippedFound.join(', ')}</div>
          )}
          {error && (
            <div className="rounded-md border border-[var(--removed-fg)]/30 bg-[var(--card-removed)] px-3 py-2 text-sm text-[var(--removed-fg)]">
              {error}
            </div>
          )}
          {result && !result.modified && (
            <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-center text-sm text-[var(--text-muted)]">
              No differences — both sides are identical.
            </div>
          )}
          {share && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <a href={shareLink()} className="text-sm text-[var(--select)] underline underline-offset-2">
                {shareLink()}
              </a>
              <span className="text-xs text-[var(--text-muted)]">Expires {new Date(share.expiresAt).toLocaleString()}</span>
              <CopyButton text={shareLink()} label="Copy link" />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:h-[calc(100vh-11.5rem)] xl:min-h-[560px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
        <JsonSideEditor
          side="Left"
          value={left}
          copyText={leftCopyText}
          onChange={handleLeftChange}
          onError={setError}
          theme={theme}
          highlightLines={leftLines}
          currentHunk={currentHunk}
          collapsedFolds={collapse.visibleFolds}
          onExpandFold={collapse.expandFold}
          copyChanges={changes}
          onCopyChange={result ? copyFromLeft : undefined}
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
          collapsedFolds={collapse.visibleFolds}
          onExpandFold={collapse.expandFold}
          copyChanges={changes}
          onCopyChange={result ? copyFromRight : undefined}
          editorRef={rightEditorRef}
        />
        <ChangesPanel changes={changes} selectedIndex={selectedChange} onSelect={(index) => selectChange(index, true)} />
      </div>

      {!fullscreen && (
      <section className="border-t border-[var(--border)] pt-6" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-lg font-semibold">
          FAQ
        </h2>
        <dl className="mt-4 grid gap-5 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-medium">Can I compare JSON files?</dt>
            <dd className="mt-1 text-[var(--text-muted)]">
              Drop or open a .json file on each side, or paste into the editors, then click Compare.
              The tool expects JSON objects. After Compare, each change has an arrow: → moves that
              change onto the right file, and ← moves it onto the left.
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
          <div>
            <dt className="font-medium">What does collapse unchanged do?</dt>
            <dd className="mt-1 text-[var(--text-muted)]">
              After Compare, long stretches of identical lines hide behind a ⋯ marker so the real
              changes stay on screen. Click the marker to expand a section, or uncheck Collapse
              unchanged.
            </dd>
          </div>
        </dl>
      </section>
      )}
    </div>
  )
}
