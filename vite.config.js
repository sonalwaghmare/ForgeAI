import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // loadEnv, not process.env: vite.config.js is evaluated before Vite loads env
  // files, so process.env never sees .env.local. Reading it explicitly is what
  // lets the proxy target be configured alongside every other setting.
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * One variable decides the whole backend: `VITE_API_URL`.
   *
   * The proxy is derived from it rather than configured beside it, so changing
   * the endpoint is one line in `.env` and nothing here needs touching. The
   * origin becomes the target and the path becomes the rule that forwards to it:
   *
   *   VITE_API_URL=https://api-newforge.forgeai.pragmatyc.com/api
   *     → proxy '/api' to https://api-newforge.forgeai.pragmatyc.com
   *     → /api/v1/login reaches https://api-newforge.forgeai.pragmatyc.com/api/v1/login
   *
   * ── Why dev goes through a proxy at all ──────────────────────────────────
   * The API's CORS allows exactly one origin, the deployed frontend's. A dev
   * server on localhost is not it, so a direct call is refused at preflight and
   * never lands. Proxied, `/api` is same-origin and CORS does not enter into it —
   * which is also what keeps session cookies first-party. A production build has
   * no proxy and calls the API directly; see `services/config.js`.
   */
  const apiUrl = env.VITE_API_URL || 'http://localhost:8000/api'

  let api
  try {
    api = new URL(apiUrl)
  } catch {
    // Failing here with the reason beats Vite starting and every request 404ing
    // against a proxy rule built from a malformed value.
    throw new Error(
      `VITE_API_URL is not a valid absolute URL: ${JSON.stringify(apiUrl)}\n` +
        'Expected something like https://api-newforge.forgeai.pragmatyc.com/api',
    )
  }

  // Trailing slashes stripped so the rule is `/api`, not `/api/` — the latter
  // would not match a request for `/api/v1/login`.
  const apiPath = api.pathname.replace(/\/+$/, '') || '/api'

  const proxy = { target: api.origin, changeOrigin: true, secure: false }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    // One rule, two servers. `preview` serves the real build output, and it needs
    // the same forwarding as `dev` so the artifact can be checked on localhost
    // before it is handed over — see `servedLocally` in services/config.js.
    server: { port: 5173, proxy: { [apiPath]: proxy } },
    preview: { port: 4173, proxy: { [apiPath]: proxy } },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          // Vite 8 runs Rolldown, which takes manualChunks as a function only.
          // Splitting these out keeps the vendor layers cacheable across releases:
          // recharts and the ICU message formatter are large and change rarely.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
              return 'react'
            }
            /* The world map's geometry and projection. Its own chunk, and
               NOT part of `vendor`: `world-atlas`'s land outline is ~55KB of
               JSON that only the Executive Dashboard renders, and vendor is
               downloaded by every page. Named here so it stays out of the
               shared bundle even though it lives in node_modules. */
            if (/world-atlas|topojson-client|d3-geo|d3-array|d3-path/.test(id)) return 'worldmap'
            if (id.includes('recharts') || id.includes('d3-')) return 'charts'
            if (/i18next|intl-messageformat|@formatjs/.test(id)) return 'i18n'
            return 'vendor'
          },
        },
      },
    },
  }
})
