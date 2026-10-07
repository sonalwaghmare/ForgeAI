import { ALERTS } from './alerts'
import { HIERARCHY_NODES } from './hierarchy'
import { OEE_PERIOD_DATA } from './oee'
import { PEOPLE, currentSites } from './enterprise'
import { allWorkOrders, isOpenOrder } from './operations'
import { DEFAULT_SECTIONS, REPORT_FORMATS, kindForTemplate, pagesForSelection } from './reportLibrary'

/**
 * Analytics & Reports — the generated-report shelf.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 *
 * ── What a report card claims, and where it comes from ────────────────────
 * The design's four cards are four authored strings: "Monthly Board Report —
 * May 2026 · All sites · 24 pages · Ready". Every part of that is typed. The
 * month never changes, the page count is a decoration, "All sites" is not
 * checked against anything, and "Generating" is a badge that will still say
 * Generating tomorrow.
 *
 * Here a report is a KIND and a SCOPE. Its title carries the period it covers,
 * computed from the clock. Its coverage — how many sites, how many machines,
 * how many anomalies and work orders fall inside it — is counted off the same
 * fixtures every other screen reads. Its length follows from that coverage
 * rather than being asserted beside it.
 *
 * ── Generating is a state with a clock behind it ──────────────────────────
 * A report that is generating has a `startedAt`, and it finishes when enough
 * time has passed. So the badge changes while you watch, Generate New produces
 * something that really is not ready yet, and the button on a running card says
 * how far along it is. The prototype's says "View Progress" and does nothing.
 */

/** Roughly how long a report takes to build, by kind. Longer for wider scope. */
const BUILD_SECONDS = 45

/**
 * The shelf.
 *
 * Authored: the kind, the scope it covers, and how long ago it was generated.
 * `siteId` is null for an enterprise-wide report.
 *
 * `ageDays` rather than a date, so the shelf is always plausibly recent — the
 * design's newest report is dated May 2026 whenever you open it.
 */
export const REPORTS = [
  { id: 'RPT-2041', kind: 'board', period: 'month', siteId: null, ageDays: 3, authorRole: 'exec' },
  { id: 'RPT-2038', kind: 'riskReview', period: 'month', siteId: 'site_pune', ageDays: 6, authorRole: 'reliability' },
  { id: 'RPT-2035', kind: 'oeeSummary', period: 'quarter', siteId: null, ageDays: 11, authorRole: 'manager' },
  { id: 'RPT-2031', kind: 'maintenanceRoi', period: 'quarter', siteId: null, ageDays: 18, authorRole: 'manager' },
  { id: 'RPT-2028', kind: 'riskReview', period: 'month', siteId: 'site_findlay', ageDays: 24, authorRole: 'reliability' },
  { id: 'RPT-2024', kind: 'oeeSummary', period: 'month', siteId: 'site_weissenthurm', ageDays: 31, authorRole: 'manager' },
]

/** The kinds the Generate dialog offers. Each one knows what it is made of. */
export const REPORT_KINDS = ['board', 'riskReview', 'oeeSummary', 'maintenanceRoi']

export const REPORT_PERIODS = ['month', 'quarter']

/* Reports generated this session. Module scope, so they survive it — and so a
   report started a minute ago is still generating when you come back. */
const GENERATED = []

export const allReports = () => [...GENERATED, ...REPORTS]

/**
 * The sections a kind is built from.
 *
 * This is what makes the page count derivable rather than decorative: a report
 * is its sections, a section runs a couple of pages, and a per-site section
 * repeats once per site in scope. The prototype writes "24 pages" beside a
 * report whose scope it never checks.
 */
const SECTIONS = {
  board: [
    { key: 'summary', pages: 2, perSite: false },
    { key: 'oee', pages: 3, perSite: true },
    { key: 'reliability', pages: 2, perSite: true },
    { key: 'risk', pages: 2, perSite: false },
    { key: 'outlook', pages: 2, perSite: false },
  ],
  riskReview: [
    { key: 'summary', pages: 1, perSite: false },
    { key: 'anomalies', pages: 4, perSite: false },
    { key: 'assets', pages: 3, perSite: false },
    { key: 'actions', pages: 2, perSite: false },
  ],
  oeeSummary: [
    { key: 'summary', pages: 1, perSite: false },
    { key: 'oee', pages: 2, perSite: true },
    { key: 'losses', pages: 2, perSite: false },
  ],
  maintenanceRoi: [
    { key: 'summary', pages: 1, perSite: false },
    { key: 'avoided', pages: 4, perSite: false },
    { key: 'workOrders', pages: 3, perSite: false },
    { key: 'outlook', pages: 2, perSite: false },
  ],
}

