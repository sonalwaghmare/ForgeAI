import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { TrendChart } from '@/components/forge/TrendChart'
import { EmptyState } from '@/components/forge/States'
import { StateBadge, hueForSeverity } from '@/components/forge/StatusBadge'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { TREND_WINDOWS } from '@/features/lines/api'
import { formatInteger, formatPercent, formatRelative, formatSigned } from '@/lib/format'
import { cn } from '@/lib/cn'
import { toneForHealth } from '@/lib/tone'

/**
 * The AI Synopsis view — the asset read as a briefing rather than as a dashboard.
 *
 * DEMO. This is the prototype's default view for an asset and it is the better
 * default: somebody opening a machine wants to know whether to do something
 * about it, and ten tabs of instrumentation answer that only after you have read
 * them. The Detailed view is one click away for when the answer is yes.
 *
 * ── Everything here is composed from the asset's own record ───────────────
 * The prototype writes one briefing and renders it on all thirty machines, so
 * every asset in it claims a drive-end bearing at 13.7× baseline. The prose here
 * is assembled in the mock handler from health, state and the worst open alert —
 * see `mocks/fixtures/lines.js`. It is specific to the machine, and it cannot
 * contradict the cards underneath it.
 */
export function AssetSynopsis({ asset, target = 85, onDeepDive }) {
  const { t } = useTranslation(['app', 'common'])

  const oee = asset.performance?.find((kpi) => kpi.key === 'oee')?.value ?? null
  const gap = oee == null ? null : Math.round((target - oee) * 10) / 10

  return (
    <div className="flex flex-col gap-3.5">
      {/* Keyed on the asset so navigating from one machine to another remounts
          the control rather than resetting it from an effect — the state belongs
          to that asset's briefing, and a key says so more plainly than a
          synchronous setState inside a dependency change. */}
      <VoiceBriefing key={asset.id} asset={asset} t={t} />

      {/* The briefing. Violet, striped, badged — the three things this codebase
          uses to mean "a machine wrote this", and the only place they are spent. */}
      <Panel stripe="violet">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <Icon name="ai" size="sm" className="shrink-0 text-violet" />
          <span className="min-w-0 flex-1">
            <span className="block text-body-sm font-bold">{t('lines.asset.synopsis.title')}</span>
            <span className="block text-micro font-normal text-ink-dim">
              {t('lines.asset.synopsis.subtitle')}
            </span>
          </span>
          <StateBadge tone={asset.briefing?.urgent ? 'amber' : 'green'} dot={false}>
            {t(asset.briefing?.urgent ? 'lines.asset.synopsis.needsAttention' : 'lines.asset.synopsis.stable')}
          </StateBadge>
        </div>

        <p className="m-0 text-body leading-[1.65] text-ink">{asset.briefing?.text}</p>

        {/* The prompts open the assistant rather than answering inline. A chip
            that produced a second paragraph here would be a chat pretending not
            to be one, and the dock is where the conversation already lives. */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          {(asset.briefing?.prompts ?? []).map((prompt) => (
            <Chip key={prompt} as="span" className="cursor-default">
              <Icon name="ai" size="xs" className="text-violet" />
              {prompt}
            </Chip>
          ))}
        </div>

        <p className="mt-3.5 mb-0 text-micro font-normal italic text-ink-dim">
          {t('common:ai.disclaimer')}
        </p>
      </Panel>

      <Insight>
        {asset.openAlerts.length
          ? t('lines.asset.synopsis.anomaliesInsight', { count: asset.openAlerts.length })
          : t('lines.asset.synopsis.cleanInsight')}
      </Insight>

      <Panel flush>
        <div className="flex items-center gap-3 border-b border-hairline px-4.5 py-3.5">
          <Eyebrow className="flex-1">{t('lines.asset.synopsis.anomaliesTitle')}</Eyebrow>
          <ForgeButton asChild size="sm">
            <Link to="/app/anomalies">
              {t('lines.asset.synopsis.allAlerts')}
              <Icon name="right" size="xs" className="mirror-rtl" />
            </Link>
          </ForgeButton>
        </div>

        {asset.openAlerts.length === 0 ? (
          <EmptyState
            icon="shield"
            title={t('lines.asset.synopsis.noAnomalies')}
            className="border-0 bg-transparent shadow-none"
          />
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {asset.openAlerts.map((alert) => (
              <li key={alert.id} className="border-b border-subtle last:border-b-0">
                <Link
                  to="/app/anomalies"
                  className="flex items-center gap-3 px-4.5 py-3 transition-colors hover:bg-sunken"
                >
                  <Dot tone={hueForSeverity(alert.severity)} size={8} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold">{alert.component}</span>
                    <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                      <Num>
                        {alert.sensor} ·{' '}
                        {t(`common:anomalyTypes.${alert.anomalyType}`, {
                          defaultValue: alert.anomalyType,
                        })}
                      </Num>
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <Mono className="block text-micro text-ink-dim">{alert.id}</Mono>
                    <Num className="mt-0.5 block text-micro font-normal text-ink-dim">
                      {formatRelative(alert.detectedAt)}
                    </Num>
                  </span>
                  <Icon name="right" size="xs" className="shrink-0 text-ink-mute mirror-rtl" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Insight>
        {gap != null && gap > 0
          ? t('lines.asset.synopsis.performanceInsight', { gap, target })
          : t('lines.asset.synopsis.performanceInsightOk', { target })}
      </Insight>

      <Panel flush>
        <div className="flex items-center gap-3 border-b border-hairline px-4.5 py-3.5">
          <Eyebrow className="flex-1">{t('lines.asset.synopsis.performanceTitle')}</Eyebrow>
          <ForgeButton size="sm" onClick={() => onDeepDive('overview')}>
            {t('lines.asset.synopsis.deepDive')}
            <Icon name="right" size="xs" className="mirror-rtl" />
          </ForgeButton>
        </div>
        <dl className="m-0 grid gap-3 p-4.5 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
          {(asset.performance ?? []).map((kpi) => (
            <div key={kpi.key} className="rounded-sm bg-sunken px-3.5 py-3">
              <dt className="eyebrow">{t(`lines.asset.kpi.${kpi.key}`)}</dt>
              <dd className="m-0 mt-1.5">
                {/* A percentage has a ladder behind it, so it takes a colour: OEE
                    at 66 is amber for the same reason a health score of 66 is.
                    Hours do not — a run time of 18.4 is neither good nor bad
                    without a target, and the design's red MTBF is really the
                    delta's colour leaking onto the figure. The delta keeps its
                    own. */}
                <Num
                  className="text-title leading-none"
                  style={kpi.unit === '%' ? { color: `var(--on-${toneForHealth(kpi.value)})` } : undefined}
                >
                  {kpi.unit === '%' ? formatPercent(kpi.value) : formatInteger(kpi.value)}
                </Num>
                {kpi.unit !== '%' ? (
                  <span className="ms-1 text-micro font-normal text-ink-dim">{kpi.unit}</span>
                ) : null}
                {kpi.deltaPct ? (
                  <Num
                    className="mt-1 block text-micro font-normal"
                    style={{ color: `var(--on-${kpi.deltaPct > 0 ? 'green' : 'red'})` }}
                  >
                    {formatSigned(kpi.deltaPct)}%
                  </Num>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      {asset.oeeTrend ? <OeeTrendCard asset={asset} target={target} t={t} /> : null}

      <Panel>
        <Eyebrow className="mb-3">{t('lines.asset.synopsis.glance')}</Eyebrow>
        <dl className="m-0 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
          <Glance label={t('lines.asset.synopsis.glanceAlerts')} value={formatInteger(asset.atAGlance?.openAlerts ?? 0)} tone={asset.atAGlance?.openAlerts ? 'amber' : null} />
          <Glance label={t('lines.asset.synopsis.glanceWorkOrders')} value={formatInteger(asset.atAGlance?.workOrders ?? 0)} />
          <Glance
            label={t('lines.asset.synopsis.glanceSensors')}
            value={`${formatInteger(asset.atAGlance?.sensorsOnline ?? 0)} / ${formatInteger(asset.atAGlance?.sensorCount ?? 0)}`}
            tone={asset.atAGlance?.sensorsOnline === asset.atAGlance?.sensorCount ? 'green' : 'red'}
          />
          <Glance
            label={t('lines.asset.synopsis.glanceNextPM')}
            value={
              asset.atAGlance?.nextPMHours === 0
                ? t('lines.asset.pmOverdue')
                : t('lines.asset.pmIn', { hours: formatInteger(asset.atAGlance?.nextPMHours ?? 0) })
            }
            tone={asset.atAGlance?.nextPMHours === 0 ? 'red' : null}
          />
          <Glance
            label={t('lines.asset.synopsis.glanceRunHours')}
            value={formatInteger(asset.atAGlance?.runHours ?? 0)}
          />
        </dl>
      </Panel>
    </div>
  )
}

/**
 * The OEE trend, with the window it covers.
 *
 * The chips are real: the payload carries a trace per window, generated at that
 * window's own resolution, so switching from 24h to 4h shows detail the longer
 * view averages away rather than the same line relabelled. All five arrive
 * together — about 180 numbers — because a request per chip would put a spinner
 * on a control whose whole purpose is to be flicked through.
 *
 * No legend: one series, and the card's own eyebrow already names it.
 */
function OeeTrendCard({ asset, target, t }) {
  const [window, setWindow] = useState('24h')
  const trend = asset.oeeTrend[window] ?? asset.oeeTrend['24h']
  if (!trend) return null

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Eyebrow className="flex-1">{t('lines.asset.synopsis.trendTitle')}</Eyebrow>
        <div
          role="group"
          aria-label={t('lines.asset.synopsis.windowLabel')}
          className="flex flex-wrap gap-1.5"
        >
          {TREND_WINDOWS.map((entry) => (
            <Chip
              key={entry}
              selected={entry === window}
              onClick={() => setWindow(entry)}
              className="px-2 py-[3px] text-micro max-lg:px-2.5 max-lg:py-1.5 max-lg:text-body-sm"
            >
              {t(`lines.asset.synopsis.window.${entry}`)}
            </Chip>
          ))}
        </div>
      </div>

      <TrendChart
        legend={false}
        series={[
          { key: 'oee', label: t('lines.asset.kpi.oee'), tone: 'muted', values: trend.values },
        ]}
        band={[target - 15, target]}
        xTicks={trend.ticks}
        label={t('lines.asset.synopsis.trendLabel')}
        bandLabel={t('oee.trend.band', { lo: target - 15, hi: target })}
        xLabel={t('oee.trend.xLabel')}
        format={(value) => formatPercent(value)}
      />
    </Panel>
  )
}

/**
 * A line of the machine's reasoning between two cards.
 *
 * The prototype calls these section insights and they are the connective tissue
 * of the whole view: without them it is four cards, and with them it is an
 * argument. Not a Panel — they sit BETWEEN panels, and giving them a surface
 * would make them a fifth card rather than the sentence introducing the next one.
 */
function Insight({ children }) {
  return (
    <p className="m-0 flex items-start gap-2.5 px-1 text-body text-ink">
      <Icon name="ai" size="sm" className="mt-0.5 shrink-0 text-violet" />
      <span>{children}</span>
    </p>
  )
}

function Glance({ label, value, tone }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="m-0 mt-1">
        <Num className="text-title" style={tone ? { color: `var(--on-${tone})` } : undefined}>
          {value}
        </Num>
      </dd>
    </div>
  )
}

/**
 * The spoken briefing.
 *
 * ── Why this is real and not a progress bar ───────────────────────────────
 * The prototype animates a progress bar on a timer and attempts speech
 * best-effort, so the bar keeps moving whether or not anything is being said.
 * That is a fake, and on a demo screen a fake that runs for 55 seconds is a long
 * time to be caught in. Here the progress comes from the utterance's own
 * boundary events, so the bar tracks the actual voice; if the browser has no
 * speech synthesis the control is not rendered at all.
 *
 * The script is the briefing text the card already shows, not a second copy —
 * one source, so they cannot say different things.
 */
function VoiceBriefing({ asset, t }) {
  const [speaking, setSpeaking] = useState(false)
  const [progress, setProgress] = useState(0)
  const utteranceRef = useRef(null)

  const script = asset.briefing?.text ?? ''
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  // Leaving the page mid-sentence must stop the voice. Without this the browser
  // keeps talking about a machine nobody is looking at any more.
  useEffect(() => {
    if (!supported) return undefined
    return () => window.speechSynthesis.cancel()
  }, [supported])

  if (!supported || !script) return null

  const stop = () => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
    setProgress(0)
  }

  const toggle = () => {
    if (speaking) {
      stop()
      return
    }
    const utterance = new SpeechSynthesisUtterance(script)
    utterance.rate = 1.02
    // `onboundary` fires per word with the character index reached, which is a
    // real position in the text rather than an elapsed-time guess.
    utterance.onboundary = (event) => {
      if (event.charIndex != null) setProgress(Math.min(100, (event.charIndex / script.length) * 100))
    }
    utterance.onend = () => {
      setProgress(100)
      setSpeaking(false)
    }
    utterance.onerror = () => stop()
    utteranceRef.current = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={toggle}
        aria-label={t(speaking ? 'lines.asset.synopsis.pause' : 'lines.asset.synopsis.play')}
        className={cn(
          'inline-flex items-center gap-2.5 rounded-pill border border-violet/40 tint-violet px-3 py-1.5',
          'text-body-sm font-semibold text-on-violet transition-colors hover:border-violet',
        )}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet text-white">
          <Icon name={speaking ? 'x' : 'right'} size="xs" />
        </span>
        {t(speaking ? 'lines.asset.synopsis.playing' : 'lines.asset.synopsis.play')}
        {speaking ? (
          <span aria-hidden="true" className="inline-block h-1 w-16 overflow-hidden rounded-pill bg-sunken">
            <span
              className="block h-full rounded-pill bg-violet transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </span>
        ) : null}
      </button>
    </div>
  )
}
