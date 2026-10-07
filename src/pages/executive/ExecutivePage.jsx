import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { ErrorState } from '@/components/forge/States'
import { Num } from '@/components/forge/primitives'
import { useExecutive } from '@/features/executive/queries'
import { useGenerateReport } from '@/features/reports/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { useScope } from '@/providers/ScopeProvider'
import { cn } from '@/lib/cn'
import { PERIODS, buildExecutiveModel, buildRoiModel } from './executiveModel'
import { BriefLoading, BriefTab } from './BriefTab'
import { ExecutiveFilterBar } from './ExecutiveFilterBar'
import { PerformanceTab } from './PerformanceTab'
import { RoiTab } from './RoiTab'

const TABS = ['brief', 'performance', 'roi']

/* Sites and Risk & Opportunity were tabs of their own for one release. Both
   now sit inside Performance, so a bookmarked or hand-typed `?tab=` naming
   either resolves to the tab their content moved to rather than to an empty
   panel — or, worse, silently to the brief, which does not hold it. */
const MOVED_TABS = { sites: 'performance', risk: 'performance' }

/**
 * Executive Dashboard — the CXO view.
 *
 * DEMO. See `DEMO-MODE.md` §8.12. Rebuilt against `platform/screens-executive.jsx`,
 * which supersedes `screens3.jsx → EnterpriseScreen`: the estate map and the
 * comparison table are now one tab of five, and the screen's subject is money.
 *
 * ── Three tabs, as declared ───────────────────────────────────────────────
 * The design declares three tabs — brief, financial, roi — and renders five
 * blocks, three of them gated on the same `tab==="financial"` string: the
 * performance figures, the site cards and league table, and the risk and
 * opportunity ledgers, stacked one after another. That stacking is the design's
 * own answer to where they belong, so all three live under Performance in the
 * order the design renders them. `SitesTab` and `RiskTab` remain separate
 * components — the tab strip is not the only reason to split a file — and the
 * brief's "Review risks" button, which called `setTab("risk")` against a tab
 * the design never defines, opens Performance instead.
 *
 * ── The design's `useEffect` is not copied ────────────────────────────────
 * It lists `period` in its dependency array four lines ABOVE the `useState`
 * that declares it — a temporal dead zone that throws on first render under
 * any bundler that does not hoist it away. The staged loader here is driven by
 * the real query lifecycle instead.
 *
 * ── Tab, period and scope are the URL ─────────────────────────────────────
 * All three are `useState` in the design, so no view of this screen can be
 * linked, bookmarked or backed out of — and a board member sent "the executive
 * dashboard" lands on MTD, all sites, the brief, whatever was being discussed.
 * `?tab=&period=&site=` costs three search params.
 *
 * ── Where the money comes from ────────────────────────────────────────────
 * Not from the transport. `/v1/executive/summary` still carries no currency
 * field and `verify:mocks` still asserts it. The commercial overlay is authored
 * in `executiveModel.js`, in the component layer, with a demo notice under
 * every panel that rests on it. Everything operational — OEE, health, anomaly
 * and work-order counts, downtime hours, site coordinates — is the real rollup.
 */