const round = (value, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** The sites a report covers: one, or all of them. */
function sitesInScope(report) {
  const sites = HIERARCHY_NODES.filter((node) => node.tier === 'site')
  return report.siteId ? sites.filter((node) => node.id === report.siteId) : sites
}

/**
 * What the report is actually about, counted.
 *
 * Every figure here comes from a fixture another screen renders, so a board
 * report cannot claim a different number of open anomalies than the anomaly
 * list shows for the same scope.
 */
export function coverageFor(report) {
  const sites = sitesInScope(report)
  const siteIds = new Set(sites.map((node) => node.id))

  const lines = HIERARCHY_NODES.filter(
    (node) => node.tier === 'line' && siteIds.has(node.parentId),
  )
  const lineIds = new Set(lines.map((node) => node.id))
  const assets = HIERARCHY_NODES.filter(
    (node) => node.tier === 'asset' && lineIds.has(node.parentId),
  )

  const alerts = ALERTS.filter((alert) => siteIds.has(alert.siteId))
  const orders = allWorkOrders().filter((order) =>
    assets.some((asset) => asset.id === order.assetId),
  )

  /* Downtime hours the platform says were avoided. The same figure the
     enterprise screen reports, taken off the alerts in scope rather than
     restated — this is the number a maintenance-ROI report exists to defend. */
  const avoidedHours = round(
    alerts.reduce((sum, alert) => sum + (alert.downtimeRiskHours ?? 0), 0),
  )

  return {
    sites: sites.length,
    siteNames: sites.map((node) => node.name),
    lines: lines.length,
    assets: assets.length,
    anomalies: alerts.length,
    criticalAnomalies: alerts.filter((alert) => alert.severity === 'critical').length,
    workOrders: orders.length,
    openWorkOrders: orders.filter(isOpenOrder).length,
    avoidedHours,
    /* The OEE the report leads on. Always the MONTH's published figure, for a
       quarterly report too: nothing in this product publishes a quarter, and
       inventing a third number no other screen would agree with is exactly the
       mistake the OEE module already records against the prototype. */
    oee: OEE_PERIOD_DATA.month.oee.value,
  }
}

/** How many pages that coverage comes to. Derived, never authored. */
export function pagesFor(report, coverage) {
  return (SECTIONS[report.kind] ?? []).reduce(
    (sum, section) => sum + section.pages * (section.perSite ? coverage.sites : 1),
    0,
  )
}

/**
 * The period a report covers, as a pair of dates.
 *
 * Computed backwards from when it was generated, so a report produced three
 * days ago covers LAST month rather than the one it was written in. `now` is a
 * parameter — §2.5.
 */
export function periodFor(report, now = Date.now()) {
  const generated = new Date(report.generatedAt ?? now - report.ageDays * 86_400_000)
  const end = new Date(generated.getFullYear(), generated.getMonth(), 1)
  const start = new Date(end)
  start.setMonth(start.getMonth() - (report.period === 'quarter' ? 3 : 1))
  // The last instant inside the period, not the first outside it: a report
  // labelled "1 Jul – 1 Aug" reads as covering a day it does not.
  const last = new Date(end.getTime() - 86_400_000)
  return { from: start.toISOString(), to: last.toISOString() }
}

/**
 * Whether a running report has finished.
 *
 * Time, not a flag. A report started forty-five seconds ago is ready; one
 * started ten seconds ago is 22% of the way there and says so.
 */
function progressOf(report, now) {
  if (!report.startedAt) return null
  const elapsed = (now - Date.parse(report.startedAt)) / 1000
  return Math.min(1, Math.max(0, elapsed / BUILD_SECONDS))
}

/**
 * One report, resolved.
 *
 * The title is composed from the kind, the scope and the period — so it cannot
 * name a month it does not cover, which the design's "Monthly Board Report —
 * May 2026" does on every day except the ones in June.
 */
export function composeReport(report, now = Date.now()) {
  const coverage = coverageFor(report)
  const progress = progressOf(report, now)
  const ready = progress == null || progress >= 1

  return {
    id: report.id,
    kind: report.kind,
    period: report.period,
    siteId: report.siteId ?? null,
    siteName: report.siteId ? sitesInScope(report)[0]?.name ?? null : null,
    ...periodFor(report, now),
    status: ready ? 'ready' : 'generating',
    // Only while it is running. A finished report has no progress, it has pages.
    progress: ready ? null : round(progress * 100, 0),
    generatedAt: report.startedAt
      ? ready
        ? new Date(Date.parse(report.startedAt) + BUILD_SECONDS * 1000).toISOString()
        : null
      : new Date(now - report.ageDays * 86_400_000).toISOString(),
    author: PEOPLE[report.authorRole]?.name ?? null,
    authorIsAi: !report.authorRole,
    /* Which library entry produced it, when one did. A report generated from
       R-011 is "Predictive Maintenance Effectiveness" on the shelf, not the
       generic name of the engine underneath it — the catalogue supplies the
       identity, the engine supplies the facts. */
    templateId: report.templateId ?? null,
    format: report.format ?? 'pdf',
    /* A build made through the builder is as long as the sections it was built
       from. One made before the library existed falls back to the engine's own
       fixed section list, so the shelf's older rows keep the page count they
       have always had rather than being silently restated. */
    pages: report.sections
      ? pagesForSelection(report.sections, coverage.sites)
      : pagesFor(report, coverage),
    sections: report.sections ?? (SECTIONS[report.kind] ?? []).map((section) => section.key),
    coverage,
    created: Boolean(report.startedAt),
  }
}

/**
 * Start one.
 *
 * It really is not ready. `startedAt` is now, the shelf answers `generating`
 * with a percentage, and forty-five seconds later the same request answers
 * `ready` with a page count. Nothing about that is stored as a flag.
 */
export function generateReport({ kind, templateId, period, siteId, sections, format }, authorRole, now = Date.now()) {
  /* A build may name a library template OR a bare engine kind. The template is
     authoritative when present: it decides the engine, so a client cannot pair
     R-040 with the OEE engine and get a safety report full of production
     figures. */
  const resolvedKind = templateId ? kindForTemplate(templateId) : kind
  if (templateId && !resolvedKind) return { error: 'unknownTemplate' }
  if (!REPORT_KINDS.includes(resolvedKind)) return { error: 'unknownKind' }
  if (!REPORT_PERIODS.includes(period)) return { error: 'unknownPeriod' }
  if (siteId && !currentSites().some((site) => site.id === siteId)) return { error: 'unknownSite' }
  if (format && !REPORT_FORMATS.includes(format)) return { error: 'unknownFormat' }

  /* An empty section list is a report with nothing in it. Rejected rather than
     silently defaulted: the builder disables its own submit for this, and a
     server that quietly substituted a default would make that guard a lie. */
  const chosen = Array.isArray(sections) && sections.length ? sections : DEFAULT_SECTIONS
  if (Array.isArray(sections) && !sections.length) return { error: 'noSections' }

  const report = {
    id: `RPT-${2100 + GENERATED.length}`,
    kind: resolvedKind,
    templateId: templateId ?? null,
    period,
    siteId: siteId || null,
    sections: chosen,
    format: format ?? 'pdf',
    ageDays: 0,
    authorRole,
    startedAt: new Date(now).toISOString(),
  }
  GENERATED.unshift(report)
  return { report: composeReport(report, now) }
}

/**
 * The shelf's rollup.
 *
 * `generating` is counted live off the clock rather than held, which is what
 * lets the client stop polling once it reaches zero.
 */
export function reportStats(rows) {
  return {
    reports: rows.length,
    ready: rows.filter((row) => row.status === 'ready').length,
    generating: rows.filter((row) => row.status === 'generating').length,
    pages: rows.filter((row) => row.status === 'ready').reduce((sum, row) => sum + row.pages, 0),
  }
}
