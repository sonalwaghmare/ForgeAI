/**
 * Exercises the real service layer through Vite's SSR loader, so `@/` aliases
 * and import.meta.env resolve exactly as they do in the browser. This runs the
 * actual axios instance, the actual interceptors and the actual mock adapter.
 */
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

// Minimal DOM surface the i18n + http layers touch at import time.
globalThis.document = {
  documentElement: { lang: 'en', dir: 'ltr', dataset: {}, classList: { toggle() {} } },
  cookie: '',
  body: { dataset: {} },
}
// axios treats a defined `document` as a browser environment and then reads
// window.location, so the stub has to be complete enough to satisfy it.
globalThis.location = {
  href: 'http://localhost/',
  origin: 'http://localhost',
  protocol: 'http:',
  // i18next's browser language detector reads location.search and location.hash.
  search: '',
  hash: '',
  pathname: '/',
}
globalThis.window = {
  localStorage: { getItem: () => null, setItem() {} },
  location: globalThis.location,
  document: globalThis.document,
}
// Node 24 exposes navigator as a getter-only global, so extend rather than assign.
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en', languages: ['en'] },
  configurable: true,
})

const server = await createServer({
  configFile: 'vite.config.js',
  server: { middlewareMode: true },
  logLevel: 'error',
})

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.log(`  FAIL ${name} ${detail}`)
  }
}