export function ExecutivePage() {
  const { t } = useTranslation(['app', 'common'])
  const navigate = useNavigate()
  const { toast } = useToast()
  const { setSiteId } = useScope()
  const [params, setParams] = useSearchParams()

  const requestedTab = params.get('tab')
  const tab = TABS.includes(requestedTab) ? requestedTab : (MOVED_TABS[requestedTab] ?? 'brief')
  const period = PERIODS.includes(params.get('period')) ? params.get('period') : 'mtd'
  const scopeId = params.get('site') ?? 'all'

  useDocumentTitle(`${t('executive.title')} · ${t('common:brand.name')}`)

  const executive = useExecutive()
  const generate = useGenerateReport()

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value == null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const sites = useMemo(() => executive.data?.sites ?? [], [executive.data])
  const stats = executive.data?.stats ?? null
  const brief = executive.data?.brief ?? null

  /* A scope that names a site the rollup does not have would silently empty
     the screen. Fall back to the estate rather than to nothing. */
  const scope = sites.some((site) => site.id === scopeId) ? scopeId : 'all'

  const model = useMemo(
    () => (stats ? buildExecutiveModel({ sites, stats, period, scopeId: scope }) : null),
    [sites, stats, period, scope],
  )
  const roi = useMemo(() => (model ? buildRoiModel({ model }) : null), [model])

  /* The staged loader. It advances only while the request is genuinely in
     flight and names what the request is doing — the design runs the same four
     stages on a timer whether or not anything is being fetched. */
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (!executive.isPending) return undefined
    const timer = setInterval(() => setStage((held) => held + 1), 520)
    /* Reset on the way OUT, not on the way in: setting state in an effect body
       is a cascading render, and the next request wants stage 0 anyway. */
    return () => {
      clearInterval(timer)
      setStage(0)
    }
  }, [executive.isPending])

  const raiseBoardReport = () =>
    generate.mutate(
      { kind: 'board', period: 'month', siteId: scope === 'all' ? null : scope },
      {
        onSuccess: () => {
          toast(t('reports.toast.started'))
          navigate('/app/reports')
        },
        onError: () => toast(t('reports.toast.failed'), 'error'),
      },
    )

  /* Set the SCOPE, then navigate. `/app/assets?site=…` would look right and do
     nothing: Lines & Assets reads its site from the scope provider. */
  const openSite = (siteId) => {
    setSiteId(siteId)
    navigate('/app/oee')
  }

  const selected = scope === 'all' ? null : scope
  const selectedSite = sites.find((site) => site.id === selected) ?? null

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('executive.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">
            <Num>
              {t('executive.subtitle', {
                sites: stats?.sites ?? 0,
                lines: stats?.lines ?? 0,
                assets: stats?.assets ?? 0,
              })}
            </Num>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ForgeButton onClick={() => navigate('/app/reports')}>
            {t('executive.analytics')}
            <Icon name="right" size="xs" className="mirror-rtl" />
          </ForgeButton>
          <ForgeButton
            variant="primary"
            onClick={raiseBoardReport}
            disabled={executive.isPending || generate.isPending}
          >
            <Icon name="chart" size="xs" />
            {t('executive.boardReport')}
          </ForgeButton>
        </div>
      </header>

      {executive.isError ? (
        <ErrorState
          error={executive.error}
          title={t('executive.loadFailed')}
          onRetry={() => executive.refetch()}
        />
      ) : (
        <>
          <ExecutiveFilterBar
            period={period}
            scopeId={scope}
            sites={sites}
            total={stats?.sites ?? sites.length}
            updatedAt={executive.dataUpdatedAt || null}
            onChange={setParam}
          />

          <div
            role="tablist"
            aria-label={t('executive.tabsLabel')}
            className="mb-5 flex gap-1 overflow-x-auto border-b border-hairline"
          >
            {TABS.map((entry) => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={entry === tab}
                onClick={() => setParam('tab', entry === 'brief' ? null : entry)}
                className={cn(
                  '-mb-px border-b-2 px-3.5 py-2.5 text-body whitespace-nowrap transition-colors',
                  'max-lg:min-h-11',
                  entry === tab
                    ? 'border-forge font-semibold text-ink'
                    : 'border-transparent text-ink-dim hover:text-ink',
                )}
              >
                {t(`executive.tab.${entry}`)}
              </button>
            ))}
          </div>

          {executive.isPending || !model ? (
            <BriefLoading stage={stage} />
          ) : (
            <>
              {tab === 'brief' ? (
                <BriefTab
                  model={model}
                  roi={roi}
                  brief={brief}
                  stats={stats}
                  onTab={(next) => setParam('tab', next)}
                  onExport={() => toast(t('executive.toast.boardPack'))}
                />
              ) : null}

              {tab === 'performance' ? (
                <PerformanceTab
                  model={model}
                  brief={brief}
                  selected={selected}
                  onSelect={(id) => setParam('site', id)}
                />
              ) : null}

              {tab === 'roi' ? (
                <RoiTab roi={roi} onExport={() => toast(t('executive.toast.roiModel'))} />
              ) : null}

              {/* Only once a plant is actually picked — from the map, a card or
                  the table. A permanent button whose label promises a site and
                  delivers the whole estate is worse than no button. */}
              {selectedSite ? (
                <div className="mt-4 flex justify-end">
                  <ForgeButton onClick={() => openSite(selectedSite.id)}>
                    {t('executive.compare.openNamed', { name: selectedSite.name })}
                    <Icon name="right" size="xs" className="mirror-rtl" />
                  </ForgeButton>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </Page>
  )
}
