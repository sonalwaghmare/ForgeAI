import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page, useAssistant } from '@/shell/AppShell'
import { AlertCard } from '@/components/forge/AlertCard'
import { Briefing } from '@/components/forge/Briefing'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { SignalTrace } from '@/components/forge/SignalTrace'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useAlertAnalysis, useAlerts } from '@/features/alerts/queries'
import { useBriefing } from '@/features/briefing/queries'
import { useHomeContext } from '@/features/home/queries'
import { useOrg, useTopline } from '@/features/operations/queries'
import { useSession } from '@/features/auth/mutations'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDecimal, formatInteger, formatPercent, formatRelative, formatTime } from '@/lib/format'
import { toneForHealth } from '@/lib/tone'
import { useDemoRole } from '@/providers/DemoRoleProvider'
import { useScope } from '@/providers/ScopeProvider'
import { config } from '@/services/config'
import { cn } from '@/lib/cn'
import { AlertFeed } from './home/AlertFeed'
import { MyAssetsTable } from './home/MyAssetsTable'
import { MyTasks } from './home/MyTasks'
import { ShiftHandoverCard } from './home/ShiftHandoverCard'
import { ShiftKpiStrip } from './home/ShiftKpiStrip'
import { WatchedAssets } from './home/WatchedAssets'

/**
 * Home — the product's actual home surface.
 *
 * Not a dashboard. PRODUCT.md's second positioning claim is that a role-adaptive
 * conversational briefing replaces one: the same plant state produces a
 * different, shorter, more actionable read for an operator than for a COO. The
 * dashboard still exists, but as the *second* tab, because a grid of tiles is
 * what you open when you already know what you are looking for.
 *
 * The composition follows the prototype: a centred greeting, the assistant
 * composer directly beneath it, contextual prompts, then the two tabs. Putting
 * the composer above the content is the whole argument — the first thing the
 * surface offers is a question, not a number.
 */

const FLAGSHIP = 'ALR-4471'

