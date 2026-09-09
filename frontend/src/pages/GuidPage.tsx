import { useMemo, useState } from 'react'
import { CopyButton } from '../components/CopyButton'
import { formatGuid, generateGuids, type GuidFormat } from '../lib/guid'

const FORMAT_PREVIEW = '550e8400-e29b-41d4-a716-446655440000'

const FORMAT_OPTIONS: { id: GuidFormat; label: string; example: string }[] = [
  { id: 'hyphenated', label: 'Standard', example: '8-4-4-4-12' },
  { id: 'compact', label: 'No hyphens', example: '32 hex chars' },
  { id: 'braces', label: 'Braces', example: '{GUID}' },
]

const COUNT_PRESETS = [1, 5, 10, 25, 50]
const MIN_COUNT = 1
const MAX_COUNT = 100

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return MIN_COUNT
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(value)))
}

export function GuidPage() {
  const [format, setFormat] = useState<GuidFormat>('hyphenated')
  const [uppercase, setUppercase] = useState(false)
  const [count, setCount] = useState(1)
  const [ids, setIds] = useState(() => generateGuids(1, { format: 'hyphenated', uppercase: false }))

  const preview = useMemo(
    () => formatGuid(FORMAT_PREVIEW, { format, uppercase }),
    [format, uppercase],
  )

  function handleGenerate() {
    setIds(generateGuids(count, { format, uppercase }))
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GUID generator</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Generate RFC 4122 UUID v4 values (random GUIDs) in the browser. Starts with one; raise
          the count when you need a batch. Nothing is sent to the API.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-[var(--text-muted)]">Format</span>
          {FORMAT_OPTIONS.map((option) => {
            const selected = format === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFormat(option.id)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selected
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {option.label}
                <span className="ml-1.5 font-normal opacity-70">{option.example}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-muted)]">How many</span>
            {COUNT_PRESETS.map((n) => {
              const selected = count === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    selected
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {n}
                </button>
              )
            })}
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              Custom
              <input
                type="number"
                min={MIN_COUNT}
                max={MAX_COUNT}
                value={count}
                onChange={(e) => setCount(clampCount(Number(e.target.value)))}
                className="w-20 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
              />
            </label>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Default is 1. Pick a preset or enter any number up to {MAX_COUNT}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            Uppercase
          </label>

          <button
            type="button"
            onClick={handleGenerate}
            className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)] shadow-sm transition hover:opacity-90"
          >
            {count === 1 ? 'Generate 1 GUID' : `Generate ${count} GUIDs`}
          </button>
        </div>

        <p className="font-mono text-xs text-[var(--text-muted)]">Preview: {preview}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-muted)]">
            {ids.length === 1 ? '1 GUID' : `${ids.length} GUIDs`}
          </span>
          <CopyButton text={ids.join('\n')} label="Copy all" />
        </div>
        <ul className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {ids.map((id, index) => (
            <li
              key={`${id}-${index}`}
              className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2 last:border-b-0"
            >
              <code className="break-all font-mono text-sm">{id}</code>
              <CopyButton text={id} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