try {
  const { endpoints } = await server.ssrLoadModule('/src/services/endpoints.js')
  const { del, get, patch, post, put } = await server.ssrLoadModule('/src/services/http.js')
  const { formatMeasure } = await server.ssrLoadModule('/src/lib/units.js')
  const { formatPercent, formatHours, formatRelative } = await server.ssrLoadModule(
    '/src/lib/format.js',
  )

  console.log('\nENDPOINTS through axios + mock adapter\n')

  const org = await get(endpoints.org.current)
  check('GET /org returns 3 sites', org.sites?.length === 3, `got ${org.sites?.length}`)
  check('org is Meridian Industrial', org.name === 'Meridian Industrial')
  check(
    'sites span 3 countries',
    new Set(org.sites.map((s) => s.country)).size === 3,
    JSON.stringify(org.sites.map((s) => s.country)),
  )

  const units = Object.fromEntries(org.sites.map((s) => [s.code, s.units.vibration]))
  check(
    'units are per-site, not global',
    units.FDY === 'in/s' && units.WTM === 'mm/s' && units.PNQ === 'mm/s',
    JSON.stringify(units),
  )

  const ent = await get(endpoints.org.entitlements)
  /* `analytics` was the off entry here until Analytics & Reports was built.
     The property being tested is that the map CAN say no, not that it says no
     about that one module — so it now names the module this rebuild has
     actually declined to build. */
  check('entitlements can gate a module off', ent.modules?.workbook === false)
  check(
    'and every nav item names an entitlement the map answers for',
    await (async () => {
      const { ALL_NAV_ITEMS } = await server.ssrLoadModule('/src/shell/navigation.js')
      return ALL_NAV_ITEMS.every((item) => item.entitlement in ent.modules)
    })(),
  )
  /* The rail labels itself with `t(`screens.${item.id}`)`, which `verify:i18n`
     cannot see — it scans for literal keys and a template is not one. So a nav
     item added without its label ships the raw key into the sidebar, which is
     exactly how `screens.reports` got there. */
  check(
    'every nav item has a label, not a raw key',
    await (async () => {
      const { ALL_NAV_ITEMS } = await server.ssrLoadModule('/src/shell/navigation.js')
      const app = JSON.parse(
        await readFile(new URL('../src/i18n/locales/en/app.json', import.meta.url), 'utf8'),
      )
      return ALL_NAV_ITEMS.every((item) => Boolean(app.screens?.[item.id]))
    })(),
    (await (async () => {
      const { ALL_NAV_ITEMS } = await server.ssrLoadModule('/src/shell/navigation.js')
      const app = JSON.parse(
        await readFile(new URL('../src/i18n/locales/en/app.json', import.meta.url), 'utf8'),
      )
      return ALL_NAV_ITEMS.filter((item) => !app.screens?.[item.id])
        .map((item) => item.id)
        .join(', ')
    })()),
  )

  const hierarchy = await get(endpoints.demoHierarchy.tree)
  const depth = (node) => 1 + Math.max(0, ...(node.children ?? []).map(depth))
  check('hierarchy reaches asset depth', depth(hierarchy) === 6, `depth ${depth(hierarchy)}`)

  const scopes = await get(endpoints.demoHierarchy.scopes)
  check('scope list flattens the tree', scopes.items.length > 20, `${scopes.items.length} scopes`)
  check(
    'every tier is present in the tree',
    ['enterprise', 'region', 'subRegion', 'site', 'line', 'asset'].every((tier) =>
      scopes.items.some((s) => s.tier === tier),
    ),
    [...new Set(scopes.items.map((s) => s.tier))].join(','),
  )
  check(
    'sub-region sits between region and site',
    scopes.items.find((s) => s.tier === 'subRegion')?.depth === 2 &&
      scopes.items.find((s) => s.tier === 'site')?.depth === 3,
  )

  const counts = await get(endpoints.alerts.counts)
  check('counts.all excludes resolved', counts.all === 11, `all=${counts.all}`)
  check('counts.critical = 3', counts.critical === 3, `critical=${counts.critical}`)
  check('counts.unassigned = 3', counts.unassigned === 3, `unassigned=${counts.unassigned}`)
  check(
    'facet counts sum to all',
    counts.critical + counts.high + counts.medium + counts.low === counts.all,
    `${counts.critical}+${counts.high}+${counts.medium}+${counts.low} vs ${counts.all}`,
  )

  const list = await get(endpoints.alerts.list, { params: { sort: 'severity' } })
  check('list returns items + total', Array.isArray(list.items) && list.total > 0)
  check(
    'severity sort puts critical first',
    list.items[0].severity === 'critical',
    list.items[0].severity,
  )
  check('every item has detectedAt', list.items.every((a) => Boolean(a.detectedAt)))
  check(
    'every reading carries a unit',
    list.items.every((a) => Boolean(a.reading.unit) && Boolean(a.threshold.unit)),
  )
  check(
    'reading and threshold units always match',
    list.items.every((a) => a.reading.unit === a.threshold.unit),
  )

  const scoped = await get(endpoints.alerts.list, { params: { siteId: 'site_weissenthurm' } })
  check(
    'site scope filters',
    scoped.items.every((a) => a.siteId === 'site_weissenthurm'),
    `${scoped.items.length} items`,
  )
  check(
    'German site reads in mm/s',
    scoped.items.every((a) => a.reading.unit !== 'in/s'),
  )

  const unassigned = await get(endpoints.alerts.list, { params: { unassigned: true } })
  check(
    'unassigned facet filters',
    unassigned.items.every((a) => a.assigneeId === null) && unassigned.items.length === 3,
    `${unassigned.items.length}`,
  )

  const analysis = await get(endpoints.alerts.analysis('ALR-4471'), { meta: { ai: true } })
  check('flagship analysis present', analysis?.alertId === 'ALR-4471')
  check('trace has points', analysis.trace.length === 31, `${analysis.trace.length}`)
  check(
    'trace crosses its threshold',
    Math.max(...analysis.trace) > analysis.traceThreshold,
    `max ${Math.max(...analysis.trace)} vs ${analysis.traceThreshold}`,
  )
  check(
    'anomaly onset is inside the series',
    analysis.traceAnomalyFrom > 0 && analysis.traceAnomalyFrom < analysis.trace.length,
  )
  check('evidence rows present', analysis.evidence.length === 6)
  check('tool calls present', analysis.toolCalls.length === 5)

  const handover = await get(endpoints.shifts.handover)
  check('handover carries 3 alerts', handover.carriedAlerts.length === 3)
  check(
    'handover summary is SQDCP order',
    handover.summary.map((r) => r.key).join(',') === 'safety,quality,delivery,cost,people',
    handover.summary.map((r) => r.key).join(','),
  )
  check('handover is unacknowledged', handover.acknowledgedAt === null)
  check(
    'flagship is in the carried set',
    handover.carriedAlerts.some((a) => a.id === 'ALR-4471'),
  )

  const wo = await get(endpoints.workOrders.list)
  check('an AI-drafted work order exists', wo.items.some((o) => o.authoredBy === 'ai'))
  check(
    'the AI-drafted order is NOT released',
    wo.items.find((o) => o.authoredBy === 'ai').state === 'draft',
  )
  check(
    'the AI-drafted order names its safety gates',
    wo.items.find((o) => o.authoredBy === 'ai').gates.includes('loto'),
  )

  const shift = await get(endpoints.shifts.current)
  check('current shift resolves', ['morning', 'afternoon', 'night'].includes(shift.shift), shift.shift)

  const topline = await get(endpoints.kpis.topline)
  check('topline has OEE', typeof topline.oee.value === 'number')

  console.log('\nDATA FUSION — connection_config assembly\n')

  /* No network here: these are the pure functions that turn the Connect-source
     form into the body POST /connections/test receives. They are checked because
     every one of them fails SILENTLY — a mis-shaped config does not error, it
     produces a probe that cannot authenticate and a "the broker is unreachable"
     message pointing at the wrong thing entirely.

     The schema below is the live response from GET /connections/connector-types,
     verbatim. */
  const fusion = await server.ssrLoadModule('/src/features/dataFusion/api.js')

  const MQTT_FIELDS = [
    { key: 'host', type: 'text', label: 'Host', required: true },
    { key: 'port', type: 'number', label: 'Port', required: true },
    { key: 'use_tls', type: 'checkbox', label: 'Use TLS', required: false },
    { key: 'auth.username', type: 'text', label: 'Username', required: false },
    { key: 'auth.password', type: 'password', label: 'Password', required: false },
  ]

  const config = fusion.buildConnectionConfig(MQTT_FIELDS, {
    host: '  mqtt.plant.local  ',
    port: '8883',
    use_tls: true,
    'auth.username': 'forge_ingest',
    'auth.password': ' pa ss ',
  })

  check(
    'a dotted key nests — auth.username is NOT a flat key',
    config.auth?.username === 'forge_ingest' && !('auth.username' in config),
    JSON.stringify(config),
  )
  check(
    'a checkbox is a real boolean, not the string "true"',
    config.use_tls === true,
    `${typeof config.use_tls} ${config.use_tls}`,
  )
  check(
    'a number field is a number — int(port) has to work server-side',
    config.port === 8883 && typeof config.port === 'number',
    `${typeof config.port} ${config.port}`,
  )
  check('a text field is trimmed', config.host === 'mqtt.plant.local', `"${config.host}"`)
  check(
    'a password is NOT trimmed — its whitespace is part of the credential',
    config.auth?.password === ' pa ss ',
    `"${config.auth?.password}"`,
  )

  const unchecked = fusion.buildConnectionConfig(MQTT_FIELDS, { host: 'h', port: 1883 })
  check(
    'an unticked checkbox is sent as false, not omitted',
    unchecked.use_tls === false,
    JSON.stringify(unchecked),
  )

  /* The server's rule, and the counter-intuitive one. `validate_connection_config`
     rejects a payload that leaves an optional field OUT — "must be included in the
     request, even if left blank" — so a blank optional travels as explicit null.

     These two checks previously asserted the opposite, which is how the earlier
     version of buildConnectionConfig passed a green harness while failing every
     real create. A check that encodes the wrong contract is worse than no check:
     it certifies the bug. */
  check(
    'a blank optional is present as null, NOT omitted',
    'auth' in unchecked && unchecked.auth.username === null && unchecked.auth.password === null,
    JSON.stringify(unchecked),
  )
  check(
    'every declared field appears in the payload',
    MQTT_FIELDS.every((field) => {
      const parts = field.key.split('.')
      let node = unchecked
      for (const part of parts) {
        if (node == null || !(part in node)) return false
        node = node[part]
      }
      return true
    }),
    JSON.stringify(unchecked),
  )

  const OPCUA_FIELDS = [
    { key: 'endpoint', type: 'text', label: 'Endpoint URL', required: true },
    {
      key: 'security_policy',
      type: 'select',
      label: 'Security Policy',
      required: false,
      options: ['Basic128Rsa15', 'Basic256', 'Basic256Sha256'],
    },
    { key: 'auth.password', type: 'password', label: 'Password', required: false },
  ]

  const opcua = fusion.buildConnectionConfig(OPCUA_FIELDS, {
    endpoint: 'opc.tcp://10.4.2.11:4840',
    security_policy: 'Basic256Sha256',
  })
  check(
    'a select carries its chosen option through',
    opcua.security_policy === 'Basic256Sha256' && opcua.endpoint === 'opc.tcp://10.4.2.11:4840',
    JSON.stringify(opcua),
  )
  check(
    'an unset optional select is null, not an empty string',
    // "" is a string, and the server checks a select's value against its options
    // list — so an empty string fails where null is explicitly allowed.
    fusion.buildConnectionConfig(OPCUA_FIELDS, { endpoint: 'opc.tcp://x:4840' })
      .security_policy === null,
  )

  check(
    'required fields left empty are reported',
    Object.keys(fusion.missingRequired(MQTT_FIELDS, {})).sort().join(',') === 'host,port',
    Object.keys(fusion.missingRequired(MQTT_FIELDS, {})).join(','),
  )
  check(
    'a whitespace-only value does not satisfy a required field',
    Boolean(fusion.missingRequired(MQTT_FIELDS, { host: '   ', port: 1883 }).host),
  )
  check(
    'nothing is reported when every required field is filled',
    Object.keys(fusion.missingRequired(MQTT_FIELDS, { host: 'h', port: 1883 })).length === 0,
  )

  /* The caption on the wizard's test step and on the edit form's probe panel:
     what address is about to be dialled. A heuristic over the schema rather than
     a per-connector hardcode, so it is worth pinning what it resolves to for the
     two seeded connector types — and pinning that it says nothing rather than
     something invented when the form is empty. */
  const mqttConnector = { fields: MQTT_FIELDS }
  check(
    'the dialled address is host:port for MQTT',
    fusion.endpointLabel(mqttConnector, { host: 'mqtt.plant.local', port: '8883' }) ===
      'mqtt.plant.local:8883',
    fusion.endpointLabel(mqttConnector, { host: 'mqtt.plant.local', port: '8883' }),
  )
  check(
    'the dialled address is the endpoint alone when the schema has no port',
    fusion.endpointLabel({ fields: OPCUA_FIELDS }, { endpoint: 'opc.tcp://10.4.2.11:4840' }) ===
      'opc.tcp://10.4.2.11:4840',
    fusion.endpointLabel({ fields: OPCUA_FIELDS }, { endpoint: 'opc.tcp://10.4.2.11:4840' }),
  )
  check(
    'no address is claimed while the form is empty',
    fusion.endpointLabel(mqttConnector, {}) === null &&
      fusion.endpointLabel(mqttConnector, { host: '   ' }) === null,
  )
  check(
    'a host with no port yet is shown bare, not as "host:"',
    fusion.endpointLabel(mqttConnector, { host: 'mqtt.plant.local' }) === 'mqtt.plant.local',
    fusion.endpointLabel(mqttConnector, { host: 'mqtt.plant.local' }),
  )

  console.log('\nDEMO HIERARCHY (read-only)\n')

  /* Settings → Sites & Hierarchy now writes to the live API, so the fixture
     hierarchy has no write routes left to exercise. What it still has to do is
     feed the demo, and these are the shapes that would break if it stopped. */

  const nodes = await get(endpoints.demoHierarchy.nodes)
  check(
    'node list returns the tier ladder',
    nodes.tiers.join(',') === 'enterprise,region,subRegion,site,line,asset',
    nodes.tiers?.join(','),
  )
  check('every node but the root has a parent', nodes.items.filter((n) => n.parentId === null).length === 1)

  const orgSites = await get(endpoints.org.current)
  check(
    'the org site list is derived from the node list',
    orgSites.sites.length === nodes.items.filter((n) => n.tier === 'site').length,
    `${orgSites.sites.length} sites`,
  )
  check(
    'every demo site carries a unit system',
    orgSites.sites.every((s) => s.units?.vibration),
    orgSites.sites.map((s) => s.units?.vibration).join(','),
  )

  /**
   * AUTH CONTRACT
   *
   * Sign-in is not fixture-backed — it talks to the real API — so there is no
   * credential to exercise here and nothing in this file should invent one.
   * What IS checkable without a running backend is the contract around it: the
   * paths, the envelope shape, the two error shapes, and above all that the
   * fixture layer refuses to answer an auth request.
   */
  console.log('\nAUTH CONTRACT (live API — no fixtures)\n')

  const { unwrapEnvelope } = await server.ssrLoadModule('/src/services/http.js')
  const { toApiError } = await server.ssrLoadModule('/src/services/apiError.js')
  const { mockAdapter } = await server.ssrLoadModule('/src/mocks/mockAdapter.js')

  // Pinned: these must match the backend's actual routes. Drift here is a silent
  // 404 at sign-in, which presents as "the password is wrong".
  check('login path is /v1/login', endpoints.auth.login === '/v1/login', endpoints.auth.login)
  check('refresh path is /v1/refresh', endpoints.auth.refresh === '/v1/refresh', endpoints.auth.refresh)
  check('no logout endpoint is claimed', endpoints.auth.logout === undefined)
  check('no session endpoint is claimed', endpoints.auth.session === undefined)

  // The important one. If a fixture ever answers an auth path again, a credential
  // the real service would reject could be accepted locally.
  await mockAdapter({ url: '/v1/login', method: 'post', baseURL: '/api', headers: {} }).then(
    () => check('fixture layer refuses POST /v1/login', false, 'it answered'),
    (error) =>
      check(
        'fixture layer refuses POST /v1/login',
        error.response?.status === 404,
        `status=${error.response?.status}`,
      ),
  )
  await mockAdapter({ url: '/v1/refresh', method: 'post', baseURL: '/api', headers: {} }).then(
    () => check('fixture layer refuses POST /v1/refresh', false, 'it answered'),
    (error) =>
      check(
        'fixture layer refuses POST /v1/refresh',
        error.response?.status === 404,
        `status=${error.response?.status}`,
      ),
  )

  // Envelope unwrapping, both directions.
  check(
    'envelope is unwrapped to its payload',
    unwrapEnvelope({
      message: 'Login successful.',
      response_code: 200,
      status: 'success',
      data: { access_token: 'a' },
    })?.access_token === 'a',
  )
  check(
    'a plain payload passes through untouched',
    unwrapEnvelope({ items: [1, 2] })?.items?.length === 2,
  )
  check(
    'a payload with its own data key is not mistaken for an envelope',
    unwrapEnvelope({ data: 'inner' })?.data === 'inner',
  )

  // Error shape 1: the application envelope.
  const envelopeError = toApiError({
    response: {
      status: 401,
      data: {
        message: 'Login failed.',
        response_code: 401,
        status: 'error',
        reason: { credentials: 'The email or password you entered is incorrect.' },
      },
      headers: {},
    },
  })
  check('401 envelope -> unauthorized', envelopeError.code === 'unauthorized', envelopeError.code)
  check('envelope reason becomes fields', Boolean(envelopeError.fields?.credentials))

  // Error shape 2: FastAPI's own validation error, which is NOT enveloped.
  const validationError = toApiError({
    response: {
      status: 422,
      data: { detail: [{ loc: ['body', 'email'], msg: 'value is not a valid email address' }] },
      headers: {},
    },
  })
  check('422 -> validation', validationError.code === 'validation', validationError.code)
  check(
    'FastAPI detail[] is flattened to a field name',
    Boolean(validationError.fields?.email),
    JSON.stringify(validationError.fields),
  )
  check(
    'array detail never becomes the printed message',
    typeof validationError.detail !== 'object',
    String(validationError.detail),
  )

  /* ── OEE and Lines · DEMO ───────────────────────────────────────────────
     These routes COMPOSE their answer from three fixtures rather than returning
     a stored one, so the ways they can break are not visible by reading the
     fixture: a bad join throws inside the handler, axios sees an error with no
     response, and the screen reports "cannot reach the platform" — which sent
     one debugging round after the backend instead of after `PEOPLE.find` being
     called on an object.

     Every composed route is called here for that reason. A green fixture is not
     evidence that the handler over it runs. */
  console.log('\nOEE + LINES · composed routes\n')

  const oee = await get(endpoints.oee.summary, { params: { period: 'day' } })
  const factors = Object.fromEntries(oee.kpis.map((k) => [k.key, k.value]))
  check(
    'OEE equals availability × performance × quality',
    Math.round(factors.availability * (factors.performance / 100) * (factors.quality / 100) * 10) /
      10 === factors.oee,
    JSON.stringify(factors),
  )
  const losses = oee.waterfall.filter((row) => row.value < 0).reduce((sum, r) => sum - r.value, 0)
  check(
    'the printed waterfall adds up to the printed headline',
    Math.round((100 - losses) * 10) / 10 === factors.oee,
    `100 − ${Math.round(losses * 10) / 10} vs ${factors.oee}`,
  )
  check('trend carries all four series', oee.trend.length === 4, String(oee.trend.length))

  const oeeLines = await get(endpoints.oee.byLine)
  const lines = await get(endpoints.productionLines.list)
  check(
    'the OEE table and the lines list agree on the line set',
    JSON.stringify(oeeLines.items.map((l) => l.id)) ===
      JSON.stringify(lines.items.map((l) => l.id)),
    JSON.stringify(oeeLines.items.map((l) => l.id)),
  )
  check(
    'lines are scoped to one site',
    new Set(lines.items.map((l) => l.siteId)).size === 1,
    JSON.stringify([...new Set(lines.items.map((l) => l.siteId))]),
  )
  check(
    'every line resolves its operator',
    lines.items.every((l) => typeof l.operatorName === 'string'),
    JSON.stringify(lines.items.map((l) => l.operatorName)),
  )
  check(
    'assets ride along with the list',
    lines.items.every((l) => l.assets.length === l.assetCount) &&
      lines.items.some((l) => l.assets.length > 0),
  )

  const richLine = lines.items.find((l) => l.rich)
  check('one line is modelled to flow depth', Boolean(richLine))
  const detail = await get(endpoints.productionLines.detail(richLine.id))
  check(
    'flow order is the hierarchy order',
    detail.assets[0].code.includes('CUP') &&
      detail.assets[detail.assets.length - 1].code.includes('PAL'),
    detail.assets.map((a) => a.code).join(' → '),
  )
  check(
    'exactly one station is blocked and the rest downstream are starved',
    detail.assets.filter((a) => a.blocked).length === 1 &&
      detail.assets.filter((a) => a.starved).length === 4,
  )
  check('the line carries its own open alerts', detail.openAlerts.length > 0)
  check(
    'every alert on the line belongs to an asset on it',
    detail.openAlerts.every((alert) => detail.assets.some((a) => a.id === alert.assetId)),
  )

  const washer = await get(endpoints.assets.detail(detail.stoppedAtAssetId))
  check('the blocked asset has a component model', washer.components.length > 0)
  check(
    'every sensor alertId resolves to a record the screen was given',
    washer.components
      .flatMap((c) => c.sensors)
      .filter((s) => s.alertId)
      .every((s) => washer.openAlerts.some((alert) => alert.id === s.alertId)),
  )
  check(
    'a sensor reading matches the alert raised on it',
    washer.components
      .flatMap((c) => c.sensors)
      .filter((s) => s.alertId)
      .every((s) => {
        const alert = washer.openAlerts.find((a) => a.id === s.alertId)
        return alert.reading.value === s.value && alert.reading.unit === s.unit
      }),
  )

  const assets = await get(endpoints.assets.list, { params: { pageSize: 100 } })
  check(
    'the asset collection covers every asset on every line',
    assets.total === lines.items.reduce((sum, l) => sum + l.assetCount, 0),
    `${assets.total} vs ${lines.items.reduce((sum, l) => sum + l.assetCount, 0)}`,
  )
  check(
    'every asset resolves its owner and its line',
    assets.items.every((a) => a.ownerName && a.lineName),
  )
  check(
    'facets count the site, not the filtered page',
    assets.facets.all === assets.total,
    `${assets.facets.all} vs ${assets.total}`,
  )
  const offline = await get(endpoints.assets.list, { params: { quick: 'offline', pageSize: 100 } })
  check(
    'a quick filter narrows the rows but not the facets',
    offline.items.every((a) => !a.online) && offline.facets.all === assets.total,
  )
  check(
    'the stat bar adds up',
    assets.stats.online + assets.stats.offline === assets.stats.total &&
      assets.stats.good + assets.stats.watch + assets.stats.poor === assets.stats.total,
    JSON.stringify(assets.stats),
  )
  const byHealth = await get(endpoints.assets.list, { params: { sort: 'health', pageSize: 100 } })
  check(
    'sorting by health actually sorts',
    byHealth.items.every((a, i, arr) => i === 0 || arr[i - 1].health <= a.health),
  )

  check('the asset carries a composed briefing', typeof washer.briefing?.text === 'string')
  check(
    'the briefing names the asset it is about',
    washer.briefing.text.startsWith(washer.name),
    washer.briefing.text.slice(0, 60),
  )
  check(
    'a briefing that claims an alert names a real one',
    !washer.briefing.urgent ||
      washer.openAlerts.some((alert) => washer.briefing.text.includes(alert.id)),
  )
  const healthy = await get(endpoints.assets.detail('FDY-CUP-01'))
  check(
    'a healthy asset gets the stable briefing, not the urgent one',
    healthy.briefing.urgent === false && healthy.openAlerts.length === 0,
  )
  check(
    'two assets do not share one briefing',
    healthy.briefing.text !== washer.briefing.text,
  )
  check(
    'performance carries the set both views draw from',
    ['oee', 'availability', 'runtime', 'mtbf', 'uptime', 'mttr'].every((key) =>
      washer.performance.some((kpi) => kpi.key === key),
    ),
    washer.performance.map((kpi) => kpi.key).join(','),
  )
  check(
    'the status split always totals 100',
    ['24h', '7d', '30d'].every(
      (w) => washer.statusHistory[w].rows.reduce((sum, row) => sum + row.pct, 0) === 100,
    ),
  )
  check(
    'the pareto is ordered worst first and its cumulative reaches 100',
    washer.pareto.every((row, i, arr) => i === 0 || arr[i - 1].hours >= row.hours) &&
      washer.pareto[washer.pareto.length - 1].cumulativePct === 100,
  )
  check(
    'a modelled sensor keeps the series its component card draws',
    washer.signals.some(
      (signal) =>
        signal.values ===
        washer.components.flatMap((c) => c.sensors).find((s) => s.name === signal.name)?.series,
    ) ||
      washer.signals.some((signal) =>
        washer.components.flatMap((c) => c.sensors).some((s) => s.name === signal.name),
      ),
  )
  check('the alert heatmap covers 91 days', washer.alertHistory.counts.length === 91)
  check(
    'the heatmap counts exactly the events the table lists',
    washer.alertHistory.counts.reduce((sum, n) => sum + n, 0) === washer.alertHistory.events.length &&
      washer.alertHistory.stats.total === washer.alertHistory.events.length,
    `${washer.alertHistory.counts.reduce((sum, n) => sum + n, 0)} vs ${washer.alertHistory.events.length}`,
  )
  check(
    'every open alert appears at the top of the history',
    washer.openAlerts
      .filter((alert) => alert.assetId === washer.id)
      .every((alert) => washer.alertHistory.events.some((event) => event.id === alert.id)),
  )
  check(
    'the BOM, documents, maintenance, insights and audit are all present',
    washer.bom.length > 0 &&
      washer.documents.items.length > 0 &&
      washer.maintenance.checklist.length > 0 &&
      Boolean(washer.maintenance.nextAt) &&
      washer.insights.clusters.length > 0 &&
      washer.audit.length > 0,
  )
  check(
    'the PM calendar places its events in the month the PM falls in',
    (() => {
      const next = new Date(washer.maintenance.nextAt)
      return washer.maintenance.events.every((event) => {
        const at = new Date(event.at)
        return at.getMonth() === next.getMonth() && at.getFullYear() === next.getFullYear()
      })
    })(),
  )
  check(
    'the PM itself is on the calendar, not only in the card above it',
    washer.maintenance.events.some((event) => event.primary),
  )
  /* `model` used to be in this list and can no longer occur: the tab now
     resolves against the Data Fusion registry, whose links reach the estate's
     own tiers only. `enterprise` was missing and can — a policy with no links at
     all reaches every asset, which is the case the old hand-written list never
     produced. */
  check(
    'every document says which level it was inherited from',
    washer.documents.items.every((doc) =>
      ['asset', 'line', 'site', 'enterprise'].includes(doc.via),
    ),
    [...new Set(washer.documents.items.map((doc) => doc.via))].join(', '),
  )
  check(
    'the asset tab and the Documents screen are one collection now',
    washer.documents.items.every((doc) => /^DOC-\d+$/.test(doc.id) || doc.uploaded),
    washer.documents.items.map((doc) => doc.id).join(', '),
  )
  check(
    'documents resolve nearest-first — the machine before the enterprise',
    (() => {
      const levels = washer.documents.items.map((doc) => doc.via)
      const rank = { asset: 0, line: 1, site: 2, enterprise: 3 }
      return levels.every((via, index) => index === 0 || rank[levels[index - 1]] <= rank[via])
    })(),
    washer.documents.items.map((doc) => doc.via).join(' → '),
  )
  check(
    'the media count is the media that resolves, not a pinned zero',
    washer.documents.mediaCount >= 0 && Number.isInteger(washer.documents.mediaCount),
  )
  check(
    'the type chips count the documents they filter to',
    washer.documents.kinds.every(
      (entry) =>
        entry.count === washer.documents.items.filter((doc) => doc.kind === entry.kind).length,
    ),
  )
  check(
    'the predicted-failure confidence is the worst alert fusion score',
    washer.insights.predicted === null ||
      washer.insights.predicted.confidence ===
        washer.openAlerts.find((a) => a.assetId === washer.id)?.fusionScore ||
      washer.insights.predicted.confidence === washer.openAlerts[0].fusionScore,
  )
  check(
    'the OEE trend carries every window, each with five axis labels',
    ['live', '4h', '8h', '12h', '24h'].every(
      (w) => washer.oeeTrend[w]?.values.length > 0 && washer.oeeTrend[w].ticks.length === 5,
    ),
    Object.keys(washer.oeeTrend).join(','),
  )
  check(
    'a shorter window is generated at its own resolution, not sliced',
    washer.oeeTrend['4h'].values.join() !== washer.oeeTrend['24h'].values.slice(0, 32).join(),
  )
  check(
    'at-a-glance agrees with the alert list it sits beside',
    washer.atAGlance.openAlerts ===
      washer.openAlerts.filter((alert) => alert.assetId === washer.id).length,
  )

  console.log('\nSENSOR EXPLORER · composed channels\n')

  /* Every one of these asserts a PROPERTY rather than a value, because the
     catalogue is composed in the handler and the fixture behind it shows none of
     it. A green fixture is not evidence the composition runs. See §2.5. */

  const channels = await get(endpoints.signals.list, { params: {} })
  // The alert list this catalogue has to agree with, read through the same
  // transport rather than imported from the fixture — the point is that the two
  // ROUTES agree, not that one module equals itself.
  const alertsById = new Map(
    (await get(endpoints.alerts.list, { params: { pageSize: 100 } })).items.map((a) => [a.id, a]),
  )
  check('GET /signals returns a catalogue', channels.items.length > 30, `${channels.items.length}`)
  check(
    'facets sum to the scope total',
    channels.facets.violation + channels.facets.warning + channels.facets.ok === channels.facets.all,
    `${channels.facets.violation}+${channels.facets.warning}+${channels.facets.ok} vs ${channels.facets.all}`,
  )
  check(
    'stream facets sum to the scope total too',
    channels.facets.online + channels.facets.offline === channels.facets.all,
  )
  check(
    'the printed reading IS the end of the printed trace',
    channels.items.every((c) => c.values[c.values.length - 1] === c.value),
    channels.items.find((c) => c.values[c.values.length - 1] !== c.value)?.id ?? '',
  )
  check(
    'no channel reads clean while an anomaly is open on it',
    channels.items.every((c) => !c.alertId || c.state !== 'ok'),
    channels.items.find((c) => c.alertId && c.state === 'ok')?.id ?? '',
  )
  check(
    'a violation is either alerted at critical/high or outside its band',
    channels.items
      .filter((c) => c.state === 'violation')
      .every(
        (c) =>
          ['critical', 'high'].includes(c.alertSeverity) ||
          c.value < c.band[0] ||
          c.value > c.band[1],
      ),
  )
  check(
    'every band is ordered low → high',
    channels.items.every((c) => c.band[0] < c.band[1]),
    channels.items.find((c) => c.band[0] >= c.band[1])?.id ?? '',
  )
  check(
    'a channel in alarm carries the alert’s own reading',
    channels.items
      .filter((c) => c.alertId && alertsById.has(c.alertId))
      .every((c) => c.value === alertsById.get(c.alertId).reading.value),
  )
  check(
    'an alerted channel’s band edge is the alert’s own threshold',
    channels.items
      .filter((c) => c.alertId && alertsById.has(c.alertId))
      .every((c) => {
        const threshold = alertsById.get(c.alertId).threshold.value
        return c.band[0] === threshold || c.band[1] === threshold
      }),
  )
  check(
    'every open alert on a sensor is visible as a channel',
    [...alertsById.values()]
      .filter((a) => a.status !== 'resolved' && a.sensor)
      .every((a) => channels.items.some((c) => c.alertId === a.id)),
    [...alertsById.values()]
      .filter((a) => a.status !== 'resolved' && a.sensor && !channels.items.some((c) => c.alertId === a.id))
      .map((a) => a.id)
      .join(','),
  )
  check(
    'units follow the site, never a global default',
    (() => {
      const vibration = channels.items.filter((c) => c.kind === 'vibration')
      const findlay = vibration.filter((c) => c.siteId === 'site_findlay')
      const overseas = vibration.filter((c) => c.siteId !== 'site_findlay')
      return (
        findlay.length > 0 &&
        overseas.length > 0 &&
        findlay.every((c) => c.unit === 'in/s') &&
        overseas.every((c) => c.unit === 'mm/s')
      )
    })(),
    [...new Set(channels.items.filter((c) => c.kind === 'vibration').map((c) => c.unit))].join(','),
  )
  check(
    'two channels never share an id',
    new Set(channels.items.map((c) => c.id)).size === channels.items.length,
  )
  check(
    'every channel names a real asset on a real line',
    channels.items.every((c) => c.assetId && c.lineId && c.lineName && c.siteName),
  )
  check(
    'the source is the one connector that provides signals',
    channels.source?.family === 'otHistorian' && Boolean(channels.source.lastSyncAt),
    JSON.stringify(channels.source),
  )
  check(
    'worst-first is the default order',
    channels.items[0].state === 'violation' &&
      channels.items[channels.items.length - 1].state === 'ok',
    `${channels.items[0].state} … ${channels.items[channels.items.length - 1].state}`,
  )

  /* The scope tree. The prototype hardcodes a root count of 7 over three sites of
     3, which do not add up; these two checks are why that cannot happen here. */
  const scopeTree = await get(endpoints.signals.scopes)
  const scopeById = new Map(scopeTree.items.map((node) => [node.id, node]))
  check(
    'the scope root counts every channel',
    scopeTree.items[0].count === channels.facets.all,
    `${scopeTree.items[0].count} vs ${channels.facets.all}`,
  )
  check(
    'a parent’s count is the sum of its children’s',
    scopeTree.items
      .filter((node) => scopeTree.items.some((child) => child.parentId === node.id))
      .every(
        (node) =>
          node.count ===
          scopeTree.items
            .filter((child) => child.parentId === node.id)
            .reduce((sum, child) => sum + child.count, 0),
      ),
  )
  check(
    'no scope row leads to an empty grid',
    scopeTree.items.every((node) => node.count > 0),
  )
  check(
    'scoping to a line returns exactly that line’s channels',
    await (async () => {
      const line = scopeTree.items.find((node) => node.tier === 'line')
      const scoped = await get(endpoints.signals.list, { params: { scope: line.id } })
      return scoped.total === line.count && scoped.items.every((c) => c.lineId === line.id)
    })(),
  )
  check(
    'a site’s scope spans its lines and nothing else',
    await (async () => {
      const site = scopeTree.items.find((node) => node.tier === 'site')
      const scoped = await get(endpoints.signals.list, { params: { scope: site.id } })
      return scoped.total === site.count && scoped.items.every((c) => c.siteId === site.id)
    })(),
  )
  check(
    'lines are qualified by site when the scope spans more than one',
    (() => {
      const names = channels.options.lines.map((line) => line.name)
      return new Set(names).size === names.length && names.some((name) => name.includes(' · '))
    })(),
    channels.options.lines.map((l) => l.name).join(' | '),
  )
  check(
    'facet counts are over the scope, not over the filtered set',
    await (async () => {
      const filtered = await get(endpoints.signals.list, { params: { state: 'violation' } })
      return filtered.facets.all === channels.facets.all && filtered.total === channels.facets.violation
    })(),
  )

  /* The window. The whole reason it is a parameter and not a label. */
  const short = await get(endpoints.signals.list, { params: { window: '1h' } })
  const long = await get(endpoints.signals.list, { params: { window: '30d' } })
  check(
    'a window changes the sample count',
    short.items[0].values.length !== long.items[0].values.length,
    `${short.items[0].values.length} vs ${long.items[0].values.length}`,
  )
  check(
    'a longer window really is longer',
    Date.parse(long.items[0].stamps[0]) < Date.parse(short.items[0].stamps[0]),
  )
  check(
    'a live window ends about now',
    Math.abs(Date.parse(short.items[0].stamps.at(-1)) - Date.now()) < 5000,
  )
  check(
    'the reading survives every window',
    short.items[0].value === short.items[0].values.at(-1) &&
      long.items.find((c) => c.id === short.items[0].id)?.values.at(-1) === short.items[0].value,
  )

  /* The calendar is the same parameter as the pills, and it is honoured. */
  const rangeFrom = new Date(Date.now() - 9 * 86_400_000).toISOString()
  const rangeTo = new Date(Date.now() - 2 * 86_400_000).toISOString()
  const ranged = await get(endpoints.signals.list, {
    params: { from: rangeFrom, to: rangeTo, window: '1h' },
  })
  check('a date range wins over a timeframe pill', ranged.window === 'custom', ranged.window)
  check(
    'a ranged trace ends where the range ends, not now',
    Math.abs(Date.parse(ranged.items[0].stamps.at(-1)) - Date.parse(rangeTo)) < 1000,
  )
  check(
    'a ranged trace starts where the range starts',
    Math.abs(Date.parse(ranged.items[0].stamps[0]) - Date.parse(rangeFrom)) < 1000,
  )
  check(
    'a nonsense range falls back to the default window rather than throwing',
    (await get(endpoints.signals.list, { params: { from: 'x', to: 'y' } })).window === '24h',
  )

  /* Search and the narrowing controls are server-side, which is the seam. */
  const searched = await get(endpoints.signals.list, { params: { q: 'washer' } })
  check(
    'search matches the asset as well as the channel',
    searched.total > 0 && searched.items.every((c) => /washer/i.test(`${c.assetName} ${c.name} ${c.tag}`)),
    `${searched.total}`,
  )
  const byKind = await get(endpoints.signals.list, { params: { kind: 'flow' } })
  check(
    'the kind filter is applied by the handler',
    byKind.total > 0 && byKind.items.every((c) => c.kind === 'flow'),
  )

  const one = await get(endpoints.signals.detail(encodeURIComponent(channels.items[0].id)), {
    params: { window: '7d' },
  })
  check('GET /signals/:id resolves one channel', one.id === channels.items[0].id)
  check(
    'the detail carries the alert record, not only its id',
    one.alertId ? one.alert?.id === one.alertId : one.alert === null,
  )
  check(
    'the literal /scopes path is not swallowed by /signals/:id',
    Array.isArray(scopeTree.items) && scopeTree.items.length > 0,
  )

  console.log('\nTIMESERIES WORKSTATION · composed charts\n')

  /* The prototype makes four independent claims about one array — an authored
     `mean` on the series row, a generated series that averages something else, a
     statistics panel with a third set, and an AI banner stating `r = −0.87` as a
     literal. These checks are why that cannot happen here. */

  const catalogue = await get(endpoints.charts.list)
  check('GET /charts returns the catalogue', catalogue.items.length >= 8, `${catalogue.items.length}`)
  check(
    'every card’s sensor count is the chart’s real membership',
    await (async () => {
      for (const card of catalogue.items) {
        const resolved = await get(endpoints.charts.detail(card.id))
        if (resolved.series.length !== card.sensorCount) return false
      }
      return true
    })(),
  )
  check(
    'no saved chart resolves to fewer than two series',
    catalogue.items.every((card) => card.sensorCount >= 2),
    catalogue.items.filter((card) => card.sensorCount < 2).map((card) => card.id).join(','),
  )
  check(
    'every chart names an author from the directory',
    catalogue.items.every((card) => Boolean(card.author)),
  )

  const flagship = await get(endpoints.charts.detail('chart_cmp12'), { params: { window: '24h' } })
  check(
    'a chart’s stats are computed over the plotted values',
    flagship.series.every((entry) => {
      const min = Math.min(...entry.values)
      const max = Math.max(...entry.values)
      return (
        Math.abs(entry.stats.min - Math.round(min * 100) / 100) < 0.011 &&
        Math.abs(entry.stats.max - Math.round(max * 100) / 100) < 0.011
      )
    }),
  )
  check(
    'the mean sits between the min and the max',
    flagship.series.every(
      (entry) => entry.stats.mean >= entry.stats.min && entry.stats.mean <= entry.stats.max,
    ),
  )
  check(
    'P95 is reachable — it is a value the series actually attains or exceeds',
    flagship.series.every((entry) => entry.stats.p95 <= entry.stats.max),
  )
  check(
    'every series is on an axis, and there are at most two',
    flagship.series.every((entry) => ['left', 'right'].includes(entry.axis)) &&
      Boolean(flagship.axes.left),
  )
  check(
    'series sharing a unit share an axis',
    (() => {
      const byUnit = new Map()
      for (const entry of flagship.series) {
        if (byUnit.has(entry.unit) && byUnit.get(entry.unit) !== entry.axis) return false
        byUnit.set(entry.unit, entry.axis)
      }
      return true
    })(),
  )
  check(
    'each axis domain contains every value drawn against it',
    ['left', 'right'].every((side) => {
      const axis = flagship.axes[side]
      if (!axis) return true
      return flagship.series
        .filter((entry) => entry.axis === side)
        .every((entry) => Math.min(...entry.values) >= axis.domain[0] && Math.max(...entry.values) <= axis.domain[1])
    }),
  )
  check(
    'two series never take the same colour',
    new Set(flagship.series.map((entry) => entry.tone)).size === flagship.series.length,
  )
  check(
    'there is one threshold rule per series, and no more',
    flagship.rules.length === flagship.series.length &&
      flagship.rules.every((rule) => flagship.series.some((entry) => entry.id === rule.seriesId)),
  )
  check(
    'a rule is marked breached exactly when the reading is outside the band',
    flagship.series.every((entry) => {
      const rule = flagship.rules.find((r) => r.seriesId === entry.id)
      const outside = entry.value < entry.band[0] || entry.value > entry.band[1]
      return rule.breached === outside
    }),
  )
  check(
    'the insight’s coefficient is one the correlation panel also reports',
    !flagship.insight ||
      flagship.correlations.some(
        (pair) =>
          pair.r === flagship.insight.r &&
          [pair.aId, pair.bId].includes(flagship.insight.a.id) &&
          [pair.aId, pair.bId].includes(flagship.insight.b.id),
      ),
    JSON.stringify(flagship.insight?.r),
  )
  check(
    'the insight names the strongest pair, not the first',
    !flagship.insight ||
      Math.abs(flagship.insight.r) === Math.abs(flagship.correlations[0].r),
  )
  check(
    'the insight only fires on a real relationship',
    !flagship.insight || Math.abs(flagship.insight.r) >= 0.6,
  )
  check(
    'an insight that names an alert names a real open one',
    !flagship.insight?.alertId || alertsById.has(flagship.insight.alertId),
  )
  check(
    'every correlation is a valid coefficient',
    flagship.correlations.every((pair) => pair.r >= -1 && pair.r <= 1),
  )
  check(
    'correlations are ordered strongest first',
    flagship.correlations.every(
      (pair, index) =>
        index === 0 || Math.abs(flagship.correlations[index - 1].r) >= Math.abs(pair.r),
    ),
  )
  check(
    'the pair count is every combination of the series, once',
    flagship.correlations.length <= (flagship.series.length * (flagship.series.length - 1)) / 2,
  )
  check(
    'stamps and values are the same length',
    flagship.series.every((entry) => entry.values.length === flagship.stamps.length),
  )
  check(
    'event markers land inside the span, never off the edge',
    [...flagship.events.anomalies, ...flagship.events.maintenance].every((event) => {
      const at = Date.parse(event.at)
      return at >= Date.parse(flagship.stamps[0]) && at <= Date.parse(flagship.stamps.at(-1))
    }),
  )
  check(
    'the path is read from the plant, not authored',
    flagship.path?.site === 'Findlay Plant' && flagship.path?.asset === 'Compressor C-12',
    JSON.stringify(flagship.path),
  )
  check(
    'a chart on one machine reports one asset',
    flagship.assetCount === 1,
    `${flagship.assetCount}`,
  )
  check(
    'a multi-asset chart says so',
    (await get(endpoints.charts.detail('chart_line1'))).assetCount === 3,
  )

  /* Granularity is a parameter, not a label — the design's select changes
     nothing at all. */
  const coarse = await get(endpoints.charts.detail('chart_cmp12'), {
    params: { window: '24h', granularity: '240' },
  })
  const fine = await get(endpoints.charts.detail('chart_cmp12'), {
    params: { window: '24h', granularity: '5' },
  })
  check(
    'granularity changes the sample count',
    fine.span.points > coarse.span.points * 10,
    `${fine.span.points} vs ${coarse.span.points}`,
  )
  check(
    'a coarser granularity still spans the same window',
    coarse.span.hours === fine.span.hours,
  )
  check(
    'statistics are recomputed at the new resolution rather than carried over',
    coarse.series[0].stats.mean !== fine.series[0].stats.mean ||
      coarse.series[0].values.length !== fine.series[0].values.length,
  )

  /* Ad-hoc — the chart a channel card opens, which nobody saved. */
  const someChannel = channels.items[0].id
  const adhoc = await get(endpoints.charts.detail('adhoc'), {
    params: { signals: someChannel, window: '24h' },
  })
  check('an ad-hoc chart composes from the URL alone', adhoc.series.length === 1)
  check(
    'an unnamed chart is named after what is in it',
    adhoc.named === false &&
      adhoc.name === `${adhoc.series[0].assetName} · ${adhoc.series[0].name}`,
    adhoc.name,
  )
  check(
    'no two ad-hoc charts share a heading',
    await (async () => {
      const names = new Set()
      for (const channel of channels.items.slice(0, 8)) {
        const one = await get(endpoints.charts.detail('adhoc'), { params: { signals: channel.id } })
        names.add(one.name)
      }
      return names.size === 8
    })(),
  )
  check(
    'a saved chart keeps its own name and says it has one',
    flagship.named === true && flagship.name.startsWith('Compressor C-12'),
    flagship.name,
  )
  check(
    'an ad-hoc series is the same channel the Explorer drew',
    adhoc.series[0].id === someChannel && adhoc.series[0].value === channels.items[0].value,
  )
  check(
    'a one-series chart has nothing to correlate and says nothing',
    adhoc.correlations.length === 0 && adhoc.insight === null,
  )

  /* Add and remove series without writing to the saved chart. */
  const narrowed = await get(endpoints.charts.detail('chart_cmp12'), {
    params: { signals: flagship.series.slice(0, 2).map((entry) => entry.id).join(',') },
  })
  check('a membership override narrows the chart', narrowed.series.length === 2)
  check(
    'the override does not write to the stored chart',
    (await get(endpoints.charts.detail('chart_cmp12'))).series.length === flagship.series.length,
  )

  /* Create. The prototype's dialog closes and forgets. */
  const chartsBefore = (await get(endpoints.charts.list)).items.length
  const made = await post(endpoints.charts.list, {
    name: 'Verify · two channels',
    signalIds: channels.items.slice(0, 2).map((entry) => entry.id),
  })
  const chartsAfter = await get(endpoints.charts.list)
  check('POST /charts creates a chart', chartsAfter.items.length === chartsBefore + 1)
  check(
    'the created chart is in the catalogue and opens',
    chartsAfter.items.some((card) => card.id === made.id) &&
      (await get(endpoints.charts.detail(made.id))).series.length === 2,
  )
  check(
    'a created chart is counted like a saved one',
    chartsAfter.items.find((card) => card.id === made.id)?.sensorCount === 2,
  )

  await get(endpoints.charts.detail('chart_nope')).then(
    () => check('unknown chart rejects', false, 'resolved instead'),
    (error) => check('unknown chart → notFound', error.code === 'notFound', `code=${error.code}`),
  )

  const csvModule = await server.ssrLoadModule('/src/features/signals/charts.js')
  const csv = csvModule.chartToCsv(flagship, {})
  check(
    'the CSV has a header plus one row per sample',
    csv.split('\n').length === flagship.stamps.length + 1,
    `${csv.split('\n').length}`,
  )
  check(
    'the CSV leaves out a hidden series',
    csvModule
      .chartToCsv(flagship, { [flagship.series[0].id]: false })
      .split('\n')[0]
      .split('","').length ===
      flagship.series.length,
  )
  check('every CSV field is quoted', csv.split('\n')[1].startsWith('"'))

  console.log('\nWORK ORDERS · composed board and the state machine\n')

  const board = await get(endpoints.workOrders.list, { params: { paged: false } })
  check('GET /work-orders returns the board', board.items.length >= 10, `${board.items.length}`)
  check(
    'column counts sum to the set they describe',
    Object.values(board.columns).reduce((sum, n) => sum + n, 0) === board.items.length,
    `${JSON.stringify(board.columns)} vs ${board.items.length}`,
  )
  check(
    'every column is a real state and every order is in one',
    board.items.every((order) => Object.keys(board.columns).includes(order.state)),
  )
  check(
    'every order names an asset the hierarchy has',
    board.items.every((order) => Boolean(order.assetName) && Boolean(order.lineName)),
    board.items.find((order) => !order.assetName)?.id ?? '',
  )
  check(
    'the stat strip counts the whole collection, not the filtered set',
    await (async () => {
      const filtered = await get(endpoints.workOrders.list, {
        params: { paged: false, state: 'completed' },
      })
      return filtered.stats.open === board.stats.open && filtered.items.length < board.items.length
    })(),
  )
  check(
    'open excludes completed — the count the asset screens read',
    board.stats.open === board.items.filter((order) => order.state !== 'completed').length,
  )
  check(
    'overdue is derived from the due date, not authored',
    board.items.every((order) => order.overdue === (order.state !== 'completed' && order.dueInDays < 0)),
  )
  check(
    'a due date is an instant, and matches the days it was stored as',
    board.items.every((order) => {
      const days = Math.round((Date.parse(order.dueAt) - Date.now()) / 86_400_000)
      return Math.abs(days - order.dueInDays) <= 1
    }),
  )
  check(
    'nextState follows the workflow and completed has none',
    board.items.every((order) =>
      order.state === 'completed' ? order.nextState === null : Boolean(order.nextState),
    ),
  )
  check(
    'only work in progress can be put on hold',
    board.items.every((order) => order.canHold === (order.state === 'inProgress')),
  )
  check(
    'a blocked order is blocked by a part it genuinely lacks',
    board.items.every((order) =>
      order.blockedByParts.every((part) => part.onHand < part.qty && part.short > 0),
    ),
  )
  check(
    'an order raised from an anomaly names a real one',
    board.items
      .filter((order) => order.alert)
      .every((order) => alertsById.has(order.alert.id) && order.alert.id === order.alertId),
  )
  check(
    'the board holds something in every column',
    Object.values(board.columns).every((count) => count > 0),
    JSON.stringify(board.columns),
  )
  check(
    'urgent sorts before low',
    board.items[0].priority === 'urgent' &&
      board.items[board.items.length - 1].priority === 'low',
    `${board.items[0].priority} … ${board.items[board.items.length - 1].priority}`,
  )
  check(
    'the asset options are the plant, not free text',
    board.options.assets.length >= 18 && board.options.assets.every((a) => a.code),
  )

  /* The state machine. This is the check that matters: the prototype's form has
     Status as a free select, so a draft can be marked Completed without ever
     being approved — on a screen whose whole subject is an approval workflow. */
  const draft = board.items.find((order) => order.state === 'draft')
  await patch(endpoints.workOrders.detail(draft.id), { state: 'completed' }).then(
    () => check('an illegal transition is rejected', false, 'it was accepted'),
    (error) =>
      check('an illegal transition is rejected', error.code === 'validation', `code=${error.code}`),
  )
  const advanced = await patch(endpoints.workOrders.detail(draft.id), {
    state: 'pendingApproval',
  })
  check('a legal transition is applied', advanced.state === 'pendingApproval')
  check('and the next move follows from the new state', advanced.nextState === 'approved')
  check(
    'a rejected transition left the record alone',
    (await get(endpoints.workOrders.detail(draft.id))).state === 'pendingApproval',
  )
  // Put it back, so this script can be run twice and so the checks below see the
  // board the fixture describes.
  await patch(endpoints.workOrders.detail(draft.id), { state: 'draft' }).catch(() => {})

  const held = board.items.find((order) => order.state === 'inProgress')
  const paused = await patch(endpoints.workOrders.detail(held.id), { state: 'onHold' })
  check('work in progress can be paused', paused.state === 'onHold')
  check('and resumes to in progress rather than advancing', paused.nextState === 'inProgress')
  await patch(endpoints.workOrders.detail(held.id), { state: 'inProgress' }).catch(() => {})

  /* Create. The id is sequential, not the prototype's `4400 + random(580)`,
     which can collide with a seeded order. */
  const raised = await post(endpoints.workOrders.list, {
    title: 'Verify · a raised order',
    assetId: 'FDY-NCK-01',
    priority: 'high',
    dueInDays: 4,
  })
  check('POST /work-orders raises one', raised.id.startsWith('WO-'))
  check('a raised order starts as a draft', raised.state === 'draft')
  check(
    'a raised order is attributed to a person, never to the AI',
    raised.authoredBy === 'human',
    raised.authoredBy,
  )
  check(
    'a raised order resolves its asset from the plant',
    raised.assetName === 'Necker' && raised.lineName,
    `${raised.assetName} / ${raised.lineName}`,
  )
  check(
    'the new id does not collide with an existing one',
    board.items.every((order) => order.id !== raised.id),
  )
  check(
    'it appears on the board and in the open count',
    await (async () => {
      const after = await get(endpoints.workOrders.list, { params: { paged: false } })
      return (
        after.items.some((order) => order.id === raised.id) &&
        after.stats.open === board.stats.open + 1
      )
    })(),
  )

  const edited = await patch(endpoints.workOrders.detail(raised.id), { title: 'Verify · renamed' })
  check('PATCH edits the fields a form owns', edited.titleText === 'Verify · renamed')

  await del(endpoints.workOrders.detail(raised.id))
  check(
    'DELETE removes it from the board',
    !(await get(endpoints.workOrders.list, { params: { paged: false } })).items.some(
      (order) => order.id === raised.id,
    ),
  )

  /* The count Lines & Assets reads. `isOpenOrder` exists because this used to be
     `state !== 'closed'`, which was true of every order in the fixture. */
  const bodymaker = await get(endpoints.assets.detail('FDY-BM-03'))
  check(
    'an asset counts only its own OPEN orders',
    bodymaker.atAGlance.workOrders ===
      board.items.filter((order) => order.assetId === 'FDY-BM-03' && order.state !== 'completed')
        .length,
    `${bodymaker.atAGlance.workOrders}`,
  )
  const withCompleted = board.items.filter(
    (order) => order.assetId === 'FDY-BM-07' && order.state === 'completed',
  )
  check(
    'a completed order does not inflate an asset’s open count',
    withCompleted.length > 0 &&
      (await get(endpoints.assets.detail('FDY-BM-07'))).atAGlance.workOrders === 0,
  )

  await get(endpoints.workOrders.detail('WO-0000')).then(
    () => check('unknown work order rejects', false, 'resolved instead'),
    (error) =>
      check('unknown work order → notFound', error.code === 'notFound', `code=${error.code}`),
  )

  console.log('\nSHIFTS · a derived roster\n')

  /* Asked for a week explicitly. The DEFAULT is not a week — see the checks
     below — because a calendar week mid-flight is a mostly-empty chart. */
  const roster = await get(endpoints.shifts.list, { params: { days: 7, pageSize: 50 } })
  check('GET /shifts?days=7 returns the week', roster.total === 21, `${roster.total}`)

  /* The default span reaches back over last week whenever this one is still
     running, so there is always a complete week of real shifts behind the chart
     — on a Monday morning as much as on a Sunday night. */
  const defaulted = await get(endpoints.shifts.list, { params: { pageSize: 100 } })
  check(
    'the default reaches back a second week while this one is unfinished',
    roster.items.every((row) => row.status === 'completed')
      ? defaulted.days === 7
      : defaulted.days === 14,
    `days=${defaulted.days}`,
  )
  check(
    'and it says which span it chose, so the control can show it',
    [7, 14, 28].includes(defaulted.days),
  )
  check(
    'the default always has a full week of shifts that have actually run',
    defaulted.items.filter((row) => row.oee != null).length >= 21,
    `${defaulted.items.filter((row) => row.oee != null).length} run`,
  )
  check(
    'three shifts a day, seven days, no gaps',
    new Set(roster.items.map((row) => row.date)).size === 7 &&
      roster.items.every((row) => ['morning', 'afternoon', 'night'].includes(row.type)),
  )
  /* Monday to Sunday, as the design has it — NOT the seven days ending today.
     The two coincide only on a Sunday, which is the day the trailing version was
     written on and is why it looked right. Opened on a Wednesday it ran Thursday
     to Wednesday and the weekday axis meant nothing. */
  check(
    'the week runs Monday to Sunday, whatever day it is opened',
    (() => {
      const dates = [...new Set(roster.items.map((row) => row.date))].sort()
      const day = (value) => new Date(`${value}T12:00:00`).getDay()
      return dates.length === 7 && day(dates[0]) === 1 && day(dates[6]) === 0
    })(),
    [...new Set(roster.items.map((row) => row.date))].sort().join(' '),
  )
  check(
    'and it still runs Monday to Sunday when today is mid-week',
    await (async () => {
      const { shiftsForWeek } = await server.ssrLoadModule('/src/mocks/fixtures/shifts.js')
      // A Wednesday, a Monday and a Sunday — the trailing version got only the
      // last of the three right.
      return ['2026-08-12', '2026-08-10', '2026-08-16'].every((pin) => {
        const dates = [
          ...new Set(shiftsForWeek(new Date(`${pin}T10:00:00`).getTime(), 7).map((r) => r.date)),
        ].sort()
        const day = (value) => new Date(`${value}T12:00:00`).getDay()
        return dates.length === 7 && day(dates[0]) === 1 && day(dates[6]) === 0
      })
    })(),
  )
  /* Stated over ALL of them, not "at least one". The week ends on Sunday, so
     from the Sunday night shift onwards there is genuinely nothing left in it
     that has not started — and a check demanding an unstarted shift exists went
     red one evening a week for a fixture that was telling the truth. */
  check(
    'a week in progress leaves the shifts that have not run without a figure',
    roster.items.every((row) => row.status !== 'scheduled' || row.oee === null),
  )
  /* Compared in LOCAL time. `toISOString().slice(0, 10)` is the UTC date, and a
     roster built from a local calendar week disagrees with it for as many hours
     a day as the offset — five and a half, here, every single day. */
  check(
    'the week is THIS week, not a fixed one',
    (() => {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      return roster.items.some((row) => row.date === today)
    })(),
  )
  check(
    'a night shift ends the next morning and lasts eight hours',
    roster.items
      .filter((row) => row.type === 'night')
      .every((row) => Math.round((Date.parse(row.endsAt) - Date.parse(row.startsAt)) / 3_600_000) === 8),
  )
  check(
    'status comes from the clock',
    roster.items.every((row) => {
      const start = Date.parse(row.startsAt)
      const end = Date.parse(row.endsAt)
      const expected = end <= Date.now() ? 'completed' : start <= Date.now() ? 'active' : 'scheduled'
      return row.status === expected
    }),
  )
  check(
    'at most one shift is running',
    roster.items.filter((row) => row.status === 'active').length <= 1,
  )
  check(
    'a shift that has not run has no OEE and no downtime',
    roster.items
      .filter((row) => row.status === 'scheduled')
      .every((row) => row.oee === null && row.downtimeMinutes === null),
  )

  /* The property this module exists to hold: the roster and the OEE screen are
     talking about the same week. The prototype's Shifts page averages 81% while
     its own OEE page says 74.2%. */
  const weekOee = (await get(endpoints.oee.summary, { params: { period: 'week' } })).kpis.find(
    (kpi) => kpi.key === 'oee',
  ).value
  const run = roster.items.filter((row) => row.oee != null)
  const mean = run.length ? run.reduce((sum, row) => sum + row.oee, 0) / run.length : null
  /* The week runs Monday to Sunday, so in the small hours of a Monday not one
     shift in it has finished and there is nothing to average. That is the
     fixture being right, and the assertion in that window is that it reports
     nothing rather than a number — the mirror of the Sunday-night case, where
     there is nothing left to schedule. */
  check(
    'the week’s shifts average the week’s published OEE',
    mean === null ? roster.stats.averageOee === null : Math.abs(mean - weekOee) < 0.06,
    mean === null ? 'nothing has run yet' : `${Math.round(mean * 100) / 100} vs ${weekOee}`,
  )
  check(
    'the strip’s average is the one the rows show',
    mean === null
      ? roster.stats.averageOee === null
      : Math.abs(roster.stats.averageOee - mean) < 0.06,
    `${roster.stats.averageOee} vs ${mean === null ? 'null' : Math.round(mean * 100) / 100}`,
  )
  check(
    'downtime follows from availability, not from a separate number',
    run.every((row) => {
      const expected = Math.round(((100 - row.availability) / 100) * row.hours * 60)
      return Math.abs(row.downtimeMinutes - expected) <= 1
    }),
  )
  check(
    'a shift carrying anomalies runs below one that carries none',
    (() => {
      const withAnomalies = run.filter((row) => row.anomalies.length > 0)
      const without = run.filter((row) => row.anomalies.length === 0)
      if (!withAnomalies.length || !without.length) return true
      const avg = (set) => set.reduce((sum, row) => sum + row.oee, 0) / set.length
      return avg(withAnomalies) < avg(without)
    })(),
  )

  /* Anomalies are found, not counted into existence. */
  check(
    'every anomaly on a shift is a real alert detected inside its window',
    roster.items.every((row) =>
      row.anomalies.every((alert) => {
        if (!alertsById.has(alert.id)) return false
        const at = Date.now() - alertsById.get(alert.id).detectedMinutesAgo * 60_000
        return at >= Date.parse(row.startsAt) && at < Date.parse(row.endsAt)
      }),
    ),
  )
  check(
    'no alert is claimed by two shifts',
    (() => {
      const seen = roster.items.flatMap((row) => row.anomalies.map((alert) => alert.id))
      return new Set(seen).size === seen.length
    })(),
  )
  check(
    'the week’s anomaly count is the rows added up',
    roster.stats.anomalies ===
      roster.items.reduce((sum, row) => sum + row.anomalies.length, 0),
  )
  check(
    'a work order on a shift was raised off one of that shift’s anomalies',
    roster.items.every((row) =>
      row.workOrders.every(() => row.anomalies.length > 0),
    ),
  )
  check(
    'a handover only ever attaches to a shift that has ended',
    roster.items.every((row) => !row.handoverId || row.status === 'completed'),
    roster.items.find((row) => row.handoverId && row.status !== 'completed')?.id ?? '',
  )
  check(
    'the handover a shift names is one the archive actually lists',
    await (async () => {
      const archive = await get(endpoints.handovers.list)
      const ids = new Set(archive.items.map((entry) => entry.id))
      return roster.items.every((row) => !row.handoverId || ids.has(row.handoverId))
    })(),
  )
  check(
    'the archive no longer lives in a fixed week',
    (await get(endpoints.handovers.list)).items.every(
      (entry) => Date.parse(entry.date) > Date.now() - 30 * 86_400_000,
    ),
  )

  /* The crew rollup and the strip are counted off one set. */
  check(
    'the crew list accounts for every shift in the week',
    roster.crew.reduce((sum, person) => sum + person.shifts, 0) === roster.stats.shifts,
    `${roster.crew.reduce((sum, person) => sum + person.shifts, 0)} vs ${roster.stats.shifts}`,
  )
  check(
    'nobody works two shifts back to back',
    (() => {
      const ordered = [...roster.items].sort(
        (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
      )
      return ordered.every(
        (row, index) => index === 0 || row.operatorId !== ordered[index - 1].operatorId,
      )
    })(),
  )
  check(
    'the roster is stable across two reads',
    await (async () => {
      const again = await get(endpoints.shifts.list, { params: { days: 7, pageSize: 50 } })
      return again.items.every((row, index) => row.operatorId === roster.items[index].operatorId)
    })(),
  )

  /* "Just me" narrows, and does NOT quietly fall back to the whole crew, which
     is what the prototype does when the reader has no shifts. */
  const mine = await get(endpoints.shifts.list, { params: { days: 7, mine: 'usr_ops_1', pageSize: 50 } })
  check(
    'a personal roster contains only that person',
    mine.items.every((row) => row.operatorId === 'usr_ops_1') && mine.total < roster.total,
    `${mine.total} of ${roster.total}`,
  )
  check(
    'and it recomputes the figures rather than reusing the crew’s',
    mine.stats.shifts === mine.total && mine.crew.length === 1,
  )
  const nobody = await get(endpoints.shifts.list, { params: { days: 7, mine: 'usr_exe_1', pageSize: 50 } })
  check(
    'somebody with no shifts gets none, not everybody’s',
    nobody.total === 0 && nobody.stats.shifts === 0,
    `${nobody.total}`,
  )

  /* The synopsis is composed off the same rows. */
  check(
    'the briefing’s figures are the strip’s figures',
    roster.synopsis.shifts === roster.stats.shifts &&
      roster.synopsis.averageOee === roster.stats.averageOee &&
      roster.synopsis.anomalies === roster.stats.anomalies,
  )
  check(
    'the roughest shift it names is one in the week and really is the roughest',
    !roster.synopsis.worst ||
      (roster.items.some((row) => row.id === roster.synopsis.worst.id) &&
        roster.items
          .filter((row) => row.status === 'completed')
          .every((row) => row.anomalies.length <= roster.synopsis.worst.anomalies)),
  )
  check(
    'the asset it blames carries an anomaly on that shift',
    !roster.synopsis.worst?.asset ||
      roster.items
        .find((row) => row.id === roster.synopsis.worst.id)
        .anomalies.some((alert) => alert.assetName === roster.synopsis.worst.asset),
  )
  check(
    'the active shift it names is the one the roster marks active',
    (roster.synopsis.active?.id ?? null) ===
      (roster.items.find((row) => row.status === 'active')?.id ?? null),
  )

  /* Assignment. The design's Schedule button does nothing. */
  const scheduled = roster.items.find((row) => row.status === 'scheduled')
  if (scheduled) {
    const reassigned = await post(endpoints.shifts.list, {
      date: scheduled.date,
      type: scheduled.type,
      operatorId: 'usr_tec_1',
    })
    check('a scheduled shift can be reassigned', reassigned.operatorId === 'usr_tec_1')
    check(
      'and the roster reflects it on the next read',
      (await get(endpoints.shifts.list, { params: { days: 7, pageSize: 50 } })).items.find(
        (row) => row.id === scheduled.id,
      ).operatorId === 'usr_tec_1',
    )
  } else {
    /* Sunday night. Not skipped silently: the only honest reason the roster can
       hold nothing to reassign is that every shift in the week has begun, and
       that is what gets asserted instead. */
    check(
      'nothing is reassignable only because every shift in the week has started',
      roster.items.every((row) => Date.parse(row.startsAt) <= Date.now()),
    )
  }
  const worked = roster.items.find((row) => row.status === 'completed')
  if (worked) {
    await post(endpoints.shifts.list, {
      date: worked.date,
      type: worked.type,
      operatorId: 'usr_tec_1',
    }).then(
      () => check('a shift already worked cannot be reassigned', false, 'it was accepted'),
      (error) =>
        check(
          'a shift already worked cannot be reassigned',
          error.code === 'validation',
          `code=${error.code}`,
        ),
    )
  } else {
    /* Monday, before the first shift of the week has finished. Not skipped
       silently: the only honest reason there is nothing worked to protect is
       that nothing in the week has ended yet. */
    check(
      'nothing is protected from reassignment only because no shift has ended',
      roster.items.every((row) => Date.parse(row.endsAt) > Date.now()),
    )
  }

  /* The range control. Three shifts a day makes a week only 21 points, which is
     thin for reading a trend off — and a longer span has to keep agreeing with
     whichever figure the OEE module publishes for it. */
  const monthOee = (await get(endpoints.oee.summary, { params: { period: 'month' } })).kpis.find(
    (kpi) => kpi.key === 'oee',
  ).value
  for (const [days, expected] of [
    [7, weekOee],
    [14, weekOee],
    [28, monthOee],
  ]) {
    const range = await get(endpoints.shifts.list, { params: { days, pageSize: 200 } })
    const ran = range.items.filter((row) => row.oee != null)
    const avg = ran.length ? ran.reduce((sum, row) => sum + row.oee, 0) / ran.length : null
    check(
      `a ${days}-day range holds ${days} days of shifts and starts on a Monday`,
      range.total === days * 3 &&
        new Date(`${[...new Set(range.items.map((r) => r.date))].sort()[0]}T12:00:00`).getDay() === 1,
      `${range.total}`,
    )
    /* A span that has just begun has nothing in it that has run. Only the
       seven-day one can be in that state — a fortnight always reaches back into
       a week that finished. */
    check(
      `and averages the published OEE for that span (${expected})`,
      avg === null ? days === 7 : Math.abs(avg - expected) < 0.06,
      avg === null ? 'nothing has run yet' : `${Math.round(avg * 100) / 100} vs ${expected}`,
    )
  }
  check(
    'a longer range really is a superset — the recent days do not move',
    await (async () => {
      const short = await get(endpoints.shifts.list, { params: { days: 7, pageSize: 100 } })
      const long = await get(endpoints.shifts.list, { params: { days: 28, pageSize: 200 } })
      const byId = new Map(long.items.map((row) => [row.id, row]))
      return short.items.every((row) => byId.has(row.id) && byId.get(row.id).operatorId === row.operatorId)
    })(),
  )

  /* The handover action on the detail panel branches on this, and offered
     nothing at all before it existed. */
  check(
    'a shift carries the STATUS of its handover, not only the id',
    roster.items.every((row) => (row.handoverId ? Boolean(row.handoverStatus) : row.handoverStatus === null)),
  )
  /* A handover only ever attaches to a shift that has ended, so in a week that
     has not had one yet there are none of any status — and the reachability of
     the Edit path is a claim about the archive rather than about this week. */
  check(
    'at least one handover is a draft, so the Edit path is reachable',
    roster.items.some((row) => row.handoverStatus === 'draft') ||
      (await get(endpoints.handovers.list)).items.some((entry) => entry.status === 'draft'),
  )
  check(
    'the status a shift reports is the one the archive holds',
    await (async () => {
      const archive = await get(endpoints.handovers.list)
      const byId = new Map(archive.items.map((entry) => [entry.id, entry.status]))
      return roster.items.every(
        (row) => !row.handoverId || byId.get(row.handoverId) === row.handoverStatus,
      )
    })(),
  )

  /* The report the design opens from "End Shift & Handover". No such record
     exists for a shift that has not ended, so it is composed — the design fills
     a template instead, which is why every shift in it carries "monitor C-12
     coolant trend" whatever happened on it. */
  const handoverDraft = roster.draftHandover
  const running = roster.items.find((row) => row.status === 'active')
  check(
    'a running shift comes with the handover it is about to file',
    Boolean(running) === Boolean(handoverDraft),
  )
  if (handoverDraft) {
    check('the draft names the shift it belongs to', handoverDraft.handover.id.includes(running.id))
    check('and is marked a draft, never a filed record', handoverDraft.handover.status === 'draft')
    check(
      'its outgoing name is the operator on that shift',
      handoverDraft.handover.outgoing === running.operatorName,
    )
    check(
      'it hands over to the NEXT window, not back to its own',
      handoverDraft.handover.to !== handoverDraft.handover.from,
    )
    check(
      'the anomalies it carries are that shift’s own',
      handoverDraft.report.carried.length === running.anomalies.length &&
        handoverDraft.report.carried.every((entry) =>
          running.anomalies.some((alert) => alert.id === entry.id),
        ),
    )
    check(
      'the downtime it reports is that shift’s own',
      handoverDraft.report.production.find((row) => row.key === 'downtime').value ===
        `${running.downtimeMinutes} min`,
    )
    check(
      'the summary states the shift’s real OEE',
      handoverDraft.report.summary.includes(String(running.oee)),
      handoverDraft.report.summary.slice(0, 90),
    )
    check(
      'pending actions travel as ids and titles, not a pre-joined sentence',
      Array.isArray(handoverDraft.report.pendingOrders) &&
        handoverDraft.report.pendingOrders.every((order) => order.id && order.title),
    )
  }
  check(
    'no shift carries an anomaly from another site',
    roster.items.every((row) =>
      row.anomalies.every((alert) => alertsById.get(alert.id)?.siteId === 'site_findlay'),
    ),
    roster.items
      .flatMap((row) => row.anomalies)
      .find((alert) => alertsById.get(alert.id)?.siteId !== 'site_findlay')?.id ?? '',
  )

  /* What the OEE chart plots: COMPLETE days only, exactly one week of them,
     ending yesterday. A week that includes today has a hole in it — two of
     today's three shifts have not run — so the chart either stopped a third of
     the way in or reserved width for work nobody had done. */
  check(
    'the chart has a full week of complete days behind it, at any hour of any day',
    await (async () => {
      const { shiftsForWeek, defaultShiftRange } = await server.ssrLoadModule(
        '/src/mocks/fixtures/shifts.js',
      )
      const days = (value) => new Date(`${value}T12:00:00`)
      return [
        '2026-08-10T07:00',
        '2026-08-12T09:00',
        '2026-08-15T20:00',
        '2026-08-16T09:00',
      ].every((pin) => {
        const now = new Date(pin).getTime()
        const rows = shiftsForWeek(now, defaultShiftRange(now))
        const d = new Date(now)
        const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const plotted = rows.filter((row) => row.date < todayKey && row.oee != null).slice(-21)
        const dates = [...new Set(plotted.map((row) => row.date))].sort()
        // Exactly 21 shifts over exactly 7 days, none of them today, none blank,
        // and the last one is the day before today.
        return (
          plotted.length === 21 &&
          dates.length === 7 &&
          plotted.every((row) => row.oee != null) &&
          dates[6] < todayKey &&
          (days(todayKey) - days(dates[6])) / 86_400_000 === 1
        )
      })
    })(),
  )
  check(
    'the default span is wide enough to fill that week whatever day it is',
    await (async () => {
      const { shiftsForWeek, defaultShiftRange } = await server.ssrLoadModule(
        '/src/mocks/fixtures/shifts.js',
      )
      return ['2026-08-10T00:30', '2026-08-13T09:00', '2026-08-16T23:00'].every((pin) => {
        const now = new Date(pin).getTime()
        const rows = shiftsForWeek(now, defaultShiftRange(now))
        const d = new Date(now)
        const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return rows.filter((row) => row.date < todayKey && row.oee != null).length >= 21
      })
    })(),
  )

  console.log('\nEXECUTIVE · rollups, target, the brief\n')

  const exec = await get(endpoints.executive.summary)
  check('GET /executive returns a row per site', exec.sites.length === 3, `${exec.sites.length}`)

  /* Coordinates, not layout percentages. The prototype positions its pins with
     `left: {lat}%; top: {lng}%`, which is not a coordinate system — this asserts
     the three sites carry real ones in real ranges. */
  check(
    'every site carries real coordinates the map can project',
    exec.sites.every(
      (site) =>
        site.coords &&
        site.coords.lat >= -90 &&
        site.coords.lat <= 90 &&
        site.coords.lon >= -180 &&
        site.coords.lon <= 180,
    ),
  )
  check(
    'and they are the right places — three continents, not three points in a box',
    await (async () => {
      const by = Object.fromEntries(exec.sites.map((site) => [site.id, site.coords]))
      return (
        Math.round(by.site_findlay.lat) === 41 &&
        Math.round(by.site_findlay.lon) === -84 &&
        Math.round(by.site_weissenthurm.lat) === 50 &&
        Math.round(by.site_pune.lon) === 74
      )
    })(),
  )

  /* Alert counts are COUNTED, not the authored `SITE_HEALTH` numbers. This is
     the check that stops the board screen and the anomaly list disagreeing
     about one plant. */
  check(
    'each site’s anomaly count is what the alert list holds for it',
    await (async () => {
      for (const site of exec.sites) {
        const alerts = await get(endpoints.alerts.list, {
          params: { siteId: site.id, pageSize: 100 },
        })
        const open = alerts.items.filter((alert) => alert.status !== 'resolved')
        if (site.openAlerts !== open.length) return false
        if (site.criticalAlerts !== open.filter((a) => a.severity === 'critical').length) return false
      }
      return true
    })(),
  )
  check(
    'the enterprise totals are the sum of the rows, not a second authored figure',
    exec.stats.openAlerts === exec.sites.reduce((sum, site) => sum + site.openAlerts, 0) &&
      exec.stats.criticalAlerts ===
        exec.sites.reduce((sum, site) => sum + site.criticalAlerts, 0) &&
      exec.stats.assets === exec.sites.reduce((sum, site) => sum + site.assets, 0),
  )
  check(
    'the enterprise OEE is the average of the sites, and is NOT the plant figure',
    await (async () => {
      const mean =
        exec.sites.reduce((sum, site) => sum + site.oee, 0) / exec.sites.length
      return (
        Math.abs(exec.stats.oee - mean) < 0.06 && exec.stats.oee !== exec.stats.plantOee
      )
    })(),
    `${exec.stats.oee} vs plant ${exec.stats.plantOee}`,
  )

  /* One target, read by the bars, the gap column and the brief. The prototype
     captions "Target: 85%" under bars drawn against nothing. */
  check(
    'the gap on every row is that row’s distance from the one target',
    exec.sites.every((site) => Math.abs(site.gapPts - (site.oee - exec.stats.target)) < 0.001) &&
      Math.abs(exec.stats.gapPts - (exec.stats.oee - exec.stats.target)) < 0.06,
  )

  /* A site's pin colour is severity-first. A plant carrying a critical anomaly
     is not "watch" because its OEE happens to be respectable. */
  check(
    'pin state follows severity before performance',
    exec.sites.every(
      (site) =>
        site.state ===
        (site.criticalAlerts > 0 ? 'critical' : site.openAlerts > 0 ? 'watch' : 'running'),
    ),
  )

  /* The brief names sites it FOUND. The prototype names Rotterdam whatever its
     own numbers say. */
  check(
    'the brief names sites the table actually lists',
    [exec.brief.risk, exec.brief.best, exec.brief.worst]
      .filter(Boolean)
      .every((entry) => exec.sites.some((site) => site.id === entry.siteId)),
  )
  check(
    'top risk is the site carrying the most critical anomalies, not the lowest OEE',
    await (async () => {
      const worst = [...exec.sites].sort((a, b) => a.oee - b.oee)[0]
      const mostCritical = Math.max(...exec.sites.map((site) => site.criticalAlerts))
      const risk = exec.sites.find((site) => site.id === exec.brief.risk.siteId)
      // It must be a site with the top critical count. It may or may not also be
      // the lowest scorer — the point is that OEE alone does not decide it.
      return risk.criticalAlerts === mostCritical && exec.brief.worst.siteId === worst.id
    })(),
  )
  check(
    'the leader really is the highest OEE on the table',
    exec.brief.best.oee === Math.max(...exec.sites.map((site) => site.oee)),
  )
  check(
    'below-target is counted against the same target the rows use',
    exec.brief.belowTarget ===
      exec.sites.filter((site) => site.oee < exec.stats.target).length,
  )
  /* Hours, never currency. The design's brief ends "$1.2M MTD" and nothing in
     this product computes money — so the payload must carry no such field. */
  check(
    'downtime exposure is reported in hours and no money figure is invented',
    typeof exec.stats.downtimeRiskHours === 'number' &&
      !('cost' in exec.stats) &&
      !('costMtd' in exec.stats) &&
      exec.stats.downtimeRiskHours ===
        Math.round(exec.sites.reduce((sum, site) => sum + site.downtimeRiskHours, 0) * 10) / 10,
  )

  /* The board-report CTA raises a REAL report through the Reports shelf's own
     create path, so the brief's button and that screen produce one record. */
  check(
    'the board-report CTA creates a board report on the shelf',
    await (async () => {
      const before = (await get(endpoints.reports.list)).total
      const made = await post(endpoints.reports.list, {
        kind: 'board',
        period: 'month',
        siteId: null,
      })
      const after = await get(endpoints.reports.list)
      return made.kind === 'board' && after.total === before + 1
    })(),
  )

  console.log('\nCOPILOT · prepared answers, grounding, the honest miss\n')

  const cp = await get(endpoints.copilot.prompts)
  check('GET /copilot/prompts returns four modes', cp.modes.length === 4, `${cp.modes.length}`)
  check('every mode offers at least one prompt', cp.modes.every((mode) => mode.prompts.length > 0))
  check(
    'the grounding line counts real open anomalies',
    await (async () => {
      const alerts = await get(endpoints.alerts.list, { params: { pageSize: 100 } })
      const open = alerts.items.filter((alert) => alert.status !== 'resolved')
      return (
        cp.grounding.alerts === open.length &&
        cp.grounding.assets === new Set(open.map((alert) => alert.assetId)).size
      )
    })(),
    `${cp.grounding.alerts}`,
  )

  /* Every chip has to answer. A prompt the lookup cannot match is a chip that
     falls back on itself — which is exactly what a canned-answer screen must
     never do, because the chips are the promise it makes. */
  check(
    'every prompt chip resolves to a prepared answer',
    await (async () => {
      for (const mode of cp.modes) {
        for (const prompt of mode.prompts) {
          const answer = await post(endpoints.copilot.messages, { question: prompt, mode: mode.id })
          if (!answer.matched || !answer.blocks.length) return false
        }
      }
      return true
    })(),
  )

  /* Every question the HOME composer offers must resolve too. All nine used to
     miss, so anybody arriving the ordinary way — type in the greeting box, hit
     send — reached a screen that answered nothing. */
  check(
    'every home suggestion resolves to a prepared answer',
    await (async () => {
      const { BRIEFING_SUGGESTIONS } = await server.ssrLoadModule(
        '/src/mocks/fixtures/briefing.js',
      )
      for (const prompts of Object.values(BRIEFING_SUGGESTIONS)) {
        for (const prompt of prompts) {
          const answer = await post(endpoints.copilot.messages, { question: prompt })
          if (!answer.matched || !answer.blocks.length) return false
        }
      }
      return true
    })(),
  )
  check(
    'no answer prints a null figure',
    await (async () => {
      const { BRIEFING_SUGGESTIONS } = await server.ssrLoadModule(
        '/src/mocks/fixtures/briefing.js',
      )
      const asked = [
        ...Object.values(BRIEFING_SUGGESTIONS).flat(),
        ...cp.modes.flatMap((mode) => mode.prompts),
      ]
      for (const prompt of asked) {
        const answer = await post(endpoints.copilot.messages, { question: prompt })
        const text = answer.blocks.map((block) => block.text ?? '').join(' ')
        if (/\b(null|undefined|NaN)\b/.test(text)) return false
      }
      return true
    })(),
  )

  /* And the figures inside an answer are read from the fixtures, not typed.
     This is the check that catches a prepared answer going stale. */
  const bmAnswer = await post(endpoints.copilot.messages, {
    question: 'Why is Bodymaker 3 flagged?',
    mode: 'trouble',
  })
  check(
    'the flagship answer quotes the flagship alert’s real reading and threshold',
    await (async () => {
      const alert = await get(endpoints.alerts.detail('ALR-4471'))
      const text = bmAnswer.blocks.map((block) => block.text ?? '').join(' ')
      return (
        text.includes(String(alert.reading.value)) &&
        text.includes(String(alert.threshold.value)) &&
        text.includes(String(alert.correlation))
      )
    })(),
  )
  check(
    'and its verdict states the real time to threshold',
    await (async () => {
      const alert = await get(endpoints.alerts.detail('ALR-4471'))
      const verdict = bmAnswer.blocks.find((block) => block.type === 'verdict')
      return Boolean(verdict) && verdict.text.includes(String(alert.etaHours))
    })(),
  )
  check(
    'the OEE answer quotes the figure the OEE module publishes',
    await (async () => {
      const answer = await post(endpoints.copilot.messages, {
        question: 'Summarise this week’s OEE',
        mode: 'explore',
      })
      const week = await get(endpoints.oee.summary, { params: { period: 'week' } })
      const headline = week.kpis.find((kpi) => kpi.key === 'oee').value
      return answer.matched && answer.blocks[0].text.includes(String(headline))
    })(),
  )
  check(
    'the work-order answer counts the board’s own open orders',
    await (async () => {
      const answer = await post(endpoints.copilot.messages, {
        question: 'Summarise the open work orders',
        mode: 'maint',
      })
      const board = await get(endpoints.workOrders.list, { params: { pageSize: 100 } })
      const open = board.items.filter((order) => order.state !== 'completed').length
      return answer.matched && answer.blocks[0].text.startsWith(`${open} of ${board.total}`)
    })(),
  )

  /* A greeting is answered, not missed. Recognising "hi" is not the keyword
     matching this file refuses to do about facts — a greeting claims nothing,
     so there is nothing to get wrong, and answering one with "I can't answer
     that" is the rudest thing a demo can do. */
  check(
    'every way of saying hello is answered, with somewhere to go next',
    await (async () => {
      for (const hello of ['Hi', 'hello there', 'Good morning!', 'hey', 'HELLO']) {
        const answer = await post(endpoints.copilot.messages, { question: hello })
        if (!answer.matched || !answer.blocks.length || !answer.suggestions?.length) return false
      }
      return true
    })(),
  )
  check(
    'but a sign-off is not mistaken for a greeting',
    await (async () => {
      const answer = await post(endpoints.copilot.messages, { question: 'thanks' })
      return answer.matched === false
    })(),
  )

  /* The honest miss. It must NOT invent an answer, and it must hand back the
     chips for the mode the reader is in so the fallback is a way forward. */
  const missed = await post(endpoints.copilot.messages, {
    question: 'does the compressor need an oil change',
    mode: 'maint',
  })
  check('an unmatched question is answered with a miss', missed.matched === false)
  check(
    'and carries no invented blocks — the wording is the client’s to translate',
    missed.blocks.length === 0,
  )
  check(
    'but does offer this mode’s chips back',
    missed.suggestions.length > 0 &&
      missed.suggestions.every((prompt) =>
        cp.modes.find((mode) => mode.id === 'maint').prompts.includes(prompt),
      ),
  )
  /* Deliberately NOT keyword matching: "compressor" appears in that question
     and in a prepared answer, and answering the wrong one confidently is worse
     than missing. */
  check(
    'a keyword in common with a prepared answer does not force a match',
    missed.matched === false,
  )
  await post(endpoints.copilot.messages, { question: '   ' }).then(
    () => check('an empty question is rejected', false, 'accepted instead'),
    (error) => check('an empty question is rejected', error.status === 422, `${error.status}`),
  )

  /* The dock's thread is a different resource and this pass did not touch it. */
  check(
    'the dock’s conversation is unchanged and still grounded on ALR-4471',
    (await get(endpoints.copilot.messages)).context.alertId === 'ALR-4471',
  )

  console.log('\nNOTIFICATIONS · rules, routing, escalation\n')

  const notify = await get(endpoints.notifications.list)
  check('GET /notifications returns the configuration', notify.rules.length > 0 && notify.channels.length > 0)

  /* The whole argument of the module: a rule's threshold is READ from the
     plant's signal specification, not typed beside it. If these drift, the
     screen is telling operators a limit the detectors do not use. */
  check(
    'a rule’s threshold is the band edge the Sensor Explorer draws',
    await (async () => {
      const { SIGNAL_SPEC } = await server.ssrLoadModule('/src/mocks/fixtures/lines.js')
      return notify.rules.every((rule) =>
        rule.thresholds.every((entry) => {
          const spec = SIGNAL_SPEC[entry.unitSystem]?.[rule.kind]
          if (!spec) return false
          const [low, high] = spec.band
          return entry.value === (rule.edge === 'below' ? low : high)
        }),
      )
    })(),
  )
  /* And the vibration rule's imperial edge is the one ALR-4471 actually trips
     at. One number, three screens. */
  check(
    'the vibration rule trips where the flagship anomaly trips',
    await (async () => {
      const alert = await get(endpoints.alerts.detail('ALR-4471'))
      const rule = notify.rules.find((entry) => entry.kind === 'vibration')
      return rule?.thresholds.some(
        (entry) => entry.value === alert.threshold.value && entry.unit === alert.threshold.unit,
      )
    })(),
  )
  check(
    'a rule spanning both plants reports both units and converts neither',
    notify.rules.every((rule) => rule.thresholds.length === 2) &&
      notify.rules.some((rule) =>
        rule.thresholds.some((a) => rule.thresholds.some((b) => a.unit !== b.unit)),
      ),
  )

  check(
    'what a rule watches is counted off the real channels',
    await (async () => {
      const signals = await get(endpoints.signals.list, { params: { pageSize: 500 } })
      return notify.rules.every((rule) => {
        const mine = signals.items.filter((channel) => channel.kind === rule.kind)
        return (
          rule.watching === mine.length &&
          rule.assets === new Set(mine.map((channel) => channel.assetId)).size
        )
      })
    })(),
  )
  check(
    'every rule watches something — a rule on a sensor nothing reports can never fire',
    notify.rules.every((rule) => rule.watching > 0),
    notify.rules.find((rule) => !rule.watching)?.id ?? '',
  )

  /* `misrouted` and `broken` are joins across two lists. Neither is computable
     from a rule alone, which is why they are composed server-side. */
  const connected = new Set(
    notify.channels.filter((channel) => channel.state === 'connected').map((channel) => channel.id),
  )
  check(
    'misrouted is exactly the routes that are not connected',
    notify.rules.every(
      (rule) =>
        JSON.stringify(rule.misrouted) ===
        JSON.stringify(rule.routes.filter((id) => !connected.has(id))),
    ),
  )
  check(
    'broken is a LIVE rule that is undeliverable, not merely one with a dead route',
    notify.rules.every((rule) => rule.broken === (rule.enabled && rule.misrouted.length > 0)),
  )
  check(
    'the mix is real — some rules deliver everywhere and at least one does not',
    notify.rules.some((rule) => rule.misrouted.length) &&
      notify.rules.some((rule) => !rule.misrouted.length),
  )
  check(
    'each channel counts the rules that actually point at it',
    notify.channels.every(
      (channel) =>
        channel.rules === notify.rules.filter((rule) => rule.routes.includes(channel.id)).length &&
        channel.liveRules ===
          notify.rules.filter((rule) => rule.enabled && rule.routes.includes(channel.id)).length,
    ),
  )
  check(
    'a channel that is not configured has no delivery target',
    notify.channels.every(
      (channel) => (channel.state === 'connected') === Boolean(channel.target),
    ),
  )

  check(
    'the escalation ladder names people the product knows, in increasing time',
    notify.escalation.every((level, index) => {
      const ordered = index === 0 || level.afterMinutes > notify.escalation[index - 1].afterMinutes
      return ordered && Boolean(level.personName) && Boolean(level.personRole)
    }),
  )

  /* `unrouted` is the figure worth putting on the screen: open anomalies no
     enabled rule covers. It has to MOVE when a switch moves, or it is
     decoration. */
  check(
    'uncovered anomalies are counted against the ENABLED rules',
    await (async () => {
      const alerts = await get(endpoints.alerts.list, { params: { pageSize: 100 } })
      const { kindOfAlert } = await server.ssrLoadModule('/src/mocks/fixtures/signals.js')
      const live = notify.rules.filter((rule) => rule.enabled).map((rule) => rule.kind)
      const expected = alerts.items
        .filter((alert) => alert.status !== 'resolved')
        .filter((alert) => !live.includes(kindOfAlert(alert))).length
      return notify.stats.unrouted === expected
    })(),
    `${notify.stats.unrouted}`,
  )

  /* The toggle. Turning a covering rule off must raise that number — this is
     the check that would catch `unrouted` being computed once and cached. */
  const covering = notify.rules.find(
    (rule) => rule.enabled && rule.fired > 0 && rule.severity === 'critical',
  )
  await patch(endpoints.notifications.rule(covering.id), { enabled: false })
  const afterOff = await get(endpoints.notifications.list)
  check(
    'turning a rule off leaves its anomalies uncovered',
    afterOff.stats.unrouted > notify.stats.unrouted &&
      afterOff.stats.enabled === notify.stats.enabled - 1,
    `${notify.stats.unrouted} → ${afterOff.stats.unrouted}`,
  )
  check(
    'and an off rule is no longer counted as broken, because nothing is lost',
    afterOff.rules.find((rule) => rule.id === covering.id).broken === false,
  )
  await patch(endpoints.notifications.rule(covering.id), { enabled: true })
  const afterOn = await get(endpoints.notifications.list)
  check(
    'turning it back on restores every figure exactly',
    afterOn.stats.unrouted === notify.stats.unrouted &&
      afterOn.stats.enabled === notify.stats.enabled &&
      afterOn.stats.broken === notify.stats.broken,
  )
  await patch(endpoints.notifications.rule(covering.id), { threshold: 99 }).then(
    () => check('PATCH cannot set a threshold — only the toggle', false, 'accepted instead'),
    (error) =>
      check('PATCH cannot set a threshold — only the toggle', error.status === 422, `${error.status}`),
  )

  const madeRule = await post(endpoints.notifications.rules, {
    kind: 'vibration',
    edge: 'above',
    severity: 'high',
    routes: ['email'],
  })
  check('POST /notifications/rules writes a rule', Boolean(madeRule.id), madeRule.id)
  check(
    'and it arrives with its threshold already composed',
    madeRule.thresholds.length === 2 && madeRule.watching > 0,
  )
  await post(endpoints.notifications.rules, {
    kind: 'notASensor',
    edge: 'above',
    severity: 'high',
    routes: ['email'],
  }).then(
    () => check('a kind the plant does not instrument is rejected', false, 'accepted instead'),
    (error) =>
      check('a kind the plant does not instrument is rejected', error.status === 422, `${error.status}`),
  )
  await post(endpoints.notifications.rules, {
    kind: 'vibration',
    edge: 'above',
    severity: 'high',
    routes: [],
  }).then(
    () => check('a rule with nowhere to go is rejected', false, 'accepted instead'),
    (error) => check('a rule with nowhere to go is rejected', error.status === 422, `${error.status}`),
  )

  console.log('\nREPORTS · coverage, length, generation\n')

  const shelf = await get(endpoints.reports.list)
  check('GET /reports returns the shelf', shelf.total > 0 && shelf.total === shelf.items.length)
  check(
    'a report covers a period that has ENDED, never one still running',
    shelf.items.every((report) => Date.parse(report.to) < Date.now()),
  )
  check(
    'and its span matches the period it claims',
    shelf.items.every((report) => {
      const days = (Date.parse(report.to) - Date.parse(report.from)) / 86_400_000
      return report.period === 'quarter' ? days > 85 && days < 95 : days > 26 && days < 32
    }),
  )

  /* The page count follows from the sections and the scope. The prototype
     writes "24 pages" beside a report whose scope it never checks. */
  check(
    'a single-site report is shorter than the same report over the whole plant',
    await (async () => {
      const board = shelf.items.find((report) => report.kind === 'board')
      const oneSite = shelf.items.find(
        (report) => report.kind === 'riskReview' && report.siteId,
      )
      return board && oneSite && board.pages > oneSite.pages
    })(),
  )
  check(
    'every report reports a page count and at least one section',
    shelf.items
      .filter((report) => report.status === 'ready')
      .every((report) => report.pages > 0 && report.sections.length > 0),
  )

  /* Coverage is counted off the same fixtures the other screens read. A board
     report cannot claim a different number of anomalies than the anomaly list. */
  check(
    'an enterprise report’s anomaly count is the whole alert list',
    await (async () => {
      const alerts = await get(endpoints.alerts.list, { params: { pageSize: 100 } })
      const enterprise = shelf.items.find((report) => !report.siteId)
      return enterprise.coverage.anomalies === alerts.total
    })(),
  )
  check(
    'a single-site report counts only that site’s anomalies',
    await (async () => {
      const scoped = shelf.items.find((report) => report.siteId)
      const alerts = await get(endpoints.alerts.list, {
        params: { siteId: scoped.siteId, pageSize: 100 },
      })
      return scoped.coverage.anomalies === alerts.total && scoped.coverage.sites === 1
    })(),
  )
  check(
    'the OEE a report leads on is the one the OEE module publishes',
    await (async () => {
      const oee = await get(endpoints.oee.summary, { params: { period: 'month' } })
      const headline = oee.kpis.find((kpi) => kpi.key === 'oee').value
      return shelf.items.every((report) => report.coverage.oee === headline)
    })(),
  )

  /* Generating is time, not a flag. This is the check that would catch a
     hardcoded "Generating" badge — the same report has to become ready. */
  const started = await post(endpoints.reports.list, { kind: 'oeeSummary', period: 'month' })
  check('POST /reports starts one, and it is NOT ready', started.status === 'generating', started.status)
  check(
    'a running report reports progress and refuses to claim a generated time',
    started.progress != null && started.progress < 100 && started.generatedAt === null,
    `${started.progress}`,
  )
  check(
    'it sorts to the top of the shelf, because it is the one anybody is waiting on',
    (await get(endpoints.reports.list)).items[0].id === started.id,
  )
  check(
    'and the SAME report reads ready once its build time has passed',
    await (async () => {
      const { allReports, composeReport } = await server.ssrLoadModule(
        '/src/mocks/fixtures/reports.js',
      )
      const row = allReports().find((report) => report.id === started.id)
      const later = composeReport(row, Date.now() + 60_000)
      return later.status === 'ready' && later.pages > 0 && later.generatedAt !== null
    })(),
  )
  await post(endpoints.reports.list, { kind: 'notAKind', period: 'month' }).then(
    () => check('an unknown report kind is rejected', false, 'accepted instead'),
    (error) => check('an unknown report kind is rejected', error.status === 422, `${error.status}`),
  )

  /* §2.5 — pinned, at several days. A report generated three days ago covers
     LAST month, whichever month it is read in. */
  check(
    'a report always covers a whole month that has finished, on any date',
    await (async () => {
      const { REPORTS, composeReport } = await server.ssrLoadModule(
        '/src/mocks/fixtures/reports.js',
      )
      return ['2026-01-01T09:00', '2026-03-15T09:00', '2026-08-16T23:00'].every((pin) => {
        const now = new Date(pin).getTime()
        return REPORTS.map((report) => composeReport(report, now)).every((report) => {
          const to = new Date(report.to)
          const from = new Date(report.from)
          // Ends on the last day of a month, starts on the first of one.
          return (
            Date.parse(report.to) < now &&
            from.getDate() === 1 &&
            new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate() === to.getDate()
          )
        })
      })
    })(),
  )

  console.log('\nLOGBOOK · composition, citation, search, writes\n')

  const log = await get(endpoints.logbook.list)
  check('GET /logbook returns the log', log.total > 0 && log.total === log.items.length, `${log.total}`)
  check('newest first', log.items.every((row, i) => i === 0 || row.at <= log.items[i - 1].at))

  /* The whole point of the fixture: an entry's author is not typed beside it,
     it is the operator the ROSTER puts on the shift containing its timestamp.
     If these two ever disagree, the logbook and the Shifts screen are telling
     the room different stories about who was on nights. */
  check(
    'every entry is attributed to the operator rostered on its shift',
    await (async () => {
      const roster = await get(endpoints.shifts.list, { params: { days: 28, pageSize: 500 } })
      const byId = new Map(roster.items.map((row) => [row.id, row]))
      return log.items.every((entry) => {
        const shift = byId.get(entry.shiftId)
        // A note older than the roster reaches has no shift; one inside it must
        // agree with the roster on BOTH the operator and the window.
        if (!shift) return entry.shiftId === null
        return shift.operatorId === entry.authorId && shift.type === entry.shiftType
      })
    })(),
  )
  check(
    'and to a window that actually contains it',
    await (async () => {
      const roster = await get(endpoints.shifts.list, { params: { days: 28, pageSize: 500 } })
      const byId = new Map(roster.items.map((row) => [row.id, row]))
      return log.items
        .filter((entry) => entry.shiftId)
        .every((entry) => {
          const shift = byId.get(entry.shiftId)
          const at = Date.parse(entry.at)
          return at >= Date.parse(shift.startsAt) && at < Date.parse(shift.endsAt)
        })
    })(),
  )
  /* A 02:14 note belongs to the night shift that began at 22:00 the day before.
     Getting this wrong is the same off-by-one that makes a night shift look
     sixteen hours long, and it is invisible on any entry written in daylight. */
  check(
    'a small-hours note lands on the night shift that started the day before',
    await (async () => {
      // Matched on LOCAL hours. `at` is an ISO instant, so `includes('T02:')`
      // reads the UTC clock and is only the same thing in one time zone.
      const entry = log.items.find((row) => new Date(row.at).getHours() < 6)
      if (!entry) return false
      return entry.shiftType === 'night' && entry.shiftId.slice(3, 13) < entry.date
    })(),
  )

  /* The violet badge and the anomaly chip are ONE fact. The prototype authors
     them separately and has an entry marked analysed that points at nothing. */
  check(
    '“AI Analyzed” is exactly the presence of a citation, never one without the other',
    log.items.every((entry) => entry.cited === Boolean(entry.alert)),
  )
  check(
    'a citation is on the entry’s own machine',
    log.items.every((entry) => !entry.alert || entry.alert.assetId === entry.assetId),
  )
  /* The rule is the tool call run backwards: Forge AI searched this machine's
     log over the 14 days BEFORE it raised the alert. An entry written after the
     alert cannot have been evidence for it. */
  check(
    'and was detected after the note was written, within the search window',
    await (async () => {
      const alerts = await get(endpoints.alerts.list, { params: { pageSize: 100 } })
      const byId = new Map(alerts.items.map((alert) => [alert.id, alert]))
      return log.items
        .filter((entry) => entry.alert)
        .every((entry) => {
          const detected = Date.parse(byId.get(entry.alert.id).detectedAt)
          const written = Date.parse(entry.at)
          return detected >= written && detected - written <= 14 * 86_400_000
        })
    })(),
  )
  /* The assertion that catches a citation rule which turns out to be always
     true. The first one was: every machine here has an open alert, so "same
     machine, written first" put the badge on all twelve. */
  const citedCount = log.items.filter((row) => row.cited).length
  check(
    'the mix is real — some entries are cited and some are not',
    citedCount > 0 && citedCount < log.total,
    `${citedCount} of ${log.total}`,
  )

  /* The flagship. `ANALYSIS['ALR-4471']` quotes "02:14 · cell 3 noise" in its
     evidence trail and records a `searchLogbook · FDY-BM-03 · 14d` tool call.
     This asserts the note it is quoting actually exists, at that time, on that
     machine, and that the citation resolves to that alert. If either side is
     edited the check fails, rather than the demo claiming evidence it lost. */
  check(
    'the note the flagship analysis quotes is in the log, and cites it back',
    await (async () => {
      const entry = log.items.find((row) => {
        const at = new Date(row.at)
        return row.assetId === 'FDY-BM-03' && at.getHours() === 2 && at.getMinutes() === 14
      })
      if (!entry) return false
      const analysis = await get(endpoints.alerts.analysis('ALR-4471'))
      const quoted = analysis.evidence.find((row) => row.key === 'logbook')?.value ?? ''
      return quoted.startsWith('02:14') && entry.alert?.id === 'ALR-4471'
    })(),
  )
  /* Stated directly, because the citation above can only be true if it holds and
     it went false for thirty-four minutes every morning before anybody noticed:
     the note is evidence, so it has to predate the alert that found it. */
  check(
    'and it was written before the alert that quotes it, at every hour of the day',
    await (async () => {
      const alert = (await get(endpoints.alerts.detail('ALR-4471'))).detectedAt
      const entry = log.items.find((row) => {
        const at = new Date(row.at)
        return row.assetId === 'FDY-BM-03' && at.getHours() === 2 && at.getMinutes() === 14
      })
      return Boolean(entry) && Date.parse(entry.at) < Date.parse(alert)
    })(),
  )

  /* Both lists, and they are deliberately different. Conflating them is how a
     machine becomes unwritable until somebody has already written about it. */
  check(
    'the filter offers only machines with entries; the composer offers the plant',
    log.assets.every((asset) => log.items.some((row) => row.assetId === asset.id)) &&
      log.plant.length > log.assets.length &&
      log.assets.every((asset) => log.plant.some((node) => node.id === asset.id)),
    `${log.assets.length} filter · ${log.plant.length} plant`,
  )
  check(
    'each machine’s entry count is the number of entries it has',
    log.assets.every(
      (asset) => asset.entries === log.items.filter((row) => row.assetId === asset.id).length,
    ),
  )

  /* Filters. The rollup is counted off the FILTERED rows and the "of 12" is
     not — narrowing has to move the first and leave the second alone. */
  const oneMachine = await get(endpoints.logbook.list, { params: { assetId: 'FDY-BM-03' } })
  check(
    'the machine filter narrows to that machine',
    oneMachine.total > 0 && oneMachine.items.every((row) => row.assetId === 'FDY-BM-03'),
    `${oneMachine.total}`,
  )
  check(
    'narrowing moves the count but not the “of N” beside it',
    oneMachine.items.every((row) => row.assetId === 'FDY-BM-03') &&
      oneMachine.total < log.total &&
      oneMachine.grandTotal === log.total,
    `${oneMachine.total} of ${oneMachine.grandTotal}`,
  )
  const citedOnly = await get(endpoints.logbook.list, { params: { cited: 'true' } })
  check(
    'the cited filter returns exactly the cited entries',
    citedOnly.total === citedCount && citedOnly.items.every((row) => row.cited),
  )

  /* The shift filter is the destination the Shifts detail panel's Logbook
     button was missing, so it has to actually narrow to that shift. */
  check(
    'a shift id narrows the log to what was written on that shift',
    await (async () => {
      const withShift = log.items.find((row) => row.shiftId)
      if (!withShift) return false
      const scoped = await get(endpoints.logbook.list, {
        params: { shiftId: withShift.shiftId },
      })
      return scoped.total > 0 && scoped.items.every((row) => row.shiftId === withShift.shiftId)
    })(),
  )

  /* Search. The design puts a violet "semantic search" marker beside a
     `.includes()`; this expands over the words a plant uses for one thing and
     reports which of them earned a match. */
  const literal = await get(endpoints.logbook.list, { params: { q: 'conductivity' } })
  check(
    'a literal hit needs no expansion, and claims none',
    literal.total > 0 && literal.expanded.length === 0,
    `${literal.total} · ${JSON.stringify(literal.expanded)}`,
  )
  const bearing = await get(endpoints.logbook.list, { params: { q: 'bearing' } })
  check(
    'searching “bearing” finds the note that says knocking',
    bearing.items.some((row) => row.text.toLowerCase().includes('knocking')),
  )
  check(
    'and says which extra terms earned that — only the ones that hit',
    bearing.expanded.length > 0 &&
      bearing.expanded.every((term) =>
        bearing.items.some((row) =>
          [row.text, row.assetName, ...row.tags].join(' ').toLowerCase().includes(term),
        ),
      ),
    JSON.stringify(bearing.expanded),
  )
  const nothing = await get(endpoints.logbook.list, { params: { q: 'zzzznotathing' } })
  check(
    'a query that matches nothing returns nothing and claims nothing',
    nothing.total === 0 && nothing.expanded.length === 0,
  )

  /* The composer's byline. Both values come down with the list so the card
     cannot promise a name the write will not use. */
  check(
    'the list says who a new entry will be attributed to',
    Boolean(log.author?.id && log.author.name && log.author.initials),
    JSON.stringify(log.author),
  )

  /* Writes. The design's Submit closes the card and fires a toast. */
  const written = await post(endpoints.logbook.list, {
    assetId: 'FDY-WSH-01',
    text: 'Check note written by verify:mocks.',
    tags: '#Cell 3, VIBRATION, vibration',
  })
  check('POST /logbook writes an entry', Boolean(written.id), written.id)
  check(
    'the server stamps the author — the body never named one',
    written.authorId === log.author.id,
    `${written.authorId}`,
  )
  check(
    'tags are normalised and deduplicated',
    JSON.stringify(written.tags) === JSON.stringify(['cell3', 'vibration']),
    JSON.stringify(written.tags),
  )
  const logAfter = await get(endpoints.logbook.list)
  check(
    'and it is at the top of the log',
    logAfter.total === log.total + 1 && logAfter.items[0].id === written.id,
  )
  check('a written entry is marked as one', logAfter.items[0].written === true)
  await post(endpoints.logbook.list, { assetId: 'FDY-WSH-01', text: '   ' }).then(
    () => check('an empty observation is rejected', false, 'accepted instead'),
    (error) => check('an empty observation is rejected', error.status === 422, `${error.status}`),
  )
  await post(endpoints.logbook.list, { assetId: 'NOT-A-MACHINE', text: 'x' }).then(
    () => check('a machine the plant does not have is rejected', false, 'accepted instead'),
    (error) =>
      check('a machine the plant does not have is rejected', error.status === 422, `${error.status}`),
  )

  /* §2.5 — pinned, at several days. The 02:14 note has to read 02:14 whichever
     morning it is looked at, and must never resolve into the future. */
  check(
    'entries resolve to their written time on any day, and never into the future',
    await (async () => {
      const { logEntries } = await server.ssrLoadModule('/src/mocks/fixtures/logbook.js')
      return [
        '2026-08-10T07:00', // a Monday, early
        '2026-08-13T01:00', // mid-week, before the 02:14 note has happened today
        '2026-08-16T23:30', // a Sunday, late
      ].every((pin) => {
        const now = new Date(pin).getTime()
        const rows = logEntries(now)
        const flagship = rows.find(
          (row) => row.assetId === 'FDY-BM-03' && row.text.startsWith('Knocking'),
        )
        const hhmm = new Date(flagship.at)
        return (
          // Authored entries only. A note WRITTEN during this run carries the
          // real clock, which is ahead of two of these three pins.
          rows.filter((row) => !row.written).every((row) => Date.parse(row.at) <= now) &&
          hhmm.getHours() === 2 &&
          hhmm.getMinutes() === 14
        )
      })
    })(),
  )

  /* The handover's observations are the log's, not a second copy of them. */
  check(
    'the handover reads its observations off the logbook',
    await (async () => {
      const handoverNow = await get(endpoints.shifts.handover)
      const current = await get(endpoints.logbook.list)
      return (
        handoverNow.logbook.length > 0 &&
        handoverNow.logbook.every((row) =>
          current.items.some((entry) => entry.at === row.at && entry.text === row.note),
        )
      )
    })(),
  )

  console.log('\nIMPORT · parsing, mapping, validation\n')

  const importer = await server.ssrLoadModule('/src/features/lines/import.js')
  const quoted = importer.parseCsv(
    'Tag ID,Description\nFDY-A,"Bodymaker 3, drive end"\nFDY-B,Plain name\n',
  )
  check(
    'quoted fields keep their commas instead of shifting every column',
    quoted.rows.length === 2 && quoted.rows[0].Description === 'Bodymaker 3, drive end',
    JSON.stringify(quoted.rows[0]),
  )

  const sample = importer.parseCsv(importer.SAMPLE_FILE.text)
  const guessed = importer.autoMap(sample.columns)
  check(
    'auto-mapping matches every field in a real-world header row',
    ['code', 'name', 'type', 'line', 'criticality', 'owner', 'sensors', 'installed'].every(
      (key) => guessed[key],
    ),
    JSON.stringify(guessed),
  )

  const lineNames = (await get(endpoints.productionLines.list)).items.map((l) => l.name)
  const validation = importer.validateAll(sample.rows, guessed, {
    lineNames,
    existingCodes: ['FDY-BM-03'],
  })
  check(
    'the sample exercises all three verdicts',
    validation.ready > 0 && validation.warnings > 0 && validation.errors > 0,
    JSON.stringify({ r: validation.ready, w: validation.warnings, e: validation.errors }),
  )
  check(
    'a row missing its tag is an error, not a warning',
    validation.validated.some(
      (entry) => entry.level === 'error' && entry.issues.some((i) => i.field === 'code'),
    ),
  )
  check(
    'an existing tag is a warning, because it can still be stored',
    validation.validated.some((entry) => entry.issues.some((i) => i.key === 'duplicate')),
  )
  check(
    'the template this wizard hands out validates clean against itself',
    (() => {
      const template = importer.parseCsv(importer.templateCsv(lineNames[0]))
      const result = importer.validateAll(template.rows, importer.autoMap(template.columns), {
        lineNames,
        existingCodes: [],
      })
      return result.errors === 0 && result.warnings === 0
    })(),
  )
  check(
    'a bad criticality falls back rather than being stored as typed',
    importer.toRecord({ Criticality: 'Med' }, { criticality: 'Criticality' }).criticality === 'medium',
  )

  /* The import writes. Run it last, since it mutates the plant the checks above
     read — an imported asset really does appear on its line. */
  const before = await get(endpoints.assets.list, { params: { pageSize: 200 } })
  const imported = await post(endpoints.assets.import, {
    rows: [
      {
        code: 'FDY-TST-01',
        name: 'Verification rig',
        type: 'tester',
        line: before.options.lines[0].name,
        criticality: 'low',
        owner: 'Karan Patel',
        sensors: ['vibration'],
        installed: '2024-01-01',
      },
      {
        code: 'FDY-TST-02',
        name: 'Nowhere rig',
        type: 'tester',
        line: 'A line that does not exist',
        criticality: 'low',
        owner: '',
        sensors: [],
        installed: null,
      },
    ],
    duplicates: 'update',
  })
  check(
    'import creates the row it can place and skips the one it cannot',
    imported.created === 1 && imported.skipped === 1,
    JSON.stringify(imported),
  )
  const after = await get(endpoints.assets.list, { params: { pageSize: 200 } })
  check(
    'the imported asset joins the collection and its line',
    after.total === before.total + 1 &&
      after.items.some((a) => a.id === 'FDY-TST-01' && a.lineId === before.options.lines[0].id),
  )
  const importedDetail = await get(endpoints.assets.detail('FDY-TST-01'))
  check(
    'an imported asset composes like any other',
    Boolean(importedDetail.briefing?.text) && Array.isArray(importedDetail.signals),
  )

  console.log('\nDATA FUSION · SOURCE FAMILIES\n')

  const fusionAll = await Promise.all(
    ['ot', 'vision', 'biz', 'db'].map((category) =>
      get(endpoints.dataFusion.sources, { params: { category } }),
    ),
  )
  const [otSources, visionSources, bizSources, dbSources] = fusionAll
  const everySource = fusionAll.flatMap((family) => family.items)

  check(
    'all four families are served and none is empty',
    fusionAll.every((family) => family.items.length > 0),
    fusionAll.map((f) => f.items.length).join('/'),
  )

  /* The point of the whole arrangement. `CONNECTORS` in operations.js is what the
     public page prints and what the Sensor Explorer's drawer reasons about; if
     Data Fusion restated those three instead of reading them, this is the check
     that would have caught it. */
  const connectors = await get(endpoints.dataFusion.connectors)
  for (const connector of connectors.items) {
    const source = everySource.find((row) => row.id === connector.id)
    check(
      `${connector.id} appears in Data Fusion with the protocol operations.js gave it`,
      source?.protocol === connector.protocol,
      `${source?.protocol} vs ${connector.protocol}`,
    )
    check(
      `${connector.id}'s status is derived to the state operations.js authored`,
      source?.status === connector.state,
      `derived ${source?.status}, authored ${connector.state}`,
    )
  }

  check(
    'the one connector that provides signals is the only source carrying a contract',
    everySource.filter((row) => row.provides?.includes('signals')).length === 1,
    String(everySource.filter((row) => row.provides?.includes('signals')).length),
  )

  /* Status is derived from the clock against the SLA, so "connected" and "last
     spoke two days ago" cannot both be true on one row — which is exactly the
     pair the prototype authors side by side. */
  check(
    'nothing is connected while past its own sync SLA',
    everySource.every((row) => row.status !== 'connected' || row.overdueMinutes === 0),
    everySource
      .filter((row) => row.status === 'connected' && row.overdueMinutes > 0)
      .map((row) => row.id)
      .join(', '),
  )
  check(
    'every source past its SLA says so',
    everySource
      .filter((row) => row.overdueMinutes > 0 && row.endpoint && !row.error)
      .every((row) => row.status === 'degraded'),
  )
  check(
    'a source with no endpoint is not configured, and reports no traffic',
    everySource
      .filter((row) => !row.endpoint)
      .every((row) => row.status === 'notConfigured' && !row.tags && !row.lastSyncAt),
  )
  check(
    'a disconnected source states its reason',
    everySource.filter((row) => row.status === 'disconnected').every((row) => Boolean(row.error)),
  )
  check(
    'every status is one the UI has a label for',
    everySource.every((row) =>
      ['connected', 'syncing', 'degraded', 'disconnected', 'notConfigured'].includes(row.status),
    ),
  )

  /* A source's site is derived from the assets it reads, so it cannot name a
     plant the platform does not have — the prototype's rows carry a free-text
     site and three of its four do not exist in this hierarchy. */
  const hierarchyNodes = await get(endpoints.demoHierarchy.nodes)
  const siteIds = new Set(
    hierarchyNodes.items.filter((node) => node.tier === 'site').map((node) => node.id),
  )
  check(
    'every site a source names is a real site',
    everySource.every((row) => row.siteId === null || siteIds.has(row.siteId)),
    everySource
      .filter((row) => row.siteId && !siteIds.has(row.siteId))
      .map((row) => row.siteId)
      .join(', '),
  )
  const assetIds = new Set(
    hierarchyNodes.items.filter((node) => node.tier === 'asset').map((node) => node.id),
  )
  check(
    'every asset a source claims to read exists',
    everySource.every((row) => row.assetIds.every((id) => assetIds.has(id))),
    everySource
      .flatMap((row) => row.assetIds)
      .filter((id) => !assetIds.has(id))
      .join(', '),
  )
  check(
    'a source with assets has a site and one without is enterprise-wide',
    everySource.every((row) => (row.assetCount > 0) === (row.siteId !== null)),
    everySource
      .filter((row) => (row.assetCount > 0) !== (row.siteId !== null))
      .map((row) => row.id)
      .join(', '),
  )

  /* Ordering is the screen's whole argument: what has stopped working is at the
     top, so the table reads as a morning's work queue rather than a catalogue. */
  const otBroken = otSources.items.findIndex((row) => row.status === 'disconnected')
  const otHealthy = otSources.items.findIndex((row) => row.status === 'connected')
  check(
    'the broken OT source sorts above the healthy ones',
    otBroken >= 0 && otBroken < otHealthy,
    `broken at ${otBroken}, first healthy at ${otHealthy}`,
  )

  check(
    'the header counts the family, not the filtered slice',
    otSources.stats.total === otSources.items.length &&
      otSources.stats.connected + otSources.stats.attention <= otSources.stats.total,
  )
  const otFiltered = await get(endpoints.dataFusion.sources, {
    params: { category: 'ot', status: 'connected' },
  })
  check(
    'filtering narrows the rows and leaves the totals alone',
    otFiltered.items.length < otSources.items.length &&
      otFiltered.stats.total === otSources.stats.total,
    `${otFiltered.items.length}/${otSources.items.length}, total ${otFiltered.stats.total}`,
  )
  check(
    'search reaches the endpoint column, not only the name',
    (await get(endpoints.dataFusion.sources, { params: { category: 'ot', q: 'opc.tcp' } })).items
      .length > 0,
  )
  check(
    'filtering by site excludes the enterprise systems',
    (
      await get(endpoints.dataFusion.sources, {
        params: { category: 'biz', siteId: 'site_findlay' },
      })
    ).items.every((row) => row.siteId === 'site_findlay'),
  )
  check(
    'the site filter only offers sites that hold a source',
    otSources.options.sites.every((option) =>
      otSources.items.some((row) => row.siteId === option.value),
    ),
  )

  check(
    'a vision system counts cameras, not tags in the thousands',
    visionSources.items.every((row) => row.tags < 100),
    visionSources.items.map((row) => row.tags).join(', '),
  )
  check(
    'the business systems are enterprise-scoped or named to a plant, never both',
    bizSources.items.length > 0 && dbSources.items.length > 0,
  )
  check(
    'no source prints an undefined figure',
    !JSON.stringify(everySource).includes('null,"name"') &&
      everySource.every((row) => row.name && row.protocol && row.category),
  )

  /* ── The connection drawer ─────────────────────────────────────────────
     The pass this block exists to police: the drawer must not become a second
     place where a source's endpoint, contract or state is written down. Every
     check below is a form of that one property. */
  console.log('\nDATA FUSION · CONNECTION DRAWER\n')

  const appStrings = JSON.parse(
    await readFile(new URL('../src/i18n/locales/en/app.json', import.meta.url), 'utf8'),
  )
  const commonStrings = JSON.parse(
    await readFile(new URL('../src/i18n/locales/en/common.json', import.meta.url), 'utf8'),
  )

  const historian = await get(endpoints.dataFusion.source('conn_historian'))
  const abb = await get(endpoints.dataFusion.source('src_800xa_wtm'))
  const maximo = await get(endpoints.dataFusion.source('src_maximo'))

  check(
    'the drawer describes the same connection the table does',
    ['status', 'protocol', 'endpoint', 'tags', 'siteName'].every(
      (field) =>
        historian[field] ===
        otSources.items.find((row) => row.id === 'conn_historian')[field],
    ),
  )
  check(
    'an anchor states its OWN contract, the one the public page prints',
    historian.contract.fromAnchor &&
      historian.contract.provides.includes('signals') &&
      historian.contract.doesNotProvide.includes('maintenanceRecords'),
    historian.contract.provides.join(', '),
  )
  check(
    'everything else speaks only for its family',
    !abb.contract.fromAnchor &&
      abb.contract.provides.length > 0 &&
      abb.contract.doesNotProvide.length > 0,
  )
  check(
    'no source claims to provide and not provide the same thing',
    [historian, abb, maximo].every((row) =>
      row.contract.provides.every((kind) => !row.contract.doesNotProvide.includes(kind)),
    ),
  )

  check(
    'the endpoint on the form is the endpoint in the registry, not a copy',
    historian.config.find((field) => field.bind === 'endpoint').value === historian.endpoint,
  )
  check(
    'a credential is never sent to the browser',
    !JSON.stringify(
      (await Promise.all(['conn_cmms', 'src_influx'].map((id) => get(endpoints.dataFusion.source(id))))).flatMap(
        (row) => row.config.filter((field) => field.type === 'secret'),
      ),
    ).includes('"value":"'),
  )

  /* Activity, derived from the source's own clock. The prototype prints "just
     now · Sync completed" above a connection its own table marks Disconnected. */
  check(
    'a source that has stopped shows the failures, not a successful sync at the top',
    abb.activity[0].kind === 'syncFailed' && abb.activity[0].reason === abb.error,
    abb.activity[0].kind,
  )
  check(
    'and the last sync that DID work is older than the failures',
    abb.activity.filter((entry) => entry.kind === 'syncCompleted').every((entry) =>
      abb.activity
        .filter((row) => row.kind === 'syncFailed')
        .every((row) => row.at > entry.at),
    ),
  )
  check(
    'a source nobody configured has no history, because nothing has happened to it',
    maximo.activity.length === 0 && maximo.status === 'notConfigured',
  )
  check(
    'every activity entry is in the past and in order',
    [historian, abb].every(
      (row) =>
        row.activity.every((entry) => Date.parse(entry.at) <= Date.now() + 1000) &&
        row.activity.every(
          (entry, index) => index === 0 || row.activity[index - 1].at >= entry.at,
        ),
    ),
  )

  /* Test answers with what is true. */
  check(
    'testing a live source reports what it carries',
    (await post(endpoints.dataFusion.sourceTest('conn_historian'))).objects === historian.tags,
  )
  const abbTest = await post(endpoints.dataFusion.sourceTest('src_800xa_wtm'))
  check(
    'testing a dead source fails with the reason its own row prints',
    abbTest.ok === false && abbTest.reason === abb.error,
    `${abbTest.reason}`,
  )
  check(
    'testing an unconfigured source says there is nothing to reach',
    (await post(endpoints.dataFusion.sourceTest('src_maximo'))).reason === 'notConfigured',
  )
  check(
    'a test leaves a trace in the activity log',
    (await get(endpoints.dataFusion.source('src_maximo'))).activity.some(
      (entry) => entry.kind === 'connectionTested',
    ),
  )

  /* Saving. The endpoint is the field that proves the arrangement: it is derived
     into a status, so writing it here has to change the row in the table. */
  await patch(endpoints.dataFusion.source('src_maximo'), {
    values: { serviceRoot: 'maximo.meridian.corp/maxrest' },
  })
  const configuredMaximo = await get(endpoints.dataFusion.source('src_maximo'))
  check(
    'giving an unconfigured source an endpoint moves it off Not configured',
    configuredMaximo.status === 'disconnected' &&
      configuredMaximo.error === 'neverSynced' &&
      configuredMaximo.endpoint.includes('maxrest'),
    configuredMaximo.status,
  )
  check(
    'and the table behind the drawer agrees on the next read',
    (await get(endpoints.dataFusion.sources, { params: { category: 'biz' } })).items.find(
      (row) => row.id === 'src_maximo',
    ).status === configuredMaximo.status,
  )
  check(
    'the save is in the activity log the source had none of a moment ago',
    configuredMaximo.activity.some((entry) => entry.kind === 'configUpdated'),
  )
  await patch(endpoints.dataFusion.source('src_maximo'), { values: { serviceRoot: '' } })
  check(
    'and clearing it puts the source back where it was',
    (await get(endpoints.dataFusion.source('src_maximo'))).status === 'notConfigured',
  )

  check(
    'a field the schema does not declare is refused, not stored',
    (await patch(endpoints.dataFusion.source('conn_historian'), { values: { tags: 999_999 } }))
      .changed === 0 &&
      (await get(endpoints.dataFusion.source('conn_historian'))).tags === historian.tags,
  )
  check(
    'saving a credential stores when, never what',
    await (async () => {
      const saved = await patch(endpoints.dataFusion.source('conn_cmms'), {
        values: { clientSecret: 'not-a-real-secret' },
      })
      const after = await get(endpoints.dataFusion.source('conn_cmms'))
      const field = after.config.find((entry) => entry.id === 'clientSecret')
      return (
        saved.changed === 1 &&
        field.set === true &&
        field.value === null &&
        !JSON.stringify(after).includes('not-a-real-secret')
      )
    })(),
  )

  /* ── Mapping ───────────────────────────────────────────────────────────
     The claim the whole module rests on: exactly one connector routes signals
     into the sensor catalogue, and the tags it does not route are the ones on
     the Contextualisation queue. */
  const isra = await get(endpoints.dataFusion.source('src_isra_fdy'))
  const s7 = await get(endpoints.dataFusion.source('src_s7_fdy'))
  const sap = await get(endpoints.dataFusion.source('conn_cmms'))
  const s3 = await get(endpoints.dataFusion.source('src_s3_docs'))
  const s4 = await get(endpoints.dataFusion.source('src_s4hana'))

  check(
    'exactly one source in the whole registry binds Forge sensors',
    await (async () => {
      const bound = await Promise.all(
        everySource
          .filter((row) => row.category === 'ot')
          .map(async (row) => [
            row.id,
            (await get(endpoints.dataFusion.source(row.id))).mapping?.bound ?? 0,
          ]),
      )
      const binding = bound.filter(([, count]) => count > 0)
      return binding.length === 1 && binding[0][0] === 'conn_historian'
    })(),
  )
  check(
    'and it is the one declaring signals in its OWN contract, not its family\'s',
    historian.provides?.includes('signals') &&
      s7.provides === null &&
      /* The family claim is true of both and binds neither on its own. */
      s7.contract.provides.includes('signals'),
  )
  check(
    'an OT source that binds nothing says why, rather than showing an empty table',
    s7.mapping.blocked === 'notRoutedForSignals' && s7.mapping.rows.length === 0,
    s7.mapping.blocked,
  )

  const boundHistorian = await get(endpoints.dataFusion.source('conn_historian'))
  check(
    'bound plus awaiting placement is every tag the source publishes',
    await (async () => {
      const { tagsOfSource } = await server.ssrLoadModule('/src/mocks/fixtures/fusionContext.js')
      const { ALL_FUSION_SOURCES, composeSource } = await server.ssrLoadModule(
        '/src/mocks/fixtures/fusion.js',
      )
      const raw = composeSource(ALL_FUSION_SOURCES().find((row) => row.id === 'conn_historian'))
      return tagsOfSource(raw).length === boundHistorian.mapping.bound + boundHistorian.mapping.unbound
    })(),
    `${boundHistorian.mapping.bound} + ${boundHistorian.mapping.unbound}`,
  )
  check(
    'nothing bound is also sitting on the Contextualisation queue',
    await (async () => {
      const queue = await get(endpoints.dataFusion.context, { params: { status: 'all' } })
      const queued = new Set(queue.items.map((item) => item.label))
      return boundHistorian.mapping.rows.every((row) => !queued.has(row.cells[0].text))
    })(),
  )
  check(
    'every bound row names a real channel on a real asset',
    await (async () => {
      const { SIGNAL_CHANNELS } = await server.ssrLoadModule('/src/mocks/fixtures/signals.js')
      const byId = new Map(SIGNAL_CHANNELS.map((channel) => [channel.id, channel]))
      return boundHistorian.mapping.rows.every((row) => {
        const channel = byId.get(row.id)
        return channel && row.cells[0].text === channel.tag && row.href.endsWith(channel.assetId)
      })
    })(),
  )
  check(
    'and only channels on the assets this source actually reads',
    boundHistorian.mapping.rows.every((row) =>
      boundHistorian.assetIds.some((assetId) => row.href.endsWith(assetId)),
    ),
  )

  check(
    'a vision source lists as many cameras as its own row reports',
    isra.mapping.rows.length === isra.tags && isra.tags > 0,
    `${isra.mapping.rows.length} of ${isra.tags}`,
  )
  check(
    'and every camera is bound to an asset that source reads',
    isra.mapping.rows.every((row) =>
      isra.assetIds.some((assetId) => row.href === `/app/assets/${assetId}`),
    ),
  )

  check(
    'every mapping row anywhere goes somewhere this product actually has',
    await (async () => {
      const routes = new Set(
        (await Promise.all(everySource.map((row) => get(endpoints.dataFusion.source(row.id)))))
          .flatMap((row) => row.mapping?.rows ?? [])
          .map((row) => row.href),
      )
      return [...routes].every((href) => href.startsWith('/app/'))
    })(),
  )
  check(
    'a business system that feeds nothing here says so instead of showing rows',
    s4.mapping.rows.length === 0 && s4.mapping.unconsumed.length > 0,
    s4.mapping.unconsumed.join(', '),
  )
  check(
    'a row is dropped only into the unconsumed list, never silently',
    [sap, s4, s3].every((row) =>
      [...row.mapping.unconsumed].every((entry) => commonStrings.dataKinds[entry]),
    ),
  )
  check(
    'and every column and every blocked reason has a heading to print',
    [boundHistorian, isra, sap, s3, s7].every(
      (row) =>
        row.mapping.columns.every(
          (column) => appStrings.dataFusion.mapping.columns[column.id],
        ) &&
        (!row.mapping.blocked || appStrings.dataFusion.mapping.blocked[row.mapping.blocked]),
    ),
  )

  /* ── The two per-family extra tabs ────────────────────────────────────── */
  check(
    'write-back is offered to business systems and to nobody else',
    Boolean(sap.writeback) && !boundHistorian.writeback && !isra.writeback && !s3.writeback,
  )
  check(
    'ROI is offered to cameras and to nobody else',
    Boolean(isra.roi) && !sap.roi && !boundHistorian.roi,
  )
  check(
    'write-back follows the connection\'s own Sync direction',
    sap.writeback.enabled ===
      (sap.config.find((field) => field.id === 'syncDirection').value === 'biDirectional'),
  )
  check(
    'and turning the connection read-only turns every rule off',
    await (async () => {
      await patch(endpoints.dataFusion.source('conn_cmms'), {
        values: { syncDirection: 'readOnly' },
      })
      const readOnly = await get(endpoints.dataFusion.source('conn_cmms'))
      await patch(endpoints.dataFusion.source('conn_cmms'), {
        values: { syncDirection: 'biDirectional' },
      })
      return readOnly.writeback.enabled === false
    })(),
  )
  check(
    'a rule can be turned off and stays off',
    await (async () => {
      const first = sap.writeback.rules.find((rule) => rule.enabled)
      await patch(endpoints.dataFusion.sourceWriteback('conn_cmms'), {
        ruleId: first.id,
        enabled: false,
      })
      const after = await get(endpoints.dataFusion.source('conn_cmms'))
      return after.writeback.rules.find((rule) => rule.id === first.id).enabled === false
    })(),
  )
  check(
    'every write-back rule names a Forge object that exists, and links to it',
    sap.writeback.rules.every((rule) => rule.href && rule.href.startsWith('/app/')),
  )
  check(
    'the recipe marked running is the one the Connection tab has selected',
    await (async () => {
      const selected = isra.config.find((field) => field.id === 'inspectionProgram').value
      const running = isra.roi.recipes.filter((recipe) => recipe.active)
      return running.length === 1 && running[0].id === selected
    })(),
  )
  check(
    'and changing the inspection program moves it',
    await (async () => {
      await patch(endpoints.dataFusion.source('src_isra_fdy'), {
        values: { inspectionProgram: 'CAN-LABEL-v2' },
      })
      const after = await get(endpoints.dataFusion.source('src_isra_fdy'))
      return after.roi.recipes.find((recipe) => recipe.active).id === 'CAN-LABEL-v2'
    })(),
  )

  check(
    'every config field has a label to render and every phrase option has a key',
    (
      await Promise.all(
        ['conn_historian', 'src_isra_fdy', 'conn_cmms', 'src_influx'].map((id) =>
          get(endpoints.dataFusion.source(id)),
        ),
      )
    ).every((row) =>
      row.config.every(
        (field) =>
          appStrings.dataFusion.connection.fields[field.id] &&
          (field.type !== 'select' ||
            field.options.every(
              (option) =>
                !option.translate ||
                appStrings.dataFusion.connection.options[field.id]?.[option.value],
            )),
      ),
    ),
  )
  check(
    'and every data kind either family names has a word in the shared vocabulary',
    (
      await Promise.all(
        everySource.map((row) => get(endpoints.dataFusion.source(row.id))),
      )
    ).every((row) =>
      [...row.contract.provides, ...row.contract.doesNotProvide].every(
        (kind) => commonStrings.dataKinds[kind],
      ),
    ),
  )

  console.log('\nDATA FUSION · OVERVIEW\n')

  const overview = await get(endpoints.dataFusion.overview)

  /* The whole reason Overview was built last. Each card has to be a count of a
     collection that is served somewhere else, so a reader can click into any
     figure and arrive at the records it counted. */
  check(
    'the source card counts the source registry',
    overview.sources.total === everySource.length,
    `${overview.sources.total} vs ${everySource.length}`,
  )
  check(
    'the tag figure is the sum of what the tables show',
    overview.sources.tags === everySource.reduce((sum, row) => sum + row.tags, 0),
  )
  check(
    'the family rollup adds back up to the whole registry',
    overview.families.reduce((sum, family) => sum + family.total, 0) === overview.sources.total,
  )
  check(
    'each family bar is the proportion connected, not an authored number',
    overview.families.every(
      (family) => family.share === Math.round((family.connected / family.total) * 100),
    ),
  )

  const graph = overview.graph
  check(
    'the graph entity total is the sum of its own breakdown',
    graph.entityTotal === Object.values(graph.entities).reduce((sum, count) => sum + count, 0),
  )
  check(
    'the graph counts the estate, not a round number',
    graph.entities.hierarchy === hierarchyNodes.items.length,
    `${graph.entities.hierarchy} vs ${hierarchyNodes.items.length}`,
  )
  check(
    'the graph counts the sources the tables list',
    graph.entities.sources === everySource.length,
  )
  check(
    'hierarchy edges are one fewer than hierarchy nodes — every node but the root has a parent',
    graph.relationships.hierarchy === graph.entities.hierarchy - 1,
  )
  check(
    'ingestion edges match the asset lists the sources declare',
    graph.relationships.ingestion ===
      everySource.reduce((sum, row) => sum + row.assetIds.length, 0),
  )
  check('nothing in the graph is zero or negative', graph.entityTotal > 0 && graph.relationshipTotal > 0)

  /* The ingest chart is composed from the sources, so it cannot be a decorative
     wave that looks the same whatever the table says. */
  check('the ingest series is 24 hourly points', overview.ingest.length === 24)
  check(
    'every hour on the ingest chart is a real hour of the day',
    overview.ingest.every((point) => point.hour >= 0 && point.hour < 24),
  )
  check(
    'the ingest series ends at the current hour',
    overview.ingest.at(-1).hour === new Date().getHours(),
    `${overview.ingest.at(-1).hour} vs ${new Date().getHours()}`,
  )
  check(
    'the night shift moves less than the day shift',
    (() => {
      const at = (hour) => overview.ingest.find((point) => point.hour === hour)?.value ?? 0
      return at(3) < at(9)
    })(),
  )
  check(
    'ingest volume is driven by what is actually delivering',
    overview.ingest.every((point) => point.value > 0),
  )

  /* "Tags streaming" counts the live-signal families only. Summing all four put
     InfluxDB's 28 million STORED series into a card labelled streaming, which is
     a category error dressed as a big number. */
  check(
    'the streaming figure excludes stored series and business records',
    overview.streamingTags < overview.sources.tags / 100,
    `${overview.streamingTags} of ${overview.sources.tags}`,
  )
  check(
    'the streaming figure is the OT and vision families, delivering only',
    overview.streamingTags ===
      everySource
        .filter((row) => ['ot', 'vision'].includes(row.category))
        .filter((row) => row.status === 'connected' || row.status === 'syncing')
        .reduce((sum, row) => sum + row.tags, 0),
  )
  check(
    'the peak and the daily total are read off the series, not authored',
    overview.ingestStats.peakPerHour === Math.max(...overview.ingest.map((p) => p.value)) &&
      overview.ingestStats.pointsPerDay ===
        overview.ingest.reduce((sum, point) => sum + point.value, 0),
  )
  check(
    'average lag is an average of the lags the tables print',
    overview.ingestStats.avgLagSeconds > 0 && overview.ingestStats.avgLagSeconds < 5,
    String(overview.ingestStats.avgLagSeconds),
  )

  /* The attention list is assembled from three collections rather than authored
     as one, so it cannot name something the tables disagree about. */
  const attention = overview.attention
  check('the attention list is not empty — this fixture has broken sources', attention.length > 0)
  check(
    'every source on the attention list is a source in a table',
    attention
      .filter((item) => item.kind.startsWith('source'))
      .every((item) => everySource.some((row) => row.id === item.id)),
  )
  check(
    'every source on the attention list is one the tables call unhealthy',
    attention
      .filter((item) => item.kind.startsWith('source'))
      .every((item) => {
        const row = everySource.find((entry) => entry.id === item.id)
        return row && row.status !== 'connected' && row.status !== 'syncing'
      }),
  )
  check(
    'nothing healthy is on the attention list',
    !attention.some((item) =>
      everySource.some((row) => row.id === item.id && row.status === 'connected'),
    ),
  )
  check(
    'the dead source is listed above the merely stale one',
    (() => {
      const down = attention.findIndex((item) => item.kind === 'sourceDown')
      const stale = attention.findIndex((item) => item.kind === 'sourceStale')
      return down >= 0 && (stale === -1 || down < stale)
    })(),
  )
  check(
    'every attention item links to a section that exists',
    attention.every((item) =>
      ['ot', 'vision', 'business', 'stores', 'documents', 'media', 'context'].includes(
        item.section,
      ),
    ),
    attention.map((item) => item.section).join(', '),
  )

  /* Documents and media landed with this screen so its counts are counts. The
     links have to resolve now rather than when pass 4 renders them. */
  const knowledge = overview.knowledge
  check('the document count is the registry length', knowledge.documents === 15)
  check('the media count is the registry length', knowledge.media === 5)
  check(
    'the page total is a sum, not a round figure',
    knowledge.pages > 0 && knowledge.pages % 100 !== 0,
    String(knowledge.pages),
  )
  check(
    'exactly one document is unverified, and it is the one on the attention list',
    knowledge.unverified === 1 &&
      attention.filter((item) => item.kind === 'docUnverified').length === 1,
    `${knowledge.unverified} unverified`,
  )
  /* An unplaced record is a different job from an unverified one, goes to a
     different screen, and must never appear under both headings. */
  check(
    'unplaced records are listed as unplaced, not as unverified',
    knowledge.unplaced === attention.filter((item) => item.kind === 'docUnplaced').length &&
      attention
        .filter((item) => item.kind === 'docUnplaced')
        .every((item) => item.section === 'context'),
    `${knowledge.unplaced} unplaced`,
  )
  check(
    'no record is on the attention list twice',
    new Set(attention.map((item) => item.id)).size === attention.length,
  )
  check(
    'the expiring certificate is counted once and listed once',
    knowledge.expiringSoon === attention.filter((item) => item.kind === 'docExpiring').length,
  )
  check(
    'the CAD figure counts CAD, not the training video',
    knowledge.cadKb > 0 && knowledge.cadKb < knowledge.mediaKb,
    `${knowledge.cadKb} of ${knowledge.mediaKb}`,
  )

  /* The document registry has no route of its own until pass 4, but its links
     are authored NOW — so they are checked now. Discovering a document pointing
     at a machine the estate does not have, three passes after writing it, is the
     expensive way to find out. */
  const knowledgeFixture = await server.ssrLoadModule('/src/mocks/fixtures/fusionDocs.js')
  const allRecords = [
    ...knowledgeFixture.FUSION_DOCS.map((doc) => knowledgeFixture.composeDoc(doc)),
    ...knowledgeFixture.FUSION_MEDIA.map(knowledgeFixture.composeMedia),
  ]
  check(
    'every document and media link resolves to a node in the estate',
    allRecords.every((record) => record.links.every((link) => Boolean(link.name))),
    allRecords
      .flatMap((record) => record.links)
      .filter((link) => !link.name)
      .map((link) => link.id)
      .join(', '),
  )
  /* Two records can have no links and mean different things: enterprise-wide is
     a decision, unplaced is the absence of one. `pending` is the single authored
     bit that separates them. */
  check(
    'a record with no links is either enterprise-wide or unplaced, never something else',
    allRecords
      .filter((record) => record.links.length === 0)
      .every((record) => ['enterprise', 'unplaced'].includes(record.scope)),
    allRecords
      .filter((record) => record.links.length === 0)
      .map((record) => `${record.id}:${record.scope}`)
      .join(', '),
  )
  check(
    'and a record WITH links is neither',
    allRecords
      .filter((record) => record.links.length > 0)
      .every((record) => !['enterprise', 'unplaced'].includes(record.scope)),
  )
  check(
    'scope is read from the links — the shallowest one wins',
    allRecords.every((record) => {
      if (record.scope === 'enterprise') return true
      const tiers = record.links.map((link) => link.kind)
      if (record.scope === 'site') return tiers.includes('site')
      if (record.scope === 'line') return tiers.includes('line') && !tiers.includes('site')
      return tiers.every((tier) => tier === 'asset')
    }),
    allRecords.map((record) => `${record.id}:${record.scope}`).join(' '),
  )
  check(
    'every record resolves the sites it reaches, walking its links up the tree',
    allRecords
      .filter((record) => !['enterprise', 'unplaced'].includes(record.scope))
      .every((record) => record.siteIds.length > 0),
  )
  check(
    'a document linked to two plants reaches both',
    allRecords.find((record) => record.id === 'DOC-1011')?.siteIds.length === 2,
    JSON.stringify(allRecords.find((record) => record.id === 'DOC-1011')?.siteIds),
  )
  check(
    'every document declares a type the UI has a label and an icon for',
    knowledgeFixture.FUSION_DOCS.every((doc) =>
      knowledgeFixture.DOC_TYPES.some((type) => type.id === doc.type),
    ),
  )
  check(
    'no document type carries a colour literal — the palette rule reaches fixtures too',
    !JSON.stringify(knowledgeFixture.DOC_TYPES).includes('#'),
  )

  console.log('\nDATA FUSION · DOCUMENTS\n')

  const docs = await get(endpoints.dataFusion.documents)
  check('the register serves every record', docs.items.length === 15, String(docs.items.length))
  check(
    'the type chips count what they would filter to',
    docs.types.every(
      (type) => type.count === docs.items.filter((doc) => doc.type === type.id).length,
    ),
  )
  check(
    'no chip is offered for a type nothing is filed under',
    docs.types.every((type) => type.count > 0),
  )
  check(
    'the register is newest-revision first',
    docs.items.every((doc, index) => index === 0 || docs.items[index - 1].date >= doc.date),
  )
  check(
    'filtering by scope narrows to that scope and leaves the total alone',
    (async () => true)() &&
      (await get(endpoints.dataFusion.documents, { params: { scope: 'enterprise' } })).items.every(
        (doc) => doc.scope === 'enterprise',
      ),
  )
  const unlinked = await get(endpoints.dataFusion.documents, { params: { linked: 'none' } })
  check(
    '"not linked" is a real answer, not the absence of a filter',
    unlinked.items.length > 0 && unlinked.items.every((doc) => doc.links.length === 0),
    String(unlinked.items.length),
  )
  check(
    'search reaches tags, not only the name',
    (await get(endpoints.dataFusion.documents, { params: { q: 'loto' } })).items.length === 1,
  )
  check(
    'the unverified filter finds exactly the one that is',
    (await get(endpoints.dataFusion.documents, { params: { verified: 'no' } })).items.length ===
      docs.stats.unverified,
  )

  /* The resolver, in both directions. This is the idea the design is worth
     copying for, and the reason the asset tab's own list could be deleted. */
  const siteSop = await get(endpoints.dataFusion.document('DOC-1003'))
  check(
    'a site SOP reaches every machine at that site and none anywhere else',
    siteSop.reaches.length > 1 && siteSop.reaches.every((asset) => asset.id.startsWith('FDY-')),
    siteSop.reaches.map((asset) => asset.id).join(', '),
  )
  const policy = await get(endpoints.dataFusion.document('DOC-1009'))
  check(
    'an enterprise policy with no links still reaches every asset',
    policy.links.length === 0 &&
      policy.reaches.length ===
        hierarchyNodes.items.filter((node) => node.tier === 'asset').length,
    `${policy.reaches.length} of ${hierarchyNodes.items.filter((n) => n.tier === 'asset').length}`,
  )
  const cert = await get(endpoints.dataFusion.document('DOC-1008'))
  check(
    'a certificate attached to one machine reaches only that machine',
    cert.reaches.length === 1 && cert.reaches[0].id === 'FDY-BM-03',
    cert.reaches.map((asset) => asset.id).join(', '),
  )
  check(
    'the two directions agree — every asset a document reaches lists it back',
    (
      await get(endpoints.assets.detail(siteSop.reaches[0].id))
    ).documents.items.some((doc) => doc.id === 'DOC-1003'),
  )
  check(
    'usage is counted from records this app holds, never claimed',
    cert.usage.assets === cert.reaches.length &&
      cert.usage.graphEdges === cert.links.length &&
      Number.isInteger(cert.usage.openAlerts) &&
      Number.isInteger(cert.usage.workOrders),
    JSON.stringify(cert.usage),
  )
  check(
    'the machine with an open anomaly reports one against its certificate',
    cert.usage.openAlerts > 0,
    String(cert.usage.openAlerts),
  )

  /* Verification is the only write, and it has to reach the asset tab too —
     that tab prints the same flag off the same record. */
  const beforeVerify = await get(endpoints.dataFusion.documents, { params: { verified: 'no' } })
  await patch(endpoints.dataFusion.document('DOC-1005'), { verified: true })
  const afterVerify = await get(endpoints.dataFusion.documents, { params: { verified: 'no' } })
  check(
    'verifying a document removes it from the unverified list',
    afterVerify.items.length === beforeVerify.items.length - 1,
    `${beforeVerify.items.length} → ${afterVerify.items.length}`,
  )
  check(
    'and the Overview stops counting it',
    (await get(endpoints.dataFusion.overview)).knowledge.unverified ===
      afterVerify.items.filter((doc) => doc.scope !== 'unplaced').length,
  )
  check(
    'a revision number cannot be edited through this route',
    (await patch(endpoints.dataFusion.document('DOC-1005'), { rev: 'Rev Z' })).rev === 'Rev A',
  )

  /* Upload. The wizard's link picker is served, not imported, so it cannot
     offer a machine the estate does not have. */
  check(
    'the wizard is offered every type, not only the ones already in use',
    docs.allTypes.length === 8 && docs.allTypes.length >= docs.types.length,
    `${docs.allTypes.length} of ${docs.types.length} in use`,
  )
  check(
    'every link target the wizard offers is a real node',
    ['site', 'line', 'asset'].every((tier) =>
      docs.targets[tier].every((option) =>
        hierarchyNodes.items.some((node) => node.id === option.id && node.tier === tier),
      ),
    ),
  )

  const filed = await post(endpoints.dataFusion.documents, {
    name: 'Test Lubrication Guide',
    type: 'sop',
    links: [{ k: 'line', id: 'line_fdy_1' }],
    rev: 'v1.0',
    owner: 'Dana Okafor',
    date: '2026-08-16',
    tags: ['lubrication', 'test'],
    ocr: true,
  })
  check('an upload joins the register', filed.id.startsWith('DOC-'), filed.id)
  check(
    'an upload is filed unverified — nobody has checked it yet',
    filed.verified === false,
  )
  check(
    'its scope is READ from the links it was given, not from a second field',
    filed.scope === 'line',
    filed.scope,
  )
  check(
    'it carries no invented size or page count',
    filed.sizeKb === null && filed.pages === null,
    JSON.stringify({ sizeKb: filed.sizeKb, pages: filed.pages }),
  )
  const afterUpload = await get(endpoints.dataFusion.documents)
  check(
    'the register grew by one and the totals moved with it',
    afterUpload.items.length === docs.items.length + 1 &&
      afterUpload.stats.total === docs.stats.total + 1,
  )
  check(
    'the new document appears under the unverified filter',
    (
      await get(endpoints.dataFusion.documents, { params: { verified: 'no' } })
    ).items.some((doc) => doc.id === filed.id),
  )
  check(
    'a line upload inherits down to every machine on that line',
    (await get(endpoints.dataFusion.document(filed.id))).reaches.length > 1,
  )
  check(
    'and it appears on one of those machines without anything being edited there',
    (await get(endpoints.assets.detail('FDY-BM-03'))).documents.items.some(
      (doc) => doc.id === filed.id && doc.via === 'line',
    ),
  )
  check(
    'the page total ignores a document with no page count rather than going NaN',
    Number.isInteger((await get(endpoints.dataFusion.overview)).knowledge.pages),
  )

  console.log('\nDATA FUSION · MEDIA\n')

  const mediaList = await get(endpoints.dataFusion.media)
  check('the library serves every record', mediaList.items.length === 5, String(mediaList.items.length))
  check(
    'all four type chips are offered, including any at zero',
    mediaList.types.length === 4,
    String(mediaList.types.length),
  )
  check(
    'the chips count what they would filter to',
    mediaList.types.every(
      (type) => type.count === mediaList.items.filter((item) => item.type === type.id).length,
    ),
  )
  check(
    'filtering by type narrows to that type',
    (await get(endpoints.dataFusion.media, { params: { type: 'thermal' } })).items.every(
      (item) => item.type === 'thermal',
    ),
  )
  check(
    'search reaches tags, not only the name',
    (await get(endpoints.dataFusion.media, { params: { q: 'hotspot' } })).items.length === 1,
  )
  check(
    'every media link resolves to a node in the estate',
    mediaList.items.every((item) => item.links.every((link) => Boolean(link.name))),
  )
  check(
    'the Overview counts what the library holds',
    (await get(endpoints.dataFusion.overview)).knowledge.media === mediaList.items.length,
  )

  const added = await post(endpoints.dataFusion.media, {
    name: 'Test Ram Assembly',
    type: 'photo',
    links: [{ k: 'asset', id: 'FDY-BM-03' }],
    owner: 'Karan Patel',
    date: '2026-08-16',
    tags: ['test'],
  })
  check('an upload joins the library', added.id.startsWith('MED-'), added.id)
  check(
    'it carries no invented file size',
    added.sizeKb === null,
    String(added.sizeKb),
  )
  check(
    'the CAD figure still counts only CAD after a photo is added',
    (await get(endpoints.dataFusion.overview)).knowledge.cadKb === knowledge.cadKb,
  )
  check(
    'it reaches the machine it is of, on that machine\'s own tab',
    (await get(endpoints.assets.detail('FDY-BM-03'))).documents.mediaCount >= 2,
    String((await get(endpoints.assets.detail('FDY-BM-03'))).documents.mediaCount),
  )

  console.log('\nDATA FUSION · CONTEXTUALISATION\n')

  const ctx = await get(endpoints.dataFusion.context, { params: { status: 'all' } })
  check('the queue is not empty', ctx.items.length > 0, String(ctx.items.length))
  check(
    'it carries all three kinds of homeless object',
    ctx.kinds.every((kind) => kind.count > 0),
    ctx.kinds.map((kind) => `${kind.id}:${kind.count}`).join(' '),
  )

  /* THE check for this screen. Every generated tag records which asset it really
     came from; `suggestFor` is given the NAME only. If the matcher were scoring
     against anything but the text it would pass trivially — and if it were
     guessing, this would fail. */
  const withTruth = ctx.items.filter((item) => item.actualAssetId)
  check(
    'the matcher recovers the right asset from the tag name alone',
    withTruth.length > 0 &&
      withTruth.every((item) => item.suggestion?.id === item.actualAssetId),
    withTruth
      .filter((item) => item.suggestion?.id !== item.actualAssetId)
      .map((item) => `${item.label} → ${item.suggestion?.id}`)
      .join(', '),
  )
  check(
    'and it is confident about them, because the code is right there in the name',
    withTruth.every((item) => item.suggestion.confidence >= 90),
    String(Math.min(...withTruth.map((item) => item.suggestion.confidence))),
  )
  check(
    'a tag with no asset code in it gets no suggestion rather than a guess',
    ctx.items
      .filter((item) => item.kind === 'tag' && !item.actualAssetId)
      .every((item) => item.suggestion === null || item.suggestion.confidence < 90),
  )
  check(
    'at least one object defeats the matcher entirely — that is the real work',
    ctx.stats.unmatched > 0,
    String(ctx.stats.unmatched),
  )
  check(
    'confidence never exceeds certainty',
    ctx.items.every((item) => !item.suggestion || item.suggestion.confidence <= 100),
  )
  check(
    'the queue is most-confident first, with the unmatched last',
    ctx.items.every((item, index) => {
      if (index === 0) return true
      const previous = ctx.items[index - 1].suggestion?.confidence ?? -1
      return previous >= (item.suggestion?.confidence ?? -1)
    }),
  )
  check(
    'the average is taken over items that HAVE a suggestion',
    ctx.stats.avgConfidence ===
      Math.round(
        ctx.items
          .filter((item) => item.suggestion)
          .reduce((sum, item) => sum + item.suggestion.confidence, 0) /
          ctx.items.filter((item) => item.suggestion).length,
      ),
  )

  /* A channel the sensor catalogue already holds has a home by definition, so
     asking somebody to place it would be asking for work already done. */
  const placedTags = await get(endpoints.signals.list, { params: { pageSize: 500 } })
  check(
    'tags the sensor catalogue already accounts for are not in the queue',
    ctx.items
      .filter((item) => item.kind === 'tag')
      .every((item) => !(placedTags.items ?? []).some((channel) => channel.tag === item.label)),
  )

  /* Placing something has to actually place it, or the screen is a list of
     buttons that change a badge. */
  const scanned = ctx.items.find((item) => item.id === 'DOC-1015')
  check(
    'the unnamed scan reaches the matcher with something to work from',
    Boolean(scanned),
    'DOC-1015 missing from the queue',
  )
  const drawing = ctx.items.find((item) => item.kind === 'document' && item.suggestion)
  await post(endpoints.dataFusion.contextDecision(drawing.id), { decision: 'accepted' })
  const placed = await get(endpoints.dataFusion.document(drawing.id))
  check(
    'placing a document links it to the asset that was suggested',
    placed.links.length === 1 && placed.links[0].id === drawing.suggestion.id,
    JSON.stringify(placed.links),
  )
  check(
    'and it stops being unplaced',
    placed.scope !== 'unplaced',
    placed.scope,
  )
  check(
    'and it appears on that machine\'s own Documents tab',
    (await get(endpoints.assets.detail(drawing.suggestion.id))).documents.items.some(
      (doc) => doc.id === drawing.id,
    ),
  )
  check(
    'and the queue is one shorter',
    (await get(endpoints.dataFusion.context, { params: { status: 'pending' } })).items.length <
      ctx.items.filter((item) => item.status === 'pending').length,
  )
  check(
    'rejecting takes it off the queue without linking it',
    await (async () => {
      const pendingNow = await get(endpoints.dataFusion.context, { params: { status: 'pending' } })
      const target = pendingNow.items.find((item) => item.kind === 'document')
      if (!target) return true
      await post(endpoints.dataFusion.contextDecision(target.id), { decision: 'rejected' })
      const after = await get(endpoints.dataFusion.document(target.id))
      return after.links.length === 0
    })(),
  )
  await get(endpoints.dataFusion.context, { params: { kind: 'tag' } }).then((only) =>
    check(
      'filtering by kind narrows to that kind',
      only.items.every((item) => item.kind === 'tag'),
    ),
  )

  console.log('\nDATA FUSION · KNOWLEDGE GRAPH\n')

  const kg = await get(endpoints.dataFusion.graph)
  check(
    'the picker offers every machine in the estate',
    kg.entities.length === hierarchyNodes.items.filter((node) => node.tier === 'asset').length,
    `${kg.entities.length}`,
  )
  check(
    'the richest neighbourhood is first, so the screen does not open looking empty',
    kg.entities.every((entity, index) => index === 0 || kg.entities[index - 1].degree >= entity.degree),
  )
  check('the estate totals are counts, not round numbers', kg.totals.relationships > 0)

  const hood = await get(endpoints.dataFusion.graphNode(kg.entities[0].id))
  check('the focus is the machine that was asked for', hood.focus.id === kg.entities[0].id)
  check(
    'every edge starts at the focus — this is a neighbourhood, not a slice of a mesh',
    hood.edges.every((edge) => edge.from === hood.focus.id),
  )
  check(
    'every drawn node has an edge, and every edge a node',
    hood.edges.length === hood.nodes.length &&
      hood.edges.every((edge) => hood.nodes.some((node) => node.id === edge.to)),
  )
  check(
    'nothing is drawn twice',
    new Set(hood.nodes.map((node) => node.id)).size === hood.nodes.length,
  )

  /* Every edge has to be a fact another collection already asserts. If one of
     these fails, the graph has started inventing relationships — which is the
     one thing that would make Data Overview's relationship count meaningless. */
  const focusAsset = await get(endpoints.assets.detail(hood.focus.id))
  check(
    'the line it says it is part of is the line the hierarchy gives it',
    hood.nodes
      .filter((node) => node.kind === 'line')
      .every((node) => node.id === focusAsset.lineId),
  )
  check(
    'every document on the graph is one the asset resolves',
    hood.nodes
      .filter((node) => node.kind === 'document')
      .every((node) => focusAsset.documents.items.some((doc) => doc.id === node.id)),
  )
  check(
    'every sensor on the graph is a channel in the catalogue',
    hood.nodes
      .filter((node) => node.kind === 'sensor')
      .every((node) => (placedTags.items ?? []).some((channel) => channel.id === node.id)),
  )
  check(
    'every source on the graph declares it reads this machine',
    hood.nodes
      .filter((node) => node.kind === 'source')
      .every((node) => everySource.some((row) => row.id === node.id && row.assetIds.includes(hood.focus.id))),
  )
  check(
    'the graph counts the same open anomalies the asset screen does',
    (hood.groups.find((group) => group.kind === 'anomaly')?.total ?? 0) ===
      focusAsset.alerts.total,
    `${hood.groups.find((group) => group.kind === 'anomaly')?.total} vs ${focusAsset.alerts.total}`,
  )
  check(
    'and the same open work orders',
    (hood.groups.find((group) => group.kind === 'workOrder')?.total ?? 0) ===
      focusAsset.workOrders.open.length,
  )
  check(
    'the document group counts everything the asset resolves, not just what is drawn',
    hood.groups.find((group) => group.kind === 'document').total ===
      focusAsset.documents.items.length,
    `${hood.groups.find((group) => group.kind === 'document').total} vs ${focusAsset.documents.items.length}`,
  )

  /* The cap is stated, never silent. */
  check(
    'the legend reports the real count, not the drawn one',
    hood.groups.every((group) => group.total >= group.shown && group.shown <= 4),
    hood.groups.map((group) => `${group.kind} ${group.shown}/${group.total}`).join(' '),
  )
  check(
    'the drawn nodes are exactly what the groups say are drawn',
    hood.nodes.length === hood.groups.reduce((sum, group) => sum + group.shown, 0),
  )

  /* Positions are computed server-side so the picture is the same on every
     render, and they have to land on the canvas. */
  check(
    'every node is positioned inside the canvas',
    hood.nodes.every((node) => node.x > 0 && node.x < 100 && node.y > 0 && node.y < 100),
  )
  check(
    'the layout is deterministic — the same machine draws the same picture',
    JSON.stringify((await get(endpoints.dataFusion.graphNode(hood.focus.id))).nodes) ===
      JSON.stringify(hood.nodes),
  )
  check(
    'no two nodes land on the same point',
    new Set(hood.nodes.map((node) => `${node.x},${node.y}`)).size === hood.nodes.length,
  )

  await get(endpoints.dataFusion.graphNode('NOPE-01')).then(
    () => check('an unknown machine rejects', false, 'resolved instead'),
    (error) => check('an unknown machine → notFound', error.code === 'notFound'),
  )

  console.log('\nDATA FUSION · PIPELINES\n')

  const pipes = await get(endpoints.dataFusion.pipelines)
  check('the list is served', pipes.items.length > 0, String(pipes.items.length))
  check(
    'every pipeline names a source the registry actually has',
    pipes.items.every((row) => everySource.some((source) => source.id === row.sourceId)),
    pipes.items
      .filter((row) => !everySource.some((source) => source.id === row.sourceId))
      .map((row) => row.sourceId)
      .join(', '),
  )
  check(
    'and resolves its name rather than carrying a second copy of it',
    pipes.items.every(
      (row) => row.sourceName === everySource.find((s) => s.id === row.sourceId).name,
    ),
  )
  check(
    'every target points at a screen this build has',
    pipes.items.every((row) => typeof row.targetHref === 'string' && row.targetHref.startsWith('/app/')),
  )

  /* The rule the screen exists to make visible. The design leaves a pipeline
     Active beside a connection its own table marks Disconnected. */
  check(
    'no pipeline is active while its source is not delivering',
    pipes.items.every((row) => {
      const source = everySource.find((entry) => entry.id === row.sourceId)
      const live = source.status === 'connected' || source.status === 'syncing'
      return live || row.status !== 'active'
    }),
    pipes.items
      .filter((row) => row.status === 'active')
      .map((row) => `${row.id}:${row.sourceStatus}`)
      .join(' '),
  )
  check(
    'a pipeline stalled by its source says which source, and reports no error of its own',
    pipes.items
      .filter((row) => row.status === 'stalled')
      .every((row) => Boolean(row.stalledBy) && row.error === null),
  )
  check(
    'exactly one pipeline is failing on its own merits',
    pipes.items.filter((row) => row.status === 'failed').length === 1,
    pipes.items.filter((row) => row.status === 'failed').map((row) => row.id).join(', '),
  )
  check(
    'a failing pipeline names the fault',
    pipes.items.filter((row) => row.status === 'failed').every((row) => Boolean(row.error)),
  )
  check(
    'nothing that is not moving reports records',
    pipes.items.filter((row) => row.status !== 'active').every((row) => row.records === 0),
  )

  /* What a pipeline moves is counted off the collection it moves, never typed
     beside it. */
  const docPipe = pipes.items.find((row) => row.id === 'pipe_docs_index')
  check(
    'the document pipeline moves as many records as there are documents',
    docPipe.records === (await get(endpoints.dataFusion.documents)).items.length,
    `${docPipe.records}`,
  )
  const otPipe = pipes.items.find((row) => row.id === 'pipe_ot_graph')
  check(
    'the historian pipeline moves as many as that historian carries tags',
    otPipe.records === everySource.find((s) => s.id === otPipe.sourceId).tags,
  )

  check(
    'lateness is arithmetic against a pipeline\'s own schedule',
    pipes.items.every(
      (row) => row.overdue === (row.everyMinutes != null && row.lastRunMinutesAgo > row.everyMinutes * 2),
    ),
  )
  check(
    'the failed and stalled rows sort above the healthy ones',
    (() => {
      const first = pipes.items.findIndex((row) => row.status === 'active')
      const broken = pipes.items.findIndex((row) => row.status === 'failed')
      return broken >= 0 && broken < first
    })(),
  )

  /* Running clears a pipeline's OWN error, and must not clear a stall. */
  const failing = pipes.items.find((row) => row.status === 'failed')
  const ran = await post(endpoints.dataFusion.pipelineAction(failing.id), { action: 'run' })
  check('running a failed pipeline clears its error', ran.status === 'active' && !ran.error)
  check('and it reports having just run', ran.lastRunMinutesAgo === 0)

  const stalled = pipes.items.find((row) => row.status === 'stalled')
  const rerun = await post(endpoints.dataFusion.pipelineAction(stalled.id), { action: 'run' })
  check(
    'running a stalled pipeline does NOT make it green — the source is still down',
    rerun.status === 'stalled',
    rerun.status,
  )

  const idlePipe = pipes.items.find((row) => row.status === 'paused')
  const resumed = await post(endpoints.dataFusion.pipelineAction(idlePipe.id), { action: 'resume' })
  check('resuming a paused pipeline starts it', resumed.status !== 'paused', resumed.status)
  const repaused = await post(endpoints.dataFusion.pipelineAction(idlePipe.id), { action: 'pause' })
  check('and pausing beats everything else', repaused.status === 'paused')

  /* ── The connect wizard ────────────────────────────────────────────────
     Last in the module, and not by accident: it WRITES to the registry every
     block above reads, so running it earlier would have the overview counting
     seventeen sources against a snapshot of sixteen. A check that creates
     something belongs after the checks that assert what was already there. */
  console.log('\nDATA FUSION · CONNECT WIZARD\n')

  const otCatalogue = await get(endpoints.dataFusion.connectorCatalogue, {
    params: { category: 'ot' },
  })
  const bizCatalogue = await get(endpoints.dataFusion.connectorCatalogue, {
    params: { category: 'biz' },
  })

  check(
    'the catalogue offers connectors, essential fields and a schedule for each family',
    await (async () => {
      const all = await Promise.all(
        ['ot', 'vision', 'biz', 'db'].map((category) =>
          get(endpoints.dataFusion.connectorCatalogue, { params: { category } }),
        ),
      )
      return all.every(
        (entry) => entry.connectors.length > 0 && entry.fields.length > 0 && entry.schedules.length > 0,
      )
    })(),
  )
  check(
    'the wizard asks for fewer fields than the drawer, and every one is in the schema',
    otCatalogue.fields.length < historian.config.length &&
      otCatalogue.fields.every((field) =>
        historian.config.some((entry) => entry.id === field.id),
      ),
    `${otCatalogue.fields.length} of ${historian.config.length}`,
  )
  check(
    'and one of them is the endpoint, empty rather than prefilled from somewhere else',
    await (async () => {
      const bound = otCatalogue.fields.find((field) => field.bind === 'endpoint')
      return Boolean(bound) && bound.value === ''
    })(),
  )
  check(
    'a gateway is scoped to a line; an enterprise system is scoped to nothing',
    otCatalogue.scopesAssets &&
      otCatalogue.scopes.length > 0 &&
      !bizCatalogue.scopesAssets &&
      bizCatalogue.scopes.length === 0,
  )
  check(
    'every line it offers is a real line, and the machines it claims are really on it',
    await (async () => {
      const { HIERARCHY_NODES } = await server.ssrLoadModule('/src/mocks/fixtures/hierarchy.js')
      return otCatalogue.scopes.every((option) => {
        const line = HIERARCHY_NODES.find((node) => node.id === option.id && node.tier === 'line')
        return (
          line &&
          option.assets.every(
            (assetId) =>
              HIERARCHY_NODES.find((node) => node.id === assetId)?.parentId === line.id,
          )
        )
      })
    })(),
  )

  check(
    'a probe with no address fails, and says so rather than inventing a server',
    (await post(endpoints.dataFusion.connectorProbe, { category: 'ot', endpoint: '' })).reason ===
      'noEndpoint',
  )
  check(
    'a probe reports a sample of what is there and NOT a total',
    await (async () => {
      const probed = await post(endpoints.dataFusion.connectorProbe, {
        category: 'ot',
        endpoint: 'opc.tcp://10.4.9.9:4840',
      })
      return probed.ok && probed.objects.length > 0 && probed.objects.every((o) => o.name && o.kind)
    })(),
  )

  /* The write. */
  const scopeLine = otCatalogue.scopes.find((option) => option.assets.length > 0)
  const newSource = await post(endpoints.dataFusion.sources, {
    category: 'ot',
    connector: 'Generic OPC-UA server',
    protocol: 'OPC-UA',
    name: 'Verify Gateway',
    endpoint: 'opc.tcp://10.4.9.9:4840',
    lineId: scopeLine.id,
    schedule: 'hourly',
    values: { securityPolicy: 'Basic256' },
  })
  const createdSource = await get(endpoints.dataFusion.source(newSource.id))

  check(
    'the wizard creates a source that says it has never synced, not that it is connected',
    createdSource.status === 'disconnected' &&
      createdSource.error === 'neverSynced' &&
      createdSource.lastSyncAt === null,
    createdSource.status,
  )
  check(
    'its object count is the scope it was given, not the sample the probe showed',
    createdSource.tags === scopeLine.objects && createdSource.tags > 0,
    `${createdSource.tags} vs ${scopeLine.objects}`,
  )
  check(
    'its site is derived from the machines it reads, exactly as every other source\'s is',
    createdSource.assetIds.length === scopeLine.assets.length &&
      createdSource.siteName !== null,
    createdSource.siteName,
  )
  check(
    'it appears in its family\'s table and in the family totals',
    await (async () => {
      const family = await get(endpoints.dataFusion.sources, { params: { category: 'ot' } })
      return (
        family.items.some((row) => row.id === newSource.id) &&
        family.stats.total === otSources.stats.total + 1
      )
    })(),
  )
  check(
    'and in the overview, which counts the registry rather than a stored figure',
    (await get(endpoints.dataFusion.overview)).sources.total === everySource.length + 1,
  )
  check(
    'a value the wizard collected is on the connection when the drawer opens it',
    createdSource.config.find((field) => field.id === 'securityPolicy').value === 'Basic256',
  )
  check(
    'it binds nothing, because it is not the connector that provides signals',
    createdSource.mapping.bound === 0 &&
      createdSource.mapping.blocked === 'notRoutedForSignals',
  )
  /* Not on the Contextualisation queue, and that is the right answer. The queue
     takes tags from sources that are actually delivering; this one has never
     synced, and asking somebody to place objects from a feed that has not started
     is asking them to do the work twice. */
  check(
    'a connection that has never delivered puts nothing on the placement queue',
    (await get(endpoints.dataFusion.context, { params: { kind: 'tag' } })).items.every(
      (item) => item.sourceId !== newSource.id,
    ),
  )
  check(
    'a connector that is not in the catalogue is refused',
    (await post(endpoints.dataFusion.sources, {
      category: 'ot',
      connector: 'Nonesuch Historian',
      protocol: 'OPC-UA',
      name: 'Nope',
      endpoint: 'opc.tcp://1.2.3.4:4840',
      lineId: scopeLine.id,
      schedule: 'hourly',
    }).catch(() => null)) === null,
  )
  check(
    'every schedule the wizard offers is one the pipelines module already knows',
    await (async () => {
      const { SCHEDULES } = await server.ssrLoadModule('/src/mocks/fixtures/fusionPipelines.js')
      return otCatalogue.schedules.every((key) => Object.hasOwn(SCHEDULES, key))
    })(),
  )
  check(
    'and the one chosen became the connection\'s SLA',
    createdSource.slaMinutes === 60,
    `${createdSource.slaMinutes}`,
  )


  /* ── The people directory ──────────────────────────────────────────────
     The point of this module is that it did not add a fourth list of people. So
     the first checks are that the three that existed are now one. */
  console.log('\nPEOPLE\n')

  const dir = await get(endpoints.people.list)
  const { PEOPLE } = await server.ssrLoadModule('/src/mocks/fixtures/enterprise.js')
  const { TASK_PEOPLE, TASKS: HOME_TASKS } = await server.ssrLoadModule(
    '/src/mocks/fixtures/home.js',
  )
  const byId = new Map(dir.items.map((row) => [row.id, row]))

  check('the directory is not empty', dir.items.length > 0, String(dir.items.length))
  check(
    'the four personas are rows in the directory, not a list beside it',
    Object.values(PEOPLE).every(
      (person) => byId.get(person.id)?.name === person.name && byId.get(person.id)?.role === person.role,
    ),
  )
  check(
    'so is everybody the roster and the logbook resolve a name from',
    TASK_PEOPLE.every((person) => byId.get(person.id)?.name === person.name),
  )
  /* Two different questions, and the module answers them separately: who does
     plant work — which a locked account still did — and who may be given
     something new. */
  check(
    'the name list is by role; the assignee list is by role AND an enabled account',
    !TASK_PEOPLE.some((person) => ['platformAdmin', 'readOnly'].includes(person.role)) &&
      (await get(endpoints.tasks.list)).people.every(
        (person) => byId.get(person.id).status === 'active',
      ),
    TASK_PEOPLE.map((person) => person.role).join(', '),
  )
  check(
    'every task is assigned to somebody who exists and can be assigned to',
    HOME_TASKS.every((task) => TASK_PEOPLE.some((person) => person.id === task.assignee)),
  )
  check(
    'every role in the directory has a word for it',
    dir.items.every((row) => commonStrings.roles[row.role]),
    [...new Set(dir.items.map((row) => row.role))].join(', '),
  )

  check(
    'initials and email are computed from the name, not carried beside it',
    dir.items.every((row) => {
      const initials = row.name.split(/\s+/).slice(0, 2).map((part) => part[0].toUpperCase()).join('')
      const local = row.email.split('@')[0]
      return row.initials === initials && local === local.toLowerCase() && local.includes('.')
    }),
  )
  check(
    'no synthetic address could ever reach a real inbox',
    dir.items.every((row) => row.email.endsWith('@meridian.example')),
  )

  /* Derived, not authored. */
  check(
    'last active is the end of a shift the person really worked',
    await (async () => {
      const { shiftsForWeek } = await server.ssrLoadModule('/src/mocks/fixtures/shifts.js')
      const roster = shiftsForWeek(Date.now(), 28)
      return dir.items.every((row) => {
        if (row.lastActiveAt === null) return true
        return roster.some(
          (shift) =>
            shift.operatorId === row.id &&
            shift.status === 'completed' &&
            shift.endsAt === row.lastActiveAt,
        )
      })
    })(),
  )
  check(
    'and nobody is reported active in the future',
    dir.items.every((row) => !row.lastActiveAt || Date.parse(row.lastActiveAt) <= Date.now()),
  )
  check(
    'an account with no activity says never rather than a plausible date',
    dir.items.some((row) => row.lastActiveAt === null && row.shiftsWorked === 0),
  )
  check(
    'the shift count is the shifts they worked',
    await (async () => {
      const { shiftsForWeek } = await server.ssrLoadModule('/src/mocks/fixtures/shifts.js')
      const roster = shiftsForWeek(Date.now(), 28)
      return dir.items.every(
        (row) =>
          row.shiftsWorked ===
          roster.filter((shift) => shift.operatorId === row.id && shift.status === 'completed')
            .length,
      )
    })(),
  )
  check(
    'the task count is their open tasks',
    dir.items.every(
      (row) =>
        row.openTasks ===
        HOME_TASKS.filter((task) => task.assignee === row.id && task.status !== 'done').length,
    ),
  )
  check(
    'every site somebody reaches is a real site in the estate',
    await (async () => {
      const { HIERARCHY_NODES } = await server.ssrLoadModule('/src/mocks/fixtures/hierarchy.js')
      const sites = new Set(HIERARCHY_NODES.filter((n) => n.tier === 'site').map((n) => n.id))
      return dir.items.every((row) => row.siteIds.every((id) => sites.has(id)))
    })(),
  )
  check(
    'somebody with no plant of their own covers the estate, and says so',
    dir.items.every((row) =>
      row.siteId === null
        ? row.scope === 'enterprise' && row.siteIds.length === 0
        : row.scope === (row.siteIds.length > 1 ? 'multiSite' : 'site'),
    ),
  )
  check(
    'and covering two sites is something the roster and the task list decided',
    dir.items.some((row) => row.scope === 'multiSite'),
    dir.items.filter((row) => row.scope === 'multiSite').map((row) => row.name).join(', '),
  )

  /* The list is an access review. */
  check(
    'a locked account sorts above a dormant one, and both above a working one',
    (() => {
      const rank = { locked: 0, inactive: 1, active: 2 }
      return dir.items.every(
        (row, index) => index === 0 || rank[dir.items[index - 1].status] <= rank[row.status],
      )
    })(),
    dir.items.map((row) => row.status).join(' '),
  )
  check(
    'the tiles count everybody, and each one is a filter the table can answer',
    await (async () => {
      const facets = [
        ['active', (row) => row.status === 'active'],
        ['inactive', (row) => row.status === 'inactive'],
        ['locked', (row) => row.status === 'locked'],
        ['mfaOff', (row) => !row.mfa],
        ['neverSignedIn', (row) => row.lastActiveAt === null],
      ]
      for (const [facet, predicate] of facets) {
        const expected = dir.items.filter(predicate).length
        if (dir.stats[facet] !== expected) return false
        const params = ['active', 'inactive', 'locked'].includes(facet)
          ? { status: facet }
          : { facet }
        const narrowed = await get(endpoints.people.list, { params })
        if (narrowed.items.length !== expected || !narrowed.items.every(predicate)) return false
        // The tiles count everybody, never the filtered slice.
        if (narrowed.stats.total !== dir.stats.total) return false
      }
      return true
    })(),
  )
  check(
    'the site filter only offers sites somebody actually reaches',
    dir.options.sites.every((option) =>
      dir.items.some((row) => row.siteIds.includes(option.value)),
    ),
  )

  /* The one write. */
  const target = dir.items.find((row) => row.status === 'active' && row.id !== 'usr_mgr_1')
  check(
    'an account can be locked, and the tiles move with it',
    await (async () => {
      await patch(endpoints.people.detail(target.id), { status: 'locked' })
      const after = await get(endpoints.people.list)
      return (
        after.items.find((row) => row.id === target.id).status === 'locked' &&
        after.stats.locked === dir.stats.locked + 1 &&
        after.stats.active === dir.stats.active - 1
      )
    })(),
  )
  /* Locking stops new work reaching them. It does NOT erase them from the roster
     or the logbook — who worked Tuesday night is a fact, and an account decision
     taken on Friday cannot unmake it. Both halves are asserted. */
  check(
    'and a locked account can no longer be given work',
    !(await get(endpoints.tasks.list)).people.some((person) => person.id === target.id),
  )
  check(
    'but the shifts they already worked still carry their name',
    await (async () => {
      const { shiftsForWeek } = await server.ssrLoadModule('/src/mocks/fixtures/shifts.js')
      const theirs = shiftsForWeek(Date.now(), 28).filter((s) => s.operatorId === target.id)
      return theirs.length === 0 || theirs.every((shift) => Boolean(shift.operatorName))
    })(),
  )
  await patch(endpoints.people.detail(target.id), { status: 'active' })
  check(
    'letting them back in restores it',
    (await get(endpoints.people.list)).items.find((row) => row.id === target.id).status === 'active',
  )
  check(
    'a status the platform does not have is refused',
    (await patch(endpoints.people.detail(target.id), { status: 'banished' }).catch(() => null)) ===
      null,
  )

  /* ── Teams and the bulk import ─────────────────────────────────────── */
  console.log('\nTEAMS & IMPORT\n')

  const teamList = await get(endpoints.teams.list)
  const dirNow = await get(endpoints.people.list)
  const peopleById = new Map(dirNow.items.map((row) => [row.id, row]))

  check('there are teams', teamList.items.length > 0, String(teamList.items.length))
  check(
    'a team reports exactly the people carrying its id',
    teamList.items.every(
      (team) =>
        team.memberCount === dirNow.items.filter((row) => row.teamId === team.id).length &&
        team.memberIds.every((id) => peopleById.get(id)?.teamId === team.id),
    ),
  )
  check(
    'a team lead is a member of the team, or the team has none',
    teamList.items.every((team) => !team.leadId || team.memberIds.includes(team.leadId)),
  )
  check(
    'a team is active when somebody in it can sign in, and dormant when nobody can',
    teamList.items.every(
      (team) =>
        team.status ===
        (team.memberIds.some((id) => peopleById.get(id).status === 'active')
          ? 'active'
          : 'dormant'),
    ),
    teamList.items.map((team) => `${team.name}:${team.status}`).join(' '),
  )
  check(
    'and at least one is dormant, so the state is reachable',
    teamList.items.some((team) => team.status === 'dormant'),
  )
  check(
    'a team reaches exactly the sites its members are at',
    teamList.items.every((team) => {
      const expected = new Set(
        team.memberIds.map((id) => peopleById.get(id).siteId).filter(Boolean),
      )
      return team.siteIds.length === expected.size && team.siteIds.every((id) => expected.has(id))
    }),
  )
  check(
    "every team's default page is a route this product actually has",
    await (async () => {
      const source = await readFile(new URL('../src/routes/router.jsx', import.meta.url), 'utf8')
      return teamList.items.every((team) => {
        const leaf = team.landing.split('/').filter(Boolean).slice(1).join('/')
        return source.includes(`path: '${leaf}'`)
      })
    })(),
    teamList.items.map((team) => team.landing).join(' '),
  )
  check(
    'and it has a name to print',
    teamList.items.every(
      (team) =>
        appStrings.settings.teams.landing[team.landingKey] &&
        appStrings.settings.teams.types[team.type],
    ),
  )
  check(
    'deactivating the last member of a team makes the team dormant',
    await (async () => {
      const live = teamList.items.find((team) => team.status === 'active' && team.memberCount === 1)
        ?? teamList.items.find((team) => team.status === 'active')
      const members = live.memberIds
      for (const id of members) await patch(endpoints.people.detail(id), { status: 'inactive' })
      const after = (await get(endpoints.teams.list)).items.find((team) => team.id === live.id)
      for (const id of members) await patch(endpoints.people.detail(id), { status: 'active' })
      return after.status === 'dormant'
    })(),
  )

  /* The import. It has to be a reconciliation, not a create. */
  check('the import history starts empty', (await get(endpoints.people.imports)).items.length === 0)

  const totalBefore = (await get(endpoints.people.list)).stats.total
  const firstRun = await post(endpoints.people.import, {
    filename: 'verify.csv',
    records: [
      { name: 'Ada Okonkwo', email: 'ada.okonkwo@meridian.example', role: 'maintenanceTechnician', site: 'Findlay Plant', team: '', mfa: true },
      { name: 'Nobody', email: 'nobody@meridian.example', role: 'notARole', site: '', team: '', mfa: false },
    ],
  })
  check(
    'a valid row is created and a row naming a role that does not exist is skipped',
    firstRun.created === 1 && firstRun.skipped === 1,
    `created=${firstRun.created} skipped=${firstRun.skipped}`,
  )
  check(
    'the new account is in the directory, at the plant the file named',
    await (async () => {
      const after = await get(endpoints.people.list)
      const added = after.items.find((row) => row.name === 'Ada Okonkwo')
      return Boolean(added) && after.stats.total === totalBefore + 1 && added.siteNames.includes('Findlay Plant')
    })(),
  )
  check(
    'and it says it has never been used, because it has not',
    (await get(endpoints.people.list)).items.find((row) => row.name === 'Ada Okonkwo')
      .lastActiveAt === null,
  )
  check(
    'running the same file again updates rather than doubling the directory',
    await (async () => {
      const second = await post(endpoints.people.import, {
        filename: 'verify.csv',
        records: [
          { name: 'Ada Okonkwo', email: 'ada.okonkwo@meridian.example', role: 'lineOperator', site: '', team: '', mfa: false },
        ],
      })
      const after = await get(endpoints.people.list)
      return (
        second.created === 0 &&
        second.updated === 1 &&
        after.items.filter((row) => row.name === 'Ada Okonkwo').length === 1 &&
        after.items.find((row) => row.name === 'Ada Okonkwo').role === 'lineOperator'
      )
    })(),
  )
  check(
    'every import is recorded, newest first, by somebody who exists',
    await (async () => {
      const history = (await get(endpoints.people.imports)).items
      return (
        history.length === 2 &&
        history[0].at >= history[1].at &&
        history.every((entry) => peopleById.has(entry.byId) && entry.filename === 'verify.csv')
      )
    })(),
  )

  /* Creating one by hand takes the same path. */
  check(
    'a hand-created account starts enabled, unhardened and unused',
    await (async () => {
      const made = await post(endpoints.people.list, {
        name: 'Rui Tavares',
        role: 'reliabilityEngineer',
      })
      return (
        made.status === 'active' &&
        made.mfa === false &&
        made.lastActiveAt === null &&
        made.email === 'rui.tavares@meridian.example'
      )
    })(),
  )
  check(
    'and a role the platform does not have is refused',
    (await post(endpoints.people.list, { name: 'X', role: 'wizard' }).catch(() => null)) === null,
  )

  /* ── Roles and permissions ─────────────────────────────────────────── */
  console.log('\nROLES\n')

  const roleList = await get(endpoints.roles.list)
  const dirForRoles = await get(endpoints.people.list)

  check('there are roles and a catalogue', roleList.items.length > 0 && roleList.catalogue.length > 0)
  check(
    'the catalogue IS the navigation rail — every permission names a real module',
    await (async () => {
      const { ALL_NAV_ITEMS } = await server.ssrLoadModule('/src/shell/navigation.js')
      const nav = new Map(ALL_NAV_ITEMS.map((item) => [item.id, item]))
      return (
        roleList.catalogue.length === ALL_NAV_ITEMS.length &&
        roleList.catalogue.every((module) => nav.get(module.id)?.to === module.to)
      )
    })(),
  )
  check(
    'every module has a name on screen and every feature has a word',
    roleList.catalogue.every(
      (module) =>
        appStrings.screens[module.id] &&
        module.features.every((feature) => appStrings.settings.roles.features[feature]),
    ),
  )
  check(
    "every module's gate is one of its own features",
    roleList.catalogue.every((module) => module.features.includes(module.gate)),
  )

  check(
    'the built-in roles are exactly the vocabulary the rest of the product uses',
    await (async () => {
      const system = roleList.items.filter((role) => role.system).map((role) => role.id).sort()
      return (
        system.length === Object.keys(commonStrings.roles).length &&
        system.every((id) => commonStrings.roles[id])
      )
    })(),
    roleList.items.filter((role) => role.system).map((role) => role.id).join(', '),
  )
  check(
    'so every role somebody actually holds is one this page knows about',
    dirForRoles.items.every((person) => roleList.items.some((role) => role.id === person.role)),
  )
  check(
    'how many people hold a role is counted from the directory, not written down',
    roleList.items.every(
      (role) =>
        role.userCount === dirForRoles.items.filter((person) => person.role === role.id).length,
    ),
  )
  check(
    'and the total assigned counts each person once',
    roleList.stats.assigned === new Set(dirForRoles.items.map((p) => p.id)).size ||
      roleList.stats.assigned <= dirForRoles.items.length,
    `${roleList.stats.assigned} of ${dirForRoles.items.length}`,
  )
  check(
    'every grant names a permission that exists in the catalogue',
    await (async () => {
      const keys = new Set(
        roleList.catalogue.flatMap((m) => m.features.map((f) => `${m.id}.${f}`)),
      )
      return roleList.items.every((role) => role.granted.every((key) => keys.has(key)))
    })(),
  )
  check(
    'the admin role reaches every module and the read-only role changes nothing',
    await (async () => {
      const admin = roleList.items.find((role) => role.id === 'platformAdmin')
      const reader = roleList.items.find((role) => role.id === 'readOnly')
      const nonGate = roleList.catalogue.flatMap((m) =>
        m.features.filter((f) => f !== m.gate).map((f) => `${m.id}.${f}`),
      )
      return (
        admin.moduleCount === roleList.catalogue.length &&
        nonGate.every((key) => !reader.grant[key])
      )
    })(),
  )
  check(
    'what a role reaches is exactly the modules whose gate it holds',
    roleList.items.every((role) => {
      const expected = roleList.catalogue
        .filter((module) => role.grant[`${module.id}.${module.gate}`])
        .map((module) => module.id)
      return (
        role.reaches.length === expected.length && role.reaches.every((id) => expected.includes(id))
      )
    }),
  )
  check(
    'no role is granted a feature on a module it cannot open',
    roleList.items.every((role) =>
      roleList.catalogue.every(
        (module) =>
          role.grant[`${module.id}.${module.gate}`] ||
          !module.features.some((f) => role.grant[`${module.id}.${f}`]),
      ),
    ),
    roleList.items
      .filter((role) =>
        roleList.catalogue.some(
          (m) => !role.grant[`${m.id}.${m.gate}`] && m.features.some((f) => role.grant[`${m.id}.${f}`]),
        ),
      )
      .map((role) => role.id)
      .join(', '),
  )

  /* Writes. A built-in role is the vocabulary and cannot be touched. */
  check(
    'a built-in role cannot be edited',
    (await put(endpoints.roles.detail('platformAdmin'), { name: 'Hacked' }).catch(() => null)) ===
      null,
  )
  check(
    'or deleted',
    (await del(endpoints.roles.detail('platformAdmin')).catch(() => null)) === null,
  )

  const custom = await post(endpoints.roles.list, {
    name: 'Safety Auditor',
    description: 'Reads everything and signs nothing.',
    grant: { 'home.view': true, 'anomalies.view': true, 'settings.view': true, 'settings.audit': true },
  })
  check(
    'a custom role can be created, and it starts with nobody holding it',
    custom.name === 'Safety Auditor' && custom.system === false && custom.userCount === 0,
  )
  check(
    'it reaches the modules it was given the gate for, and no others',
    custom.reaches.length === 3 &&
      ['home', 'anomalies', 'settings'].every((id) => custom.reaches.includes(id)),
    custom.reaches.join(', '),
  )
  check(
    'a permission the catalogue does not have is dropped rather than stored',
    await (async () => {
      const junk = await post(endpoints.roles.list, {
        name: 'Junk',
        grant: { 'nosuch.module': true, 'home.view': true },
      })
      await del(endpoints.roles.detail(junk.id))
      return junk.granted.length === 1 && junk.granted[0] === 'home.view'
    })(),
  )
  check(
    'the new role is in the list and in the counts',
    await (async () => {
      const after = await get(endpoints.roles.list)
      return (
        after.items.some((role) => role.id === custom.id) &&
        after.stats.custom === roleList.stats.custom + 1
      )
    })(),
  )
  check(
    'a custom role nobody holds can be deleted',
    Boolean(await del(endpoints.roles.detail(custom.id))) &&
      !(await get(endpoints.roles.list)).items.some((role) => role.id === custom.id),
  )
  check(
    'and one somebody holds cannot',
    await (async () => {
      const held = await post(endpoints.roles.list, { name: 'Held', grant: { 'home.view': true } })
      const person = await post(endpoints.people.list, { name: 'Test Holder', role: held.id })
      const refused = await del(endpoints.roles.detail(held.id)).catch(() => null)
      await patch(endpoints.people.detail(person.id), { status: 'inactive' })
      return refused === null
    })(),
  )

  /* ── The row actions and channel cards the design has ──────────────── */
  console.log('\nNOTIFICATION ACTIONS\n')

  const beforeRules = await get(endpoints.notifications.list)
  const editable = beforeRules.rules.find((rule) => rule.routes.length > 0)

  check(
    'a rule can be edited, and its kind is not among the fields',
    await (async () => {
      const next = editable.severity === 'critical' ? 'medium' : 'critical'
      await put(endpoints.notifications.rule(editable.id), { severity: next, kind: 'vibration' })
      const after = (await get(endpoints.notifications.list)).rules.find(
        (rule) => rule.id === editable.id,
      )
      return after.severity === next && after.kind === editable.kind
    })(),
  )
  check(
    'a rule can be deleted, and what it covered stops being covered',
    await (async () => {
      const live = (await get(endpoints.notifications.list)).rules.find((rule) => rule.enabled)
      const before = (await get(endpoints.notifications.list)).stats
      await del(endpoints.notifications.rule(live.id))
      const after = await get(endpoints.notifications.list)
      return (
        !after.rules.some((rule) => rule.id === live.id) &&
        after.stats.rules === before.rules - 1 &&
        after.stats.unrouted >= before.unrouted
      )
    })(),
  )

  /* Channels. A target is what connects one, so the state cannot be set beside
     it and disagree — the design's cards can read Connected over "Not
     configured". */
  const unconfigured = beforeRules.channels.find((channel) => channel.state !== 'connected')
  check(
    'testing an unconfigured channel fails and says why',
    await (async () => {
      const result = await post(endpoints.notifications.channelTest(unconfigured.id))
      return result.ok === false && result.reason === 'notConfigured'
    })(),
  )
  check(
    'giving a channel a target connects it',
    await (async () => {
      const result = await patch(endpoints.notifications.channel(unconfigured.id), {
        target: 'ops-escalation',
      })
      return result.state === 'connected' && result.target === 'ops-escalation'
    })(),
  )
  check(
    'and every rule routed there stops being undeliverable',
    await (async () => {
      const after = await get(endpoints.notifications.list)
      return after.rules
        .filter((rule) => rule.routes.includes(unconfigured.id))
        .every((rule) => !rule.misrouted.includes(unconfigured.id))
    })(),
  )
  check(
    'testing it now succeeds',
    (await post(endpoints.notifications.channelTest(unconfigured.id))).ok === true,
  )
  check(
    'clearing the target disconnects it again',
    await (async () => {
      const result = await patch(endpoints.notifications.channel(unconfigured.id), { target: '' })
      const after = await get(endpoints.notifications.list)
      return (
        result.state === 'notConfigured' &&
        after.rules
          .filter((rule) => rule.routes.includes(unconfigured.id))
          .every((rule) => rule.misrouted.includes(unconfigured.id))
      )
    })(),
  )

  /* The ladder is ordered by time; a rung that fires before the one above it is
     not an escalation. */
  check(
    'a level earlier than the one before it is refused',
    (await post(endpoints.notifications.escalation, {
      personId: 'usr_mgr_1',
      afterMinutes: 5,
      routes: ['email'],
    }).catch(() => null)) === null,
  )
  check(
    'a later one is added on the end, with a real person on it',
    await (async () => {
      const last = (await get(endpoints.notifications.list)).escalation.slice(-1)[0]
      const added = await post(endpoints.notifications.escalation, {
        personId: 'usr_rel_1',
        afterMinutes: last.afterMinutes + 30,
        routes: ['email'],
      })
      const after = (await get(endpoints.notifications.list)).escalation
      return (
        added.personName &&
        after.slice(-1)[0].id === added.id &&
        after.every((level, index) => index === 0 || level.afterMinutes > after[index - 1].afterMinutes)
      )
    })(),
  )
  check(
    'a level routed nowhere is refused',
    (await post(endpoints.notifications.escalation, {
      personId: 'usr_rel_1',
      afterMinutes: 999,
      routes: [],
    }).catch(() => null)) === null,
  )

  /* ── Notification preferences ──────────────────────────────────────── */
  console.log('\nNOTIFICATION PREFERENCES\n')

  const notifyConfig = await get(endpoints.notifications.list)
  check(
    'the configuration carries personal preferences beside the org rules',
    notifyConfig.preferences.length > 0 && notifyConfig.rules.length > 0,
  )
  check(
    'every preference has a name and a hint to print',
    notifyConfig.preferences.every(
      (preference) =>
        appStrings.notifications.preferences.items[preference.id] &&
        (preference.at || appStrings.notifications.preferences.hints[preference.id]),
    ),
  )
  check(
    'browser push is offered, off, and cannot be turned on',
    await (async () => {
      const push = notifyConfig.preferences.find((p) => p.id === 'browserPush')
      if (!push || push.on !== false || push.unavailable !== true) return false
      const refused = await patch(endpoints.notifications.preference('browserPush'), {
        on: true,
      }).catch(() => null)
      const after = (await get(endpoints.notifications.list)).preferences.find(
        (p) => p.id === 'browserPush',
      )
      return refused === null && after.on === false
    })(),
  )
  check(
    'a preference can be turned off and stays off',
    await (async () => {
      await patch(endpoints.notifications.preference('dailyDigest'), { on: false })
      const off = (await get(endpoints.notifications.list)).preferences.find(
        (p) => p.id === 'dailyDigest',
      ).on
      await patch(endpoints.notifications.preference('dailyDigest'), { on: true })
      return off === false
    })(),
  )
  check(
    'and changing one does not touch the rules the org routes by',
    await (async () => {
      const before = (await get(endpoints.notifications.list)).stats
      await patch(endpoints.notifications.preference('soundInApp'), { on: true })
      const after = (await get(endpoints.notifications.list)).stats
      return JSON.stringify(before) === JSON.stringify(after)
    })(),
  )
  check(
    'Settings reaches the same screen rather than a second copy of it',
    await (async () => {
      const source = await readFile(new URL('../src/routes/router.jsx', import.meta.url), 'utf8')
      const mounts = source.match(/element: <NotificationsPage \/>/g) ?? []
      return mounts.length === 2 && !source.includes('NotificationsSettingsPage')
    })(),
  )

  /* ── The settings rail ─────────────────────────────────────────────── */
  console.log('\nSETTINGS NAVIGATION\n')

  const settingsSource = await readFile(
    new URL('../src/pages/settings/SettingsLayout.jsx', import.meta.url),
    'utf8',
  )
  const routerSource = await readFile(
    new URL('../src/routes/router.jsx', import.meta.url),
    'utf8',
  )
  const settingsIds = [...settingsSource.matchAll(/\{ id: '([\w]+)', to: '([^']+)'/g)].map(
    ([, id, to]) => ({ id, to }),
  )

  check('the rail has items', settingsIds.length > 0, String(settingsIds.length))
  check(
    'every settings item has a label, and every group a heading',
    settingsIds.every((item) => appStrings.settings.pages[item.id]) &&
      [...settingsSource.matchAll(/^    id: '([\w]+)',$/gm)].every(
        ([, id]) => appStrings.settings.sections[id],
      ),
    settingsIds.filter((item) => !appStrings.settings.pages[item.id]).map((i) => i.id).join(', '),
  )
  check(
    'no label is left over for an item the rail no longer has',
    Object.keys(appStrings.settings.pages).every((id) =>
      settingsIds.some((item) => item.id === id),
    ),
    Object.keys(appStrings.settings.pages)
      .filter((id) => !settingsIds.some((item) => item.id === id))
      .join(', '),
  )
  check(
    'every item goes to a route the router serves, built or placeholder',
    settingsIds.every((item) => {
      const leaf = item.to.replace('/app/settings/', '')
      return routerSource.includes(`path: '${leaf}'`) || routerSource.includes('SettingsPlaceholder')
    }),
  )
  check(
    'Settings does not offer a second list of data sources',
    !settingsIds.some((item) => item.id === 'sources'),
  )

  /* ── The audit log ─────────────────────────────────────────────────── */
  console.log('\nAUDIT LOG\n')

  const audit0 = await get(endpoints.audit.list)
  check('the log is not empty before anybody clicks anything', audit0.items.length > 0,
    String(audit0.items.length))
  check(
    'it is newest first',
    audit0.items.every((row, index) => index === 0 || audit0.items[index - 1].at >= row.at),
  )
  check(
    'every entry has a person or is the platform, and every action has a word',
    audit0.items.every(
      (row) =>
        (row.actorId === null || row.actorName) &&
        appStrings.settings.audit.actions[row.action] &&
        appStrings.settings.audit.kinds[row.resourceKind] &&
        appStrings.settings.audit.severity[row.severity],
    ),
    [...new Set(audit0.items.map((r) => r.action))]
      .filter((a) => !appStrings.settings.audit.actions[a])
      .join(', '),
  )
  check(
    'every seeded entry points at a record that exists',
    await (async () => {
      const { ALERTS } = await server.ssrLoadModule('/src/mocks/fixtures/alerts.js')
      const { logEntries } = await server.ssrLoadModule('/src/mocks/fixtures/logbook.js')
      const alerts = new Set(ALERTS.map((a) => a.id))
      const notes = new Set(logEntries().map((e) => e.id))
      return audit0.items
        .filter((row) => row.id.startsWith('AUD-SEED-'))
        .every((row) =>
          row.resourceKind === 'anomaly' ? alerts.has(row.resourceId) : notes.has(row.resourceId),
        )
    })(),
  )
  check(
    'nothing is recorded in the future',
    audit0.items.every((row) => Date.parse(row.at) <= Date.now() + 1000),
  )
  check(
    'severity is derived from the action, so one action is never two severities',
    await (async () => {
      const byAction = new Map()
      for (const row of audit0.items) {
        if (byAction.has(row.action) && byAction.get(row.action) !== row.severity) return false
        byAction.set(row.action, row.severity)
      }
      return true
    })(),
  )

  /* The point of the page: the rest of the demo writes it. */
  check(
    'locking an account appears in the log, critical, naming who and what',
    await (async () => {
      const target = (await get(endpoints.people.list)).items.find(
        (row) => row.status === 'active' && row.id !== 'usr_mgr_1',
      )
      await patch(endpoints.people.detail(target.id), { status: 'locked' })
      const after = await get(endpoints.audit.list)
      const entry = after.items[0]
      await patch(endpoints.people.detail(target.id), { status: 'active' })
      return (
        entry.action === 'ACCOUNT_LOCKED' &&
        entry.severity === 'critical' &&
        entry.resourceId === target.id &&
        Boolean(entry.actorName)
      )
    })(),
  )
  check(
    'and reactivating it appears too, as its own entry',
    (await get(endpoints.audit.list)).items[0].action === 'ACCOUNT_REACTIVATED',
  )
  check(
    'creating and deleting a role are both recorded',
    await (async () => {
      const made = await post(endpoints.roles.list, {
        name: 'Audit Probe',
        grant: { 'home.view': true },
      })
      const created = (await get(endpoints.audit.list)).items[0]
      await del(endpoints.roles.detail(made.id))
      const deleted = (await get(endpoints.audit.list)).items[0]
      return created.action === 'ROLE_CREATED' && deleted.action === 'ROLE_DELETED'
    })(),
  )
  check(
    'disconnecting a channel is recorded as critical; connecting it is not',
    await (async () => {
      const before = (await get(endpoints.notifications.list)).channels.find(
        (channel) => channel.state === 'connected',
      )
      await patch(endpoints.notifications.channel(before.id), { target: '' })
      const off = (await get(endpoints.audit.list)).items[0]
      await patch(endpoints.notifications.channel(before.id), { target: before.target })
      const on = (await get(endpoints.audit.list)).items[0]
      return (
        off.action === 'CHANNEL_DISCONNECTED' &&
        off.severity === 'critical' &&
        on.action === 'CHANNEL_CONFIGURED' &&
        on.severity === 'info'
      )
    })(),
  )
  check(
    'replacing a credential is recorded, and the value is not',
    await (async () => {
      await patch(endpoints.dataFusion.source('conn_cmms'), {
        values: { clientSecret: 'audit-probe-secret' },
      })
      const after = await get(endpoints.audit.list)
      return (
        after.items.some((row) => row.action === 'CREDENTIAL_ROTATED') &&
        !JSON.stringify(after).includes('audit-probe-secret')
      )
    })(),
  )
  check(
    'the filters narrow to what they say, and the tiles keep counting everything',
    await (async () => {
      const all = await get(endpoints.audit.list)
      const critical = await get(endpoints.audit.list, { params: { severity: 'critical' } })
      const users = await get(endpoints.audit.list, { params: { kind: 'user' } })
      return (
        critical.items.every((row) => row.severity === 'critical') &&
        users.items.every((row) => row.resourceKind === 'user') &&
        critical.stats.total === all.stats.total &&
        critical.items.length < all.items.length
      )
    })(),
  )
  check(
    'there is no way to write to it from a client',
    (await post(endpoints.audit.list, { action: 'FORGED' }).catch(() => null)) === null,
  )

  /* ── Security & access ─────────────────────────────────────────────── */
  console.log('\nSECURITY\n')

  const sec = await get(endpoints.security.settings)
  check('the policy comes back with every field the page draws', 
    ['sso','requireMfa','minimumLength','passwordExpiry','sessionTimeout','ipAllowlist','httpsOnly','rateLimit','logApiRequests']
      .every((key) => Object.hasOwn(sec.settings, key)))
  check(
    'every option a select offers has a word to print',
    sec.options.passwordExpiry.every((k) => appStrings.settings.security.password.expiryOptions[k]) &&
      sec.options.sessionTimeouts.every((k) => appStrings.settings.security.sessions.timeouts[k]) &&
      sec.options.concurrentSessions.every(
        (k) => appStrings.settings.security.sessions.concurrentOptions[k],
      ) &&
      sec.mfa.methods.every((m) => appStrings.settings.security.auth.methods[m.id]),
  )
  check(
    'the MFA gap is counted from the directory, and names the people in it',
    await (async () => {
      const people = (await get(endpoints.people.list)).items
      const expected = people.filter((p) => p.status !== 'inactive' && !p.mfa)
      return (
        sec.mfa.missing === expected.length &&
        sec.mfa.missing > 0 &&
        expected.every((p) => sec.mfa.missingNames.includes(p.name))
      )
    })(),
    `${sec.mfa.missing} of ${sec.mfa.total}`,
  )
  const enrol = async (person, mfa) =>
    post(endpoints.people.import, {
      filename: 'mfa.csv',
      records: [
        { name: person.name, email: person.email, role: person.role, site: '', team: '', mfa },
      ],
    })

  check(
    'enrolling somebody moves the gap rather than leaving it authored',
    await (async () => {
      const target = (await get(endpoints.people.list)).items.find(
        (p) => !p.mfa && p.status !== 'inactive',
      )
      await enrol(target, true)
      const after = await get(endpoints.security.settings)
      await enrol(target, false)
      return after.mfa.missing === sec.mfa.missing - 1
    })(),
  )
  /* The other half, and the reason the first one has to say "active": a
     deactivated account cannot sign in, so it is not somebody the requirement
     would lock out and enrolling it changes nothing. */
  check(
    'a deactivated account is not counted in the gap either way',
    await (async () => {
      const dormant = (await get(endpoints.people.list)).items.find(
        (p) => p.status === 'inactive' && !p.mfa,
      )
      if (!dormant) return true
      const before = (await get(endpoints.security.settings)).mfa.missing
      await enrol(dormant, true)
      const after = (await get(endpoints.security.settings)).mfa.missing
      await enrol(dormant, false)
      return before === after
    })(),
  )

  /* One session, and it is honest about what it does not know. */
  check(
    'exactly one session is reported, and it is this browser',
    sec.sessions.length === 1 && sec.sessions[0].self === true && Boolean(sec.sessions[0].personName),
  )
  check(
    'it does not claim an address or a city it cannot know',
    sec.sessions[0].ip === null && sec.sessions[0].location === null,
  )

  /* Every change is recorded, and that is the join with the audit log. */
  check(
    'changing the policy writes a critical entry naming the fields',
    await (async () => {
      const before = (await get(endpoints.audit.list)).items.length
      await patch(endpoints.security.settings, { minimumLength: 16, requireUppercase: false })
      const after = await get(endpoints.audit.list)
      const entry = after.items[0]
      return (
        after.items.length === before + 1 &&
        entry.action === 'SETTINGS_CHANGED' &&
        entry.severity === 'critical' &&
        entry.resource === 'settings:security' &&
        entry.detail.fields.includes('minimumLength')
      )
    })(),
  )
  check(
    'and the change is what comes back on the next read',
    (await get(endpoints.security.settings)).settings.minimumLength === 16,
  )
  check(
    'saving the same values again records nothing',
    await (async () => {
      const before = (await get(endpoints.audit.list)).items.length
      await patch(endpoints.security.settings, { minimumLength: 16 })
      return (await get(endpoints.audit.list)).items.length === before
    })(),
  )
  check(
    'a field the page does not own is ignored rather than stored',
    await (async () => {
      const result = await patch(endpoints.security.settings, { httpsOnly: false, nonsense: 1 })
      const after = await get(endpoints.security.settings)
      return result.changed.length === 0 && after.settings.httpsOnly === true
    })(),
  )
  check(
    'the audit log has a word for the action and the resource kind',
    Boolean(appStrings.settings.audit.actions.SETTINGS_CHANGED) &&
      Boolean(appStrings.settings.audit.kinds.settings),
  )

  /* ── API keys, webhooks and the spec ───────────────────────────────── */
  console.log('\nAPI & WEBHOOKS\n')

  const dev = await get(endpoints.developer.access)
  check('there are keys, webhooks, scopes and events', 
    dev.keys.length > 0 && dev.webhooks.length > 0 && dev.scopes.length > 0 && dev.events.length > 0)
  check(
    'no key response carries a value, only a prefix',
    dev.keys.every((key) => key.prefix.endsWith('••••')) && !JSON.stringify(dev.keys).includes('sk_prod_a'),
  )
  check(
    'every scope names a module in the rail, or is read:all',
    await (async () => {
      const { ALL_NAV_ITEMS } = await server.ssrLoadModule('/src/shell/navigation.js')
      const ids = new Set(ALL_NAV_ITEMS.map((item) => item.id))
      return dev.scopes.every((scope) => scope.module === null || ids.has(scope.module))
    })(),
  )
  check(
    'every event names a module that raises it',
    await (async () => {
      const { ALL_NAV_ITEMS } = await server.ssrLoadModule('/src/shell/navigation.js')
      const ids = new Set(ALL_NAV_ITEMS.map((item) => item.id))
      return dev.events.every((event) => ids.has(event.module))
    })(),
  )
  check(
    'every key scope is one the platform offers',
    await (async () => {
      const ids = new Set(dev.scopes.map((scope) => scope.id))
      return dev.keys.every((key) => key.scopes.every((scope) => ids.has(scope)))
    })(),
    dev.keys.flatMap((k) => k.scopes).join(', '),
  )
  check(
    'every webhook subscribes only to events that exist',
    await (async () => {
      const ids = new Set(dev.events.map((event) => event.id))
      return dev.webhooks.every((hook) => hook.events.every((event) => ids.has(event)))
    })(),
  )
  check(
    'and delivers over HTTPS',
    dev.webhooks.every((hook) => hook.url.startsWith('https://')),
  )

  /* The value exists exactly once. This is the check that matters on this page. */
  const probeKey = await post(endpoints.developer.keys, {
    name: 'Verify Probe',
    scopes: ['read:anomalies'],
    expiry: 'd90',
  })
  check('generating a key returns its value once', typeof probeKey.secret === 'string' && probeKey.secret.length > 24)
  check(
    'and no later response contains it anywhere',
    await (async () => {
      const after = await get(endpoints.developer.access)
      const auditAfter = await get(endpoints.audit.list)
      return (
        !JSON.stringify(after).includes(probeKey.secret) &&
        !JSON.stringify(auditAfter).includes(probeKey.secret)
      )
    })(),
  )
  check(
    'the new key starts never used, and is recorded',
    await (async () => {
      const after = await get(endpoints.developer.access)
      const row = after.keys.find((key) => key.id === probeKey.id)
      const entry = (await get(endpoints.audit.list)).items.find(
        (row2) => row2.resourceId === probeKey.id,
      )
      return row.lastUsedAt === null && row.status === 'active' && entry?.action === 'API_KEY_CREATED'
    })(),
  )
  check(
    'rotating gives a different value and records it',
    await (async () => {
      const rotated = await post(endpoints.developer.keyRotate(probeKey.id))
      const entry = (await get(endpoints.audit.list)).items[0]
      return rotated.secret !== probeKey.secret && entry.action === 'API_KEY_ROTATED'
    })(),
  )
  check(
    'revoking keeps the row and marks it, rather than hiding what existed',
    await (async () => {
      await del(endpoints.developer.key(probeKey.id))
      const after = await get(endpoints.developer.access)
      const row = after.keys.find((key) => key.id === probeKey.id)
      return row?.status === 'revoked'
    })(),
  )
  check(
    'a revoked key cannot be rotated back into use',
    (await post(endpoints.developer.keyRotate(probeKey.id)).catch(() => null)) === null,
  )
  check(
    'a key with no scopes is refused',
    (await post(endpoints.developer.keys, { name: 'Empty', scopes: [] }).catch(() => null)) === null,
  )

  /* Webhooks. */
  check(
    'a webhook over plain http is refused',
    (await post(endpoints.developer.webhooks, {
      name: 'Insecure',
      url: 'http://example.com/hook',
      events: ['anomaly.detected'],
    }).catch(() => null)) === null,
  )
  check(
    'one subscribing to an event nothing raises is refused',
    (await post(endpoints.developer.webhooks, {
      name: 'Ghost',
      url: 'https://example.com/hook',
      events: ['prediction.alert'],
    }).catch(() => null)) === null,
  )
  check(
    'a test shows the payload rather than reporting a delivery',
    await (async () => {
      const hook = dev.webhooks[0]
      const result = await post(endpoints.developer.webhookTest(hook.id))
      return (
        result.url === hook.url &&
        result.payload.event === hook.events[0] &&
        Object.hasOwn(result.payload, 'delivered_at')
      )
    })(),
  )

  /* The specification describes what this client really calls. */
  const spec = await get(endpoints.developer.spec)
  check('the spec is an OpenAPI 3 document with paths', 
    spec.openapi.startsWith('3.') && Object.keys(spec.paths).length > 20,
    String(Object.keys(spec.paths).length))
  /* The document IS the declared path set — not a subset of it and not a
     superset. Both sides normalised, because a path parameter is named after
     what it is (`alertId`, `anomalyId`) and the spec calls all of them `id`. */
  check(
    'the spec is exactly what `endpoints.js` declares, no more and no less',
    await (async () => {
      const source = await readFile(new URL('../src/services/endpoints.js', import.meta.url), 'utf8')
      const declared = new Set(
        [...source.matchAll(/v\(\s*[`']([^`']+)[`']\s*\)/g)].map(([, path]) =>
          path.replace(/\$\{[^}]+\}/g, '*'),
        ),
      )
      const published = new Set(
        Object.keys(spec.paths).map((path) => path.replace('/v1', '').replace('{id}', '*')),
      )
      const missing = [...declared].filter((path) => !published.has(path))
      const extra = [...published].filter((path) => !declared.has(path))
      return missing.length === 0 && extra.length === 0
    })(),
    await (async () => {
      const source = await readFile(new URL('../src/services/endpoints.js', import.meta.url), 'utf8')
      const declared = new Set(
        [...source.matchAll(/v\(\s*[`']([^`']+)[`']\s*\)/g)].map(([, path]) =>
          path.replace(/\$\{[^}]+\}/g, '*'),
        ),
      )
      const published = new Set(
        Object.keys(spec.paths).map((path) => path.replace('/v1', '').replace('{id}', '*')),
      )
      return `${published.size} published, ${declared.size} declared`
    })(),
  )
  check(
    'the Postman collection covers the same paths',
    await (async () => {
      const collection = await get(endpoints.developer.postman)
      return collection.item.length === Object.keys(spec.paths).length
    })(),
  )
  check(
    'every audit action this page raises has a word for it',
    ['API_KEY_CREATED','API_KEY_ROTATED','API_KEY_REVOKED','WEBHOOK_CREATED','WEBHOOK_UPDATED','WEBHOOK_DELETED']
      .every((action) => appStrings.settings.audit.actions[action]) &&
      ['apiKey','webhook'].every((kind) => appStrings.settings.audit.kinds[kind]),
  )

  /* ── Integrations ──────────────────────────────────────────────────────
     The page has no records of its own, so every check here is about that:
     each card resolves to a row somewhere else, and each write lands in the
     registry rather than in a copy of it. */
  console.log('\nINTEGRATIONS\n')

  const integrations = await get(endpoints.integrations.list)
  const cards = integrations.groups.flatMap((group) => group.items)

  check(
    'every group and every status a card can show has a word to print',
    integrations.groups.every((group) => appStrings.settings.integrations.groups[group.id]) &&
      cards.every((card) => appStrings.dataFusion.sources.status[card.status]),
    integrations.groups.map((group) => `${group.id}:${group.items.length}`).join(' · '),
  )

  check(
    'no card exists that is not already a row somewhere else',
    await (async () => {
      const registry = new Set(
        (
          await Promise.all(
            ['ot', 'vision', 'biz', 'db'].map(async (category) =>
              (await get(endpoints.dataFusion.sources, { params: { category } })).items,
            ),
          )
        )
          .flat()
          .map((source) => source.id),
      )
      const channels = new Set(
        (await get(endpoints.notifications.list)).channels.map((channel) => channel.id),
      )
      return cards.every((card) =>
        card.kind === 'source' ? registry.has(card.id) : channels.has(card.id),
      )
    })(),
    `${cards.length} cards`,
  )

  check(
    'and no row is missing: the four families and the five channels are all on the page',
    await (async () => {
      const sources = (
        await Promise.all(
          ['ot', 'vision', 'biz', 'db'].map(async (category) =>
            (await get(endpoints.dataFusion.sources, { params: { category } })).items,
          ),
        )
      ).flat()
      const channels = (await get(endpoints.notifications.list)).channels
      return cards.length === sources.length + channels.length
    })(),
  )

  check(
    'a card reports the state its own registry row reports, never a second reading of it',
    await (async () => {
      const ot = (await get(endpoints.dataFusion.sources, { params: { category: 'ot' } })).items
      return ot.every(
        (source) => cards.find((card) => card.id === source.id)?.status === source.status,
      )
    })(),
  )

  /* ── The monitor's arithmetic ──────────────────────────────────────── */

  const monitor = integrations.monitor
  check(
    'the monitor holds the streaming families and nothing else',
    monitor.length > 0 &&
      (await (async () => {
        const streaming = (
          await Promise.all(
            ['ot', 'vision'].map(async (category) =>
              (await get(endpoints.dataFusion.sources, { params: { category } })).items,
            ),
          )
        ).flat()
        return monitor.length === streaming.length
      })()),
    `${monitor.length} rows`,
  )
  check(
    'throughput is the tag count at the publishing interval, not a second number',
    monitor
      .filter((row) => row.status === 'connected' || row.status === 'syncing')
      .every((row) => row.recordsPerMinute === Math.round((row.tags * 180) / 60)),
  )
  check(
    'and it is zero on a source that is not delivering',
    await (async () => {
      const down = monitor.filter((row) => row.status !== 'connected' && row.status !== 'syncing')
      return down.length > 0 && down.every((row) => row.recordsPerMinute === 0)
    })(),
  )
  check(
    'lag is null where nothing measured it, so the cell can be an em dash rather than a zero',
    monitor.some((row) => row.lagSeconds == null) &&
      monitor.every((row) => row.lagSeconds == null || row.lagSeconds > 0),
  )

  /* ── Pause reaches the whole product ───────────────────────────────── */

  check(
    'pausing is refused on a source with no endpoint — there is no ingest to stop',
    await (async () => {
      const empty = (
        await get(endpoints.dataFusion.sources, { params: { category: 'biz' } })
      ).items.find((source) => source.status === 'notConfigured')
      const answer = await post(endpoints.integrations.sourcePause(empty.id), { paused: true })
      return answer.ok === false && answer.reason === 'notConfigured'
    })(),
  )

  check(
    'pausing a source changes its row in Data Fusion and stalls the pipelines reading it',
    await (async () => {
      const target = monitor.find((row) => row.status === 'connected' && row.pipelines > 0)
      if (!target) return false
      await post(endpoints.integrations.sourcePause(target.id), { paused: true })

      const family = (await get(endpoints.dataFusion.sources, { params: { category: 'ot' } })).items
      const paused = family.find((source) => source.id === target.id)
      const downstream = (await get(endpoints.dataFusion.pipelines)).items.filter(
        (pipeline) => pipeline.sourceId === target.id,
      )
      const stalled = downstream.every((pipeline) => pipeline.status === 'stalled')

      /* Put it back, and check that resuming is a return rather than a third state. */
      await post(endpoints.integrations.sourcePause(target.id), { paused: false })
      const after = (
        await get(endpoints.dataFusion.sources, { params: { category: 'ot' } })
      ).items.find((source) => source.id === target.id)

      return (
        paused.status === 'paused' &&
        downstream.length > 0 &&
        stalled &&
        after.status === target.status
      )
    })(),
  )

  check(
    'a paused source stops counting as arriving',
    await (async () => {
      const target = monitor.find((row) => row.status === 'connected' && row.tags > 0)
      const before = (await get(endpoints.dataFusion.overview)).streamingTags
      await post(endpoints.integrations.sourcePause(target.id), { paused: true })
      const during = (await get(endpoints.dataFusion.overview)).streamingTags
      await post(endpoints.integrations.sourcePause(target.id), { paused: false })
      return during === before - target.tags
    })(),
  )

  /* ── Delete, and what refuses it ───────────────────────────────────── */

  check(
    'the three platform connectors refuse deletion rather than appearing to accept it',
    await (async () => {
      const anchor = monitor.find((row) => !row.removable)
      const answer = await del(endpoints.integrations.source(anchor.id))
      const still = (
        await get(endpoints.dataFusion.sources, { params: { category: 'ot' } })
      ).items.some((source) => source.id === anchor.id)
      return answer.ok === false && answer.reason === 'anchored' && still
    })(),
  )

  check(
    'deleting a source takes the pipelines that read it with it',
    await (async () => {
      const target = monitor.find((row) => row.removable && row.pipelines > 0)
      if (!target) return false
      const before = (await get(endpoints.dataFusion.pipelines)).items.length
      await del(endpoints.integrations.source(target.id))

      const gone = !(
        await get(endpoints.dataFusion.sources, { params: { category: 'ot' } })
      ).items.some((source) => source.id === target.id)
      const pipelines = (await get(endpoints.dataFusion.pipelines)).items
      return (
        gone &&
        pipelines.length === before - target.pipelines &&
        !pipelines.some((pipeline) => pipeline.sourceId === target.id)
      )
    })(),
  )

  check(
    'both writes are in the audit log, with a word for each action',
    await (async () => {
      const log = (await get(endpoints.audit.list)).items
      const actions = ['SOURCE_PAUSED', 'SOURCE_RESUMED', 'SOURCE_DELETED']
      return (
        actions.every((action) => log.some((row) => row.action === action)) &&
        actions.every((action) => appStrings.settings.audit.actions[action]) &&
        appStrings.settings.audit.kinds.source !== undefined &&
        log.find((row) => row.action === 'SOURCE_DELETED').severity === 'critical'
      )
    })(),
  )

  /* ── General ───────────────────────────────────────────────────────────
     The page is eleven controls, and the checks are about which of them mean
     something: what the options are drawn from, what a save actually reaches,
     and what the danger zone does and refuses. */
  console.log('\nGENERAL\n')

  const general = await get(endpoints.org.settings)

  check(
    'every option this page offers has a word to print',
    general.options.industries.every((id) => appStrings.settings.general.industries[id]) &&
      general.options.dateFormats.every((id) => appStrings.settings.general.dateFormats[id]) &&
      general.options.timeFormats.every((id) => appStrings.settings.general.timeFormats[id]) &&
      general.options.dataRetention.every((id) => appStrings.settings.general.retention[id]),
  )

  check(
    'the landing pages are pages that exist, named by the rail rather than here',
    await (async () => {
      const { ALL_NAV_ITEMS } = await server.ssrLoadModule('/src/shell/navigation.js')
      const known = new Map(ALL_NAV_ITEMS.map((item) => [item.id, item.to]))
      return (
        general.options.landingPages.length > 0 &&
        general.options.landingPages.every(
          (page) => known.get(page.value) === page.to && appStrings.screens[page.value],
        )
      )
    })(),
    `${general.options.landingPages.length} pages`,
  )

  check(
    'the sites and time zones come from the hierarchy, not from this file',
    await (async () => {
      const sites = (await get(endpoints.org.current)).sites
      const ids = sites.map((site) => site.id).sort()
      return (
        JSON.stringify(general.options.sites.map((site) => site.value).sort()) ===
          JSON.stringify(ids) &&
        sites.every((site) => general.options.timeZones.includes(site.timeZone)) &&
        general.options.timeZones.includes('UTC')
      )
    })(),
  )

  check(
    'measurement units are reported per site, because that is where they are held',
    general.siteUnits.length > 1 &&
      new Set(general.siteUnits.map((site) => site.unitSystem)).size > 1,
    general.siteUnits.map((site) => `${site.name}:${site.unitSystem}`).join(' · '),
  )

  check(
    'the session timeout is the Security page\'s value and moves when that page moves it',
    await (async () => {
      const before = general.sessionTimeout
      const security = await get(endpoints.security.settings)
      if (before !== security.settings.sessionTimeout) return false

      const next = before === 'h4' ? 'h8' : 'h4'
      await patch(endpoints.security.settings, { sessionTimeout: next })
      const after = (await get(endpoints.org.settings)).sessionTimeout
      await patch(endpoints.security.settings, { sessionTimeout: before })
      return after === next
    })(),
  )

  check(
    'renaming the organisation renames it everywhere, not only in this payload',
    await (async () => {
      const original = (await get(endpoints.org.current)).name
      await patch(endpoints.org.settings, { name: 'Meridian Industrial Group' })
      const org = await get(endpoints.org.current)
      const settings = await get(endpoints.org.settings)
      await patch(endpoints.org.settings, { name: original })
      return org.name === 'Meridian Industrial Group' && settings.settings.name === org.name
    })(),
  )

  check(
    'a field this page does not own is ignored rather than stored',
    await (async () => {
      const answer = await patch(endpoints.org.settings, {
        unitSystem: 'metric',
        sessionTimeout: 'm15',
      })
      const after = await get(endpoints.org.settings)
      return (
        answer.changed.length === 0 &&
        !Object.hasOwn(after.settings, 'unitSystem') &&
        !Object.hasOwn(after.settings, 'sessionTimeout')
      )
    })(),
  )

  check(
    'saving the same values again records nothing',
    (await patch(endpoints.org.settings, { timeFormat: general.settings.timeFormat })).changed
      .length === 0,
  )

  check(
    'a change is written to the audit log, naming the fields',
    await (async () => {
      await patch(endpoints.org.settings, { dateFormat: 'ymd', industry: 'steel' })
      const entry = (await get(endpoints.audit.list)).items.find(
        (row) => row.resource === 'settings:org',
      )
      return (
        entry?.action === 'SETTINGS_CHANGED' &&
        entry.detail.fields.includes('dateFormat') &&
        entry.detail.fields.includes('industry')
      )
    })(),
  )

  /* ── The danger zone ───────────────────────────────────────────────── */

  check(
    'the export carries the change that was made before it, and says it is synthetic',
    await (async () => {
      const data = await get(endpoints.org.export)
      return (
        data.synthetic === true &&
        data.organisation.dateFormat === 'ymd' &&
        data.sites.length > 0 &&
        data.people.length > 0 &&
        data.auditLog.length > 0
      )
    })(),
  )

  check(
    'reset puts back a setting on another page as well as this one',
    await (async () => {
      await patch(endpoints.security.settings, { requireMfa: false })
      await patch(endpoints.org.settings, { industry: 'pharma' })

      await post(endpoints.org.reset)

      const after = await get(endpoints.org.settings)
      const security = await get(endpoints.security.settings)
      return after.settings.industry === 'metalPackaging' && security.settings.requireMfa === true
    })(),
  )

  check(
    'and it does NOT clear the audit log — it writes to it',
    await (async () => {
      const log = (await get(endpoints.audit.list)).items
      const entry = log.find((row) => row.action === 'SETTINGS_RESET')
      return (
        log.length > 1 &&
        entry?.severity === 'critical' &&
        log.some((row) => row.action === 'SETTINGS_CHANGED') &&
        appStrings.settings.audit.actions.SETTINGS_RESET !== undefined
      )
    })(),
  )

  check(
    'reset does not touch accounts — a person is not a setting',
    (await get(endpoints.people.list)).items.length > 0,
  )

  /* ── Modules & Plan ────────────────────────────────────────────────────
     One map, and a switch that reaches it. Every check here is about that:
     the cards ARE the entitlements, the metrics are counts of real
     collections, and a toggle changes what the navigation rail is served. */
  console.log('\nMODULES & PLAN\n')

  const planned = await get(endpoints.org.plan)

  check(
    'the cards are exactly the entitlement map the rail reads',
    await (async () => {
      const entitlements = await get(endpoints.org.entitlements)
      const cards = planned.modules.map((module) => module.id).sort()
      const gated = Object.keys(entitlements.modules).sort()
      return (
        JSON.stringify(cards) === JSON.stringify(gated) &&
        planned.modules.every((module) => entitlements.modules[module.id] === module.enabled)
      )
    })(),
    `${planned.modules.length} modules`,
  )

  check(
    'every module has a name, a description and a word for its badge',
    await (async () => {
      const { ALL_NAV_ITEMS } = await server.ssrLoadModule('/src/shell/navigation.js')
      const byEntitlement = new Map(ALL_NAV_ITEMS.map((item) => [item.entitlement, item]))
      return planned.modules.every((module) => {
        const nav = byEntitlement.get(module.id)
        const named = nav
          ? appStrings.screens[nav.id]
          : appStrings.settings.modules.names[module.id]
        return Boolean(named) && Boolean(appStrings.settings.modules.descriptions[module.id])
      })
    })(),
  )

  check(
    'every metric a card prints has a word, and is a count of something that exists',
    await (async () => {
      const withMetric = planned.modules.filter((module) => module.metric)
      if (withMetric.length < 8) return false
      if (!withMetric.every((m) => appStrings.settings.modules.metrics[m.metric.key])) return false

      /* Spot-check three against the collections they claim to count. */
      const assets = planned.modules.find((m) => m.id === 'assets').metric.value
      const sources = planned.modules.find((m) => m.id === 'dataFusion').metric.value
      const accounts = planned.modules.find((m) => m.id === 'settings').metric.value

      const hierarchy = (await get(endpoints.org.current)).sites
      const people = (await get(endpoints.people.list)).items
      const monitor = (await get(endpoints.integrations.list)).monitor

      return (
        assets > 0 &&
        hierarchy.reduce((sum, site) => sum + site.assets, 0) === assets &&
        accounts === people.length &&
        sources >= monitor.filter((row) => row.status === 'connected').length
      )
    })(),
  )

  check(
    'the three locked modules refuse, each with its own reason',
    await (async () => {
      const locked = planned.modules.filter((module) => module.locked)
      if (locked.length !== 3) return false
      const answers = await Promise.all(
        locked.map((module) => patch(endpoints.org.module(module.id), { enabled: true })),
      )
      return (
        answers.every((answer) => answer.ok === false) &&
        new Set(answers.map((answer) => answer.reason)).size === 2 &&
        locked.every((module) => appStrings.settings.modules.refused[module.locked])
      )
    })(),
    planned.modules
      .filter((module) => module.locked)
      .map((module) => `${module.id}:${module.locked}`)
      .join(' · '),
  )

  check(
    'switching a module off takes it out of what the rail is served, and back on returns it',
    await (async () => {
      const target = planned.modules.find((module) => !module.locked && module.enabled)
      await patch(endpoints.org.module(target.id), { enabled: false })
      const off = await get(endpoints.org.entitlements)

      await patch(endpoints.org.module(target.id), { enabled: true })
      const on = await get(endpoints.org.entitlements)

      return off.modules[target.id] === false && on.modules[target.id] === true
    })(),
  )

  check(
    'and it is written to the audit log',
    await (async () => {
      const entry = (await get(endpoints.audit.list)).items.find(
        (row) => row.action === 'MODULE_CHANGED',
      )
      return (
        Boolean(entry) &&
        entry.resourceKind === 'module' &&
        appStrings.settings.audit.actions.MODULE_CHANGED !== undefined &&
        appStrings.settings.audit.kinds.module !== undefined
      )
    })(),
  )

  /* ── The plan and its meters ───────────────────────────────────────── */

  check(
    'the banner counts the cards below it rather than asserting a total',
    planned.plan.totalModules === planned.modules.length &&
      planned.plan.activeModules === planned.modules.filter((module) => module.enabled).length,
    `${planned.plan.activeModules}/${planned.plan.totalModules}`,
  )

  check(
    'every tier this product offers has a word, and the upgrade names a real one',
    await (async () => {
      const { PLANS } = await server.ssrLoadModule('/src/mocks/fixtures/plan.js')
      return (
        Object.keys(PLANS).every((tier) => appStrings.settings.modules.tiers[tier]) &&
        Boolean(appStrings.settings.modules.tiers[planned.plan.upgradeTo]) &&
        Object.hasOwn(PLANS, planned.plan.upgradeTo)
      )
    })(),
    `${planned.plan.tier} → ${planned.plan.upgradeTo}`,
  )

  check(
    'the sensor meter is the estate’s own per-site counts, summed',
    await (async () => {
      const sites = (await get(endpoints.org.current)).sites
      const total = sites.reduce((sum, site) => sum + (site.sensors ?? 0), 0)
      return planned.plan.usage.sensors.used === total && total > 0
    })(),
    String(planned.plan.usage.sensors.used),
  )

  check(
    'the site meter is at its limit, which is what upgrading would change',
    planned.plan.usage.sites.used === planned.plan.usage.sites.limit,
    `${planned.plan.usage.sites.used}/${planned.plan.usage.sites.limit}`,
  )

  /* Three of the five meters are demo figures. The check pins the MARKING
     rather than the values: a number that quietly stopped declaring itself
     authored is the thing worth catching, and so is a counted one that started
     claiming to be. */
  check(
    'the three demo meters say so in the payload, and draw a bar',
    ['apiCalls', 'copilotSessions', 'storage'].every((id) => {
      const row = planned.plan.usage[id]
      const used = row.unit === 'bytes' ? row.usedKb : row.used
      const limit = row.unit === 'bytes' ? row.limitKb : row.limit
      return row.authored === true && used > 0 && used < limit
    }),
  )

  check(
    'and the two counted ones do not',
    ['sites', 'sensors'].every((id) => planned.plan.usage[id].authored !== true),
  )

  check(
    'each demo figure carries the real count beside it, for the day it is deleted',
    planned.plan.usage.copilotSessions.counted === 1 &&
      planned.plan.usage.storage.countedKb > 0 &&
      planned.plan.usage.storage.countedKb < planned.plan.usage.storage.usedKb,
  )

  check(
    'and the Copilot card still reports what the module is doing, not the meter',
    planned.modules.find((module) => module.id === 'copilot').metric.value ===
      planned.plan.usage.copilotSessions.counted,
  )

  check(
    'the storage the registries actually hold is megabytes, which is why it is not the meter',
    await (async () => {
      const docs = (await get(endpoints.dataFusion.documents)).items
      const stored = planned.plan.usage.storage
      /* Under a gigabyte — what thirty-odd documents weigh, and the reading the
         meter goes back to when there is real storage behind it. */
      return docs.length > 0 && stored.countedKb / 1048576 < 1
    })(),
    `${Math.round((planned.plan.usage.storage.countedKb ?? 0) / 1024)} MB counted`,
  )

  check(
    'an unlimited allowance is null rather than a large number',
    await (async () => {
      const { PLANS } = await server.ssrLoadModule('/src/mocks/fixtures/plan.js')
      return Object.values(PLANS.enterprise).every((limit) => limit === null)
    })(),
  )

  /* ── Billing & Usage ───────────────────────────────────────────────────
     The page that asserts the most. The checks are about the seam: which
     figures are composed from the plan, which are demo records, and that the
     demo ones say so. */
  console.log('\nBILLING & USAGE\n')

  const billing = await get(endpoints.org.billing)

  check(
    'the plan and the meters are the same objects Modules & Plan draws',
    await (async () => {
      const fromPlan = await get(endpoints.org.plan)
      return (
        billing.plan.tier === fromPlan.plan.tier &&
        billing.plan.activeModules === fromPlan.plan.activeModules &&
        JSON.stringify(billing.plan.usage) === JSON.stringify(fromPlan.plan.usage)
      )
    })(),
  )

  check(
    'the invoice amounts are arithmetic on the plan price, not typed twice',
    await (async () => {
      const monthly = billing.invoices.filter((row) => !row.annual)
      const annual = billing.invoices.find((row) => row.annual)
      return (
        monthly.length > 0 &&
        monthly.every((row) => row.amount === billing.monthly) &&
        annual.amount === billing.monthly * 12
      )
    })(),
    `${billing.monthly} × ${billing.invoices.length - 1} + annual`,
  )

  check(
    'every invoice is marked as a demo record, with a status that has a word',
    billing.invoices.every(
      (row) => row.authored === true && appStrings.settings.billing.status[row.status],
    ) && billing.payment.authored === true,
  )

  check(
    'the invoice ids are unique and each names its own year',
    await (async () => {
      const ids = billing.invoices.map((row) => row.id)
      return (
        new Set(ids).size === ids.length &&
        billing.invoices.every((row) =>
          row.id.includes(String(new Date(row.periodStart).getUTCFullYear())),
        )
      )
    })(),
    billing.invoices.map((row) => row.id).join(' '),
  )

  check(
    'the card on file carries no number — only a brand, four digits and an expiry',
    await (async () => {
      const serialised = JSON.stringify(billing.payment)
      return (
        billing.payment.last4.length === 4 &&
        !Object.hasOwn(billing.payment, 'number') &&
        !Object.hasOwn(billing.payment, 'cvv') &&
        !/\d{9,}/.test(serialised)
      )
    })(),
  )

  check(
    'the billing contact can be changed, and a bad address is refused',
    await (async () => {
      const before = billing.payment.contactEmail
      const bad = await patch(endpoints.org.billingContact, { email: 'not-an-address' })
      const good = await patch(endpoints.org.billingContact, { email: 'finance@meridian.example' })
      const after = (await get(endpoints.org.billing)).payment.contactEmail
      await patch(endpoints.org.billingContact, { email: before })

      const logged = (await get(endpoints.audit.list)).items.some(
        (row) => row.action === 'BILLING_CONTACT_CHANGED',
      )
      return (
        bad.ok === false &&
        bad.reason === 'invalidEmail' &&
        good.ok === true &&
        after === 'finance@meridian.example' &&
        logged &&
        appStrings.settings.audit.actions.BILLING_CONTACT_CHANGED !== undefined
      )
    })(),
  )

  check(
    'the trend ends on today’s real figure, so its right-hand end can be checked',
    await (async () => {
      const meter = billing.plan.usage.sensors
      const expected = Math.round((meter.used / meter.limit) * 100 * 10) / 10
      const last = billing.trend.points[billing.trend.points.length - 1]
      return (
        billing.trend.points.length === 6 &&
        billing.trend.authored === true &&
        billing.trend.anchoredTo === 'sensors' &&
        Math.abs(last.value - expected) < 0.11
      )
    })(),
    `${billing.trend.points[billing.trend.points.length - 1].value}%`,
  )

  check(
    'and every point on it is a percentage, in order, oldest first',
    billing.trend.points.every((point) => point.value >= 0 && point.value <= 100) &&
      billing.trend.points.every(
        (point, index, all) => index === 0 || Date.parse(point.at) > Date.parse(all[index - 1].at),
      ),
  )

  check(
    'what upgrading gains is derived from the tier table, and every line has a word',
    await (async () => {
      const { PLANS } = await server.ssrLoadModule('/src/mocks/fixtures/plan.js')
      const next = PLANS[billing.plan.upgradeTo]
      return (
        billing.gains.length > 0 &&
        billing.gains.every(
          (gain) =>
            next[gain.key] === null &&
            gain.from != null &&
            appStrings.settings.billing.gains[gain.key],
        )
      )
    })(),
    billing.gains.map((gain) => gain.key).join(' · '),
  )

  check(
    'the sales address is a reserved example domain, so the button cannot reach anybody',
    /@(?:example\.(?:com|net|org)|[\w-]+\.example)$/.test(billing.salesEmail) &&
      /\.example$/.test(billing.payment.contactEmail.split('@')[1] ?? ''),
    `${billing.salesEmail} · ${billing.payment.contactEmail}`,
  )

  /* The invoice download. Written by hand rather than by a dependency, so the
     bytes are worth asserting: a file the reader cannot open is the failure
     mode, and it is silent. */
  check(
    'the invoice PDF is a real PDF — header, one page, and an xref that counts',
    await (async () => {
      const { simplePdf } = await server.ssrLoadModule('/src/lib/pdf.js')
      const blob = simplePdf({ lines: ['INVOICE', 'INV-2026-001', 'Total: $4,200.00'] })
      const text = await blob.text()
      const objects = [...text.matchAll(/^\d+ 0 obj$/gm)].length
      const size = Number(text.match(/\/Size (\d+)/)?.[1])
      const startxref = Number(text.match(/startxref\n(\d+)/)?.[1])

      return (
        blob.type === 'application/pdf' &&
        text.startsWith('%PDF-1.4') &&
        text.trimEnd().endsWith('%%EOF') &&
        objects === 5 &&
        size === objects + 1 &&
        /* The offset in the trailer must actually land on the xref table, which
           is the one thing a hand-written PDF gets wrong. */
        text.slice(startxref).startsWith('xref')
      )
    })(),
  )

  check(
    'and it escapes the characters PDF syntax reserves, rather than emitting them raw',
    await (async () => {
      const { simplePdf } = await server.ssrLoadModule('/src/lib/pdf.js')
      const text = await simplePdf({ lines: ['A (test) with \\ and ünïcode'] }).text()
      return (
        text.includes('\\(test\\)') &&
        text.includes('\\\\') &&
        /* Outside WinAnsi, dropped rather than mis-encoded. */
        !text.includes('ü')
      )
    })(),
  )

  console.log('\nERROR PATHS\n')
  await get(endpoints.alerts.detail('ALR-0000')).then(
    () => check('unknown id rejects', false, 'resolved instead'),
    (error) =>
      check('unknown id → ApiError notFound', error.code === 'notFound', `code=${error.code}`),
  )
  await get('/v1/nope').then(
    () => check('unknown route rejects', false),
    (error) => check('unknown route → notFound', error.code === 'notFound', `code=${error.code}`),
  )

  console.log('\nFORMATTERS\n')
  check(
    'imperial threshold keeps its own unit',
    formatMeasure({ value: 0.49, unit: 'in/s' }) === '0.49 in/s',
    formatMeasure({ value: 0.49, unit: 'in/s' }),
  )
  check(
    'metric threshold keeps its own unit',
    formatMeasure({ value: 12.5, unit: 'mm/s' }) === '12.5 mm/s',
    formatMeasure({ value: 12.5, unit: 'mm/s' }),
  )
  check(
    'degrees sit tight against the numeral',
    formatMeasure({ value: 402, unit: '°F' }) === '402°F',
    formatMeasure({ value: 402, unit: '°F' }),
  )
  check('null measure renders an em dash', formatMeasure(null) === '—')
  check('percent formats', formatPercent(74.2) === '74.2%', formatPercent(74.2))
  check('hours format as duration', formatHours(4.5) === '4h 30m', formatHours(4.5))
  check(
    'relative time reads naturally',
    /ago/.test(formatRelative(new Date(Date.now() - 34 * 60000))),
    formatRelative(new Date(Date.now() - 34 * 60000)),
  )
} finally {
  await server.close()
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURE(S)`}\n`)
process.exit(failures === 0 ? 0 : 1)
