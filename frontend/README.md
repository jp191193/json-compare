# Frontend

React + Vite + TypeScript UI for [JSON Compare](../README.md).

```bash
cp .env.example .env
npm install
npm run dev
```

Dev server: `http://localhost:5173`. Compare and hash share links run entirely in the browser; `VITE_API_BASE_URL` is only needed for Redis `/share/:id` links (default `http://localhost:8080`).
