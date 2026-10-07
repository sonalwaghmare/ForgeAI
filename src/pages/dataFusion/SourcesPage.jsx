import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { PAGE_SIZES, TablePagination } from '@/components/forge/TablePagination'
import { Mono, Num } from '@/components/forge/primitives'
import { FUSION_STATUSES, useFusionSources } from '@/features/dataFusion/sources'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger, formatRelative } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { AddSourceWizard } from './AddSourceWizard'
import { ConnectionDrawer } from './ConnectionDrawer'

/**
 * One screen, four source families: OT & Historians, Vision Systems, ERP / MES /
 * CMMS, Databases & Cloud.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── Why one component and not four ────────────────────────────────────────
 * The design draws the same table four times. What differs between the families
 * is the *contract* — what each ingests, its config schema, its mapping columns,
 * its wizard steps — and none of that is on this screen; it is behind the drawer
 * and the wizard, which are the next two passes. Four copies of a table that
 * differ in one noun would be four places to fix the next column change.
 *
 * The noun does differ, and it is read from the category rather than hardcoded:
 * a historian counts tags, an ERP counts records, a TSDB counts series and a
 * vision system counts cameras.
 *
 * ── Every column here is answerable, unlike the IoT table ─────────────────
 * `IotSensorsPage` dropped Tags, Lag, Last sync and Status because the real
 * resource has none of them. That was the honest outcome there and it is not a
 * precedent for here: these four families are fixtures, the fixture carries all
 * four facts, and the status is derived from the last-sync clock rather than
 * authored beside it. When a real endpoint lands, whichever of these it cannot
 * answer goes the same way those four did.
 */

/** Filter sentinel. Radix rejects an item whose value is the empty string. */
const ALL = 'all'

/** Section id → the category the transport knows it by. */
const CATEGORY_OF = { ot: 'ot', vision: 'vision', business: 'biz', stores: 'db' }

/** What each family counts. Drives the column header and the header line. */
const UNIT_OF = { ot: 'tags', vision: 'cameras', business: 'records', stores: 'series' }

/**
 * The five statuses on the severity ladder.
 *
 * `syncing` takes Watch rather than a hue of its own: a sync in flight is
 * something to keep an eye on and not something wrong, which is exactly what
 * that step of the ladder means everywhere else in this product. `notConfigured`
 * takes no hue at all — a catalogue entry nobody filled in is not a state of
 * health, and colouring it would put it in a queue it does not belong in.
 */
const STATUS_TONE = {
  connected: 'green',
  syncing: 'watch',
  degraded: 'amber',
  disconnected: 'red',
  /* Stopped by a person from the pipeline monitor. No hue, for the same reason
     `notConfigured` has none: it is not a state of health, and colouring it
     would file it in the queue of faults to chase. */
  paused: null,
  notConfigured: null,
}

