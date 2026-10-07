/**
 * Home's demo-mode panels: shift context, the KPI strip, my tasks, the watched
 * assets carousel, my assets, and shift handovers.
 *
 * SYNTHETIC. Every figure here is authored, the same as everything else in this
 * directory, and none of it is measured. These panels exist in the Claude Design
 * prototype and have no endpoint behind them yet, so they are served from here
 * and gated on `VITE_DEMO_MODE`.
 *
 * ── Why it is a fixture and not props typed into the component ─────────────
 * The prototype hardcodes these arrays inside the JSX. Doing the same would mean
 * that landing the real endpoint is a rewrite of the screen rather than an edit
 * to one service function. Everything below is therefore reached the ordinary
 * way — mock adapter → the feature's `api.js` → hook — so the screens already read
 * as if the data were remote: they have loading states, they refetch, and a
 * mutation invalidates them.
 *
 * ── The universe is Meridian's, not the prototype's ────────────────────────
 * The prototype says Chennai and Compressor C-12; this codebase says Findlay,
 * Pune and Bodymaker 3, and the ly list, the briefing and the public page
 * all already agree on that. Copying the prototype's place names verbatim would
 * put two plants in one product. The SHAPE is the prototype's exactly; the nouns
 * are this codebase's.
 *
 * Arrays are module state, deliberately: a task marked done or a handover
 * published persists for the session, which is what makes the demo honest to
 * click through.
 */

import { ALL_PEOPLE, SELF_ID } from "./people";

/* ── Trace generation ─────────────────────────────────────────────────────
   Deterministic, unlike the prototype's `Math.random()`. A trace that is
   regenerated on every render makes a carousel that redraws under the reader,
   and it means two people looking at the same demo see different charts. The
   seed makes each series stable and different from its neighbours. */
function trace(count, base, amplitude, { freq = 4, drift = 0, spikeAt = null, seed = 1 } = {}) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    // A cheap deterministic wobble — enough to stop the line reading as a
    // textbook sine, without pulling in a PRNG.
    const jitter = Math.sin((i + 1) * seed * 12.9898) * amplitude * 0.14;
    let value = base + amplitude * Math.sin(t * Math.PI * freq) + jitter;
    if (drift && t > 0.4) value += (t - 0.4) * amplitude * drift;
    if (spikeAt != null && Math.abs(t - spikeAt) < 0.04) value += amplitude * 1.7;
    out.push(Math.round(value * 100) / 100);
  }
  return out;
}

/* ══ SHIFT CONTEXT ═══════════════════════════════════════════════════════
   The toolbar line above the dashboard. `asOf` is stamped by the handler on
   every read rather than frozen here, so the clock is not a lie. */
export const HOME_CONTEXT = {
  siteId: "site_findlay",
  siteName: "Findlay Plant",
  shift: "night",
  shiftWindow: "22:00 – 06:00",
  timeZone: "America/New_York",
};

/* ══ SHIFT KPIs ══════════════════════════════════════════════════════════
   Four tiles. `to` makes a tile a link; the prototype's are clickable and two
   of them are the fastest route to the anomaly list on the whole screen.

   `anomaliesActive` and `criticalAlerts` are computed by the handler from the
   alerts fixture rather than written here, so the strip cannot disagree with
   the list it links to. The other two are authored. */
export const SHIFT_KPIS = [
  { key: "anomaliesActive", icon: "bolt", tone: "amber", to: "/app/anomalies" },
  { key: "criticalAlerts", icon: "bell", tone: "red", to: "/app/anomalies" },
  { key: "sensorsOnline", icon: "plug", tone: "green", to: null, value: 2560, offline: 2 },
  { key: "shiftOee", icon: "gauge", tone: null, to: "/app/oee", value: 71.8, target: 85 },
];

/* ══ WATCHED ASSETS ══════════════════════════════════════════════════════
   The carousel. Three assets the shift is actively watching, each with the one
   signal that put it there. Same field names `SignalTrace` already takes, so the
   component needs no adapter. */
