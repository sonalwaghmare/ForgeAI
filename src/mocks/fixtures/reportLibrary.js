import { currentSites } from './enterprise'

/**
 * Analytics & Reports — the STANDARD REPORT LIBRARY.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 * See `DEMO-MODE.md` §8.9.
 *
 * ── What changed, and why this file exists ────────────────────────────────
 * The design's Reports module used to be a shelf of four generated cards. It is
 * now a LIBRARY: thirty-four reports a manufacturing plant is actually expected
 * to produce, each one named against the standard that defines it — ISO 22400
 * for productivity, ISO 14224 for reliability taxonomy, ISO 50001 for energy,
 * ISO 45001 and OSHA for safety, Nakajima's TPM losses, SMRP's maintenance
 * metrics, AIAG SPC for capability. Plus a builder that assembles one, and a
 * schedule that delivers it.
 *
 * ── Why a template carries a `kind` ───────────────────────────────────────
 * Thirty-four templates do not mean thirty-four generation engines. Each one
 * declares which of the four real engines in `fixtures/reports.js` produces it,
 * so a report generated from the library still gets its coverage counted off
 * the plant — the same sites, machines, anomalies and work orders every other
 * screen reads — rather than acquiring a decorative page count the moment the
 * catalogue grew. The template supplies the identity; the engine supplies the
 * facts.
 *
 * ── Personas are a filter, not a permission ───────────────────────────────
 * `personas` says who a report is FOR, which is how somebody finds theirs in a
 * list of thirty-four. It is not access control: what a person may read is
 * decided by their role on the server, and nothing here is consulted for that.
 */

/** Who a report is written for. The library's primary filter. */
export const REPORT_PERSONAS = ['exec', 'plant', 'prod', 'maint', 'qa', 'ehs', 'eng', 'fin']

/** Subject areas. Each carries a hue token name, never a literal. */
export const REPORT_CATEGORIES = [
  { id: 'oee', tone: 'forge' },
  { id: 'reliability', tone: 'amber' },
  { id: 'quality', tone: 'green' },
  { id: 'energy', tone: 'watch' },
  { id: 'safety', tone: 'red' },
  { id: 'cost', tone: 'violet' },
  { id: 'production', tone: 'line' },
  { id: 'inventory', tone: 'ack' },
]

/** How often a report is normally run. Drives the frequency filter. */
export const REPORT_CADENCES = ['shift', 'daily', 'weekly', 'monthly', 'quarterly', 'onDemand']

/** The output formats the builder offers. */
export const REPORT_FORMATS = ['pdf', 'xlsx', 'pptx', 'csv']

/**
 * The sections a report can be assembled from.
 *
 * `ai` marks the three the platform WRITES rather than tabulates — the summary,
 * the insight and the recommended actions. The builder badges those, because a
 * reader has to be able to tell which paragraphs came out of a model and which
 * came out of a counter. That distinction is the product's whole posture and it
 * cannot be left to the reader to guess.
 */
export const REPORT_SECTIONS = [
  { id: 'summary', ai: true, pages: 1 },
  { id: 'scorecard', ai: false, pages: 1 },
  { id: 'trend', ai: false, pages: 2 },
  { id: 'pareto', ai: false, pages: 1 },
  { id: 'detail', ai: false, pages: 3 },
  { id: 'compare', ai: false, pages: 1 },
  { id: 'breakdown', ai: false, pages: 2, perSite: true },
  { id: 'insight', ai: true, pages: 1 },
  { id: 'actions', ai: true, pages: 1 },
  { id: 'appendix', ai: false, pages: 2 },
]

/** The sections a new build starts with. The rest are opt-in. */
export const DEFAULT_SECTIONS = ['summary', 'scorecard', 'trend', 'pareto', 'insight', 'actions']

/**
 * The library.
 *
 * `id` is the catalogue number a plant refers the report by — R-001 is the OEE
 * summary in every conversation, so it is the identifier here too. `standard`
 * is the specification the report is written against, `kind` the engine that
 * produces it, `popular` whether it is one most sites actually run.
 */
