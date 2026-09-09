# Frontend

React + Vite + TypeScript UI for [JSON Compare](../README.md).

```bash
cp .env.example .env
npm install
npm run dev
```

Dev server: `http://localhost:5173` (expects the API at `VITE_API_BASE_URL`, default `http://localhost:8080`).

Crawler user-agents on `/share/:id` are proxied to the API’s `GET /share/:id` HTML (Open Graph tags from diff stats, no JSON). Browsers still get the React share page. On Vercel, the same split is `vercel.json` + `api/og.js` (`API_BASE_URL` or `VITE_API_BASE_URL`).
