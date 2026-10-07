/**
 * Drives the copilot's live path against a running backend, through Vite's SSR
 * loader so `@/` aliases and import.meta.env resolve exactly as in the browser.
 *
 * This is the only automated check the copilot screen has. The repo has no
 * component test framework, so without this the mapping from SSE events to the
 * screen's block shape would be verified by looking at it — and the whole point
 * of the evidence block is that a reader can trust what is under the text.
 *
 * Needs the backend on :8080 and the AI engine behind it. Skips loudly if the
 * backend is not up, rather than passing a check it never ran.
 *
 *   node scripts/verify-copilot-live.mjs
 */
import { createServer } from 'vite'

globalThis.document = {
  documentElement: { lang: 'en', dir: 'ltr', dataset: {}, classList: { toggle() {} } },
  cookie: '',
  body: { dataset: {} },
}
globalThis.location = {
  href: 'http://localhost/', origin: 'http://localhost', protocol: 'http:',
  search: '', hash: '', pathname: '/',
}
const store = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  },
  location: globalThis.location,
  document: globalThis.document,
}
globalThis.localStorage = globalThis.window.localStorage
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en', languages: ['en'] },
  configurable: true,
})

/** Mirrors liveAnswer.js. Divergence here is the failure this script exists to catch. */
const LABELLED = new Set(['evidence', 'anomaly', 'asset', 'statistic', 'relationship', 'rca'])
const STEPS = new Set([
  'resolve_entity', 'get_anomaly', 'find_anomalies', 'series_stats', 'get_rca', 'run_rca',
])

const API = process.env.VITE_API_URL || 'http://localhost:8080/api'
const ALIAS = process.env.FORGE_ACCOUNT || 'pragmatyc'
const EMAIL = process.env.FORGE_EMAIL || 'rohan@gmail.com'
const PASSWORD = process.env.FORGE_PASSWORD

if (!PASSWORD) {
  console.error('FORGE_PASSWORD is not set (the backend .env has it as SEED_USER_PASSWORD).')
  process.exit(2)
}

const reachable = await fetch(`${API.replace(/\/api$/, '')}/docs`).then(() => true, () => false)
if (!reachable) {
  console.error(`backend not reachable at ${API} — start it before running this.`)
  process.exit(2)
}

const server = await createServer({
  configFile: 'vite.config.js',
  server: { middlewareMode: true },
  logLevel: 'error',
})

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`  ok   ${name}`)
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`) }
}

try {
  const { setAccessToken } = await server.ssrLoadModule('/src/services/authToken.js')
  const { askCopilot } = await server.ssrLoadModule('/src/features/copilot/screen.js')

  const login = await fetch(`${API}/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_alias: ALIAS, email: EMAIL, password: PASSWORD }),
  }).then((response) => response.json())
  const token = login?.data?.access_token
  if (!token) { console.error('login failed:', JSON.stringify(login).slice(0, 200)); process.exit(2) }
  setAccessToken(token)

  console.log('\nCOPILOT live path — SSE events to the screen\'s blocks\n')

  const anomalyId = process.env.FORGE_ANOMALY_ID || null
  const first = await askCopilot({
    question: 'what happened with this anomaly?',
    scope: anomalyId ? { page_anomaly_id: anomalyId } : {},
  })

  check('the turn answered', first.matched === true, JSON.stringify(first).slice(0, 200))
  check('a session was opened', Boolean(first.sessionId), String(first.sessionId))
  const text = first.blocks.find((block) => block.type === 'text')
  check('there is prose to read', Boolean(text?.text))

  // The evidence block is the reason the prose is worth believing: the service
  // strips any claim it cannot tie to a record, so an answer that arrived with
  // text and no sources means either nothing was read or the mapping dropped it.
  const evidence = first.blocks.find((block) => block.type === 'evidence')
  if (evidence) {
    check('every cited record has a label', evidence.rows.every((row) => row.value))
    check('every row key is one the screen can translate',
      evidence.rows.every((row) => LABELLED.has(row.key)),
      JSON.stringify(evidence.rows.map((row) => row.key)))
  } else {
    console.log('  note the answer cited nothing — no evidence block to check')
  }

  check('reasoning steps are keys the screen can translate',
    first.reasoning.every((step) => STEPS.has(step)), JSON.stringify(first.reasoning))

  // The property that makes it a conversation rather than a search box.
  const second = await askCopilot({
    question: 'which detectors were those again?',
    scope: anomalyId ? { page_anomaly_id: anomalyId } : {},
    sessionId: first.sessionId,
  })
  check('the follow-up stayed in the same conversation', second.sessionId === first.sessionId,
    `${first.sessionId} -> ${second.sessionId}`)
  check('the follow-up answered', second.matched === true)

  console.log(failures ? `\n${failures} failed\n` : '\nall checks passed\n')
} finally {
  await server.close()
}

process.exit(failures ? 1 : 0)