export const REPORT_TEMPLATES = [
  // ── OEE & productivity ──────────────────────────────────────────────
  { id: 'R-001', category: 'oee', kind: 'oeeSummary', standard: 'ISO 22400', personas: ['exec', 'plant', 'prod'], cadence: ['daily', 'weekly', 'monthly'], popular: true,
    kpis: ['oee', 'availability', 'performance', 'quality', 'teep'], sources: ['mes', 'downtime'] },
  { id: 'R-002', category: 'oee', kind: 'oeeSummary', standard: 'Nakajima TPM', personas: ['plant', 'prod', 'eng'], cadence: ['weekly', 'monthly'], popular: true,
    kpis: ['lossHours', 'lossCost', 'lossShare', 'paretoRank'], sources: ['downtime', 'costModel'] },
  { id: 'R-003', category: 'oee', kind: 'oeeSummary', standard: 'ISO 22400', personas: ['plant', 'prod'], cadence: ['weekly'],
    kpis: ['oeeByLine', 'throughput', 'changeover'], sources: ['mes', 'shifts'] },
  { id: 'R-004', category: 'oee', kind: 'oeeSummary', standard: 'internal', personas: ['plant', 'prod'], cadence: ['shift', 'weekly'],
    kpis: ['oeeByShift', 'attainment', 'crewVariance'], sources: ['shifts', 'mes'] },
  { id: 'R-005', category: 'oee', kind: 'oeeSummary', standard: 'ISO 22400', personas: ['prod', 'eng'], cadence: ['daily', 'weekly'],
    kpis: ['cycleTime', 'takt', 'bottleneck'], sources: ['plc', 'lineModel'] },

  // ── Reliability & maintenance ───────────────────────────────────────
  { id: 'R-010', category: 'reliability', kind: 'maintenanceRoi', standard: 'ISO 14224', personas: ['maint', 'plant'], cadence: ['monthly', 'quarterly'], popular: true,
    kpis: ['mtbf', 'mttr', 'availability', 'failureRate'], sources: ['workOrders', 'failureHistory'] },
  { id: 'R-011', category: 'reliability', kind: 'maintenanceRoi', standard: 'SMRP 5.4', personas: ['maint', 'exec'], cadence: ['monthly'], popular: true,
    kpis: ['catchRate', 'falsePositives', 'avoidedHours', 'avoidedCost'], sources: ['anomalyEngine', 'workOrders'] },
  { id: 'R-012', category: 'reliability', kind: 'maintenanceRoi', standard: 'SMRP 3.2', personas: ['maint', 'plant'], cadence: ['weekly'],
    kpis: ['pmCompliance', 'backlogWeeks', 'scheduleAttainment'], sources: ['cmms', 'workOrders'] },
  { id: 'R-013', category: 'reliability', kind: 'maintenanceRoi', standard: 'SMRP 5.1', personas: ['maint', 'exec'], cadence: ['monthly'],
    kpis: ['plannedShare', 'reactiveShare', 'wrenchTime'], sources: ['workOrders', 'labour'] },
  { id: 'R-014', category: 'reliability', kind: 'riskReview', standard: 'IEC 62740', personas: ['maint', 'eng'], cadence: ['monthly'],
    kpis: ['rcasClosed', 'recurrence', 'actionEffectiveness'], sources: ['rca', 'anomalies'] },

  // ── Inventory & spares ──────────────────────────────────────────────
  { id: 'R-015', category: 'inventory', kind: 'maintenanceRoi', standard: 'ISO 55000', personas: ['maint', 'fin'], cadence: ['monthly'],
    kpis: ['turns', 'stockOuts', 'carryingCost'], sources: ['inventory', 'workOrders'] },
  { id: 'R-016', category: 'inventory', kind: 'maintenanceRoi', standard: 'ISO 55000', personas: ['maint', 'fin'], cadence: ['quarterly'],
    kpis: ['criticalCoverage', 'leadTime', 'obsolescence'], sources: ['inventory', 'assetRegistry'] },

  // ── Quality & compliance ────────────────────────────────────────────
  { id: 'R-020', category: 'quality', kind: 'oeeSummary', standard: 'ISO 9001 / IATF 16949', personas: ['qa', 'plant', 'prod'], cadence: ['daily', 'weekly'], popular: true,
    kpis: ['fpy', 'scrapRate', 'reworkRate', 'copq'], sources: ['vision', 'mes'] },
  { id: 'R-021', category: 'quality', kind: 'oeeSummary', standard: 'ISO 7870 / AIAG SPC', personas: ['qa', 'eng'], cadence: ['weekly'],
    kpis: ['cp', 'cpk', 'ppk', 'oocEvents'], sources: ['gauge', 'sensors'] },
  { id: 'R-022', category: 'quality', kind: 'oeeSummary', standard: 'ISO 9001', personas: ['qa', 'prod'], cadence: ['weekly', 'monthly'],
    kpis: ['topDefects', 'defectRate', 'costPerDefect'], sources: ['quality'] },
  { id: 'R-023', category: 'quality', kind: 'riskReview', standard: 'ISO 9001 §10.2', personas: ['qa', 'exec'], cadence: ['monthly'],
    kpis: ['complaints', 'capaOpen', 'closureDays'], sources: ['crm', 'qms'] },
  { id: 'R-024', category: 'quality', kind: 'riskReview', standard: 'ISO 9001 / FSSC 22000', personas: ['qa', 'ehs'], cadence: ['quarterly'],
    kpis: ['openNcs', 'overdueActions', 'docCompliance'], sources: ['qms', 'audit'] },

  // ── Energy & sustainability ─────────────────────────────────────────
  { id: 'R-030', category: 'energy', kind: 'oeeSummary', standard: 'ISO 50001', personas: ['eng', 'exec', 'fin'], cadence: ['monthly'], popular: true,
    kpis: ['kwh', 'intensity', 'peakDemand', 'costPerKwh'], sources: ['meters', 'mes'] },
  { id: 'R-031', category: 'energy', kind: 'board', standard: 'GHG Protocol / ISO 14064', personas: ['exec', 'ehs'], cadence: ['quarterly'],
    kpis: ['co2e', 'intensity', 'vsTarget'], sources: ['meters', 'fuel'] },
  { id: 'R-032', category: 'energy', kind: 'oeeSummary', standard: 'ISO 50001', personas: ['eng', 'maint'], cadence: ['monthly'],
    kpis: ['specificPower', 'leakRate', 'pressureBand'], sources: ['meters', 'sensors'] },

  // ── Safety & EHS ────────────────────────────────────────────────────
  { id: 'R-040', category: 'safety', kind: 'riskReview', standard: 'OSHA / ISO 45001', personas: ['ehs', 'exec', 'plant'], cadence: ['monthly'], popular: true,
    kpis: ['trir', 'ltifr', 'nearMiss', 'ltiFreeDays'], sources: ['incidents', 'hrHours'] },
  { id: 'R-041', category: 'safety', kind: 'riskReview', standard: 'API RP 584', personas: ['ehs', 'eng'], cadence: ['monthly'],
    kpis: ['iowBreaches', 'timeOutside', 'responseTime'], sources: ['sensors', 'iowLimits'] },
  { id: 'R-042', category: 'safety', kind: 'riskReview', standard: 'ISO 45001', personas: ['ehs', 'maint'], cadence: ['monthly'],
    kpis: ['permits', 'overdue', 'lotoEvents'], sources: ['ehs', 'shifts'] },
  { id: 'R-043', category: 'safety', kind: 'riskReview', standard: 'ISO 45001 §9.1', personas: ['ehs', 'plant'], cadence: ['monthly'],
    kpis: ['reports', 'closureDays', 'repeatSites'], sources: ['logbook', 'ehs'] },

  // ── Cost & financial ────────────────────────────────────────────────
  { id: 'R-050', category: 'cost', kind: 'maintenanceRoi', standard: 'SMRP', personas: ['fin', 'exec', 'plant'], cadence: ['monthly'], popular: true,
    kpis: ['downtimeCost', 'costPerHour', 'avoidedCost'], sources: ['downtime', 'finance'] },
  { id: 'R-051', category: 'cost', kind: 'board', standard: 'internal', personas: ['fin', 'exec'], cadence: ['monthly'],
    kpis: ['costPerUnit', 'variance', 'contributionMargin'], sources: ['erp', 'mes'] },
  { id: 'R-052', category: 'cost', kind: 'maintenanceRoi', standard: 'SMRP 1.4', personas: ['fin', 'maint'], cadence: ['monthly'],
    kpis: ['spendVsBudget', 'shareOfRav', 'costPerAsset'], sources: ['erp', 'workOrders'] },
  { id: 'R-053', category: 'cost', kind: 'maintenanceRoi', standard: 'internal', personas: ['exec', 'fin'], cadence: ['quarterly'], popular: true,
    kpis: ['roi', 'payback', 'npv', 'netBenefit'], sources: ['valueModel', 'finance'] },
  { id: 'R-054', category: 'cost', kind: 'board', standard: 'internal', personas: ['exec', 'fin'], cadence: ['quarterly'], popular: true,
    kpis: ['oee', 'downtimeCost', 'riskExposure', 'attainment'], sources: ['mes', 'finance', 'riskRegister'] },

  // ── Production & planning ───────────────────────────────────────────
  { id: 'R-060', category: 'production', kind: 'oeeSummary', standard: 'ISO 22400', personas: ['prod', 'plant', 'exec'], cadence: ['daily', 'weekly'], popular: true,
    kpis: ['attainment', 'adherence', 'backlog'], sources: ['erpOrders', 'mes'] },
  { id: 'R-061', category: 'production', kind: 'oeeSummary', standard: 'SMED', personas: ['prod', 'eng'], cadence: ['weekly'],
    kpis: ['changeover', 'frequency', 'bestTime'], sources: ['shifts', 'mes'] },
  { id: 'R-062', category: 'production', kind: 'riskReview', standard: 'ISO 22005 / 21 CFR 11', personas: ['qa', 'prod'], cadence: ['onDemand'],
    kpis: ['traceCompleteness', 'holdStatus'], sources: ['mes', 'erp', 'lab'] },
  { id: 'R-063', category: 'production', kind: 'oeeSummary', standard: 'ISO 22400', personas: ['plant', 'exec'], cadence: ['monthly'],
    kpis: ['utilisation', 'headroom', 'constraint'], sources: ['mes', 'lineModel'] },
  { id: 'R-064', category: 'production', kind: 'riskReview', standard: 'internal', personas: ['prod', 'plant'], cadence: ['shift', 'daily'],
    kpis: ['carryover', 'openAlerts', 'pendingActions'], sources: ['shifts', 'logbook', 'anomalies'] },
]

