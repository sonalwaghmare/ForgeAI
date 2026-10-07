import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { HealthRing } from '@/components/forge/HealthRing'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { useAsset } from '@/features/lines/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'
import { AssetOverview } from './AssetOverview'
import {
  AlertHistoryTab,
  AuditTab,
  BomTab,
  DocumentsTab,
  InsightsTab,
  MaintenanceTab,
  TelemetryTab,
  TimeseriesTab,
  WorkOrdersTab,
} from './AssetTabs'
import { AssetSynopsis } from './AssetSynopsis'

/**
 * One asset — the prototype's station detail.
 *
 * DEMO. This is the screen four other modules link into, so it is deliberately
 * addressable by asset id alone: `/app/assets/FDY-WSH-01` works whether you
 * arrived from a line, an anomaly, a work order or a pasted link. The prototype
 * reaches it only by clicking through a line, which is why it has no URL for the
 * thing an operator most often needs to send someone.
 *
 * Pass 3 grows the ten tabs on top of this. What is here is the header, the four
 * figures, the component rail and the sensor cards — the parts the line screen
 * links to and the parts that read real records.
 *
 * ── Component depth is honest ─────────────────────────────────────────────
 * Two machines are modelled to component level. For the rest the screen says so
 * rather than rendering an invented bill of materials, which is the same stance
 * the module placeholder takes and for the same reason.
 */

export function AssetDetailPage() {
  const { t } = useTranslation(['app', 'common'])
  const { assetId } = useParams()
  const asset = useAsset(assetId)

  useDocumentTitle(`${asset.data?.name ?? t('screens.assets')} · ${t('common:brand.name')}`)

  return (
    <Page>
      <div className="mb-4">
        <ForgeButton asChild>
          <Link to={asset.data?.lineId ? `/app/assets/lines/${asset.data.lineId}` : '/app/assets'}>
            <Icon name="right" size="xs" className="rotate-180 rtl:rotate-0" />
            {t('lines.asset.back', { line: asset.data?.lineName ?? t('lines.title') })}
          </Link>
        </ForgeButton>
      </div>

      {asset.isError ? (
        <ErrorState
          error={asset.error}
          title={t('lines.asset.loadFailed')}
          onRetry={() => asset.refetch()}
        />
      ) : asset.isPending ? (
        <SkeletonRows count={6} />
      ) : !asset.data ? (
        <EmptyState icon="machine" title={t('lines.asset.notFound')} />
      ) : (
        <AssetBody asset={asset.data} t={t} />
      )}
    </Page>
  )
}

/** The ten sections of the Detailed view, in the prototype's order. */
const TABS = [
  'overview',
  'timeseries',
  'alerts',
  'workOrders',
  'telemetry',
  'documents',
  'maintenance',
  'bom',
  'insights',
  'audit',
]

/** A three-letter shorthand for the machine type, as the prototype's tile has. */
const abbreviate = (type = '') => type.slice(0, 3).toUpperCase()

