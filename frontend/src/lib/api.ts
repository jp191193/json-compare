import type {
  CreateShareResponse,
  DiffResult,
  HealthResponse,
  ShareRecord,
} from './types'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export class ApiError extends Error {
  status: number
  side?: string

  constructor(message: string, status: number, side?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.side = side
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options)

  if (!res.ok) {
    let message = res.statusText
    let side: string | undefined
    try {
      const body = await res.json()
      message = body.error ?? message
      side = body.side
    } catch {
      // response had no JSON body
    }
    throw new ApiError(message, res.status, side)
  }

  return res.json() as Promise<T>
}

export function getHealth() {
  return request<HealthResponse>('/healthz')
}

export function postDiff(left: unknown, right: unknown) {
  return request<DiffResult>('/api/v1/diff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ left, right }),
  })
}

export function createShare(left: unknown, right: unknown, ttlHours?: number) {
  return request<CreateShareResponse>('/api/v1/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      left,
      right,
      ...(ttlHours ? { ttl_hours: ttlHours } : {}),
    }),
  })
}

export function getShare(id: string) {
  return request<ShareRecord>(`/api/v1/shares/${id}`)
}

export function exportShareUrl(id: string, format: 'json' | 'text') {
  return `${API_BASE}/api/v1/shares/${id}/export?format=${format}`
}