const template = (id) => REPORT_TEMPLATES.find((entry) => entry.id === id) ?? null

/**
 * How long a build of this shape comes to.
 *
 * Derived from the sections chosen and the sites in scope, exactly as the
 * shelf's page count is — so the builder's preview and the card it produces
 * cannot disagree. A per-site section repeats.
 */
export function pagesForSelection(sectionIds, siteCount) {
  return REPORT_SECTIONS.filter((section) => sectionIds.includes(section.id)).reduce(
    (sum, section) => sum + section.pages * (section.perSite ? Math.max(1, siteCount) : 1),
    0,
  )
}

/**
 * Scheduled deliveries.
 *
 * Authored: which template, how often, to whom, in what format. The NEXT RUN is
 * not authored — it is computed off the cadence and the clock in `composeSchedule`,
 * because a schedule whose next run is a fixed string is a schedule that has
 * already passed.
 */
export const REPORT_SCHEDULES = [
  { id: 'SCH-01', templateId: 'R-001', cadence: 'daily', atHour: 6, audience: 'plantLeadership', recipients: 6, formats: ['pdf', 'xlsx'], active: true },
  { id: 'SCH-02', templateId: 'R-011', cadence: 'monthly', atHour: 6, audience: 'maintenance', recipients: 4, formats: ['pdf'], active: true },
  { id: 'SCH-03', templateId: 'R-040', cadence: 'monthly', atHour: 7, audience: 'ehsExec', recipients: 9, formats: ['pdf'], active: true },
  { id: 'SCH-04', templateId: 'R-053', cadence: 'quarterly', atHour: 6, audience: 'board', recipients: 5, formats: ['pdf'], active: true },
  { id: 'SCH-05', templateId: 'R-002', cadence: 'weekly', atHour: 6, audience: 'production', recipients: 8, formats: ['xlsx'], active: false },
]

