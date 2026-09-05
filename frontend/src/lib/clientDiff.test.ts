import { describe, expect, it } from 'vitest'
import { ClientDiffError, compareJson } from './clientDiff'
import { buildLineDiff } from './lineDiff'

describe('compareJson', () => {
  it('counts added, removed, changed, and unchanged top-level keys', () => {
    const result = compareJson({ a: 1, b: 2, c: 3 }, { a: 1, b: 20, d: 4 })
    expect(result.modified).toBe(true)
    expect(result.stats).toEqual({ added: 1, removed: 1, changed: 1, moved: 0, unchanged: 1 })
    expect(result.delta).toEqual({
      b: [2, 20],
      c: [3, 0, 0],
      d: [4],
    })
  })

  it('returns no delta for identical objects', () => {
    const payload = { a: 1, b: { c: [1, 2, 3] } }
    const result = compareJson(payload, payload)
    expect(result.modified).toBe(false)
    expect(result.delta).toBeNull()
    expect(result.stats.added).toBe(0)
    expect(result.stats.removed).toBe(0)
    expect(result.stats.changed).toBe(0)
  })

  it('counts a nested field change', () => {
    const result = compareJson(
      { user: { name: 'Alice', age: 30 } },
      { user: { name: 'Alice', age: 31 } },
    )
    expect(result.stats.changed).toBe(1)
    expect(result.delta).toEqual({ user: { age: [30, 31] } })
  })

  it('treats a type change as modified', () => {
    const result = compareJson({ value: '42' }, { value: 42 })
    expect(result.stats.changed).toBe(1)
    expect(result.delta).toEqual({ value: ['42', 42] })
  })

  it('rejects a top-level array', () => {
    expect(() => compareJson([1], { a: 1 })).toThrow(ClientDiffError)
    try {
      compareJson([1], { a: 1 })
    } catch (e) {
      expect(e).toBeInstanceOf(ClientDiffError)
      expect((e as ClientDiffError).side).toBe('left')
    }
  })

  it('produces a line-aligned view for the sample payloads', () => {
    const left = { name: 'Alice', age: 30, active: true }
    const right = { name: 'Alice', age: 31, role: 'admin' }
    const result = compareJson(left, right)
    const built = buildLineDiff(left, right, result.delta)
    expect(built.left.lines.length).toBe(built.right.lines.length)
    expect(built.left.lines.some((l) => l.status === 'modified')).toBe(true)
    expect(built.right.lines.some((l) => l.status === 'added')).toBe(true)
    expect(built.left.lines.some((l) => l.status === 'removed')).toBe(true)
  })

  it('marks appended array items as added', () => {
    const result = compareJson({ items: [1, 2] }, { items: [1, 2, 3] })
    expect(result.delta).toEqual({
      items: { _t: 'a', '2': [3] },
    })
    expect(result.stats.added).toBe(1)
  })
})
