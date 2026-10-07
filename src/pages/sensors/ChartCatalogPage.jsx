import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { PlainBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Num } from '@/components/forge/primitives'
import { useCharts, useCreateChart, useSignals } from '@/features/signals/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger, formatRelative } from '@/lib/format'
import { ChannelPickerDialog } from './ChannelPickerDialog'

/**
 * The saved-chart catalogue.
 *
 * DEMO. Eight cards, as the design has, but about Meridian's own machines
 * rather than the prototype's Chennai heat exchanger, turbine and furnace.
 *
 * ── The sensor count is counted ───────────────────────────────────────────
 * The prototype writes `s: 12` on a card whose chart has no series and `s: 4`
 * beside a four-series array, so one of its eight is wrong and nothing on the
 * card says which. Here it is `chartChannels().length` from the handler.
 *
 * ── A card says whether it is worth opening ───────────────────────────────
 * Each carries the worst state among its own channels, counted off the same
 * catalogue the Explorer draws. That is a real reason to have this page rather
 * than a list of names: eight saved views, and this is the one in alarm.
 */
export function ChartCatalogPage() {
  const { t } = useTranslation(['app', 'common'])
  const navigate = useNavigate()
  const { toast } = useToast()

  const charts = useCharts()
  // The whole catalogue, so New Chart can offer every channel. Not paginated for
  // the same reason the floor map is not: a picker showing rows 26–50 of a plant
  // is not a picker.
  const channels = useSignals({ window: '24h', sort: 'plant' })
  const createChart = useCreateChart()
  const [picking, setPicking] = useState(false)

  useDocumentTitle(`${t('sensors.workstation.title')} · ${t('common:brand.name')}`)

  const items = charts.data?.items ?? []

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="m-0 mb-1.5">
            <Link
              to="/app/sensors"
              className="inline-flex items-center gap-1.5 text-body-sm text-ink-dim transition-colors hover:text-ink"
            >
              <Icon name="right" size="xs" className="rotate-180 mirror-rtl" />
              {t('sensors.title')}
            </Link>
          </p>
          <h1 className="m-0 text-display text-balance">{t('sensors.workstation.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">
            <Num>
              {t('sensors.workstation.subtitle', {
                charts: formatInteger(items.length),
                channels: formatInteger(channels.data?.facets?.all ?? 0),
              })}
            </Num>
          </p>
        </div>
        <ForgeButton variant="primary" onClick={() => setPicking(true)}>
          <Icon name="plus" size="xs" />
          {t('sensors.workstation.newChart')}
        </ForgeButton>
      </header>

      {charts.isError ? (
        <ErrorState
          error={charts.error}
          title={t('sensors.workstation.loadFailed')}
          onRetry={() => charts.refetch()}
        />
      ) : charts.isPending ? (
        <SkeletonRows count={4} />
      ) : items.length === 0 ? (
        <EmptyState icon="chart" title={t('sensors.workstation.emptyTitle')} />
      ) : (
        <ul className="m-0 grid list-none gap-3.5 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,24rem),1fr))]">
          {items.map((chart) => (
            <li key={chart.id}>
              <Panel
                as={Link}
                to={`/app/sensors/charts/${chart.id}`}
                interactive
                // Earned: a saved chart with a channel in violation is the one to
                // open first, and that is exactly what the edge is for.
                stripe={chart.worst === 'violation' ? 'red' : null}
                className="flex h-full flex-col gap-2.5 no-underline"
              >
                <div className="flex items-center gap-2">
                  <Icon name="chart" size="sm" className="text-on-forge" />
                  {chart.created ? <PlainBadge>{t('sensors.workstation.created')}</PlainBadge> : null}
                  {chart.worst !== 'ok' ? (
                    <StateBadge tone={chart.worst === 'violation' ? 'red' : 'amber'}>
                      {t(`sensors.state.${chart.worst}`)}
                    </StateBadge>
                  ) : null}
                  <span className="ms-auto" />
                  <Icon name="right" size="xs" className="text-ink-mute mirror-rtl" />
                </div>
                <p className="m-0 text-title">{chart.name}</p>
                <p className="m-0 mt-auto text-micro font-normal text-ink-dim">
                  <Num>
                    {t('sensors.workstation.cardMeta', {
                      count: chart.sensorCount,
                      assets: chart.assetCount,
                      author: chart.author ?? '—',
                      when: formatRelative(chart.savedAt),
                    })}
                  </Num>
                </p>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <ChannelPickerDialog
        open={picking}
        mode="create"
        channels={channels.data?.items ?? []}
        selected={[]}
        pending={createChart.isPending}
        onClose={() => setPicking(false)}
        onSubmit={async (body) => {
          const chart = await createChart.mutateAsync(body)
          setPicking(false)
          toast(t('sensors.workstation.createdToast', { name: chart.name }), 'ok')
          navigate(`/app/sensors/charts/${chart.id}`)
        }}
      />
    </Page>
  )
}