/** When this schedule fires next. Computed, never stored — §2.5. */
function nextRunAt(schedule, now) {
  const next = new Date(now)
  next.setHours(schedule.atHour, 0, 0, 0)
  if (next.getTime() <= now) next.setDate(next.getDate() + 1)

  if (schedule.cadence === 'weekly') {
    // Monday, the day a weekly operations report is read.
    while (next.getDay() !== 1) next.setDate(next.getDate() + 1)
  } else if (schedule.cadence === 'monthly') {
    next.setDate(1)
    if (next.getTime() <= now) next.setMonth(next.getMonth() + 1)
  } else if (schedule.cadence === 'quarterly') {
    next.setDate(1)
    // The first day of the next quarter.
    next.setMonth(Math.floor(next.getMonth() / 3) * 3 + 3)
  }
  return next.toISOString()
}

export function composeSchedule(schedule, now = Date.now()) {
  return {
    id: schedule.id,
    templateId: schedule.templateId,
    kind: template(schedule.templateId)?.kind ?? null,
    cadence: schedule.cadence,
    atHour: schedule.atHour,
    audience: schedule.audience,
    recipients: schedule.recipients,
    formats: schedule.formats,
    // Paused schedules have no next run. Printing one for a schedule that will
    // not fire is the single most misleading thing this table could do.
    nextRunAt: schedule.active ? nextRunAt(schedule, now) : null,
    status: schedule.active ? 'active' : 'paused',
  }
}

