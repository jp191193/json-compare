const TOOL =
  'inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50'

interface ResultsBarProps {
  compared: boolean
  total: number
  added: number
  removed: number
  modified: number
  typeChanged: number
  moved: number
  index: number | null
  onPrev: () => void
  onNext: () => void
  onExport?: () => void
  onCopy?: () => void
  copyLabel?: string
  onShare?: () => void
  sharing?: boolean
  fullscreen?: boolean
  onToggleFullscreen?: () => void
}

function Count({
  glyph,
  label,
  value,
  glyphClass,
}: {
  glyph: string
  label: string
  value: number
  glyphClass: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <span className={`font-semibold ${glyphClass}`} aria-hidden>
        {glyph}
      </span>
      {label}: <span className="font-semibold text-[var(--text)]">{value}</span>
    </span>
  )
}

export function ResultsBar({
  compared,
  total,
  added,
  removed,
  modified,
  typeChanged,
  moved,
  index,
  onPrev,
  onNext,
  onExport,
  onCopy,
  copyLabel = 'Copy…',
  onShare,
  sharing,
  fullscreen,
  onToggleFullscreen,
}: ResultsBarProps) {
  const position = index === null || total === 0 ? `— / ${total}` : `${index + 1} / ${total}`

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <span className={compared ? 'text-[#3fb950]' : 'text-[var(--text-muted)]'} aria-hidden>
            ✓
          </span>
          Results
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          Changes: <span className="font-semibold text-[var(--text)]">{total}</span>
        </span>
        <Count glyph="✓" label="Added" value={added} glyphClass="text-[var(--added-fg)]" />
        <Count glyph="✕" label="Removed" value={removed} glyphClass="text-[var(--removed-fg)]" />
        <Count glyph="●" label="Modified" value={modified} glyphClass="text-[var(--modified-fg)]" />
        <Count glyph="▣" label="Type Changed" value={typeChanged} glyphClass="text-[var(--type-fg)]" />
        {moved > 0 && <Count glyph="↔" label="Moved" value={moved} glyphClass="text-[var(--moved-fg)]" />}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {onExport && (
          <button type="button" className={TOOL} onClick={onExport} disabled={!compared}>
            Export…
          </button>
        )}
        {onCopy && (
          <button type="button" className={TOOL} onClick={onCopy} disabled={!compared || total === 0}>
            {copyLabel}
          </button>
        )}
        {onShare && (
          <button type="button" className={TOOL} onClick={onShare} disabled={sharing}>
            {sharing ? 'Sharing…' : 'Share'}
          </button>
        )}
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
          <button
            type="button"
            className="px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)] disabled:opacity-40"
            onClick={onPrev}
            disabled={total === 0}
            aria-label="Previous change"
          >
            ‹ Prev
          </button>
          <span className="border-x border-[var(--border)] px-2 py-1 text-xs tabular-nums text-[var(--text-muted)]">
            {position}
          </span>
          <button
            type="button"
            className="px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)] disabled:opacity-40"
            onClick={onNext}
            disabled={total === 0}
            aria-label="Next change"
          >
            Next ›
          </button>
        </div>
        {onToggleFullscreen && (
          <button
            type="button"
            className={TOOL}
            onClick={onToggleFullscreen}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? '✕' : '⛶'}
          </button>
        )}
      </div>
    </div>
  )
}
