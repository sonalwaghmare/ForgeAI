import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page, useAssistant } from '@/shell/AppShell'
import { AlertCard } from '@/components/forge/AlertCard'
import { AiInsight } from '@/components/forge/AiSurface'
import { Chip, Segmented, SegmentedItem } from '@/components/forge/Chip'
import { FacetTile } from '@/components/forge/FacetTile'
import { Icon } from '@/components/forge/Icon'
import { Dot } from '@/components/forge/primitives'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { useAlertCounts, useAlerts } from '@/features/alerts/queries'
import { useOrg } from '@/features/operations/queries'
import { formatInteger } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useScope } from '@/providers/ScopeProvider'

/**
 * Anomalies — the flagship operational surface.
 *
 * The facet tiles above the list are controls, not ornaments: each filters the
 * list beneath it and takes an accent leading edge when active. That is the only
 * thing that justifies a row of big numbers on a screen like this.
 */

const FACETS = [
  { id: 'all', icon: 'list', tone: null },
  { id: 'critical', icon: 'bolt', tone: 'red' },
  { id: 'open', icon: 'bolt', tone: null },
  // A tick, not a gear. "Acknowledged" means a person has taken this — a cog
  // says configuration, which is the same mismatch the edit button had.
  { id: 'ack', icon: 'check', tone: 'ack' },
  { id: 'escalated', icon: 'up', tone: 'amber' },
  { id: 'unassigned', icon: 'users', tone: null },
]

const SEVERITIES = ['critical', 'high', 'medium', 'low']

export function AlertsPage() {
  const { t } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('screens.anomalies')} · ${t('common:brand.name')}`)
  const { params: scopeParams, siteId } = useScope()
  const { ground, alert: grounded } = useAssistant()
  const { data: org } = useOrg()

  const [facet, setFacet] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [sort, setSort] = useState('severity')
  const [view, setView] = useState('list')

  /** Facets map onto request params rather than filtering client-side, so this
      keeps working when the list is paginated by a real API. */
  const facetParams = useMemo(() => {
    if (facet === 'all') return {}
    if (facet === 'critical') return { severity: 'critical' }
    if (facet === 'unassigned') return { unassigned: true }
    return { status: facet }
  }, [facet])

  const query = useMemo(
    () => ({
      ...scopeParams,
      ...facetParams,
      ...(severity !== 'all' && facet !== 'critical' ? { severity } : {}),
      sort,
    }),
    [scopeParams, facetParams, severity, facet, sort],
  )

  const alerts = useAlerts(query)
  const counts = useAlertCounts(scopeParams)

  const items = alerts.data?.items ?? []
  const siteCount = siteId ? 1 : (org?.sites?.length ?? 0)

  return (
    <Page>
      <div className="mb-4.5 flex flex-wrap items-end gap-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 flex items-center gap-2.5 text-display">
            {t('alerts.title')}
            <span className="inline-flex items-center gap-1.5 rounded-pill tint-green px-2.5 py-0.5 text-micro text-on-green">
              <Dot tone="green" size={6} />
              {t('common:state.live')}
            </span>
          </h1>
          <p className="mt-1.5 text-control font-normal text-ink-dim">
            {t('alerts.subtitle', { count: counts.data?.all ?? 0, sites: siteCount })}
          </p>
        </div>
        <Chip as="div">{t('common:synthetic.short')}</Chip>
        <Chip>{t('common:actions.export')}</Chip>
      </div>

      <div
        role="group"
        aria-label={t('alerts.filterByStatus')}
        className="mb-5 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(132px,1fr))]"
      >
        {FACETS.map((entry) => (
          <FacetTile
            key={entry.id}
            icon={entry.icon}
            tone={entry.tone}
            selected={facet === entry.id}
            onClick={() => setFacet(entry.id)}
            label={
              entry.id === 'all'
                ? t('alerts.facets.all')
                : entry.id === 'critical'
                  ? t('common:severity.critical')
                  : t(`common:status.${entry.id}`)
            }
            value={formatInteger(counts.data?.[entry.id] ?? 0)}
            caption={t(
              entry.id === 'all' ? 'alerts.facets.allCaption' : `alerts.facets.${entry.id}Caption`,
            )}
          />
        ))}
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <Segmented label={t('alerts.viewMode')}>
          <SegmentedItem
            selected={view === 'list'}
            label={t('alerts.listView')}
            onClick={() => setView('list')}
          >
            <Icon name="list" size="sm" />
          </SegmentedItem>
          <SegmentedItem
            selected={view === 'board'}
            label={t('alerts.boardView')}
            onClick={() => setView('board')}
          >
            <Icon name="board" size="sm" />
          </SegmentedItem>
        </Segmented>

        <div
          role="group"
          aria-label={t('alerts.filterBySeverity')}
          className="flex flex-wrap items-center gap-2"
        >
          <Chip selected={severity === 'all'} onClick={() => setSeverity('all')}>
            {t('alerts.facets.all')}
          </Chip>
          {SEVERITIES.map((level) => (
            <Chip
              key={level}
              selected={severity === level}
              onClick={() => setSeverity(level)}
              disabled={facet === 'critical' && level !== 'critical'}
            >
              {t(`common:severity.${level}`)} · {formatInteger(counts.data?.[level] ?? 0)}
            </Chip>
          ))}
        </div>

        <div className="flex-1" />
        <span className="text-body-sm text-ink-dim">
          {t('alerts.showing', { shown: items.length, total: alerts.data?.total ?? 0 })}
        </span>
        <Chip onClick={() => setSort(sort === 'severity' ? 'detected' : 'severity')}>
          {t('common:actions.sortBy', {
            field: t(sort === 'severity' ? 'alerts.sortSeverity' : 'alerts.sortDetected'),
          })}
        </Chip>
      </div>

      {/* SecInsight: the machine narrates the list rather than occupying a
          panel beside it. */}
      <AiInsight className="mt-6 mb-2">{t('alerts.insight')}</AiInsight>

      {alerts.isPending ? (
        <SkeletonRows count={5} />
      ) : alerts.isError ? (
        <ErrorState
          error={alerts.error}
          title={t('alerts.loadFailed')}
          onRetry={() => alerts.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          action={
            <Chip
              onClick={() => {
                setFacet('all')
                setSeverity('all')
              }}
            >
              {t('common:actions.clearFilters')}
            </Chip>
          }
        />
      ) : (
        <div
          className={
            view === 'board'
              ? 'grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))]'
              : 'flex flex-col gap-2.5'
          }
        >
          {items.map((item) => (
            <AlertCard
              key={item.id}
              alert={item}
              compact={view === 'board'}
              selected={grounded?.id === item.id}
              onSelect={ground}
            />
          ))}
        </div>
      )}
    </Page>
  )
}