/** Time-of-day greeting. Derived from the clock, which is genuinely local. */
function greetingKey(hour) {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export function HomePage() {
  const { t } = useTranslation(['app', 'common'])
  // `role` only. The fixture person behind a role is not the signed-in user, and
  // greeting someone by a demo name is worse than not greeting them at all.
  const { role } = useDemoRole()
  const { data: session } = useSession()
  const briefing = useBriefing(role)
  const [tab, setTab] = useState('synopsis')
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')

  useDocumentTitle(`${t('screens.home')} · ${t('common:brand.name')}`)

  /**
   * First name only, from the signed-in account.
   *
   * `named` drives an ICU select in the greeting string, so a missing name gives
   * "Good morning" rather than "Good morning, " with a dangling comma. The
   * punctuation lives in the translation because not every language puts it
   * there — interpolating an empty string would leave the artefact behind in all
   * of them.
   */
  const name = session?.user?.name?.trim().split(/\s+/)[0] ?? ''
  const greeting = t(`home.greeting.${greetingKey(new Date().getHours())}`, {
    name,
    named: name ? 'yes' : 'no',
  })

  /**
   * Hand the question to the assistant.
   *
   * It used to navigate to the anomaly list whatever was typed, because the
   * Copilot screen did not exist and routing to a placeholder is worse than
   * routing somewhere real. It exists now, and it takes a seeded question in
   * `?q=` — so the composer carries the words across instead of dropping them
   * and landing the reader on a list.
   *
   * With the flag off there is no Copilot screen, so the old behaviour stands
   * rather than becoming a broken link.
   */
  const ask = (asked) => {
    const text = (asked ?? '').trim()
    if (!config.demoMode) {
      navigate('/app/anomalies')
      return
    }
    if (!text) return
    navigate(`/app/copilot?q=${encodeURIComponent(text)}`)
  }

  return (
    <Page>
      {/* ── Greeting and composer ─────────────────────────────────────── */}
      <div className="mx-auto mb-6 max-w-[42rem] text-center">
        <h1 className="m-0 text-display text-balance">{greeting}</h1>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            ask(question)
          }}
          className="mt-4.5 rounded-lg border border-hairline bg-card p-3.5 text-start shadow-edge focus-within:border-forge"
        >
          <label className="sr-only" htmlFor="home-ask">
            {t('home.composer.label')}
          </label>
          <textarea
            id="home-ask"
            rows={2}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t('home.composer.placeholder')}
            className="w-full resize-none border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
          />
          <div className="flex items-center justify-end">
            <ForgeButton type="submit" variant="primary" size="sm" aria-label={t('home.composer.send')}>
              <Icon name="send" size="sm" />
            </ForgeButton>
          </div>
        </form>

        {briefing.data?.suggestions?.length ? (
          <div className="mt-3.5 flex flex-wrap justify-center gap-2">
            {briefing.data.suggestions.map((suggestion) => (
              <Chip key={suggestion} onClick={() => ask(suggestion)}>
                <Icon name="ai" size="xs" className="text-violet" />
                {suggestion}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label={t('home.tabs.label')}
        className="mb-5 flex justify-center gap-1 border-b border-hairline"
      >
        {[
          ['synopsis', t('home.tabs.synopsis'), 'ai'],
          ['dashboard', t('home.tabs.dashboard'), 'home'],
        ].map(([id, label, icon]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-4.5 py-2.5 text-control transition-colors',
              tab === id
                ? 'border-b-forge font-bold text-ink'
                : 'border-b-transparent font-medium text-ink-dim hover:text-ink',
              'max-lg:min-h-11',
            )}
          >
            <Icon
              name={icon}
              size="sm"
              className={cn(tab !== id && 'text-ink-mute')}
              style={tab === id && id === 'synopsis' ? { color: 'var(--hue-violet)' } : undefined}
            />
            {label}
          </button>
        ))}
      </div>

      {tab === 'synopsis' ? (
        briefing.isPending ? (
          <SkeletonRows count={4} className="mx-auto max-w-[56rem]" />
        ) : briefing.isError ? (
          <ErrorState error={briefing.error} onRetry={() => briefing.refetch()} />
        ) : (
          <>
            <Briefing blocks={briefing.data.blocks} />
            <p className="mx-auto mt-5 max-w-[56rem] text-micro font-normal text-ink-dim">
              {t('home.generatedAt', { when: formatRelative(briefing.data.generatedAt) })}
            </p>
          </>
        )
      ) : (
        <MyDashboard />
      )}
    </Page>
  )
}

/* ══ MY DASHBOARD ══════════════════════════════════════════════════════ */

/**
 * The second tab. Deliberately the second: a grid of tiles is what you open when
 * you already know what you are looking for, and the briefing is what you read
 * when you do not.
 *
 * ── Two compositions, one tab ──────────────────────────────────────────────
 * With `VITE_DEMO_MODE` off this is exactly what it has always been: the shift
 * KPI panel, one watched trace, the active-alert feed, and site health beside
 * them. Everything on it is answered by an endpoint that exists.
 *
 * With the flag on it becomes the prototype's full dashboard — the four-tile
 * strip, My Tasks, the watched-asset carousel, the asset table, and the shift
 * handover card. Those five are authored fixtures; see `mocks/fixtures/home.js`.
 *
 * The two are written out separately rather than as one tree full of
 * conditionals. The layouts genuinely differ — the prototype moves the alert
 * feed into the right column and site health off the screen — and a single tree
 * that tried to be both would be a column of ternaries nobody could read, in the
 * one place where "what does this look like with the flag off" has to stay
 * answerable at a glance.
 */
function MyDashboard() {
  return config.demoMode ? <PrototypeDashboard /> : <LiveDashboard />
}

/* ══ LIVE — what ships ═══════════════════════════════════════════════════ */

function LiveDashboard() {
  const { t } = useTranslation(['app', 'common'])
  const { params } = useScope()
  const topline = useTopline(params)
  const analysis = useAlertAnalysis(FLAGSHIP)

  return (
    <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)_minmax(300px,380px)] max-xl:grid-cols-1">
      <div className="flex flex-col gap-4">
        {/* Shift KPIs */}
        <Panel>
          <div className="mb-3.5 flex items-center gap-3">
            <Eyebrow className="flex-1">{t('home.dashboard.kpis')}</Eyebrow>
            <ForgeButton asChild size="sm">
              <Link to="/app/oee" aria-label={t('home.dashboard.openOee')}>
                <Icon name="right" size="xs" className="mirror-rtl" />
              </Link>
            </ForgeButton>
          </div>
          {topline.isPending ? (
            <SkeletonRows count={1} />
          ) : (
            <dl className="m-0 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr))]">
              <Kpi label={t('common:metrics.oee')} value={formatPercent(topline.data.oee.value)} tone="amber" />
              <Kpi label={t('common:metrics.mtbf')} value={`${formatInteger(topline.data.mtbf.value)}h`} />
              <Kpi label={t('common:metrics.mttr')} value={`${formatDecimal(topline.data.mttr.value)}h`} />
              <Kpi
                label={t('common:metrics.anomalies24h')}
                value={formatInteger(topline.data.anomalies24h.value)}
                tone="amber"
              />
            </dl>
          )}
        </Panel>

        {/* Live monitoring — the watched asset's own trace */}
        <Panel>
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <Eyebrow className="flex-1">{t('home.dashboard.watched')}</Eyebrow>
            <span className="inline-flex items-center gap-1.5 rounded-pill tint-green px-2.5 py-0.5 text-micro text-on-green">
              <Dot tone="green" size={6} />
              {t('home.dashboard.streaming')}
            </span>
            <ForgeButton asChild size="sm">
              <Link to="/app/sensors" aria-label={t('home.dashboard.openSensors')}>
                <Icon name="right" size="xs" className="mirror-rtl" />
              </Link>
            </ForgeButton>
          </div>
          <FlagshipTrace analysis={analysis} />
        </Panel>

        <ActiveAlerts />
      </div>

      <SiteHealth />
    </div>
  )
}

/* ══ PROTOTYPE — the demo composition ════════════════════════════════════ */

