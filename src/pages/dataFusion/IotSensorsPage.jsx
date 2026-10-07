import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { PlainBadge } from '@/components/forge/StatusBadge'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { PAGE_SIZES, TablePagination } from '@/components/forge/TablePagination'
import { Mono, Num } from '@/components/forge/primitives'
import { useConnections, useConnectorTypes } from '@/features/dataFusion/queries'
import { useHierarchyNodes } from '@/features/hierarchy/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger } from '@/lib/format'
import { ConnectSourceWizard } from './ConnectSourceWizard'
import { DeleteConnectionDialog, EditConnectionDialog } from './ConnectionDialogs'
import { connectionPath } from './sections'

/**
 * IoT · Edge / Sensor Gateways — the account's connections, live.
 *
 * ── Four columns went away, and that is the honest outcome ────────────────
 * This table used to show Tags, Lag, Last sync and Status out of a hardcoded
 * constant. `ConnectionOut` returns `{id, name, plant_id, connector_type_id,
 * is_active}`, and there is no last-seen, no message rate, no lag and no tag count
 * anywhere in the resource. Rather than four columns of em dashes — or four
 * invented numbers an operator might act on — they are gone until the API has
 * something to put in them.
 *
 * What replaced them is real: the connector's own name and protocol family
 * resolved from the catalogue, and the site resolved from the hierarchy. Both are
 * joins the client has to perform, because the list carries ids only.
 *
 * So this screen reports how a connection is CONFIGURED and never whether it is
 * working. That is a gap in the resource rather than in the screen, and
 * "live · 0.1 s · 2,838 tags" beside a broker nobody has measured is the same
 * defect as a fabricated OEE.
 *
 * ── Three requests, all three required ───────────────────────────────────
 * Connections, connector types, hierarchy. A row cannot be read correctly without
 * all three — no catalogue means every protocol cell is blank, no hierarchy means
 * every site is a UUID — so one error state covers them rather than the table
 * degrading into a grid of gaps.
 */

/** Filter sentinel. Radix rejects an item whose value is the empty string. */
const ALL = 'all'

const STATES = ['active', 'inactive']

