/**
 * Every API path the client knows, in one place.
 *
 * Nothing else in the app may write a URL string. When the real APIs land the
 * only thing that changes here is the path text; call sites, query keys and
 * fixtures all stay put. Paths are relative — the base URL comes from
 * VITE_API_URL via the axios instance.
 */

export const API_VERSION = "v1";

const v = (path) => `/${API_VERSION}${path}`;

export const endpoints = {
  /* ── Identity ─────────────────────────────────────────────────────────
     These two are LIVE — they are the only paths in this file the real API
     actually serves, and the transport routes them to the network rather than
     to the fixture layer. Everything below is still mock-backed.

     There is deliberately no `logout` entry: the API exposes no such endpoint,
     and its refresh tokens are stateless JWTs that nothing can revoke, so a
     server round trip would have no effect to wait for. Signing out clears the
     client's cookies — see features/auth/api.js.

     There is no session/me entry either. Nothing serves it, so the signed-in
     user comes from the login response and is persisted client-side. */
  auth: {
    login: v("/auth/login"),
    refresh: v("/auth/refresh"),
  },
  org: {
    current: v("/org"),
    /* DEMO. The General page. GET reads the settings with the options they are
       chosen from — the sites from the hierarchy, the landing pages from the
       rail — and PATCH changes them. */
    settings: v("/org/settings"),
    /* DEMO. The danger zone's two actions that do something. `reset` is a POST
       because it is a command rather than a field with a new value, and `export`
       is a GET because it takes nothing and changes nothing. There is no
       `DELETE /org`: see the page. */
    reset: v("/org/reset"),
    export: v("/org/export"),
    entitlements: v("/org/entitlements"),

    /* DEMO. Settings → Modules & Plan. `plan` is the same module map
       `entitlements` serves, with what each module is currently doing and the
       tier it sits in — one request, because the banner's counts are counts of
       the cards below it and fetching them apart would let them disagree.

       The write is spelled as the MODULE it changes, not as the page: this
       screen owns no records, and a toggle here is an entitlement change that
       the navigation rail reads on its next render. */
    plan: v("/org/plan"),
    module: (id) => v(`/org/modules/${id}`),

    /* DEMO. Settings → Billing & Usage. One read for the whole page: the plan,
       its meters, the invoice history, the card on file and the trend are all
       one billing period, and fetching them apart would let them describe
       different ones.

       `billingContact` is a PATCH on the billing record and is the ONLY write
       this page has. There is deliberately no payment-method endpoint — see the
       fixture. */
    billing: v("/org/billing"),
    billingContact: v("/org/billing/contact"),
  },

  /* ── Asset classes ────────────────────────────────────────────────────
     LIVE — the third path the real API serves. Account-scoped reusable types:
     a machine model, a line configuration, a site blueprint, a sensor type.
     Plant, Line and Machine each carry a nullable `asset_class_id` pointing
     back here, so a class is the template and the hierarchy holds instances.

     `list` is also the create path — the API POSTs to the collection. Updates
     are PUT, not PATCH: the API has no partial-patch semantics anywhere, and
     its update schema accepts `name` only, so `entity_type` is fixed once a
     class exists.

     The collection also accepts `?entity_type=<enum>` as a server-side filter.
     The screen deliberately does not use it: it reads the whole set once so
     the type rail can show a count per type, and narrows in the client. A
     filtered fetch per rail click would still need an unfiltered one behind it
     just to render those counts. */
  assetClasses: {
    list: v("/asset-classes"),
    detail: (id) => v(`/asset-classes/${id}`),
  },

  /* ── Asset hierarchy ──────────────────────────────────────────────────
     LIVE. Six tiers: enterprise › region › subRegion › site › line › asset.
     See mocks/fixtures/hierarchy.js for why this is not strict ISA-95.

     `tree` drives the whole node list on its own: it returns the nested shape
     with `short_code` at every level, and `features/hierarchy/flatten.js`
     reshapes it. The five collections are no longer read for the list.

     They are still here because `tree` carries neither `is_active` nor
     `asset_class_id`, and every update is a full-replace PUT that must send
     both — so an edit form reads the one record it is about to overwrite
     through its `detail` path. See `features/hierarchy/api.js` `fetchNode`.

     The account is the root and has no endpoint at all: it cannot be created,
     renamed or removed from here, which is why the tree's top row is the one
     node with no controls on it. */
  hierarchy: {
    tree: v("/asset-hierarchy"),
    regions: v("/regions"),
    region: (id) => v(`/regions/${id}`),
    subRegions: v("/subregions"),
    subRegion: (id) => v(`/subregions/${id}`),
    plants: v("/plants"),
    plant: (id) => v(`/plants/${id}`),
    lines: v("/lines"),
    line: (id) => v(`/lines/${id}`),
    machines: v("/machines"),
    machine: (id) => v(`/machines/${id}`),
  },

  /* ── Fixture-only hierarchy ───────────────────────────────────────────
     The demo universe, still behind the mock adapter. `/org` feeds the site
     health cards and the public page's site list, and the fixtures under it are
     keyed to fixture site ids — repointing them at the live tree would empty
     the whole demo, so the two coexist until the scoped endpoints land. */
  demoHierarchy: {
    tree: v("/hierarchy"),
    scopes: v("/hierarchy/scopes"),
    site: (siteId) => v(`/hierarchy/sites/${siteId}`),
    nodes: v("/hierarchy/nodes"),
  },

  /* ── Anomalies ────────────────────────────────────────────────────────
     LIVE, and NOT the same resource as `alerts` below.

     `alerts` is the demo universe: fixture-backed, denormalised, and carrying
     fields no endpoint serves (a reading, a threshold, a fusion score, an
     assignee). It still feeds the home screen, the public page and the
     assistant dock. `anomalies` is the real API — a narrower record with a
     hierarchy attachment — and it is what the Anomalies screen reads. The two
     coexist until the demo surfaces are moved over; nothing should be added to
     `alerts` from here on.

     `list` is paginated and is the ONLY endpoint that carries the facet counts:
     they arrive inside the list response as `counts.status` and
     `counts.severity`, so there is no separate counts request to make. See
     `fetchAnomalies`.

     Updates are PATCH, not PUT — the only partial-patch endpoint in this API.
     `AnomalyUpdate` takes `title`, `severity` and `status`, every one optional,
     so a status change sends that field alone. */
  /* `rca` is 1:1 with an anomaly and — this is the important part — **404s when
     no analysis has been requested**, which is the ordinary state of a new
     anomaly rather than a fault. `NotFoundError("RCA")` is how "nobody has asked
     yet" is expressed on the wire, so `fetchAnomalyRca` catches it and answers
     `null`. Treating it as an error would put a red panel on every anomaly the
     moment it was opened.

     `rcaRequest` is a POST that returns 202 and creates the row in `queued`
     with `content: {}`. It is idempotent — a second call answers "RCA already
     requested." with the existing row rather than 409-ing. */
  anomalies: {
    list: v("/anomalies"),
    /**
     * DEMO. The facets the list cannot count yet — snoozed, unassigned.
     *
     * `/anomaly-facets`, deliberately NOT `/anomalies/facets`. `isLivePath`
     * matches on the START of the path and `/v1/anomalies` is in `LIVE_PATHS`, so
     * anything nested under it goes to the network — where this route does not
     * exist and answers 404. A sibling path is the whole of the fix, and it is
     * worth knowing about before adding any other mock beneath a live prefix.
     */
    demoFacets: v("/anomaly-facets"),
    detail: (anomalyId) => v(`/anomalies/${anomalyId}`),
    rca: (anomalyId) => v(`/anomalies/${anomalyId}/rca`),
    rcaRequest: (anomalyId) => v(`/anomalies/${anomalyId}/rca/request`),
  },

  /* ── Monitor ──────────────────────────────────────────────────────── */
  alerts: {
    list: v("/alerts"),
    detail: (alertId) => v(`/alerts/${alertId}`),
    counts: v("/alerts/counts"),
    acknowledge: (alertId) => v(`/alerts/${alertId}/acknowledge`),
    analysis: (alertId) => v(`/alerts/${alertId}/analysis`),
  },
  assets: {
    list: v("/assets"),
    /* Bulk create-or-update. A collection POST would be the obvious spelling and
       is wrong here: this is not "create an asset", it is "reconcile these
       rows against the plant", and it answers with how many of each it did. */
    import: v("/assets/import"),
    detail: (assetId) => v(`/assets/${assetId}`),
    documents: (assetId) => v(`/assets/${assetId}/documents`),
    health: (assetId) => v(`/assets/${assetId}/health`),
  },
  /* `list` and `detail` are LIVE — create, list, read, update and delete are all
     served. `PUT` is NARROWER than `POST`: it takes neither the parent trio nor
     `data_source_connection_id`, so a sensor cannot be re-attached or re-pointed
     after onboarding. See features/sensors/api.js `updateSensor`.

     `waveformTypes` and `valueUnits` are LIVE too, and are platform master data
     rather than anything belonging to a sensor — global, read-only, seeded, the
     same arrangement as `connectorTypes`. They are mounted under this router
     because a sensor is the only thing that references them, and both are
     REQUIRED on create and update, so neither form can be filled without them.

     Their literal paths sit above `detail`'s parameterised one: FastAPI matches
     in declaration order and the router declares them first, so
     `/sensors/waveform-types` never reaches `get_sensor` as a malformed UUID.
     Order here is documentation of that, not what causes it.

     `series` is not live and has no fixture either; it predates the real router
     and is left in place because the timeseries slice will want that exact path. */
  sensors: {
    list: v("/sensors"),
    waveformTypes: v("/sensors/waveform-types"),
    valueUnits: v("/sensors/value-units"),
    detail: (sensorId) => v(`/sensors/${sensorId}`),
    series: (sensorId) => v(`/sensors/${sensorId}/series`),
  },
  oee: {
    summary: v("/oee/summary"),
    byLine: v("/oee/lines"),
  },

  /* ── Lines & Assets · DEMO ────────────────────────────────────────────
     `/production-lines` and not `/lines`, which is already taken: the real API
     serves `/v1/lines` as the hierarchy's line collection and it is in
     LIVE_PATHS, so anything registered under that prefix goes to the network.

     They are genuinely different resources. `hierarchy.lines` is the structural
     record — a name, a parent, an asset class — and this one is the operational
     view of the same line: state, throughput, health, the assets on it and their
     open alerts. The demo composes the second from the first plus a fixture
     overlay, and when the real endpoint lands it will do the same server-side.

     `assets.detail` below already existed and is reused for the station screen
     rather than duplicated here — one asset, one path. */
  productionLines: {
    list: v("/production-lines"),
    detail: (lineId) => v(`/production-lines/${lineId}`),
  },
  /* ── Sensor Explorer · DEMO ───────────────────────────────────────────
     `/signals` and not `/sensors`, which is already taken and is LIVE. They are
     genuinely different resources and the split is the same one as
     `/production-lines` beside `/lines`.

     A SENSOR is the configuration of a tag: its name, its waveform type, its
     value unit, which connection reads it, what its extraction config says. That
     is what the real API serves and what Data Fusion → IoT sensors edits.

     A SIGNAL is the measured channel: a normal operating band, a current
     reading, a state and a trace over a window. Nothing serves it yet.

     `scopes` is the hierarchy above the channels with a count on every node. It
     rides beside the collection rather than inside it because the selector must
     keep showing the whole plant while the grid is narrowed to one line — a
     count that changed when you filtered would be answering a different
     question. */
  signals: {
    list: v("/signals"),
    scopes: v("/signals/scopes"),
    detail: (signalId) => v(`/signals/${signalId}`),
  },

  /* ── Timeseries Workstation · DEMO ────────────────────────────────────
     A chart is a saved set of channels with a name on it. `list` is also the
     create path — the New Chart dialog POSTs to the collection.

     `detail` takes the span as query params (`window` or `from`/`to`, plus
     `granularity`) and answers the chart with its traces, statistics,
     correlations and events already resolved. That is deliberate rather than
     lazy: the statistics panel, the series table and the AI banner are three
     views of one computation, and computing it three times in the client is how
     they come to disagree.

     `adhoc` is the id the Workstation uses when it was opened from a channel
     card rather than from a saved chart — the channels arrive in `?signals=`
     and nothing is stored. It is a path segment and not a separate route so
     that one screen serves both, and saving an ad-hoc chart is a POST to the
     collection rather than a different page. */
  charts: {
    list: v("/charts"),
    detail: (chartId) => v(`/charts/${chartId}`),
  },

  /* ── Shifts · DEMO ────────────────────────────────────────────────────
     `current` and `handover` predate the module and feed the top bar and the
     public page; `list` is the roster the Shifts screen reads.

     One collection, and the AI synopsis rides on it rather than having a route
     of its own: the briefing's every figure is counted off the same rows the
     table lists, and a second request would be a second chance for the two to
     disagree. */
  /* ── Notifications · DEMO ─────────────────────────────────────────────
     Alert rules, the channels they deliver through, and the escalation ladder,
     all on ONE response. They are three views of one configuration and the
     interesting facts are the joins between them — a live rule pointing at an
     unconfigured channel is only visible if you hold both at once.

     `rule` serves PATCH, which is the enable/disable toggle and nothing else:
     the rest of a rule is an edit, and an edit is the dialog. */
  notifications: {
    list: v("/notifications"),
    rule: (id) => v(`/notifications/rules/${id}`),
    rules: v("/notifications/rules"),
    /* DEMO. A personal delivery setting, not an org routing rule — which is why
       it is its own sub-resource rather than a field on the configuration. */
    preference: (id) => v(`/notifications/preferences/${id}`),
    channel: (id) => v(`/notifications/channels/${id}`),
    channelTest: (id) => v(`/notifications/channels/${id}/test`),
    escalation: v("/notifications/escalation"),
  },

  /* ── Executive Dashboard · DEMO ───────────────────────────────────────
     One response: the site rollups, the enterprise totals and the AI brief.
     They are three views of one computation — the brief names the site the
     bars show as worst, and the totals are summed off the same rows — so
     splitting them would be three chances to disagree. */
  executive: {
    summary: v("/executive"),
  },

  /* ── Analytics & Reports · DEMO ───────────────────────────────────────
     The generated-report shelf. `list` is also the generate path — a POST
     starts one, which then takes time to finish, so the collection is polled
     while anything on it is still running. */
  reports: {
    list: v("/reports"),
    detail: (id) => v(`/reports/${id}`),
    /* The standard-report catalogue: templates, their categories and personas,
       the sections a build can be assembled from, and the delivery schedule.
       Separate from `list` because it is a catalogue, not a collection of the
       user's things — it never changes while the tab is open, so it is fetched
       once and never polled, while `list` polls whenever a build is running. */
    library: v("/reports/library"),
  },

  /* ── Logbook · DEMO ───────────────────────────────────────────────────
     One collection, GET and POST. Search, the machine filter and the shift
     filter are all query params applied server-side — the search in particular
     has to be, because it expands the query against a synonym table and reports
     back which extra terms earned a match. Filtering in the client would make
     that chip a claim nobody could check.

     The rollup and the machine list ride on the same response for the reason
     the shift synopsis does: they are counted off the rows the feed renders,
     and a second request is a second chance to disagree with it. */
  logbook: {
    list: v("/logbook"),
  },

  shifts: {
    list: v("/shifts"),
    current: v("/shifts/current"),
    handover: v("/shifts/handover"),
  },

  /* ── Act ────────────────────────────────────────────────────────────
     DEMO. The collection is also the create path — a POST to `/work-orders`
     raises one, which is the ordinary spelling and is right here: this really
     is "create a work order", unlike `/assets/import`, which reconciles rows
     against a plant and answers with how many of each it did.

     `detail` serves GET, PATCH and DELETE. PATCH and not PUT: advancing a state
     and editing a title touch different fields, and a full replace would make
     the board's Move button send back a whole order to change one word. It is
     also the only place in this app that VALIDATES a transition — the handler
     checks the move against `WO_NEXT` and answers 422 for one the workflow does
     not allow, so a draft cannot be marked complete without being approved. */
  workOrders: {
    list: v("/work-orders"),
    detail: (id) => v(`/work-orders/${id}`),
    create: v("/work-orders"),
  },

  /* ── Agents ───────────────────────────────────────────────────────── */
  /* `messages` serves GET and POST. GET is the DOCK's thread, grounded on
     ALR-4471 and unchanged; POST is the Copilot screen asking a question and is
     the ordinary spelling — asking really is creating a message.

     `prompts` is the screen's opening state: the four agent modes, their chips,
     and what the assistant says it is grounded to. Separate from `messages`
     because it is read once when the screen mounts and never again, while
     `messages` is written on every question. */
  copilot: {
    /* LIVE. The turn endpoint streams SSE and is read with `fetch` rather than
       `EventSource`, which is GET-only and cannot carry a question in a body. */
    turns: v("/copilot/turns"),
    sessions: v("/copilot/sessions"),
    sessionTurns: (id) => v(`/copilot/sessions/${id}/turns`),
    /* LIVE. What has already been asked about one incident, across every visit —
       the dock reloads from this instead of opening empty on a record somebody has
       already investigated. The bare `anomalies` prefix is here so `http.js` has
       something static to match `anomalyTurns` against, exactly as `sessions`
       covers `sessionTurns`; nothing calls it on its own. */
    anomalies: v("/copilot/anomalies"),
    anomalyTurns: (id) => v(`/copilot/anomalies/${id}/turns`),
    /* Demo fixtures behind the public page. Unrelated to the three above. */
    messages: v("/copilot/messages"),
    prompts: v("/copilot/prompts"),
    session: v("/copilot/session"),
  },

  /* ── Data Fusion ──────────────────────────────────────────────────────
     LIVE, all of it. `LIVE_PATHS` carries the `/v1/connections` prefix, which is
     the correct statement now that every route under it is served and used.

     `connectorTypes` sits under the connections prefix because that is where the
     router mounts it, not because it belongs to one connection. It is listed
     after `connection` so the more specific literal path is easy to see beside
     the parameterised one — order here is documentation only, the transport
     matches on the prefix.

     Updates are PUT, not PATCH, and replace all three editable fields:
     `plant_id` and `connector_type_id` are not updatable at all, so a connection
     cannot move site or change protocol.

     `connectors` below is unrelated: it feeds the public page's source-contract
     section from the demo fixtures and predates the real endpoints. Both stay. */
  dataFusion: {
    connections: v("/connections"),
    connection: (id) => v(`/connections/${id}`),
    connectorTypes: v("/connections/connector-types"),
    connectionTest: v("/connections/test"),

    connectors: v("/data-fusion/connectors"),

    /* DEMO. The other four source families — OT, vision, business systems,
       databases — which the product does not have endpoints for yet.

       Deliberately NOT under `/connections`: that prefix is in `LIVE_PATHS` and
       every request beneath it goes to the network. "Sources" is also the right
       noun for the wider set, since a document store and an S3 prefix are not
       connections in the sense that resource means. */
    sources: v("/data-fusion/sources"),

    /* DEMO. One source, with the things a table has no room for: the ingest
       contract, the config schema with its values resolved, and the activity
       log. A separate request from the collection rather than a fatter row —
       the config schema for a historian is thirteen fields and nobody reading
       a list of six sources needs seventy-eight of them.

       `source` serves GET and PATCH; `sourceTest` is a POST to an action
       sub-resource, for the reason the pipelines pass gives: "test this now" is
       not a field with a new value. */
    source: (id) => v(`/data-fusion/sources/${id}`),
    sourceTest: (id) => v(`/data-fusion/sources/${id}/test`),

    /* DEMO. One write-back rule. A sub-resource rather than a field on the
       source, because a rule is a record in its own right — it has a target
       object and its own enabled state, and folding six of them into the config
       payload would make the connection form responsible for something it does
       not show. */
    sourceWriteback: (id) => v(`/data-fusion/sources/${id}/writeback`),

    /* DEMO. The connect wizard. Both are deliberately OUTSIDE `/sources/` rather
       than `/sources/catalogue` and `/sources/probe`: those would be matched by
       `/sources/:id` on any router that takes the first pattern that fits, and a
       collection whose ids can collide with its own sub-paths is a collection
       waiting to serve a catalogue as a source.

       The probe is a POST because it reaches out to somewhere — and it is a probe
       of a CONNECTOR, not of a source, because at that point in the wizard there
       is no source yet. Testing one that exists is `sourceTest`. */
    connectorCatalogue: v("/data-fusion/connector-catalogue"),
    connectorProbe: v("/data-fusion/connector-probe"),

    /* DEMO. The module's landing screen. One request rather than five: every
       figure on it is a count taken across the same collections in the same
       pass, and five endpoints would let the cards disagree with each other by
       being fetched at different moments. */
    overview: v("/data-fusion/overview"),

    /* DEMO. The document registry. `document` serves GET and PATCH — the only
       editable field is verification, which is a judgement this reader makes;
       a revision number and an owner belong to the system that filed the
       document, and offering them as inputs would make this a second source of
       truth for facts it does not own. */
    documents: v("/data-fusion/documents"),
    document: (id) => v(`/data-fusion/documents/${id}`),

    /* DEMO. Photographs, CAD, thermal captures and inspection video. A separate
       collection from documents rather than a `?kind=` on it: they share a
       linking model and nothing else — no revision, no page count, no
       verification, and a grid instead of a register. */
    media: v("/data-fusion/media"),

    /* DEMO. Contextualisation — the queue of objects that arrived without a
       home. A decision is a POST to the item rather than a PATCH of the record,
       because what is stored is the REVIEW, and accepting one writes a link into
       whichever registry the object came from. */
    context: v("/data-fusion/context"),
    contextDecision: (id) => v(`/data-fusion/context/${encodeURIComponent(id)}/decision`),

    /* DEMO. The knowledge graph. `graph` is the whole-estate counts plus the
       machines worth opening; `graphNode` is one machine's neighbourhood,
       positioned. Two requests because the picker is read once and the
       neighbourhood changes on every click. */
    graph: v("/data-fusion/graph"),
    graphNode: (id) => v(`/data-fusion/graph/${id}`),

    /* DEMO. Ingestion pipelines. Running and pausing are POSTs to an `actions`
       sub-resource rather than a PATCH of the record: "run this now" is not a
       field with a new value, and modelling it as one would mean inventing a
       field whose only job is to be written. */
    pipelines: v("/data-fusion/pipelines"),
    pipelineAction: (id) => v(`/data-fusion/pipelines/${id}/actions`),
  },

  /* ── Overview ─────────────────────────────────────────────────────── */
  briefing: {
    current: v("/briefing"),
  },

  /* ── Home dashboard · DEMO ────────────────────────────────────────────
     Fixture-backed and only read when `VITE_DEMO_MODE=true`. The paths are
     written the way the real API would serve them rather than under a `/demo`
     prefix, because the whole point of routing these through the transport is
     that landing the endpoint is a change of answer, not a change of address.

     `context` is the toolbar's site + shift line. `kpis` is the four-tile strip;
     two of its four values are computed from the alerts fixture by the handler
     so the strip cannot disagree with the list it links to. */
  home: {
    context: v("/home/context"),
    kpis: v("/home/kpis"),
    watched: v("/home/watched-assets"),
    assets: v("/home/my-assets"),
  },

  /* Tasks. A real resource in its own right — the home panel is one view of it,
     and Work Orders will be another. Create posts to the collection; update and
     delete take the id. */
  tasks: {
    list: v("/tasks"),
    detail: (id) => v(`/tasks/${id}`),
  },

  /* Shift handovers. `latest` is what the home card reads — the most recent
     published record, which is not always the newest row, because the newest may
     still be a draft. */
  handovers: {
    list: v("/handovers"),
    latest: v("/handovers/latest"),
    detail: (id) => v(`/handovers/${id}`),
    acknowledge: (id) => v(`/handovers/${id}/acknowledge`),
  },

  /* ── Insights ─────────────────────────────────────────────────────── */
  kpis: {
    topline: v("/kpis/topline"),
  },

  /* ── People · DEMO ────────────────────────────────────────────────────
     The account directory behind Settings → Users. `/users` and not
     `/settings/users`: a person is a resource of the platform, not of the screen
     that happens to administer them, and the same collection is what the task
     assignee picker and the shift roster read from.

     `person` serves PATCH only, and the only field it takes is `status`. A name
     belongs to the person, a role to the roles page, a site to the hierarchy and
     a last sign-in to the log — offering any of them here would make this screen
     a second source of truth for a fact it does not own. */
  people: {
    list: v("/users"),
    detail: (id) => v(`/users/${id}`),
    /* Bulk create-or-update, and the same spelling the asset import uses: this
       is not "create a user", it is "reconcile these rows against the
       directory", and it answers with how many of each it did. */
    import: v("/users/import"),
    imports: v("/users/imports"),
  },

  /* DEMO. Developer access — API keys, webhooks and the published spec.
     One read, because the page is one page and the three lists are drawn
     together. A key's value is returned by `keys` on create and by
     `keyRotate`, and by nothing else ever. */
  developer: {
    access: v("/developer"),
    keys: v("/developer/keys"),
    key: (id) => v(`/developer/keys/${id}`),
    keyRotate: (id) => v(`/developer/keys/${id}/rotate`),
    webhooks: v("/developer/webhooks"),
    webhook: (id) => v(`/developer/webhooks/${id}`),
    webhookTest: (id) => v(`/developer/webhooks/${id}/test`),
    spec: v("/developer/spec"),
    postman: v("/developer/postman"),
  },

  /* DEMO. Settings → Integrations. One GET, because the connector grid and the
     pipeline monitor are two views of the same registry and fetching them
     separately would let them be fetched at different moments and disagree.

     The two writes are deliberately spelled as the SOURCE resource they change:
     this page has no records of its own, and an endpoint named for the page
     rather than for what it writes is how a second registry starts. */
  integrations: {
    list: v("/integrations"),
    sourcePause: (id) => v(`/integrations/sources/${id}/pause`),
    source: (id) => v(`/integrations/sources/${id}`),
  },

  /* DEMO. Security policy. GET reads it, PATCH changes it — and every accepted
     change writes to the audit log, which is how the two screens are joined. */
  security: {
    settings: v("/security"),
  },

  /* DEMO. The audit log. Read-only by construction: an audit log with a write
     endpoint is not an audit log. Entries are appended by the writes they
     record, in the fixtures that perform them. */
  audit: {
    list: v("/audit"),
  },

  /* DEMO. Roles and what they permit. `role` serves PUT and DELETE; a system
     role refuses both, because it is the vocabulary the Users screen, the create
     dialog and the bulk import all validate against. */
  roles: {
    list: v("/roles"),
    detail: (id) => v(`/roles/${id}`),
  },

  /* DEMO. Teams. A resource of its own and not `/users?group=`: a team has a
     lead, a channel and a default page, none of which belong to a person. */
  teams: {
    list: v("/teams"),
  },
};