function AssetBody({ asset, t }) {
  /**
   * The view and the tab live in the URL.
   *
   * The prototype holds both in `useState`, which means a colleague cannot be
   * sent to the Timeseries tab of a machine — the link always opens on the AI
   * synopsis. Search params cost nothing and this is the screen most likely to
   * be pasted into a message.
   */
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'detailed' ? 'detailed' : 'synopsis'
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'overview'

  const go = (next) => setParams(next, { replace: true })

  const status = asset.blocked
    ? 'blocked'
    : asset.starved
      ? 'starved'
      : !asset.online
        ? 'offline'
        : (asset.health ?? 100) < 50
          ? 'maintenance'
          : 'running'
  const statusTone = { running: 'green', maintenance: 'amber', blocked: 'red', offline: null, starved: null }[status]
  const healthBand = asset.health >= 80 ? 'good' : asset.health >= 50 ? 'watch' : 'critical'

  return (
    <>
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-4">
          {/* The type tile. Neutral rather than the prototype's per-type colour
              palette: nineteen arbitrary hues that mean nothing beyond "this is
              a different kind of machine" would spend the whole colour system
              on a label the text beside it already carries. */}
          <span className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-hairline bg-sunken">
            <Mono className="text-body-sm font-bold text-ink-dim">{abbreviate(asset.type)}</Mono>
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="m-0 text-headline text-balance">
                {asset.name} <Mono className="text-title font-medium text-ink-mute">{asset.code}</Mono>
              </h1>
              <StateBadge tone={statusTone}>{t(`lines.asset.status.${status}`)}</StateBadge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-body-sm text-ink-dim">
              <span>
                {t(`lines.type.${asset.type}`, { defaultValue: asset.type })} · {asset.vendor} {asset.model}
              </span>
              <span className="text-ink-mute">·</span>
              <Mono>{t('lines.asset.serial', { serial: asset.code.replace(/-/g, '') })}</Mono>
              <span className="text-ink-mute">·</span>
              <StateBadge
                tone={asset.criticality === 'critical' ? 'red' : asset.criticality === 'high' ? 'amber' : null}
                dot={false}
              >
                {t('lines.asset.criticality', { level: t(`common:severity.${asset.criticality}`) })}
              </StateBadge>
              <span className="text-ink-mute">·</span>
              <span>{t('lines.asset.ownerIs', { name: asset.ownerName })}</span>
            </div>
          </div>

          <HealthRing
            value={asset.health}
            label={t('lines.asset.health')}
            caption={t(`lines.asset.healthBand.${healthBand}`)}
            className="shrink-0"
          />
        </div>

        {/* The view switch. Violet on the synopsis because that view IS the
            machine talking; the detailed view is instrumentation and takes the
            ordinary selected treatment. */}
        <div
          role="group"
          aria-label={t('lines.asset.view.label')}
          className="mt-4 flex flex-wrap gap-2 border-t border-subtle pt-3.5"
        >
          <button
            type="button"
            aria-pressed={view === 'synopsis'}
            onClick={() => go({})}
            className={cn(
              'inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-body-sm font-semibold transition-colors',
              view === 'synopsis'
                ? 'border-violet/40 tint-violet text-on-violet'
                : 'border-hairline bg-card text-ink-dim hover:border-forge hover:text-ink',
            )}
          >
            <Icon name="ai" size="xs" className={view === 'synopsis' ? 'text-violet' : undefined} />
            {t('lines.asset.view.synopsis')}
          </button>
          <button
            type="button"
            aria-pressed={view === 'detailed'}
            onClick={() => go({ view: 'detailed', tab })}
            className={cn(
              'inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-body-sm font-semibold transition-colors',
              view === 'detailed'
                ? 'border-forge/40 tint-forge text-on-forge'
                : 'border-hairline bg-card text-ink-dim hover:border-forge hover:text-ink',
            )}
          >
            <Icon name="layers" size="xs" />
            {t('lines.asset.view.detailed')}
          </button>
        </div>
      </Panel>

      {view === 'synopsis' ? (
        <AssetSynopsis
          asset={asset}
          onDeepDive={(next) => go({ view: 'detailed', tab: next })}
        />
      ) : (
        <>
          <div
            role="tablist"
            aria-label={t('lines.asset.tabsLabel')}
            className="mb-5 flex gap-1 overflow-x-auto border-b border-hairline"
          >
            {TABS.map((entry) => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={entry === tab}
                onClick={() => go({ view: 'detailed', tab: entry })}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-body-sm whitespace-nowrap transition-colors',
                  entry === tab
                    ? 'border-forge font-semibold text-ink'
                    : 'border-transparent text-ink-dim hover:text-ink',
                )}
              >
                {t(`lines.asset.tabs.${entry}`)}
                {entry === 'alerts' && asset.alerts.total ? (
                  <Num className="rounded-pill bg-sunken px-1.5 text-micro font-bold text-ink-dim">
                    {formatInteger(asset.alerts.total)}
                  </Num>
                ) : null}
              </button>
            ))}
          </div>

          <TabPane
            tab={tab}
            asset={asset}
            onOpenTab={(next) => go({ view: 'detailed', tab: next })}
          />
        </>
      )}
    </>
  )
}

/**
 * Which section renders. A map rather than a chain of ternaries: ten branches
 * read as a lookup, and a missing one is then visible as a missing key.
 */
function TabPane({ tab, asset, onOpenTab }) {
  switch (tab) {
    case 'overview':
      return <AssetOverview asset={asset} onOpenTab={onOpenTab} />
    case 'timeseries':
      return <TimeseriesTab asset={asset} />
    case 'alerts':
      return <AlertHistoryTab asset={asset} />
    case 'workOrders':
      return <WorkOrdersTab asset={asset} />
    case 'telemetry':
      return <TelemetryTab asset={asset} />
    case 'documents':
      return <DocumentsTab asset={asset} />
    case 'maintenance':
      return <MaintenanceTab asset={asset} />
    case 'bom':
      /* The bill of materials and the spare parts, and nothing else. An earlier
         version also showed the component rail with its sensor traces, which was
         two mistakes: the four figures above it repeat the header and the
         Overview, and the traces repeat Timeseries. The BOM already carries the
         component tree, which is the part that lives nowhere else. */
      return <BomTab asset={asset} />
    case 'insights':
      return <InsightsTab asset={asset} onOpenTab={onOpenTab} />
    case 'audit':
      return <AuditTab asset={asset} />
    default:
      return null
  }
}