export const WATCHED_ASSETS = [
  {
    id: "FDY-BM-03",
    name: "Bodymaker 3",
    lineName: "Line 1",
    sensor: "Vibration RMS",
    reading: { value: 0.42, unit: "in/s" },
    tone: "red",
    threshold: 0.38,
    normalBand: [0.12, 0.3],
    anomalyFrom: 0.68,
    values: trace(60, 0.22, 0.06, { drift: 2.6, spikeAt: 0.82, seed: 3 }),
  },
  {
    id: "PNQ-BM-02",
    name: "Bodymaker 2",
    lineName: "Line 1",
    sensor: "Coolant Flow",
    reading: { value: 41, unit: "L/min" },
    tone: "amber",
    threshold: 48,
    normalBand: [48, 62],
    anomalyFrom: 0.55,
    values: trace(60, 54, 5, { freq: 3, drift: -1.9, seed: 7 }),
  },
  {
    id: "FDY-WSH-01",
    name: "Washer",
    lineName: "Line 1",
    sensor: "Conductivity",
    reading: { value: 98.6, unit: "%" },
    tone: "green",
    threshold: 94,
    normalBand: [96, 101],
    anomalyFrom: null,
    values: trace(60, 98.4, 1.1, { freq: 5, seed: 11 }),
  },
];

/* ══ MY ASSETS ═══════════════════════════════════════════════════════════
   The prototype's table: what this person is responsible for, its state, its
   health and the last thing that happened to it. */
export const MY_ASSETS = [
  { id: "FDY-BM-03", name: "Bodymaker 3", lineName: "Line 1", state: "tripped", health: 62, openWorkOrders: 1 },
  { id: "FDY-WSH-01", name: "Washer", lineName: "Line 1", state: "watch", health: 74, openWorkOrders: 0 },
  { id: "FDY-CMP-12", name: "Compressor C-12", lineName: "Compressed Air", state: "watch", health: 68, openWorkOrders: 2 },
  { id: "FDY-DEC-02", name: "Decorator 2", lineName: "Line 1", state: "running", health: 88, openWorkOrders: 0 },
  { id: "FDY-OVN-01", name: "IBO Oven", lineName: "Line 1", state: "running", health: 91, openWorkOrders: 0 },
  { id: "FDY-PAL-02", name: "Palletizer", lineName: "Line 1", state: "running", health: 84, openWorkOrders: 0 },
];

/* ══ TASKS ═══════════════════════════════════════════════════════════════
   `assignee` is a person id so the list can be filtered by "assigned to me"
   without string-matching a display name. `SELF` is who the demo signs in as.

   `source` records where a task came from — an anomaly, the handover, the work
   order queue — which is the field that makes the list feel like part of a
   system rather than a to-do app bolted on. */
export const SELF = SELF_ID;

/**
 * The people who do plant work.
 *
 * A view over the people registry rather than a second list of the same people.
 * It used to be authored here with the role written out in English — "Plant
 * Manager" — which the briefing card printed straight to the screen in every
 * locale; `role` is now the same `common:roles` key the rest of the product uses.
 *
 * Filtered by ROLE and not by account status, which is the distinction that
 * matters. This list is what the roster, the logbook and the notification ladder
 * resolve a name from, and locking somebody's account must not erase who worked
 * Tuesday night. What it must do is stop them being given anything new — that is
 * `assignablePeople()` below, and it is evaluated per request rather than at
 * import, because a list computed once at module load is a snapshot of a fixture
 * this product writes to.
 */
const PLANT_ROLES = ["plantManager", "reliabilityEngineer", "lineOperator", "maintenanceTechnician", "shiftLead", "executive"];

export const TASK_PEOPLE = ALL_PEOPLE().filter((person) => PLANT_ROLES.includes(person.role));

/** Who a task can be assigned to NOW. Read at request time, never cached. */
export const assignablePeople = () => ALL_PEOPLE().filter((person) => person.status === "active" && PLANT_ROLES.includes(person.role));

/** Assets a task can be attached to. Mirrors MY_ASSETS plus the line itself. */
export const TASK_ASSETS = [
  { id: "FDY-BM-03", name: "Bodymaker 3" },
  { id: "PNQ-BM-02", name: "Bodymaker 2" },
  { id: "FDY-CMP-12", name: "Compressor C-12" },
  { id: "FDY-WSH-01", name: "Washer" },
  { id: "FDY-OVN-01", name: "IBO Oven" },
  { id: "PNQ-NCK-01", name: "Necker" },
  { id: "line_fdy_1", name: "Line 1" },
];