export function IotSensorsPage() {
  const { t, i18n } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('dataFusion.iot.title')} · ${t('common:brand.name')}`)

  const connections = useConnections()
  const connectorTypes = useConnectorTypes()
  const hierarchy = useHierarchyNodes()

  const [query, setQuery] = useState('')
  const [state, setState] = useState(ALL)
  const [site, setSite] = useState(ALL)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [connecting, setConnecting] = useState(false)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)

  const typeById = useMemo(
    () => new Map((connectorTypes.data?.items ?? []).map((type) => [type.id, type])),
    [connectorTypes.data],
  )

  const siteById = useMemo(
    () =>
      new Map(
        (hierarchy.data?.items ?? [])
          .filter((node) => node.tier === 'site')
          .map((node) => [node.id, node]),
      ),
    [hierarchy.data],
  )

  /** Rows decorated once with everything the table, the filters and the search read. */
  const rows = useMemo(() => {
    const decorated = (connections.data?.items ?? []).map((connection) => ({
      connection,
      type: typeById.get(connection.connectorTypeId) ?? null,
      site: siteById.get(connection.plantId) ?? null,
    }))
    // Sorted by the reader's locale rather than code-unit order, so an umlaut
    // lands where that language puts it.
    return decorated.sort((a, b) =>
      a.connection.name.localeCompare(b.connection.name, i18n.language),
    )
  }, [connections.data, typeById, siteById, i18n.language])

  const siteOptions = useMemo(() => {
    // Only sites that actually hold a connection. A filter offering twelve plants
    // when eleven of them return nothing is a filter that wastes clicks.
    const present = new Map()
    for (const row of rows) if (row.site) present.set(row.site.id, row.site.name)
    return [...present].map(([value, label]) => ({ value, label }))
  }, [rows])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (state !== ALL && (row.connection.isActive ? 'active' : 'inactive') !== state) return false
      if (site !== ALL && row.connection.plantId !== site) return false
      if (!needle) return true
      // Everything visible on the row, including the two resolved joins — a search
      // that ignores the column you are looking at reads as broken.
      return [row.connection.name, row.type?.name ?? '', row.type?.protocolFamily ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [rows, query, state, site])

  // Clamped rather than reset: narrowing a filter while on page 3 should land on
  // the last page that still exists, not throw you back to the first.
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const activeCount = rows.filter((row) => row.connection.isActive).length
  const isNarrowed = query.trim().length > 0 || state !== ALL || site !== ALL

  const isPending = connections.isPending || connectorTypes.isPending || hierarchy.isPending
  const isError = connections.isError || connectorTypes.isError || hierarchy.isError
  const error = connections.error ?? connectorTypes.error ?? hierarchy.error

  function retry() {
    connections.refetch()
    connectorTypes.refetch()
    hierarchy.refetch()
  }

  function clearFilters() {
    setQuery('')
    setState(ALL)
    setSite(ALL)
    setPage(1)
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 text-headline">{t('dataFusion.iot.title')}</h1>
          <p className="mt-2 mb-0 text-body-sm text-ink-dim">
            {isPending || isError ? (
              t('dataFusion.iot.subtitle')
            ) : (
              <Num>
                {t('dataFusion.iot.summary', { sources: rows.length, active: activeCount })}
              </Num>
            )}
          </p>
        </div>
        <ForgeButton variant="primary" onClick={() => setConnecting(true)}>
          {t('dataFusion.iot.connectSource')}
        </ForgeButton>
      </header>

      {isPending ? (
        <SkeletonRows count={4} />
      ) : isError ? (
        <ErrorState error={error} title={t('dataFusion.iot.loadFailed')} onRetry={retry} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="plug"
          title={t('dataFusion.iot.empty')}
          body={t('dataFusion.iot.emptyBody')}
          action={
            <ForgeButton variant="primary" onClick={() => setConnecting(true)}>
              {t('dataFusion.iot.connectSource')}
            </ForgeButton>
          }
        />
      ) : (
        <>
          <Panel flush className="mb-3.5 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <div className="flex min-w-[15rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge max-sm:w-full max-sm:flex-none">
                <Icon name="search" size="sm" className="text-ink-mute" />
                <label className="sr-only" htmlFor="source-search">
                  {t('dataFusion.iot.searchLabel')}
                </label>
                <input
                  id="source-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                  placeholder={t('dataFusion.iot.searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>

              <ForgeSelect
                id="source-state"
                labelHidden
                size="sm"
                label={t('dataFusion.iot.filterByState')}
                value={state}
                onValueChange={(next) => {
                  setState(next)
                  setPage(1)
                }}
                className="w-[11rem] shrink-0"
                options={[
                  { value: ALL, label: t('dataFusion.iot.allStates') },
                  ...STATES.map((value) => ({ value, label: t(`dataFusion.iot.state.${value}`) })),
                ]}
              />

              <ForgeSelect
                id="source-site"
                labelHidden
                size="sm"
                label={t('dataFusion.iot.filterBySite')}
                value={site}
                onValueChange={(next) => {
                  setSite(next)
                  setPage(1)
                }}
                className="w-[12rem] shrink-0"
                options={[{ value: ALL, label: t('dataFusion.iot.allSites') }, ...siteOptions]}
              />

              <p className="m-0 ms-auto text-body-sm text-ink-dim">
                <Num>
                  {t('dataFusion.iot.matchCount', {
                    shown: formatInteger(filtered.length),
                    total: formatInteger(rows.length),
                  })}
                </Num>
              </p>
            </div>
          </Panel>

          {filtered.length ? (
            <Panel flush className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t('dataFusion.iot.tableCaption')}</caption>
                  <thead>
                    <tr>
                      {['source', 'connector', 'protocol', 'site', 'state'].map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                        >
                          {t(`dataFusion.iot.columns.${column}`)}
                        </th>
                      ))}
                      <th scope="col" className="bg-sunken px-3.5 py-2.5">
                        <span className="sr-only">{t('dataFusion.iot.columns.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(({ connection, type, site: node }) => (
                      <tr
                        key={connection.id}
                        className="border-t border-subtle transition-colors hover:border-forge/30 hover:bg-sunken"
                      >
                        {/* The name is the way in. Every other cell on this row
                            describes how the source is configured; this one opens
                            what it actually carries, which is where an operator is
                            usually headed. The gear beside it still edits the
                            connection itself. */}
                        <td className="px-3.5 py-2.5 text-body-sm font-semibold">
                          <Link
                            to={connectionPath(connection.id)}
                            className="inline-flex items-center gap-1.5 text-ink transition-colors hover:text-on-forge"
                          >
                            <span className="min-w-0 truncate">{connection.name}</span>
                            <Icon
                              name="right"
                              size="xs"
                              className="shrink-0 text-ink-mute rtl:rotate-180"
                            />
                          </Link>
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          {type ? (
                            <span translate="no">{type.name}</span>
                          ) : (
                            /* A connector type this build has never seen. The
                               backend can seed one without a frontend release, so
                               the id is stated rather than the cell left blank. */
                            <Mono>{connection.connectorTypeId}</Mono>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {type ? (
                            <Mono className="text-ink-dim uppercase">{type.protocolFamily}</Mono>
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          {node ? (
                            node.name
                          ) : (
                            /* Deletion is soft everywhere in this API and nothing
                               cascades, so a connection outlives the plant it was
                               registered against and lands here. */
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <Mono className="truncate">{connection.plantId}</Mono>
                              <span className="text-micro font-normal text-on-amber">
                                {t('dataFusion.iot.siteUnresolved')}
                              </span>
                            </span>
                          )}
                        </td>
                        {/* Both states named. The exception-only pattern read as
                            a bug: an active connection had an empty cell, and a
                            reader had to know to interpret the absence as
                            "healthy". Naming both leaves nothing to infer. */}
                        <td className="px-3.5 py-2.5">
                          {connection.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-pill tint-green px-2.5 py-[3px] text-micro whitespace-normal text-on-green">
                              {t('dataFusion.iot.state.active')}
                            </span>
                          ) : (
                            <PlainBadge>{t('dataFusion.iot.state.inactive')}</PlainBadge>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="flex items-center justify-end gap-1">
                            <IconButton
                              bare
                              label={t('dataFusion.iot.configure', { name: connection.name })}
                              onClick={() => setEditing(connection)}
                              className="size-8"
                            >
                              <Icon name="gear" size="sm" />
                            </IconButton>
                            <IconButton
                              bare
                              label={t('dataFusion.iot.remove', { name: connection.name })}
                              onClick={() => setRemoving(connection)}
                              className="size-8 hover:text-on-red"
                            >
                              <Icon name="trash" size="sm" />
                            </IconButton>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                total={filtered.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                label={t('dataFusion.iot.rowNoun')}
              />
            </Panel>
          ) : (
            <EmptyState
              icon="search"
              title={t('dataFusion.iot.noMatch')}
              body={t('dataFusion.iot.noMatchBody')}
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

      <ConnectSourceWizard open={connecting} onClose={() => setConnecting(false)} />
      <EditConnectionDialog connection={editing} onClose={() => setEditing(null)} />
      <DeleteConnectionDialog connection={removing} onClose={() => setRemoving(null)} />
    </div>
  )
}

/** A value the source does not report. Never an empty cell — a blank reads as a bug. */
function Dash() {
  return <span className="text-ink-mute">—</span>
}
