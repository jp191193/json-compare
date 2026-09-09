import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const SHARE_CRAWLER =
  /bot|crawler|spider|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|iframely|embedly|skypeuripreview|redditbot|applebot|googlebot|bingbot|duckduckbot|preview|unfurl/i

function isShareCrawler(ua: string | undefined) {
  return Boolean(ua && SHARE_CRAWLER.test(ua))
}

/** Proxy crawler hits on /share/:id to the Go OG HTML handler. */
function shareOgDevProxy(): Plugin {
  return {
    name: 'share-og-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        const match = path.match(/^\/share\/([^/]+)\/?$/)
        if (!match || !isShareCrawler(req.headers['user-agent'])) {
          next()
          return
        }

        const api = (process.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
        const host = req.headers.host || 'localhost:5173'
        try {
          const upstream = await fetch(`${api}/share/${encodeURIComponent(match[1])}`, {
            headers: { 'X-Public-Base-URL': `http://${host}` },
          })
          const html = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('content-type', 'text/html; charset=utf-8')
          const robots = upstream.headers.get('x-robots-tag')
          if (robots) res.setHeader('x-robots-tag', robots)
          res.end(html)
        } catch {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), shareOgDevProxy()],
  server: {
    port: 5173,
  },
})
