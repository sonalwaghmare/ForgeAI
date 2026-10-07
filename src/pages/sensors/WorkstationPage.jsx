import { useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { AiBadge, PlainBadge } from '@/components/forge/StatusBadge'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import {
  ADHOC,
  GRANULARITIES,
  PLOT_MODES,
  WORKSTATION_PANELS,
  chartToCsv,
} from '@/features/signals/charts'
import { DEFAULT_WINDOW, SIGNAL_WINDOWS } from '@/features/signals/api'
import { useChart, useCreateChart, useSignals } from '@/features/signals/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatDateTime, formatDecimal, formatRelative } from '@/lib/format'
import { formatMeasure } from '@/lib/units'
import { ChannelPickerDialog } from './ChannelPickerDialog'
import { DateRangePicker } from './DateRangePicker'
import { SeriesTable } from './SeriesTable'
import { WorkstationChart } from './WorkstationChart'
import { WorkstationPanel } from './WorkstationPanels'

/**
 * The Timeseries Workstation.
 *
 * DEMO. See `DEMO-MODE.md` §8.4. Reached two ways, and it is the same screen
 * both times: `/app/sensors/charts/:chartId` opens a saved chart, and
 * `/app/sensors/charts/adhoc?signals=…` opens a selection nobody saved — which
 * is what a channel card in the Explorer links to.
 *
 * ── The whole of the chart is in the URL ──────────────────────────────────
 * Span, granularity, plot mode, which series are hidden, and any series added or
 * removed. So a modified saved chart can be sent to a colleague without being
 * written to, and Save As is a POST rather than a second code path. The
 * prototype holds every one of these in `useState`, so nothing it shows can be
 * linked to — including the chart itself, which is reached by clicking a card
 * that sets a boolean.
 *
 * ── Nothing here computes a number ────────────────────────────────────────
 * The statistics, the correlations, the insight's coefficient and the threshold
 * rules all arrive resolved from one pass over the plotted traces. That is what
 * stops the table, the panels and the banner from being three opinions — which
 * in the prototype they measurably are: `TS_SERIES` says the vibration mean is
 * 38.4, `tsGen()` produces a series that averages near 33, and the statistics
 * panel authors 38.4 again beside a P95 of 41.8 that its own data never reaches.
 */
export function WorkstationPage() {
  const { t } = useTranslation(['app', 'common'])
  const { chartId = ADHOC } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()
  const chartRef = useRef(null)

  const windowKey = SIGNAL_WINDOWS.includes(searchParams.get('window'))
    ? searchParams.get('window')
    : DEFAULT_WINDOW
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const range = useMemo(() => (from && to ? { from, to } : null), [from, to])
  const granularity = searchParams.get('granularity') ?? ''
  const mode = PLOT_MODES.includes(searchParams.get('mode')) ? searchParams.get('mode') : 'overlay'
  const signalIds = useMemo(() => {
    const raw = searchParams.get('signals')
    return raw ? raw.split(',').filter(Boolean) : []
  }, [searchParams])
  const hidden = useMemo(() => {
    const raw = searchParams.get('hidden')
    return new Set(raw ? raw.split(',').filter(Boolean) : [])
  }, [searchParams])

  const [panel, setPanel] = useState(null)
  const [insightOpen, setInsightOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  /* The undo stack. Session-scoped and capped at ten, which is exactly what the
     design's History panel claims to offer and does not implement. Each entry
     holds the search string before the edit, so undoing is a navigation rather
     than a second set of state to keep in step with the URL. */
  const [history, setHistory] = useState([])

  const params = useMemo(
    () => ({
      chartId,
      ...(range ? { from: range.from, to: range.to } : { window: windowKey }),
      granularity: granularity || undefined,
      signalIds,
    }),
    [chartId, range, windowKey, granularity, signalIds],
  )

  const chart = useChart(params)
  const catalogue = useSignals({ window: '24h', sort: 'plant' })
  const createChart = useCreateChart()

  useDocumentTitle(
    `${chart.data?.name ?? t('sensors.workstation.title')} · ${t('common:brand.name')}`,
  )

  const visible = useMemo(() => {
    const map = {}
    for (const id of hidden) map[id] = false
    return map
  }, [hidden])

  /** Record what the URL was, then change it. That pair IS the undo stack. */
  const edit = (label, mutate) => {
    const before = searchParams.toString()
    setHistory((previous) => [
      { id: `${Date.now()}-${previous.length}`, label, at: new Date().toISOString(), before },
      ...previous,
    ].slice(0, 10))
    setSearchParams((current) => {
      const url = new URLSearchParams(current)
      mutate(url)
      return url
    })
  }

  const undo = () => {
    const [last, ...rest] = history
    if (!last) return
    setSearchParams(new URLSearchParams(last.before))
    setHistory(rest)
  }

  const setParam = (key, value) =>
    setSearchParams((current) => {
      const url = new URLSearchParams(current)
      if (value) url.set(key, value)
      else url.delete(key)
      return url
    })

  const pickWindow = (next) =>
    setSearchParams((current) => {
      const url = new URLSearchParams(current)
      url.set('window', next)
      url.delete('from')
      url.delete('to')
      return url
    })

  const pickRange = (next) =>
    setSearchParams((current) => {
      const url = new URLSearchParams(current)
      if (next) {
        url.set('from', next.from)
        url.set('to', next.to)
        url.delete('window')
      } else {
        url.delete('from')
        url.delete('to')
      }
      return url
    })

  const data = chart.data

  const toggleSeries = (id) => {
    const entry = data?.series.find((series) => series.id === id)
    edit(
      t(hidden.has(id) ? 'sensors.workstation.historyShow' : 'sensors.workstation.historyHide', {
        series: entry?.name ?? id,
      }),
      (url) => {
        const next = new Set(hidden)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        if (next.size) url.set('hidden', [...next].join(','))
        else url.delete('hidden')
      },
    )
  }

  const removeSeries = (id) => {
    const entry = data?.series.find((series) => series.id === id)
    const remaining = (data?.series ?? []).map((series) => series.id).filter((entry) => entry !== id)
    edit(t('sensors.workstation.historyRemove', { series: entry?.name ?? id }), (url) => {
      url.set('signals', remaining.join(','))
    })
  }

  const addSeries = (ids) => {
    const merged = [...new Set([...(data?.series ?? []).map((entry) => entry.id), ...ids])]
    edit(t('sensors.workstation.historyAdd', { count: ids.length }), (url) => {
      url.set('signals', merged.join(','))
    })
    setAdding(false)
  }

  /** CSV of exactly what is plotted, downloaded. */
  const exportCsv = () => {
    const csv = chartToCsv(data, visible)
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${slug(data.name)}.csv`)
    toast(t('sensors.workstation.exportedCsv'), 'ok')
  }

  /**
   * PNG of the chart as drawn.
   *
   * Serialised from the live SVG with its computed colours inlined, because the
   * tokens are CSS custom properties on an ancestor and an SVG lifted out of the
   * document loses every one of them — the export would be a black rectangle.
   */
  const exportPng = () => {
    const svg = chartRef.current?.querySelector('svg')
    if (!svg) return
    const clone = svg.cloneNode(true)
    inlineComputedColours(svg, clone)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const source = new XMLSerializer().serializeToString(clone)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 2000
      canvas.height = 680
      const context = canvas.getContext('2d')
      /* The page surface, then the card over it. Two fills rather than one,
         because the card's own token is translucent in dark mode — painting it
         onto an empty canvas would give a PNG with a see-through background,
         and there is no literal to fall back on. Both come from
         `getComputedStyle`, which resolves the tokens to concrete colours, so
         the export follows whichever theme the reader is in. */
      context.fillStyle = getComputedStyle(document.body).backgroundColor
      context.fillRect(0, 0, canvas.width, canvas.height)
      const card = chartRef.current?.firstElementChild
      if (card) {
        context.fillStyle = getComputedStyle(card).backgroundColor
        context.fillRect(0, 0, canvas.width, canvas.height)
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) download(blob, `${slug(data.name)}.png`)
        toast(t('sensors.workstation.exportedPng'), 'ok')
      })
    }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
  }

  const copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href)
    toast(t('sensors.workstation.linkCopied'), 'ok')
  }

  const saveAs = async () => {
    const created = await createChart.mutateAsync({
      /* An unsaved chart keeps the name it is already showing; saving a chart
         that HAS a name makes a copy and says so, rather than two rows in the
         catalogue with one title between them. */
      name: data.named ? t('sensors.workstation.copyOf', { name: data.name }) : data.name,
      signalIds: data.series.map((entry) => entry.id),
    })
    toast(t('sensors.workstation.createdToast', { name: created.name }), 'ok')
  }

  return (
    <Page>
      <header className="mb-3.5">
        <p className="m-0 mb-1.5 flex flex-wrap items-center gap-3">
          <Link
            to="/app/sensors/charts"
            className="inline-flex items-center gap-1.5 text-body-sm text-ink-dim transition-colors hover:text-ink"
          >
            <Icon name="right" size="xs" className="rotate-180 mirror-rtl" />
            {t('sensors.workstation.allCharts')}
          </Link>
          <Link
            to="/app/sensors"
            className="inline-flex items-center gap-1.5 text-body-sm text-ink-dim transition-colors hover:text-ink"
          >
            <Icon name="chart" size="xs" />
            {t('sensors.title')}
          </Link>
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-display text-balance">
              {data?.name}
              {/* "Unsaved" is a STATUS and belongs beside the title, not in
                  place of it — the heading was reading "Unsaved chart" on all
                  forty-five channels, which named none of them. */}
              {data && !data.named ? (
                <PlainBadge className="align-middle">{t('sensors.workstation.unsaved')}</PlainBadge>
              ) : null}
            </h1>
            {data?.path ? (
              <p className="mt-1.5 mb-0 flex flex-wrap items-center gap-x-1.5 text-body-sm text-ink-dim">
                <span>{data.path.site}</span>
                <Icon name="right" size="xs" className="mirror-rtl" />
                <span>{data.path.line}</span>
                <Icon name="right" size="xs" className="mirror-rtl" />
                <span>
                  {data.assetCount > 1
                    ? t('sensors.workstation.assetCount', { count: data.assetCount })
                    : data.path.asset}
                </span>
              </p>
            ) : null}
          </div>
          {data?.author ? (
            <p className="m-0 text-micro font-normal text-ink-dim">
              <Num>
                {t('sensors.workstation.savedBy', {
                  author: data.author,
                  when: formatRelative(data.savedAt),
                })}
              </Num>
            </p>
          ) : null}
        </div>
      </header>

      {chart.isError ? (
        <ErrorState
          error={chart.error}
          title={t('sensors.workstation.loadFailed')}
          onRetry={() => chart.refetch()}
        />
      ) : !data ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          {/* Toolbar. Two rows, as the design has: the span controls above, the
              timeframe shortcuts and the liveness below. */}
          <Panel flush className="mb-3.5">
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3.5 py-2.5">
              <div
                role="group"
                aria-label={t('sensors.workstation.modeLabel')}
                className="flex gap-[3px] rounded-md bg-sunken p-[3px]"
              >
                {PLOT_MODES.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    aria-pressed={mode === entry}
                    onClick={() => setParam('mode', entry === 'overlay' ? '' : entry)}
                    className={
                      mode === entry
                        ? 'rounded-xs bg-forge px-3 py-1 text-body-sm font-semibold text-white'
                        : 'rounded-xs px-3 py-1 text-body-sm text-ink-dim transition-colors hover:text-ink'
                    }
                  >
                    {t(`sensors.workstation.mode.${entry}`)}
                  </button>
                ))}
              </div>

              <DateRangePicker value={range} onChange={pickRange} />

              <ForgeSelect
                label={t('sensors.workstation.granularity')}
                labelInline
                size="sm"
                value={granularity || 'auto'}
                onValueChange={(value) => setParam('granularity', value === 'auto' ? '' : value)}
                options={[
                  { value: 'auto', label: t('sensors.workstation.granularityAuto') },
                  ...GRANULARITIES.map((minutes) => ({
                    value: String(minutes),
                    label: t(`sensors.workstation.granularityOption.${minutes}`),
                  })),
                ]}
              />

              <span className="ms-auto flex flex-wrap gap-2">
                <ForgeButton size="sm" onClick={copyLink}>
                  <Icon name="layers" size="xs" />
                  {t('sensors.workstation.copyLink')}
                </ForgeButton>
                <ForgeButton size="sm" onClick={saveAs} disabled={createChart.isPending}>
                  <Icon name="check" size="xs" />
                  {t('sensors.workstation.saveAs')}
                </ForgeButton>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-3.5 py-2">
              <div
                role="group"
                aria-label={t('sensors.window.label')}
                className="flex gap-[3px] rounded-md bg-sunken p-[3px]"
              >
                {SIGNAL_WINDOWS.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    aria-pressed={!range && windowKey === entry}
                    onClick={() => pickWindow(entry)}
                    className={
                      !range && windowKey === entry
                        ? 'rounded-xs bg-forge px-3 py-1 text-body-sm font-semibold text-white'
                        : 'rounded-xs px-3 py-1 text-body-sm text-ink-dim transition-colors hover:text-ink'
                    }
                  >
                    {t(`sensors.window.${entry}`)}
                  </button>
                ))}
              </div>

              <Mono className="text-micro text-ink-dim">
                {formatDateTime(data.span.from)} → {formatDateTime(data.span.to)}
              </Mono>

              <p className="m-0 ms-auto flex items-center gap-1.5 text-micro font-normal text-ink-dim">
                {range ? (
                  t('sensors.stream.closedRange')
                ) : (
                  <>
                    <Dot tone="green" size={6} />
                    <Num>
                      {t('sensors.stream.live', {
                        when: chart.dataUpdatedAt
                          ? formatRelative(new Date(chart.dataUpdatedAt))
                          : '—',
                      })}
                    </Num>
                  </>
                )}
              </p>
            </div>
          </Panel>

          {/* The plot, with the panel rail beside it. */}
          <div className="mb-3.5 flex gap-2.5">
            {/* The ref is on a plain wrapper rather than on `Panel`: the PNG
                export reaches for `querySelector('svg')` and a component that
                may or may not forward a ref is not something an export should
                depend on. */}
            <div ref={chartRef} className="min-w-0 flex-1">
              <Panel>
                <WorkstationChart chart={data} visible={visible} mode={mode} />
              </Panel>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {WORKSTATION_PANELS.map((entry) => (
                <IconButton
                  key={entry}
                  label={t(`sensors.workstation.panel.${entry}`)}
                  pressed={panel === entry}
                  onClick={() => setPanel((previous) => (previous === entry ? null : entry))}
                >
                  <Icon name={PANEL_ICON[entry]} size="sm" />
                </IconButton>
              ))}
            </div>
          </div>

          {/* Forge AI insight. Composed from this chart's own strongest pair, and
              absent entirely when nothing in it correlates — a banner that fires
              on every chart is a banner nobody reads. */}
          {data.insight && insightOpen ? (
            <Panel stripe="violet" className="mb-3.5 flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-xs tint-violet">
                <Icon name="ai" size="sm" style={{ color: 'var(--on-violet)' }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 flex flex-wrap items-center gap-2">
                  <AiBadge />
                  <Eyebrow as="span">{t('sensors.workstation.insight')}</Eyebrow>
                </p>
                <p className="mt-1.5 mb-0 text-body">
                  <Num>
                    {t('sensors.workstation.insightBody', {
                      a: data.insight.a.name,
                      aValue: formatMeasure({
                        value: data.insight.a.value,
                        unit: data.insight.a.unit,
                      }),
                      b: data.insight.b.name,
                      bValue: formatMeasure({
                        value: data.insight.b.value,
                        unit: data.insight.b.unit,
                      }),
                      direction: t(`sensors.workstation.correlation.${data.insight.direction}`),
                      strength: t(`sensors.workstation.correlation.${data.insight.strength}`),
                      r: formatDecimal(data.insight.r, 2),
                      hours: formatDecimal(data.span.hours, 0),
                    })}
                  </Num>
                  {data.insight.alertId ? (
                    <>
                      {' '}
                      <Num>
                        {t('sensors.workstation.insightAlert', {
                          alert: data.insight.alertId,
                          asset: data.insight.assetName,
                        })}
                      </Num>
                    </>
                  ) : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ForgeButton asChild variant="primary" size="sm">
                    <Link to={`/app/assets/${data.insight.assetId}?view=detailed&tab=insights`}>
                      {t('sensors.workstation.openInsights')}
                      <Icon name="right" size="xs" className="mirror-rtl" />
                    </Link>
                  </ForgeButton>
                  {/* The design's second CTA. It had nowhere to go until Work
                      Orders was built; now it opens that module's New WO form
                      prefilled with the machine, the anomaly and a title taken
                      from the correlation the banner just described. */}
                  <ForgeButton asChild size="sm">
                    <Link
                      to={{
                        pathname: '/app/work-orders',
                        search: new URLSearchParams({
                          new: '1',
                          assetId: data.insight.assetId,
                          ...(data.insight.alertId ? { alertId: data.insight.alertId } : {}),
                          priority: data.insight.alertSeverity === 'critical' ? 'urgent' : 'high',
                          title: t('sensors.workstation.woTitle', {
                            a: data.insight.a.name,
                            b: data.insight.b.name,
                          }),
                        }).toString(),
                      }}
                    >
                      {t('sensors.workstation.createWorkOrder')}
                      <Icon name="right" size="xs" className="mirror-rtl" />
                    </Link>
                  </ForgeButton>
                  <ForgeButton asChild size="sm">
                    <Link to={`/app/assets/${data.insight.assetId}`}>
                      {t('sensors.workstation.openAsset')}
                      <Icon name="right" size="xs" className="mirror-rtl" />
                    </Link>
                  </ForgeButton>
                  <ForgeButton size="sm" onClick={() => setInsightOpen(false)}>
                    {t('sensors.workstation.dismiss')}
                  </ForgeButton>
                </div>
              </div>
            </Panel>
          ) : null}

          {panel ? (
            <WorkstationPanel
              panel={panel}
              chart={data}
              history={history}
              onUndo={undo}
              onExportCsv={exportCsv}
              onExportPng={exportPng}
              onClose={() => setPanel(null)}
            />
          ) : null}

          <SeriesTable
            chart={data}
            visible={visible}
            onToggle={toggleSeries}
            onRemove={removeSeries}
            onAdd={() => setAdding(true)}
          />
        </>
      )}

      <ChannelPickerDialog
        open={adding}
        mode="add"
        channels={catalogue.data?.items ?? []}
        selected={(data?.series ?? []).map((entry) => entry.id)}
        onClose={() => setAdding(false)}
        onSubmit={({ signalIds: picked }) => addSeries(picked)}
      />
    </Page>
  )
}

const PANEL_ICON = {
  alerts: 'bell',
  history: 'rail',
  correlation: 'bolt',
  statistics: 'chart',
  export: 'doc',
}

/** A filename from a chart name. */
const slug = (name) =>
  (name ?? 'chart')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'chart'

/** Hand a Blob to the browser as a download, then let it go. */
function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Copy the resolved colour of every painted node onto the clone.
 *
 * The palette is CSS custom properties declared on `:root`, so an SVG serialised
 * out of the document resolves `var(--hue-forge)` to nothing and every stroke
 * renders black. Reading the computed value off the live node and writing it as
 * a literal attribute on the clone is the only way an export looks like the
 * chart — and it is the one place in the app a colour literal is legitimate,
 * because it is produced at runtime from a token and never written to a file.
 */
function inlineComputedColours(live, clone) {
  const liveNodes = live.querySelectorAll('*')
  const cloneNodes = clone.querySelectorAll('*')
  liveNodes.forEach((node, index) => {
    const target = cloneNodes[index]
    if (!target) return
    const computed = getComputedStyle(node)
    for (const property of ['fill', 'stroke']) {
      const value = computed.getPropertyValue(property)
      if (value && value !== 'none') target.setAttribute(property, value)
    }
  })
}
