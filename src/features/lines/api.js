import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Lines & Assets.
 *
 * DEMO. Fixture-backed today; see `src/mocks/fixtures/lines.js`, which explains
 * why the plant's shape is read from the hierarchy rather than restated.
 *
 * ── Line states ───────────────────────────────────────────────────────────
 * A closed set, and worth writing down because two of them look alike and are
 * not: `stopped` is a line that should be making product and is not, `idle` is a
 * line nobody scheduled. Only the first is a fault, and only the first should
 * ever wear a fault colour.
 */
export const LINE_STATES = ['running', 'stopped', 'idle']

/**
 * Every line at a site, each with its assets already attached.
 *
 * One request, not one per line. The row expands into its assets in place and
 * the whole set is six lines and thirty assets — fetching on expand would be six
 * round trips to render a screen whose content was already known, and it would
 * make the accordion feel like a page load.
 */
export async function fetchLines(siteId, signal) {
  const body = await get(endpoints.productionLines.list, { params: { siteId }, signal })
  return {
    items: body?.items ?? [],
    total: body?.total ?? 0,
    siteId: body?.siteId ?? siteId ?? null,
    siteName: body?.siteName ?? null,
    sensorCount: body?.sensorCount ?? 0,
  }
}

/** One line: its assets in flow order, its throughput trace, its open alerts. */
export async function fetchLine(lineId, signal) {
  const body = await get(endpoints.productionLines.detail(lineId), { signal })
  return {
    ...body,
    assets: body?.assets ?? [],
    throughput: body?.throughput ?? [],
    openAlerts: body?.openAlerts ?? [],
  }
}

/**
 * One asset, with its component tree if it has one.
 *
 * `components` is empty for most of the plant and that is the truth rather than
 * a gap to paper over: two machines are modelled to component depth, and the
 * screen says so for the rest instead of inventing a bill of materials.
 */
export async function fetchAsset(assetId, signal) {
  const body = await get(endpoints.assets.detail(assetId), { signal })
  return {
    ...body,
    components: body?.components ?? [],
    openAlerts: body?.openAlerts ?? [],
  }
}

/** The windows the asset OEE trend offers, in chip order. Mirrors the fixture. */
export const TREND_WINDOWS = ['live', '4h', '8h', '12h', '24h']

/** The quick filters over the asset collection, in the order the chips appear. */
export const ASSET_QUICK_FILTERS = ['all', 'critical', 'alerts', 'offline']

/** How the asset table can be ordered. */
export const ASSET_SORTS = ['name', 'line', 'health', 'alerts']

/**
 * Every asset at a site, filtered and paged.
 *
 * `facets`, `options` and `stats` ride along with the collection: the chips
 * need counts, the drawer needs its option sets, and the stat bar needs the
 * whole-site totals. Three more requests to render one screen would be three
 * more chances for the header and the rows to disagree about what is in front
 * of the reader.
 */
export async function fetchAssets(params, signal) {
  const body = await get(endpoints.assets.list, { params, signal })
  return {
    items: body?.items ?? [],
    total: body?.total ?? 0,
    page: body?.page ?? 1,
    pageSize: body?.pageSize ?? 25,
    facets: body?.facets ?? {},
    options: body?.options ?? { types: [], owners: [], tags: [], lines: [], criticalities: [] },
    stats: body?.stats ?? null,
  }
}

/** Attach a document to an asset's register. */
export const uploadAssetDocument = (assetId, document) =>
  post(endpoints.assets.documents(assetId), document)

/**
 * The eight document types the uploader offers, in its own order.
 *
 * Here rather than in the fixture: the modal and the register's filters both
 * read it, and a page reaching into `mocks/` would bundle the demo layer into
 * the production build. The fixture imports it from here, which is the direction
 * the dependency should run.
 */
export const DOCUMENT_KINDS = [
  'manual',
  'sop',
  'drawing',
  'datasheet',
  'certificate',
  'policy',
  'report',
  'layout',
]

/** Where a document can be attached, narrowest first. */
export const DOCUMENT_SCOPES = ['asset', 'model', 'site', 'enterprise']
