import { describe, expect, it } from 'vitest'
import { decodeHashShare, encodeHashShare, hashShareUrl } from './hashShare'

describe('hashShare', () => {
  it('round-trips left, right, and ignore keys', async () => {
    const payload = {
      v: 1 as const,
      left: { name: 'Alice', age: 30 },
      right: { name: 'Alice', age: 31, role: 'admin' },
      ignoreKeys: 'updatedAt, _id',
    }
    const encoded = await encodeHashShare(payload)
    expect(encoded.startsWith('g1.') || encoded.startsWith('j1.')).toBe(true)
    const decoded = await decodeHashShare(`#${encoded}`)
    expect(decoded).toEqual(payload)
  })

  it('returns null for garbage hashes', async () => {
    expect(await decodeHashShare('#not-a-share')).toBeNull()
    expect(await decodeHashShare('')).toBeNull()
  })

  it('builds a fragment URL', () => {
    expect(hashShareUrl('g1.abc', 'https://example.com', '/')).toBe('https://example.com/#g1.abc')
    expect(hashShareUrl('g1.abc', 'https://example.com', '/app/')).toBe('https://example.com/app/#g1.abc')
  })
})