export const TASKS = [
  {
    id: "TSK-2041",
    title: "Inspect the Bodymaker 3 coolant loop and reseat the J14 harness",
    assetId: "FDY-BM-03",
    assetName: "Bodymaker 3",
    priority: "critical",
    dueAt: "2026-06-17T16:00",
    status: "inProgress",
    assignee: "usr_mgr_1",
    source: { kind: "anomaly", ref: "ALR-4471" },
  },
  {
    id: "TSK-2038",
    title: "Verify the spindle vibration trend on the Necker before the ramp-up",
    assetId: "PNQ-NCK-01",
    assetName: "Necker",
    priority: "high",
    dueAt: "2026-06-17T18:00",
    status: "open",
    assignee: "usr_mgr_1",
    source: { kind: "handover", ref: "HND-2307" },
  },
  {
    id: "TSK-2034",
    title: "Approve WO-4418 — drive-end bearing replacement",
    assetId: "FDY-CMP-12",
    assetName: "Compressor C-12",
    priority: "high",
    dueAt: "2026-06-18T12:00",
    status: "open",
    assignee: "usr_mgr_1",
    source: { kind: "workOrder", ref: "WO-4418" },
  },
  {
    id: "TSK-2029",
    title: "Review the weekly OEE dip on Line 1 and report back at the huddle",
    assetId: "line_fdy_1",
    assetName: "Line 1",
    priority: "medium",
    dueAt: "2026-06-19T09:00",
    status: "open",
    assignee: "usr_rel_1",
    source: { kind: "delegated", ref: null },
  },
  {
    id: "TSK-2025",
    title: "Close out the quarterly PM checklist for the IBO Oven",
    assetId: "FDY-OVN-01",
    assetName: "IBO Oven",
    priority: "low",
    dueAt: "2026-06-20T17:00",
    status: "done",
    assignee: "usr_tec_1",
    source: { kind: "pm", ref: "PM-Q3" },
  },
];

/* ══ HANDOVERS ═══════════════════════════════════════════════════════════
   The history list, and the one full report the card and the modal both read.

   Ids continue the HND- series `operations.js` already uses. That fixture holds
   ONE handover, structured for the public page in SQDCP order; this holds the
   operator-facing history and the long-form report, which is a different shape
   for a different surface. They are not merged because merging them would force
   one of the two screens to ignore half of its own record. */
/* `daysAgo` rather than a date, for the same reason `detectedMinutesAgo` is
   minutes: the dates authored here were June 2026 and were June 2026 forever.
   The handler resolves each to a real date, which also lets the Shifts roster
   match a handover to the shift that wrote it — the two screens are views of one
   record and could not be joined while one of them lived in a fixed week.

   The newest is yesterday and not today, because the newest handover has to
   belong to a shift that has actually ENDED. Today's afternoon and night shifts
   have not run yet, and a handover report for one of them would be a record of
   work nobody has done. */
