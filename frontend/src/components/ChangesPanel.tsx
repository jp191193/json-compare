import { useMemo, useState } from 'react'
import type { ChangeKind, DiffChange } from '../lib/lineDiff'

const KIND_LABEL: Record<ChangeKind, string> = {
  added: 'ADD',
  removed: 'REMOVE',
  modified: 'MODIFY',
  type: 'TYPE',
  moved: 'MOVE',
}

const KIND_CLASS: Record<ChangeKind, string> = {
  added: 'bg-[var(--card-added)] text-[var(--added-fg)]',
  removed: 'bg-[var(--card-removed)] text-[var(--removed-fg)]',
  modified: 'bg-[var(--card-modified)] text-[var(--modified-fg)]',
  type: 'bg-[var(--card-type)] text-[var(--type-fg)]',
  moved: 'bg-[var(--card-modified)] text-[var(--modified-fg)]',
}

interface ChangesPanelProps {
  changes: DiffChange[]
  selectedIndex: number | null
  onSelect: (index: number) => void
}

export function ChangesPanel({ changes, selectedIndex, onSelect }: ChangesPanelProps) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()

  const visible = useMemo(() => {
    if (!normalized) return changes.map((change, index) => ({ change, index }))
    return changes
      .map((change, index) => ({ change, index }))
      .filter(({ change }) => {
        const haystack = `${change.path} ${change.from ?? ''} ${change.to ?? ''}`.toLowerCase()
        return haystack.includes(normalized)
      })
  }, [changes, normalized])

  const position =
    selectedIndex === null || changes.length === 0 ? `0 / ${changes.length}` : `${selectedIndex + 1} / ${changes.length}`

  return (
    <aside className="flex h-[min(68vh,760px)] min-h-[420px] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] xl:h-full xl:min-h-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="text-xs font-semibold tracking-wide">Changes</span>
        <span className="text-xs tabular-nums text-[var(--text-muted)]">{position}</span>
      </div>
      <div className="border-b border-[var(--border)] p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by path or value"
          aria-label="Filter changes"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--editor-bg)] px-2 py-1.5 text-xs outline-none focus:border-[var(--select)]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {changes.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-[var(--text-muted)]">
            Compare two JSON values to list every add, remove, modification, and type change.
          </p>
        ) : visible.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-[var(--text-muted)]">No changes match that filter.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {visible.map(({ change, index }) => {
              const selected = index === selectedIndex
              return (
                <li key={`${change.path}-${change.start}-${change.kind}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(index)}
                    aria-current={selected ? 'true' : undefined}
                    className={`w-full rounded-md px-2.5 py-2 text-left ${KIND_CLASS[change.kind]} ${
                      selected ? 'ring-2 ring-[var(--select)]' : 'hover:brightness-110'
                    }`}
                  >
                    <span className="text-[10px] font-bold tracking-wider">{KIND_LABEL[change.kind]}</span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--text)]">{change.path}</span>
                    {change.from !== undefined && (
                      <span className="mt-1 block truncate text-[11px] opacity-80">from: {change.from}</span>
                    )}
                    {change.to !== undefined && (
                      <span className="block truncate text-[11px] opacity-80">to: {change.to}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </aside>
  )
}
