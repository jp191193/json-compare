export interface HashSharePayload {
  v: 1
  left: unknown
  right: unknown
  ignoreKeys?: string
}

const PREFIX_GZIP = 'g1.'
const PREFIX_JSON = 'j1.'

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function b64UrlToBytes(raw: string): Uint8Array {
  const padded = raw.replaceAll('-', '+').replaceAll('_', '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const bin = atob(padded + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function gzipEncode(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gzipDecode(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}

export async function encodeHashShare(payload: HashSharePayload): Promise<string> {
  const json = JSON.stringify({ v: 1, left: payload.left, right: payload.right, ignoreKeys: payload.ignoreKeys ?? '' })
  try {
    if (typeof CompressionStream !== 'undefined') {
      const compressed = await gzipEncode(json)
      return PREFIX_GZIP + bytesToB64Url(compressed)
    }
  } catch {
    // fall through to uncompressed
  }
  return PREFIX_JSON + bytesToB64Url(new TextEncoder().encode(json))
}

export async function decodeHashShare(hash: string): Promise<HashSharePayload | null> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return null

  let json: string
  try {
    if (raw.startsWith(PREFIX_GZIP)) {
      json = await gzipDecode(b64UrlToBytes(raw.slice(PREFIX_GZIP.length)))
    } else if (raw.startsWith(PREFIX_JSON)) {
      json = new TextDecoder().decode(b64UrlToBytes(raw.slice(PREFIX_JSON.length)))
    } else {
      return null
    }
  } catch {
    return null
  }

  try {
    const parsed = JSON.parse(json) as Partial<HashSharePayload>
    if (parsed.v !== 1 || parsed.left === undefined || parsed.right === undefined) return null
    return {
      v: 1,
      left: parsed.left,
      right: parsed.right,
      ignoreKeys: typeof parsed.ignoreKeys === 'string' ? parsed.ignoreKeys : '',
    }
  } catch {
    return null
  }
}

export function hashShareUrl(encoded: string, origin = window.location.origin, pathname = window.location.pathname): string {
  const path = pathname.endsWith('/') ? pathname.slice(0, -1) || '/' : pathname
  const basePath = path === '/' ? '' : path
  return `${origin}${basePath}/#${encoded}`
}

/** Browsers and chat apps start failing well before this; warn the user. */
export const HASH_SHARE_SOFT_LIMIT = 16_000
export const HASH_SHARE_HARD_LIMIT = 80_000
