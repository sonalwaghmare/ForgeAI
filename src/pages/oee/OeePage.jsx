import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { PERIODS } from '@/features/oee/api'
import { useOeeLines, useOeeSummary } from '@/features/oee/queries'
import { useHomeContext } from '@/features/home/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { buildOeeModel, OEE_BANDS } from './oeeModel'
import { OeeFilterBar } from './OeeFilterBar'
import { SynopsisView } from './SynopsisView'
import { OverviewView } from './OverviewView'
import { LossesView } from './LossesView'
import { LinesView } from './LinesView'
import { QualityView } from './QualityView'

/**
 * OEE & Operations.
 *
 * DEMO. Registered only when `VITE_DEMO_MODE` is on; with the flag off the route
 * falls through to the module placeholder, which is the truth about it. See
 * `DEMO-MODE.md` §8.2.
 *
 * ── The shape ─────────────────────────────────────────────────────────────
 * The design is one module with five views over one dataset: an AI synopsis,
 * the Overview it summarises, the loss analysis behind that, lines and shifts,
 * and quality and output. A filter bar sits above all five and scopes them
 * together.
 *
 * ── Everything a reader can see is in the URL ─────────────────────────────
 * `?view=`, `?period=`, `?line=`, `?shift=`, `?band=`, `?q=`, `?compare=0`.
 *
 * The prototype holds all seven in `useState`, which means no view inside this
 * module can be linked, bookmarked or backed out of: send a colleague to "the
 * night-shift loss analysis" and you send them to the synopsis with the filters
 * cleared. Search params rather than child routes because these are one screen
 * under one heading with one filter bar — a nested route per tab would make the
 * shared bar remount and the shared scope reset on every switch.
 *
 * ── Two queries, unchanged ────────────────────────────────────────────────
 * `useOeeSummary(period)` and `useOeeLines()` are the flows this module already
 * had and they still carry the only measured figures on the screen — the four
 * factors, the trend, the waterfall, the AI attribution and the site's lines.
 * Everything the rebuild adds is derived from those in `oeeModel.js` rather than
 * fetched, so nothing new is authored into a fixture and nothing on the screen
 * can contradict the headline. The demo notice at the foot of each panel says
 * which is which.
 */

const VIEWS = ['synopsis', 'overview', 'losses', 'lines', 'quality']
const VIEW_ICON = { synopsis: 'ai', overview: 'gauge', losses: 'chart', lines: 'factory', quality: 'shield' }

export function OeePage() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'synopsis'
  const period = PERIODS.includes(params.get('period')) ? params.get('period') : 'day'
  const lineId = params.get('line') ?? 'all'
  const shiftKey = params.get('shift') ?? 'all'
  const band = params.get('band') ?? 'all'
  const query = params.get('q') ?? ''
  // Comparison is ON unless it has been switched off, which is the design's
  // default and means the common case carries no query string at all.
  const compare = params.get('compare') !== '0'

  const summary = useOeeSummary(period)
  const lines = useOeeLines()
  const context = useHomeContext()

  useDocumentTitle(`${t('oee.title')} · ${t('common:brand.name')}`)

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value == null || value === '') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const model = useMemo(
    () =>
      buildOeeModel({
        summary: summary.data ?? null,
        lines: lines.data?.items ?? [],
        period,
      }),
    [summary.data, lines.data, period],
  )

  /* ── The scope, applied once ───────────────────────────────────────────
     The filter bar narrows the LINE-LEVEL and SHIFT-LEVEL views, and it does
     not narrow the plant headline — a site's OEE is not the average of the
     rows a reader happens to have filtered to, and quietly recomputing it
     would be the screen's one genuinely misleading move. The bar says so.

     Done here rather than in each view so the Overview's line strip and the
     Lines tab's table cannot disagree about what "at risk" selected. */
  const scoped = useMemo(() => {
    if (!model) return null
    const text = query.trim().toLowerCase()
    const inBand = OEE_BANDS[band]
    const visibleLines = model.lines.filter((line) => {
      if (lineId !== 'all' && line.id !== lineId) return false
      if (inBand && (line.oee == null || !inBand(line.oee))) return false
      if (text) {
        const haystack = `${line.name} ${line.topLoss ?? ''}`.toLowerCase()
        if (!haystack.includes(text)) return false
      }
      return true
    })
    const visibleShifts =
      shiftKey === 'all' ? model.shifts : model.shifts.filter((shift) => shift.key === shiftKey)
    return { ...model, visibleLines, visibleShifts }
  }, [model, lineId, band, query, shiftKey])

  const failed = summary.isError

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('oee.title')}</h1>
          <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">
            {t('oee.subtitle', {
              site: context.data?.siteName ?? '',
              window: t(`oee.window.${period}`),
              prior: t(`oee.prior.${period}`),
              target: formatPercent(model?.target ?? 85, 0),
            })}
          </p>
        </div>

        {/* Export is offered and refuses, rather than being left out or left
            inert. Nothing on this screen is recorded — it is computed from four
            factors — so there is no file to produce, and saying that is more
            use than a button that downloads a snapshot of a derivation. */}
        <ForgeButton size="sm" onClick={() => toast(t('oee.exportToast'), 'info')}>
          <Icon name="doc" size="sm" aria-hidden="true" />
          {t('oee.export')}
        </ForgeButton>
      </header>

      <OeeFilterBar
        period={period}
        lineId={lineId}
        shiftKey={shiftKey}
        band={band}
        query={query}
        compare={compare}
        lines={model?.lines ?? []}
        summaryLine={
          model
            ? t('oee.filters.summary', {
                units: model.output.goodUnits.toLocaleString(),
                stops: model.reliability.stops,
              })
            : null
        }
        onChange={setParam}
      />

      <nav
        aria-label={t('oee.viewLabel')}
        className="mb-5 flex gap-1 overflow-x-auto border-b border-hairline"
      >
        {VIEWS.map((entry) => {
          const on = entry === view
          return (
            <button
              key={entry}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => setParam('view', entry === 'synopsis' ? null : entry)}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-body whitespace-nowrap transition-colors',
                on
                  ? 'border-forge font-semibold text-ink'
                  : 'border-transparent text-ink-dim hover:text-ink',
              )}
            >
              <Icon
                name={VIEW_ICON[entry]}
                size="sm"
                aria-hidden="true"
                // Violet is AI authorship and nothing else, so only the synopsis
                // tab's glyph takes it — and only when it is the one selected.
                className={cn(
                  entry === 'synopsis' && on ? 'text-violet' : on ? 'text-forge' : 'text-ink-mute',
                )}
              />
              {t(`oee.view.${entry}`)}
            </button>
          )
        })}
      </nav>

      {failed ? (
        <ErrorState
          error={summary.error}
          title={t('oee.loadFailed')}
          onRetry={() => summary.refetch()}
        />
      ) : !scoped ? (
        <SkeletonRows count={6} />
      ) : (
        <>
          {view === 'synopsis' ? <SynopsisView model={scoped} period={period} /> : null}
          {view === 'overview' ? (
            <OverviewView model={scoped} period={period} compare={compare} onParam={setParam} />
          ) : null}
          {view === 'losses' ? <LossesView model={scoped} /> : null}
          {view === 'lines' ? (
            <LinesView model={scoped} compare={compare} linesQuery={lines} />
          ) : null}
          {view === 'quality' ? (
            <QualityView model={scoped} period={period} compare={compare} />
          ) : null}
        </>
      )}
    </Page>
  )
}
