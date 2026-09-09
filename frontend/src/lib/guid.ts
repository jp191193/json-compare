export type GuidFormat = 'hyphenated' | 'compact' | 'braces'

export function newGuidV4(): string {
  return crypto.randomUUID()
}

export function formatGuid(
  uuid: string,
  opts: { format: GuidFormat; uppercase: boolean },
): string {
  let value = uuid
  if (opts.format === 'compact') {
    value = value.replaceAll('-', '')
  } else if (opts.format === 'braces') {
    value = `{${value}}`
  }
  return opts.uppercase ? value.toUpperCase() : value
}

export function generateGuids(
  count: number,
  opts: { format: GuidFormat; uppercase: boolean },
): string[] {
  const n = Math.min(100, Math.max(1, Math.trunc(count)))
  return Array.from({ length: n }, () => formatGuid(newGuidV4(), opts))
}
