import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Analytics & Reports — the generated-report shelf.
 *
 * DEMO. See `DEMO-MODE.md` §8.9.
 */

/** The kinds the Generate dialog offers. */
export const REPORT_KINDS = ['board', 'riskReview', 'oeeSummary', 'maintenanceRoi']

export const REPORT_PERIODS = ['month', 'quarter']

const toReport = (row) => ({
  id: row.id,
  kind: row.kind,
  period: row.period,
  siteId: row.siteId ?? null,
  siteName: row.siteName ?? null,
  from: row.from,
  to: row.to,
  status: row.status,
  /* Only while it is building. A finished report has no progress, it has
     pages — so the card cannot show a bar beside a Download button. */
  progress: row.progress ?? null,
  generatedAt: row.generatedAt ?? null,
  author: row.author ?? null,
  pages: row.pages ?? 0,
  sections: row.sections ?? [],
  /* What the report is about, counted off the same fixtures the anomaly list
     and the work-order board read. A board report cannot claim a different
     number of open anomalies than the screen behind it shows. */
  coverage: row.coverage ?? null,
  created: Boolean(row.created),
})

export async function fetchReports(signal) {
  const data = await get(endpoints.reports.list, { signal })
  return {
    items: (data?.items ?? []).map(toReport),
    total: data?.total ?? 0,
    stats: data?.stats ?? null,
    options: data?.options ?? { kinds: REPORT_KINDS, periods: REPORT_PERIODS, sites: [] },
  }
}

/**
 * Start one.
 *
 * It answers immediately with a report that is genuinely not ready — the shelf
 * then reports its progress until enough time has passed. The author is stamped
 * server-side, as everywhere else.
 */
export const generateReport = ({ templateId, kind, period, siteId, sections, format }) =>
  post(endpoints.reports.list, {
    templateId: templateId ?? null,
    kind,
    period,
    siteId: siteId || null,
    sections,
    format,
  })

/**
 * The standard-report catalogue.
 *
 * Templates, the taxonomy that files them, the sections a build assembles from,
 * the formats it can be delivered in, and the standing schedule. Fetched once —
 * it is a specification, not state, and nothing on this screen mutates it.
 */
export async function fetchReportLibrary(signal) {
  const data = await get(endpoints.reports.library, { signal })
  return {
    templates: data?.templates ?? [],
    categories: data?.categories ?? [],
    personas: data?.personas ?? [],
    cadences: data?.cadences ?? [],
    sections: data?.sections ?? [],
    formats: data?.formats ?? [],
    defaultSections: data?.defaultSections ?? [],
    schedules: data?.schedules ?? [],
    sites: data?.sites ?? [],
    stats: data?.stats ?? { templates: 0, categories: 0, scheduled: 0 },
  }
}
