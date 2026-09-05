import type { DiffResult, DiffStats } from './types'

export class ClientDiffError extends Error {
  side?: 'left' | 'right'

  constructor(message: string, side?: 'left' | 'right') {
    super(message)
    this.name = 'ClientDiffError'
    this.side = side
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function emptyStats(): DiffStats {
  return { added: 0, removed: 0, changed: 0, moved: 0, unchanged: 0 }
}

function mergeStats(a: DiffStats, b: DiffStats): DiffStats {
  return {
    added: a.added + b.added,
    removed: a.removed + b.removed,
    changed: a.changed + b.changed,
    moved: a.moved + b.moved,
    unchanged: a.unchanged + b.unchanged,
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  if (typeof a === 'object') {
    if (typeof b !== 'object' || b === null || Array.isArray(b)) return false
    const ak = Object.keys(a as Record<string, unknown>)
    const bk = Object.keys(b as Record<string, unknown>)
    if (ak.length !== bk.length) return false
    const right = b as Record<string, unknown>
    return ak.every((k) => Object.hasOwn(right, k) && deepEqual((a as Record<string, unknown>)[k], right[k]))
  }
  return false
}

/** jsondiffpatch-shaped delta, or undefined when the values are equal. */
function diffValue(left: unknown, right: unknown): unknown {
  if (deepEqual(left, right)) return undefined

  if (Array.isArray(left) && Array.isArray(right)) return diffArray(left, right)
  if (isPlainObject(left) && isPlainObject(right)) return diffObject(left, right)
  return [left, right]
}

function diffObject(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> | undefined {
  const delta: Record<string, unknown> = {}
  for (const key of Object.keys(left)) {
    if (!Object.hasOwn(right, key)) {
      delta[key] = [left[key], 0, 0]
      continue
    }
    const child = diffValue(left[key], right[key])
    if (child !== undefined) delta[key] = child
  }
  for (const key of Object.keys(right)) {
    if (!Object.hasOwn(left, key)) delta[key] = [right[key]]
  }
  return Object.keys(delta).length > 0 ? delta : undefined
}

function diffArray(left: unknown[], right: unknown[]): Record<string, unknown> | undefined {
  const delta: Record<string, unknown> = { _t: 'a' }
  const min = Math.min(left.length, right.length)
  for (let i = 0; i < min; i++) {
    const child = diffValue(left[i], right[i])
    if (child !== undefined) delta[String(i)] = child
  }
  for (let i = min; i < left.length; i++) {
    delta[`_${i}`] = [left[i], 0, 0]
  }
  for (let i = min; i < right.length; i++) {
    delta[String(i)] = [right[i]]
  }
  return Object.keys(delta).length > 1 ? delta : undefined
}

function countLeaf(entry: unknown[]): DiffStats {
  const s = emptyStats()
  if (entry.length === 1) s.added = 1
  else if (entry.length === 2) s.changed = 1
  else if (entry.length === 3) {
    if (entry[2] === 0) s.removed = 1
    else if (entry[2] === 3) s.moved = 1
    else s.changed = 1
  }
  return s
}

function countDelta(delta: unknown): DiffStats {
  if (delta == null) return emptyStats()
  if (Array.isArray(delta)) return countLeaf(delta)
  if (typeof delta !== 'object') return emptyStats()

  const obj = delta as Record<string, unknown>
  let stats = emptyStats()
  for (const key of Object.keys(obj)) {
    if (key === '_t') continue
    stats = mergeStats(stats, countDelta(obj[key]))
  }
  return stats
}

function countUnchangedTopLevel(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  delta: Record<string, unknown> | null,
): number {
  const touched = new Set(delta ? Object.keys(delta) : [])
  const all = new Set([...Object.keys(left), ...Object.keys(right)])
  let unchanged = 0
  for (const key of all) {
    if (!touched.has(key)) unchanged++
  }
  return unchanged
}

/**
 * Compare two JSON values in the browser. Top-level values must be objects
 * (same constraint as the Go API) so API request/response bodies stay the
 * common case.
 */
export function compareJson(left: unknown, right: unknown): DiffResult {
  if (!isPlainObject(left)) {
    throw new ClientDiffError('Left side must be a JSON object at the top level (not an array or scalar).', 'left')
  }
  if (!isPlainObject(right)) {
    throw new ClientDiffError('Right side must be a JSON object at the top level (not an array or scalar).', 'right')
  }

  const raw = diffObject(left, right)
  const delta = (raw ?? null) as Record<string, unknown> | null
  const stats = countDelta(delta)
  stats.unchanged = countUnchangedTopLevel(left, right, delta)

  return {
    delta,
    stats,
    modified: delta != null && Object.keys(delta).length > 0,
  }
}
