import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { PlainBadge } from '@/components/forge/StatusBadge'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { TablePagination } from '@/components/forge/TablePagination'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useConnection, useConnectorTypes } from '@/features/dataFusion/queries'
import { useHierarchyNodes } from '@/features/hierarchy/queries'
import { PARENT_ICON, describeParent, parentOf } from '@/features/hierarchy/parents'
import { useSensors } from '@/features/sensors/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { EditConnectionDialog } from './ConnectionDialogs'
import { fusionPath, newSensorPath, sensorPath } from './sections'
import { PathCell, primaryPathOf } from './SensorForm'
import { DeleteSensorDialog } from './SensorDialogs'

/**
 * One connection, and the sensors read off it.
 *
 * ── Why this is a route and not a drawer ──────────────────────────────────
 * A connection's sensor list runs to five figures. That is a screen — it needs a
 * paginated table, a page title, and a URL someone can send to a colleague — and a
 * drawer over the connections table would give it none of those while stealing half
 * the width from the thing it is listing.
 *
 * It sits UNDER the `iot` section rather than beside it, at
 * `/app/data-fusion/iot/:connectionId`, so `DataFusionLayout` keeps "IoT & Sensors"
 * lit in the section rail while you are inside one source. A twelfth top-level
 * section for sensors would have been wrong: sensors are not a source family, they
 * are what a source family contains.
 *
 * ── The list is paginated by the SERVER, uniquely in this app ──────────────
 * Every other list screen fetches its collection and slices it in a `useMemo`.
 * `GET /sensors` is the only paginated endpoint in the API, and here it has to be:
 * ten thousand rows each carrying an `extraction_config` JSONB is megabytes to show
 * fifty. So `page` and `pageSize` are request params, `total` comes from the
 * response, and `TablePagination` — which never sliced anything — takes them
 * unchanged.
 *
 * ── Three joins the client performs, because SensorOut carries no names ────
 * `SensorOut` returns ids: `plant_id`/`line_id`/`machine_id`, `asset_class_id`,
 * `data_source_connection_id`. Not one name. The parent's name and its trail come
 * from the hierarchy, the connector's name from the catalogue, and the connection's
 * from its own detail read — all three already cached by the time this screen opens
 * from the source table.
 */