/**
 * The library, resolved for the wire.
 *
 * The site count travels with it so the builder can price a scope without a
 * second request — it is the only input the page-count formula needs that the
 * client does not already hold.
 */
export function reportLibrary(now = Date.now()) {
  const sites = currentSites()
  return {
    templates: REPORT_TEMPLATES.map((entry) => ({
      ...entry,
      popular: Boolean(entry.popular),
      // The catalogue's own estimate at default scope and default sections, so
      // a card can say how long the report runs before anybody configures it.
      pages: pagesForSelection(DEFAULT_SECTIONS, sites.length),
    })),
    categories: REPORT_CATEGORIES,
    personas: REPORT_PERSONAS,
    cadences: REPORT_CADENCES,
    sections: REPORT_SECTIONS,
    formats: REPORT_FORMATS,
    defaultSections: DEFAULT_SECTIONS,
    schedules: REPORT_SCHEDULES.map((entry) => composeSchedule(entry, now)),
    sites,
    stats: {
      templates: REPORT_TEMPLATES.length,
      categories: REPORT_CATEGORIES.length,
      scheduled: REPORT_SCHEDULES.filter((entry) => entry.active).length,
    },
  }
}

/** The engine a library template is produced by. Used to validate a build. */
export const kindForTemplate = (id) => template(id)?.kind ?? null