export const HANDOVERS = [
  {
    id: "HND-2307",
    from: "afternoon",
    to: "night",
    daysAgo: 1,
    window: "14:00 – 22:00",
    outgoing: "Ines Brandt",
    incoming: "Dana Okafor",
    status: "draft",
    oee: 74,
    criticalCarried: 1,
    highCarried: 1,
    pending: 3,
  },
  {
    id: "HND-2306",
    from: "morning",
    to: "afternoon",
    daysAgo: 1,
    window: "06:00 – 14:00",
    outgoing: "Dana Okafor",
    incoming: "Ines Brandt",
    status: "acknowledged",
    oee: 81,
    criticalCarried: 0,
    highCarried: 2,
    pending: 1,
  },
  {
    id: "HND-2305",
    from: "night",
    to: "morning",
    daysAgo: 1,
    window: "22:00 – 06:00",
    outgoing: "Karan Patel",
    incoming: "Dana Okafor",
    status: "acknowledged",
    oee: 78,
    criticalCarried: 1,
    highCarried: 0,
    pending: 2,
  },
  {
    id: "HND-2304",
    from: "afternoon",
    to: "night",
    daysAgo: 2,
    window: "14:00 – 22:00",
    outgoing: "Ines Brandt",
    incoming: "Maya Reddy",
    status: "acknowledged",
    oee: 85,
    criticalCarried: 0,
    highCarried: 1,
    pending: 0,
  },
  {
    id: "HND-2303",
    from: "morning",
    to: "afternoon",
    daysAgo: 2,
    window: "06:00 – 14:00",
    outgoing: "Dana Okafor",
    incoming: "Ines Brandt",
    status: "acknowledged",
    oee: 79,
    criticalCarried: 0,
    highCarried: 3,
    pending: 2,
  },
  {
    id: "HND-2302",
    from: "night",
    to: "morning",
    daysAgo: 2,
    window: "22:00 – 06:00",
    outgoing: "Karan Patel",
    incoming: "Dana Okafor",
    status: "acknowledged",
    oee: 82,
    criticalCarried: 1,
    highCarried: 1,
    pending: 1,
  },
  {
    id: "HND-2301",
    from: "afternoon",
    to: "night",
    daysAgo: 3,
    window: "14:00 – 22:00",
    outgoing: "Ines Brandt",
    incoming: "Maya Reddy",
    status: "acknowledged",
    oee: 76,
    criticalCarried: 2,
    highCarried: 1,
    pending: 4,
  },
];

/** Rollup for the history page's stat cards. Authored, not derived: the list is
    seven rows and the counts describe the whole archive behind them. */
/**
 * A handover's date, resolved from `daysAgo`.
 *
 * Local, and formatted as `yyyy-mm-dd` by hand rather than through
 * `toISOString()`, which converts to UTC first and lands on the previous day for
 * anybody west of Greenwich after 19:00.
 */
export function handoverDate(handover, now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - handover.daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Every handover with its date resolved — what the routes and the roster read. */
export const datedHandovers = (now = Date.now()) => HANDOVERS.map((handover) => ({ ...handover, date: handoverDate(handover, now) }));

export const HANDOVER_STATS = {
  total: 418,
  thisWeek: 21,
  perDay: 3,
  averageOee: 79.4,
  averageOverShifts: 7,
  pendingActions: 13,
};

/**
 * The long-form report. One record rather than one per row: the prototype opens
 * the same report from every row, and authoring seven full reports to hide that
 * would be six lies for no gain. The handler stamps the row's own id onto it so
 * the modal header is honest about which handover was opened.
 */
export const HANDOVER_REPORT = {
  siteName: "Findlay Plant",
  summary:
    "Steady shift overall. Line 1 held 74% OEE against an 85% target, limited by a recurring coolant-flow restriction on Bodymaker 2 that has not cleared. One critical anomaly (ALR-4471) is open and under investigation on Bodymaker 3; the drive-end bearing replacement WO-4418 is drafted and waiting on approval. No safety incidents, no near misses.",
  production: [
    { key: "cansProduced", value: "412,800", note: "94% of plan" },
    { key: "lineSpeed", value: "1,640 cpm", note: "target 1,800" },
    { key: "downtime", value: "38 min", note: "2 stops" },
    { key: "rejects", value: "0.8%", note: "within spec" },
  ],
  carried: [
    { id: "ALR-4471", severity: "critical", description: "Vibration RMS climbing on the Bodymaker 3 drive-end bearing", state: "openInvestigating" },
    {
      id: "ALR-4465",
      severity: "high",
      description: "Coolant flow restricted on Bodymaker 2 — 41 L/min against a 48 L/min floor",
      state: "acknowledged",
    },
  ],
  pending: [
    "Approve WO-4418 — drive-end bearing replacement on Compressor C-12",
    "Re-verify the Bodymaker 3 coolant loop after the J14 harness is reseated",
    "Watch the Necker spindle vibration trend through the evening run",
  ],
  aiDraft: [
    "412,800 cans produced (94% of plan) · average 1,640 cpm · 38 min downtime",
    "1 critical anomaly (ALR-4471, vibration) and 1 high (ALR-4465, coolant flow)",
    "3 pending actions carried to the next shift",
  ],
};
