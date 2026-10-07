import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { useHomeKpis } from '@/features/home/queries'
import { formatInteger, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The four-tile shift strip, from the prototype's My Dashboard.
 *
 * DEMO. Two of the four values are derived from the alert fixture by the mock
 * handler, so the strip and the anomaly list it links to cannot contradict each
 * other; the other two are authored. See `mocks/fixtures/home.js`.
 *
 * ── Why these tiles are links and the top bar's are not ────────────────────
 * The top bar's KPI strip is ambient — it tells you where you are while you do
 * something else. These four are the opposite: three of them are the shortest
 * route from Home to the screen that explains the number, and the prototype
 * makes them clickable for that reason. A tile that navigates is an `<a>`, so it
 * gets a focus ring, a middle-click and a status-bar URL for free.
 *
 * Sensors Online is deliberately NOT a link. Sensor Explorer does not exist yet,
 * and a tile that navigates to a placeholder is worse than one that sits still.
 */

/** Value formatting per tile. Percent and count are not interchangeable, and a
    map keeps the branch out of the render. */
const FORMAT = {
  shiftOee: (value) => formatPercent(value),
}

export function ShiftKpiStrip() {
  const { t } = useTranslation(['app', 'common'])
  const kpis = useHomeKpis()

  return (
    <Panel>
      <div className="mb-3.5 flex items-center gap-3">
        <Eyebrow className="flex-1">{t('home.dashboard.kpis')}</Eyebrow>
      </div>

      {kpis.isPending ? (
        <SkeletonRows count={1} />
      ) : (
        <dl className="m-0 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
          {(kpis.data ?? []).map((kpi) => (
            <KpiTile key={kpi.key} kpi={kpi} t={t} />
          ))}
        </dl>
      )}
    </Panel>
  )
}

function KpiTile({ kpi, t }) {
  const format = FORMAT[kpi.key] ?? formatInteger
  const value = format(kpi.value)

  /**
   * The caption under the number. Each tile says a different kind of second
   * thing — a count, a target, a bare instruction — so the interpolations differ
   * and a single key would not carry them.
   */
  const caption = {
    anomaliesActive: () => t('home.dashboard.kpi.anomaliesActiveSub', { count: kpi.critical ?? 0 }),
    criticalAlerts: () => t('home.dashboard.kpi.criticalAlertsSub'),
    sensorsOnline: () =>
      t('home.dashboard.kpi.sensorsOnlineSub', {
        uptime: formatPercent(99.9),
        offline: formatInteger(kpi.offline ?? 0),
      }),
    shiftOee: () => t('home.dashboard.kpi.shiftOeeSub', { target: formatPercent(kpi.target) }),
  }[kpi.key]?.()

  const body = (
    <>
      <div className="mb-2.5 flex items-center">
        <span className="flex size-6 items-center justify-center rounded-xs border border-hairline bg-sunken">
          <Icon
            name={kpi.icon}
            size="sm"
            className={cn(!kpi.tone && 'text-on-forge')}
            style={kpi.tone ? { color: `var(--on-${kpi.tone})` } : undefined}
          />
        </span>
        <span className="flex-1" />
        {/* The prototype's expand glyph. Decorative here — the whole tile is the
            target, so a second control inside it would be a nested hit area. */}
        {kpi.to ? <Icon name="arrow-right" size="xs" className="text-ink-mute" /> : null}
      </div>

      <dt className="text-body-sm text-ink-dim">{t(`home.dashboard.kpi.${kpi.key}`)}</dt>
      <dd className="m-0 mt-1">
        <Num
          className="block text-metric-sm"
          style={kpi.tone ? { color: `var(--on-${kpi.tone})` } : undefined}
        >
          {value}
        </Num>
        {caption ? <span className="mt-1 block text-micro font-normal text-ink-dim">{caption}</span> : null}
      </dd>
    </>
  )

  if (!kpi.to) {
    return <div className="rounded-sm border border-hairline bg-card p-3.5">{body}</div>
  }

  return (
    <Link
      to={kpi.to}
      className="rounded-sm border border-hairline bg-card p-3.5 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-forge/40 hover:shadow-lift"
    >
      {body}
    </Link>
  )
}