export function SourcesPage({ section }) {
  const { t, i18n } = useTranslation(['app', 'common'])

  const category = CATEGORY_OF[section] ?? null
  const unit = UNIT_OF[section] ?? 'tags'

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(ALL)
  const [site, setSite] = useState(ALL)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const sources = useFusionSources(category, { q: query.trim() || undefined, status, siteId: site })

  const title = t(`dataFusion.sections.${section}`)
  useDocumentTitle(`${title} · ${t('common:brand.name')}`)

  const rows = sources.data?.items ?? []
  const stats = sources.data?.stats ?? { total: 0, connected: 0, attention: 0, tags: 0 }
  const siteOptions = sources.data?.options?.sites ?? []

  // Clamped rather than reset: narrowing a filter while on page 2 should land on
  // the last page that still exists, not throw you back to the first.
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const isNarrowed = query.trim().length > 0 || status !== ALL || site !== ALL

  function clearFilters() {
    setQuery('')
    setStatus(ALL)
    setSite(ALL)
    setPage(1)
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 text-headline">{title}</h1>
          <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
            {t(`dataFusion.sectionIntros.${section}`)}
          </p>
        </div>
        {/* It earns its place now that it creates a row. What it makes appears in
            this table, counts on the overview, opens in the drawer, and says
            Disconnected · never synced — because it has not synced. */}
        <ForgeButton variant="primary" onClick={() => setConnecting(true)}>
          {t('dataFusion.newSource.open')}
        </ForgeButton>
      </header>

      {sources.isPending ? (
        <SkeletonRows count={4} />
      ) : sources.isError ? (
        <ErrorState
          error={sources.error}
          title={t('dataFusion.sources.loadFailed')}
          onRetry={sources.refetch}
        />
      ) : (
        <>
          {/* The three facts a reader wants before the table: how many sources,
              how many are healthy, and how much is arriving. Counted over the
              whole family rather than the filtered slice, so a filter narrows
              the table without appearing to disconnect anything. */}
          <p className="mt-0 mb-3.5 text-body-sm text-ink-dim">
            <Num>
              {t('dataFusion.sources.summary', {
                total: stats.total,
                connected: stats.connected,
                count: formatInteger(stats.tags),
                unit: t(`dataFusion.sources.unit.${unit}`),
              })}
            </Num>
            {stats.attention ? (
              <>
                {' · '}
                <span className="font-semibold text-on-amber">
                  <Num>{t('dataFusion.sources.attention', { count: stats.attention })}</Num>
                </span>
              </>
            ) : null}
          </p>

          <Panel flush className="mb-3.5 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <div className="flex min-w-[15rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge max-sm:w-full max-sm:flex-none">
                <Icon name="search" size="sm" className="text-ink-mute" />
                <label className="sr-only" htmlFor="fusion-source-search">
                  {t('dataFusion.sources.searchLabel')}
                </label>
                <input
                  id="fusion-source-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                  placeholder={t('dataFusion.sources.searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>

              <ForgeSelect
                id="fusion-source-status"
                labelHidden
                size="sm"
                label={t('dataFusion.sources.filterByStatus')}
                value={status}
                onValueChange={(next) => {
                  setStatus(next)
                  setPage(1)
                }}
                className="w-[12rem] shrink-0"
                options={[
                  { value: ALL, label: t('dataFusion.sources.allStatuses') },
                  ...FUSION_STATUSES.map((value) => ({
                    value,
                    label: t(`dataFusion.sources.status.${value}`),
                  })),
                ]}
              />

              {/* Only offered when more than one site holds a source in this
                  family. A select with one option is a control that cannot
                  change anything. */}
              {siteOptions.length > 1 ? (
                <ForgeSelect
                  id="fusion-source-site"
                  labelHidden
                  size="sm"
                  label={t('dataFusion.sources.filterBySite')}
                  value={site}
                  onValueChange={(next) => {
                    setSite(next)
                    setPage(1)
                  }}
                  className="w-[13rem] shrink-0"
                  options={[
                    { value: ALL, label: t('dataFusion.sources.allSites') },
                    ...siteOptions,
                  ]}
                />
              ) : null}

              <p className="m-0 ms-auto text-body-sm text-ink-dim">
                <Num>
                  {t('dataFusion.sources.matchCount', {
                    shown: formatInteger(rows.length),
                    total: formatInteger(stats.total),
                  })}
                </Num>
              </p>
            </div>
          </Panel>

          {rows.length ? (
            <Panel flush className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">
                    {t('dataFusion.sources.tableCaption', { family: title })}
                  </caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                      >
                        {t('dataFusion.sources.columns.source')}
                      </th>
                      <th
                        scope="col"
                        className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                      >
                        {t('dataFusion.sources.columns.protocol')}
                      </th>
                      <th
                        scope="col"
                        className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                      >
                        {t('dataFusion.sources.columns.endpoint')}
                      </th>
                      <th
                        scope="col"
                        className="eyebrow bg-sunken px-3.5 py-2.5 text-end whitespace-nowrap"
                      >
                        {t(`dataFusion.sources.unit.${unit}`)}
                      </th>
                      <th
                        scope="col"
                        className="eyebrow bg-sunken px-3.5 py-2.5 text-end whitespace-nowrap"
                      >
                        {t('dataFusion.sources.columns.lag')}
                      </th>
                      <th
                        scope="col"
                        className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                      >
                        {t('dataFusion.sources.columns.lastSync')}
                      </th>
                      <th
                        scope="col"
                        className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                      >
                        {t('dataFusion.sources.columns.status')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <tr key={row.id} className="border-t border-subtle hover:bg-sunken">
                        <td className="px-3.5 py-2.5">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            {/* The name is the control. A whole row wired to a
                                click is not reachable from a keyboard, and a
                                separate "Configure" link — which is what the
                                prototype adds — is a second target for the same
                                job. */}
                            <button
                              type="button"
                              onClick={() => setOpenId(row.id)}
                              className="text-start text-body-sm font-semibold text-ink transition-colors hover:text-on-forge"
                              translate="no"
                            >
                              {row.name}
                            </button>
                            {/* The site, or the fact that there is not one. An
                                enterprise system genuinely has no plant, and a
                                blank cell here would read as missing data. */}
                            <span className="text-micro font-normal text-ink-dim">
                              {row.siteName ?? t('dataFusion.sources.enterprise')}
                            </span>
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <Mono className="text-body-sm text-ink-dim">{row.protocol}</Mono>
                        </td>
                        <td className="px-3.5 py-2.5">
                          {row.endpoint ? (
                            <Mono className="text-body-sm text-ink-dim">{row.endpoint}</Mono>
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-end">
                          {row.tags ? (
                            <Num className="text-body-sm">{formatInteger(row.tags)}</Num>
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-end">
                          {row.latencyMs == null ? (
                            <Dash />
                          ) : (
                            <Num className="text-body-sm text-ink-dim">
                              {t('dataFusion.sources.latency', {
                                seconds: (row.latencyMs / 1000).toFixed(2),
                              })}
                            </Num>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          {row.lastSyncAt ? (
                            <time dateTime={row.lastSyncAt}>
                              {formatRelative(new Date(row.lastSyncAt), i18n.language)}
                            </time>
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <StatusPill status={row.status} error={row.error} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                total={rows.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                label={t('dataFusion.sources.rowNoun')}
              />
            </Panel>
          ) : (
            <EmptyState
              icon="search"
              title={t('dataFusion.sources.noMatch')}
              body={t('dataFusion.sources.noMatchBody')}
              action={
                isNarrowed ? (
                  <ForgeButton onClick={clearFilters}>
                    {t('common:actions.clearFilters')}
                  </ForgeButton>
                ) : null
              }
            />
          )}
        </>
      )}

      <ConnectionDrawer id={openId} onClose={() => setOpenId(null)} />
      <AddSourceWizard
        open={connecting}
        section={section}
        category={category}
        onClose={() => setConnecting(false)}
      />
    </div>
  )
}

/**
 * The status, and the reason under it when there is one.
 *
 * A disconnected source that does not say why is a row somebody has to open a
 * drawer to act on. The reason is a key rather than a message so it translates,
 * which is also what stops it becoming a place for a server string to leak into
 * the UI untranslated.
 */
export function StatusPill({ status, error }) {
  const { t } = useTranslation('app')
  const tone = STATUS_TONE[status]

  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn(
          'inline-flex w-fit items-center rounded-pill px-2.5 py-[3px] text-micro whitespace-nowrap',
          tone ? cn(TINT_CLASS[tone], ON_TINT_CLASS[tone]) : 'bg-sunken text-ink-dim',
        )}
      >
        {t(`dataFusion.sources.status.${status}`)}
      </span>
      {error ? (
        <span className="text-micro font-normal text-ink-dim">
          {t(`dataFusion.sources.error.${error}`)}
        </span>
      ) : null}
    </span>
  )
}

/** A value the source does not report. Never an empty cell — a blank reads as a bug. */
function Dash() {
  return <span className="text-ink-mute">—</span>
}
