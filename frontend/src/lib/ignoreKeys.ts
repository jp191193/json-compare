export function parseIgnoreKeys(input: string): Set<string> {
  return new Set(
    input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

export function stripIgnoredKeys(value: unknown, ignoreSet: Set<string>): unknown {
  if (ignoreSet.size === 0) return value
  if (Array.isArray(value)) return value.map((v) => stripIgnoredKeys(v, ignoreSet))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (ignoreSet.has(k)) continue
      out[k] = stripIgnoredKeys(v, ignoreSet)
    }
    return out
  }
  return value
}

export function findIgnoredKeysPresent(
  value: unknown,
  ignoreSet: Set<string>,
  found: Set<string> = new Set(),
): Set<string> {
  if (ignoreSet.size === 0) return found
  if (Array.isArray(value)) {
    for (const v of value) findIgnoredKeysPresent(v, ignoreSet, found)
    return found
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (ignoreSet.has(k)) found.add(k)
      else findIgnoredKeysPresent(v, ignoreSet, found)
    }
  }
  return found
}
