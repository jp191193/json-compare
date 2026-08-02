import type { DiffStats } from '../lib/types'

const ITEMS: { key: keyof DiffStats; label: string; className: string }[] = [
  { key: 'added', label: 'Added', className: 'bg-[var(--added-bg)] text-[var(--added-fg)]' },
  { key: 'removed', label: 'Removed', className: 'bg-[var(--removed-bg)] text-[var(--removed-fg)]' },
  { key: 'changed', label: 'Changed', className: 'bg-[var(--modified-bg)] text-[var(--modified-fg)]' },
  { key: 'moved', label: 'Moved', className: 'bg-[var(--moved-bg)] text-[var(--moved-fg)]' },
  { key: 'unchanged', label: 'Unchanged', className: 'bg-[var(--surface-2)] text-[var(--text-muted)]' },
]

export function StatsBadges({ stats }: { stats: DiffStats }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ITEMS.map(({ key, label, className }) => (
        <span
          key={key}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${className}`}
        >
          {label}
          <span className="font-semibold">{stats[key]}</span>
        </span>
      ))}
    </div>
  )
}
