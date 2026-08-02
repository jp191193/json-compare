export interface DiffStats {
  added: number
  removed: number
  changed: number
  moved: number
  unchanged: number
}

export interface DiffResult {
  delta: Record<string, unknown> | null
  stats: DiffStats
  modified: boolean
}

export interface CreateShareResponse {
  id: string
  url: string
  expiresAt: string
}

export interface ShareRecord {
  id: string
  left: unknown
  right: unknown
  delta: DiffResult
  createdAt: string
  expiresAt: string
}

export interface HealthResponse {
  status: string
  error?: string
}