function PrototypeDashboard() {
  return (
    <>
      <DashboardToolbar />
      <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)_minmax(300px,360px)] max-xl:grid-cols-1">
        <div className="flex flex-col gap-4">
          <ShiftKpiStrip />
          <MyTasks />
          <WatchedAssets />
          <MyAssetsTable />
        </div>

        <div className="flex flex-col gap-4">
          <ShiftHandoverCard />
          {/* The dense feed, not the `AlertCard` stack the live dashboard uses.
              This column is 340px wide and holds six anomalies; a full alert
              object in it is five badges tall with every line wrapping. */}
          <AlertFeed />
        </div>
      </div>
    </>
  )
}

/**
 * Site, shift and the clock — the prototype's line above the dashboard.
 *
 * The time is rendered in the SITE's zone, not the reader's. A plant manager in
 * one timezone reading a Findlay dashboard needs Findlay's clock; showing them
 * their own would make every timestamp on the screen argue with this one.
 */
function DashboardToolbar() {
  const { t } = useTranslation(['app', 'common'])
  const context = useHomeContext()

  if (!context.data) return null

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-3">
      <p className="m-0 inline-flex items-center gap-2 text-body-sm text-ink-dim">
        <Icon name="cal" size="sm" className="text-ink-mute" />
        {t('home.dashboard.contextLine', {
          site: context.data.siteName,
          shift: t(`common:shift.${context.data.shift}`),
          time: formatTime(context.data.asOf, context.data.timeZone),
        })}
      </p>
      <div className="flex-1" />
      <ForgeButton size="sm">
        <Icon name="gear" size="xs" />
        {t('home.dashboard.editDashboard')}
      </ForgeButton>
    </div>
  )
}

/* ══ SHARED BETWEEN BOTH ═════════════════════════════════════════════════ */

function FlagshipTrace({ analysis }) {
  const { params } = useScope()
  const alerts = useAlerts({ ...params, sort: 'severity' })
  const flagship = (alerts.data?.items ?? []).find((alert) => alert.id === FLAGSHIP)

  if (analysis.isPending || !flagship) return <SkeletonRows count={1} />

  return (
    <SignalTrace
      values={analysis.data.trace}
      threshold={analysis.data.traceThreshold}
      normalBand={analysis.data.traceNormalBand}
      anomalyFrom={analysis.data.traceAnomalyFrom}
      unit={analysis.data.traceUnit}
      label={flagship.assetName}
    />
  )
}

/** The live anomaly feed. Real data in both modes — it is not part of the demo. */
function ActiveAlerts() {
  const { t } = useTranslation(['app', 'common'])
  const { params } = useScope()
  const { ground } = useAssistant()
  const alerts = useAlerts({ ...params, sort: 'severity' })
  const items = (alerts.data?.items ?? []).filter((alert) => alert.status !== 'resolved')

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Eyebrow className="flex-1">{t('home.dashboard.activeAlerts')}</Eyebrow>
        <ForgeButton asChild size="sm">
          <Link to="/app/anomalies">{t('common:actions.viewAll')}</Link>
        </ForgeButton>
      </div>
      {alerts.isPending ? (
        <SkeletonRows count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="check"
          title={t('home.dashboard.noAlerts')}
          body={t('home.dashboard.noAlertsBody')}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.slice(0, 4).map((alert) => (
            <AlertCard key={alert.id} alert={alert} onSelect={ground} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Site health. Live-mode only — the prototype's right column is the handover. */
function SiteHealth() {
  const { t } = useTranslation(['app', 'common'])
  const { params } = useScope()
  const topline = useTopline(params)
  const org = useOrg()

  return (
    <Panel className="h-fit">
      <div className="mb-3.5 flex items-center gap-3">
        <Eyebrow className="flex-1">{t('home.dashboard.myAssets')}</Eyebrow>
        <ForgeButton asChild size="sm">
          <Link to="/app/assets" aria-label={t('home.dashboard.openAssets')}>
            <Icon name="right" size="xs" className="mirror-rtl" />
          </Link>
        </ForgeButton>
      </div>
      {topline.isPending || org.isPending ? (
        <SkeletonRows count={2} />
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {topline.data.sites.map((health) => {
            const site = org.data.sites.find((entry) => entry.id === health.siteId)
            const tone = toneForHealth(health.health)
            return (
              <li
                key={health.siteId}
                className="flex items-center gap-3 border-t border-subtle py-2.5 first:border-t-0"
              >
                <Dot tone={tone} size={7} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold">{site?.name}</span>
                  <span className="block text-micro font-normal text-ink-dim">
                    {formatInteger(site?.lines)} lines · {formatInteger(site?.assets)} assets
                  </span>
                </span>
                <span className="text-end">
                  <Num className="block text-body-sm font-bold" style={{ color: `var(--on-${tone})` }}>
                    {formatPercent(health.oee)}
                  </Num>
                  <Mono className="block text-micro text-ink-dim">{site?.units.vibration}</Mono>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function Kpi({ label, value, tone }) {
  return (
    <div className="rounded-sm bg-sunken px-3 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="m-0 mt-1">
        <Num
          className="text-title leading-none"
          style={tone ? { color: `var(--on-${tone})` } : undefined}
        >
          {value}
        </Num>
      </dd>
    </div>
  )
}