export function ConnectionSensorsPage() {
  // No locale needed here: the rows arrive server-ordered by `created_at, id` and
  // are never re-sorted client-side — sorting one page of a paginated list would
  // order fifty rows against nothing.
  const { t } = useTranslation(['app', 'common'])
  const { connectionId } = useParams()
  const navigate = useNavigate()

  const connection = useConnection(connectionId)
  const catalogue = useConnectorTypes()
  const hierarchy = useHierarchyNodes()

  const [page, setPage] = useState(1)
  // 50 rather than PAGE_SIZES[0]. This screen exists because the list is enormous;
  // opening it ten rows at a time would be a footer with a thousand pages behind it.
  const [pageSize, setPageSize] = useState(50)

  const [removing, setRemoving] = useState(null)
  const [editingConnection, setEditingConnection] = useState(false)

  const sensors = useSensors({ connectionId, page, pageSize })

  useDocumentTitle(
    `${connection.data?.name ?? t('dataFusion.sensors.title')} · ${t('common:brand.name')}`,
  )

  /**
   * The connector type, preferring the one nested in the detail read.
   *
   * Same two-source arrangement `ConnectionDialogs` documents: `GET /connections/{id}`
   * nests `connector_type`, which is the better answer in one request, but an older
   * server build omits it and the catalogue is keyed by the same id. Its
   * `extractionFields` is what generates the sensor form, so a null here is what makes
   * onboarding unavailable rather than merely unlabelled.
   */
  const connector = useMemo(() => {
    if (connection.data?.connectorType) return connection.data.connectorType
    return (
      (catalogue.data?.items ?? []).find((type) => type.id === connection.data?.connectorTypeId) ??
      null
    )
  }, [connection.data, catalogue.data])

  const site = useMemo(() => {
    if (!connection.data?.plantId) return null
    return (
      (hierarchy.data?.items ?? []).find(
        (node) => node.tier === 'site' && node.id === connection.data.plantId,
      ) ?? null
    )
  }, [connection.data, hierarchy.data])

  /* The header needs all three reads; the table has its own states. Splitting them
     means paging never blanks the connection summary above it. */
  const headerPending = connection.isPending || catalogue.isPending || hierarchy.isPending
  const headerError = connection.isError || catalogue.isError || hierarchy.isError

  if (headerPending) {
    return (
      <div className="px-8 py-6 max-xl:px-5.5">
        <SkeletonRows count={3} />
      </div>
    )
  }

  if (headerError) {
    return (
      <div className="px-8 py-6 max-xl:px-5.5">
        <Back />
        <ErrorState
          error={connection.error ?? catalogue.error ?? hierarchy.error}
          title={t('dataFusion.sensors.connectionFailed')}
          onRetry={() => {
            connection.refetch()
            catalogue.refetch()
            hierarchy.refetch()
          }}
          className="mt-5"
        />
      </div>
    )
  }

  const rows = sensors.data?.items ?? []
  const total = sensors.data?.total ?? 0
  // Paging keeps the previous page on screen (see useSensors), so the in-flight
  // state is a dim rather than a skeleton — the rows under the pointer stay put.
  const settling = sensors.isPlaceholderData

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <Back />

      {/* ── The connection, stated ─────────────────────────────────────── */}
      <header className="mt-3 mb-5 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 text-headline">{connection.data.name}</h1>
          <p className="mt-2 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-ink-dim">
            {connector ? (
              <>
                <span translate="no">{connector.name}</span>
                <span aria-hidden="true">·</span>
                <Mono className="uppercase">{connector.protocolFamily}</Mono>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            {site ? (
              <span>{site.name}</span>
            ) : (
              <span className="text-on-amber">{t('dataFusion.iot.siteUnresolved')}</span>
            )}
            <span aria-hidden="true">·</span>
            {connection.data.isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-pill tint-green px-2.5 py-[3px] text-micro text-on-green">
                {t('dataFusion.iot.state.active')}
              </span>
            ) : (
              <PlainBadge>{t('dataFusion.iot.state.inactive')}</PlainBadge>
            )}
          </p>
        </div>

        <ForgeButton onClick={() => setEditingConnection(true)}>
          {t('dataFusion.sensors.configureConnection')}
        </ForgeButton>
      </header>

      {/* ── The sensors ────────────────────────────────────────────────── */}
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
        <div className="min-w-0">
          <Eyebrow>{t('dataFusion.sensors.sectionLabel')}</Eyebrow>
          <p className="mt-1 mb-0 text-body-sm text-ink-dim">
            {sensors.isPending ? (
              t('dataFusion.sensors.subtitle')
            ) : (
              <Num>{t('dataFusion.sensors.summary', { count: total })}</Num>
            )}
          </p>
        </div>

        {/* No connector type means no `extraction_schema`, so there is nothing to
            generate the form from. The reason is stated whether or not the button
            is here, because it explains an absence either way. */}
        <span className="flex flex-wrap items-center gap-2.5">
          {connector ? null : (
            <span className="text-body-sm text-on-amber">
              {t('dataFusion.sensors.noConnector')}
            </span>
          )}
          {/* Only once there is a list to sit above.
              With no sensors the empty state carries the only call to action, in
              the middle of the space it is talking about — two primaries offering
              the same thing, one of them beside a heading and one inside the
              explanation, is a choice the reader has to resolve before acting. */}
          {total > 0 ? (
            <ForgeButton
              variant="primary"
              disabled={!connector}
              onClick={() => navigate(newSensorPath(connectionId))}
            >
              {t('dataFusion.sensors.onboard')}
            </ForgeButton>
          ) : null}
        </span>
      </div>

      {sensors.isPending ? (
        <SkeletonRows count={5} />
      ) : sensors.isError ? (
        <ErrorState
          error={sensors.error}
          title={t('dataFusion.sensors.loadFailed')}
          onRetry={sensors.refetch}
        />
      ) : total === 0 ? (
        <EmptyState
          icon="wave"
          title={t('dataFusion.sensors.empty')}
          body={t('dataFusion.sensors.emptyBody')}
          action={
            connector ? (
              <ForgeButton variant="primary" onClick={() => navigate(newSensorPath(connectionId))}>
                {t('dataFusion.sensors.onboard')}
              </ForgeButton>
            ) : null
          }
        />
      ) : (
        <Panel flush className="overflow-hidden">
          <div className={cn('overflow-x-auto transition-opacity', settling && 'opacity-60')}>
            <table className="w-full border-collapse">
              <caption className="sr-only">{t('dataFusion.sensors.tableCaption')}</caption>
              <thead>
                <tr>
                  {['name', 'attachedTo', 'valueType', 'valuePath'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                    >
                      {t(`dataFusion.sensors.columns.${column}`)}
                    </th>
                  ))}
                  <th scope="col" className="bg-sunken px-3.5 py-2.5">
                    <span className="sr-only">{t('dataFusion.sensors.columns.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((sensor) => (
                  <SensorRow
                    key={sensor.id}
                    sensor={sensor}
                    connector={connector}
                    nodes={hierarchy.data?.items ?? []}
                    onEdit={() => navigate(sensorPath(connectionId, sensor.id))}
                    onRemove={() => setRemoving(sensor)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              // A larger page means fewer pages; page 40 of 200 may not exist at 200
              // rows. Reset rather than clamp — at this scale the old offset means
              // nothing once the window changes size.
              setPage(1)
            }}
            label={t('dataFusion.sensors.rowNoun')}
          />
        </Panel>
      )}

      <DeleteSensorDialog sensor={removing} onClose={() => setRemoving(null)} />
      <EditConnectionDialog
        connection={editingConnection ? connection.data : null}
        onClose={() => setEditingConnection(false)}
      />
    </div>
  )
}

