# JSON Compare API

A backend for comparing two JSON payloads, highlighting the differences, and
generating shareable links to revisit a diff later. Weekend MVP — no auth,
no rate limiting, and shareable diffs expire automatically via Redis TTL.

## Stack

- Go + [Gin](https://github.com/gin-gonic/gin)
- Redis (shareable diffs are stored with a TTL, default 7 days)
- Diffing via [gojsondiff](https://github.com/yudai/gojsondiff), which outputs
  deltas in the [jsondiffpatch](https://github.com/benjamine/jsondiffpatch)
  delta *format* — the frontend does not depend on the `jsondiffpatch`
  library itself, it walks that delta shape with its own renderer (see
  `frontend/src/lib/lineDiff.ts`) to build a line-aligned, side-by-side view.
- Frontend: React + Vite + TypeScript + Tailwind (in `frontend/`), with
  CodeMirror for JSON editing/highlighting and `react-router` for the
  compare/share views.

## Running locally

```bash
docker compose up --build
```

This starts the API on `localhost:8080` and a Redis instance. To run without
Docker, start a local Redis and:

```bash
cp .env.example .env   # adjust as needed
go run ./cmd/server
```

### Frontend

```bash
cd frontend
cp .env.example .env   # points at http://localhost:8080 by default
npm install
npm run dev
```

Opens on `localhost:5173`. Compare two JSON payloads side by side, with:

- Line-level highlighting (added/removed/modified/moved), computed client-side
  from the API's delta so both panes always show the same number of rows —
  even when keys are added/removed, the shorter side is padded with blank
  placeholder lines so unrelated content stays visually aligned.
- Synced scrolling between the two panes (line-index based, not just pixel
  offset).
- An "ignore keys" filter (comma-separated key names, any nesting depth) to
  exclude volatile fields (e.g. `updatedAt`, `_id`) from the comparison and
  from a created share, without losing them from the editors.
- One-click copy for either side, and a share link (`/share/:id`) that anyone
  with the URL can view or export, as long as the backend is reachable.

## Known gaps (MVP scope)

- No authentication or per-user ownership of shares — anyone with the ID can
  view/export a share.
- No rate limiting — fine for local/weekend use, not for public deployment.
- CORS is wide open (`*`) — lock this down to a real frontend origin before
  deploying anywhere public.
- Both `left` and `right` must be JSON **objects** at the top level (not bare
  arrays or scalars) — this matches the common case of comparing API
  request/response bodies.
- No automated frontend test suite (`frontend/`) — the Go backend has
  `internal/diff/diff_test.go`, but the frontend has been verified manually
  (a headless-browser script driven ad hoc), not via a checked-in test runner.
- Array diffing in the frontend's side-by-side view handles add/remove/modify
  and simple reorders, but is a best-effort alignment, not a byte-for-byte
  guarantee for deeply nested or heavily reordered arrays.

## API

### `GET /healthz`

Health check; pings Redis.

```bash
curl localhost:8080/healthz
```

### `POST /api/v1/diff`

Stateless diff — no persistence. Returns the delta (jsondiffpatch format) and
summary stats.

```bash
curl -X POST localhost:8080/api/v1/diff \
  -H "Content-Type: application/json" \
  -d '{
        "left":  {"name": "Alice", "age": 30, "active": true},
        "right": {"name": "Alice", "age": 31, "role": "admin"}
      }'
```

Response:

```json
{
  "delta": {
    "age": [30, 31],
    "role": [{"role": "admin"}],
    "active": [true, 0, 0]
  },
  "stats": {"added": 1, "removed": 1, "changed": 1, "moved": 0, "unchanged": 1},
  "modified": true
}
```

### `POST /api/v1/shares`

Computes the diff once and stores it in Redis under a short ID. Optional
`ttl_hours` (clamped server-side to `MAX_SHARE_TTL_HOURS`, default 720/30 days).

```bash
curl -X POST localhost:8080/api/v1/shares \
  -H "Content-Type: application/json" \
  -d '{
        "left":  {"name": "Alice", "age": 30},
        "right": {"name": "Alice", "age": 31},
        "ttl_hours": 24
      }'
```

Response:

```json
{"id": "aB3xQ9kLmZ", "url": "/api/v1/shares/aB3xQ9kLmZ", "expiresAt": "2026-08-02T13:00:00Z"}
```

### `GET /api/v1/shares/:id`

Fetches the stored record (`left`, `right`, `delta`, timestamps). 404 if
missing or expired.

```bash
curl localhost:8080/api/v1/shares/aB3xQ9kLmZ
```

### `GET /api/v1/shares/:id/export?format=json|text`

Downloads the diff. `format=json` returns the raw delta; `format=text` returns
a human-readable ASCII diff.

```bash
curl -OJ "localhost:8080/api/v1/shares/aB3xQ9kLmZ/export?format=text"
```

## Testing

```bash
go test ./...
```