/* ══ ROW ═══════════════════════════════════════════════════════════════ */

function SensorRow({ sensor, connector, nodes, onEdit, onRemove }) {
  const { t } = useTranslation(['app', 'common'])

  const parent = parentOf(sensor)
  const attached = describeParent(nodes, parent)

  return (
    <tr className="border-t border-subtle transition-colors hover:border-forge/30 hover:bg-sunken">
      <td className="px-3.5 py-2.5 text-body-sm font-semibold">{sensor.name}</td>

      <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
        {attached ? (
          <span className="flex min-w-0 items-start gap-1.5">
            <Icon
              name={PARENT_ICON[attached.tier]}
              size="xs"
              className="mt-1 shrink-0 text-ink-mute"
            />
            <span className="min-w-0">
              <span className="block truncate text-ink">{attached.name}</span>
              {attached.trail.length ? (
                <span className="block truncate text-micro font-normal text-ink-mute">
                  {attached.trail.join(' · ')}
                </span>
              ) : null}
            </span>
          </span>
        ) : (
          /* Deletion is soft everywhere in this API and nothing cascades, so a
             sensor outlives the machine it was attached to and lands here. The id
             is stated rather than the cell left blank. */
          <span className="flex min-w-0 flex-col gap-0.5">
            <Mono className="truncate">{parent?.id ?? '—'}</Mono>
            <span className="text-micro font-normal text-on-amber">
              {t('dataFusion.sensors.parentUnresolved')}
            </span>
          </span>
        )}
      </td>

      <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
        {t(`dataFusion.sensors.valueType.${sensor.valueType}`)}
      </td>

      <td className="px-3.5 py-2.5">
        <PathCell path={primaryPathOf(connector, sensor.extractionConfig)} />
      </td>

      <td className="px-3.5 py-2.5">
        <span className="flex items-center justify-end gap-1">
          <IconButton
            bare
            label={t('dataFusion.sensors.configure', { name: sensor.name })}
            onClick={onEdit}
            className="size-8"
          >
            <Icon name="gear" size="sm" />
          </IconButton>
          <IconButton
            bare
            label={t('dataFusion.sensors.remove', { name: sensor.name })}
            onClick={onRemove}
            className="size-8 hover:text-on-red"
          >
            <Icon name="trash" size="sm" />
          </IconButton>
        </span>
      </td>
    </tr>
  )
}

/**
 * Back to the source list.
 *
 * A link and not a breadcrumb trail: the section rail already says where this is,
 * and there is exactly one level above. `right` rotated is the codebase's
 * previous-direction glyph — there is no left chevron in the sprite — and it mirrors
 * under RTL because "back" is a direction rather than a shape.
 */
function Back() {
  const { t } = useTranslation('app')
  return (
    <Link
      to={fusionPath('iot')}
      className="inline-flex items-center gap-1.5 text-body-sm text-ink-dim transition-colors hover:text-ink"
    >
      <Icon name="right" size="xs" className="rotate-180 rtl:rotate-0" />
      {t('dataFusion.sensors.backToSources')}
    </Link>
  )
}
