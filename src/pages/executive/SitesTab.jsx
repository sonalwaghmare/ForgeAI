import { useTranslation } from 'react-i18next'
import { Meter } from '@/components/forge/Meter'
import { Panel } from '@/components/forge/Panel'
import { StateBadge } from '@/components/forge/StatusBadge'
import { WorldMap } from '@/components/forge/WorldMap'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent, formatSigned } from '@/lib/format'
import { ON_TINT_CLASS, toneForHealth } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { STATE_TONE, formatMoney } from './executiveModel'
import { Bar, DemoNotice } from './parts'

/**
 * Sites — the estate, plant by plant.
 *
 * ── A section of Performance, not a tab ───────────────────────────────────
 * In `screens-executive.jsx` the site cards and the league table sit in a block
 * gated on `tab==="financial"`, immediately after another block gated on the
 * same string and immediately before a third. That is the design's own answer
 * to where this belongs, so it is rendered by `PerformanceTab` between the
 * operating figures and the risk ledgers. It stays its own file only because
 * it is large.
 *
 * ── The map stays ─────────────────────────────────────────────────────────
 * `WorldMap` projects the sites' REAL coordinates through bundled Natural Earth
 * geometry — no key, no tile server, every fill a token. The new design drops
 * it; keeping it above the section that is about where the plants are costs
 * nothing and is the one thing on this screen that is not authored.
 *
 * ── Nothing here is stated twice ──────────────────────────────────────────
 * OEE, health, anomaly counts, work orders and downtime hours are the server's.
 * Only revenue and margin are authored, and the downtime COST is those hours
 * times the one rate this module owns.
 */
export function SitesTab({ model, selected, onSelect, currency = 'USD' }) {
  const { t } = useTranslation('app')
  const ranked = [...model.rows].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Eyebrow as="h2" className="m-0 flex-1">
            {t('executive.map.title')}
          </Eyebrow>
          <span className="text-micro font-normal text-ink-mute">
            {t('executive.map.legend')}
          </span>
        </div>

        <WorldMap
          label={t('executive.map.label')}
          sites={model.rows.map((site) => ({
            id: site.id,
            name: site.name,
            coords: site.coords,
            tone: STATE_TONE[site.state],
          }))}
          selectedId={selected}
          onSelect={(id) => onSelect(selected === id ? null : id)}
        />

        <p className="m-0 mt-2 text-micro font-normal text-ink-mute">{t('executive.map.note')}</p>
      </Panel>

      {/* ── The cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
        {model.rows.map((site) => {
          const tone = STATE_TONE[site.state]
          return (
            <Panel
              key={site.id}
              as="button"
              type="button"
              interactive
              stripe={tone}
              aria-pressed={selected === site.id}
              onClick={() => onSelect(selected === site.id ? null : site.id)}
              className={cn(
                'text-start',
                selected === site.id && 'border-forge/60 shadow-lift',
              )}
            >
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-body font-semibold">{site.name}</span>
                <StateBadge tone={tone}>{t(`executive.state.${site.state}`)}</StateBadge>
              </div>
              <span className="mb-2.5 block text-micro text-ink-dim">
                {site.city}
                {site.countryName ? `, ${site.countryName}` : null}
              </span>

              <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Num
                  className={cn(
                    'text-metric-sm leading-none',
                    ON_TINT_CLASS[toneForHealth(site.oee ?? 0)],
                  )}
                >
                  {formatPercent(site.oee)}
                </Num>
                <span className="text-micro text-ink-dim">{t('executive.kpi.oee')}</span>
                <Num className="ms-auto text-micro font-semibold text-ink-dim">
                  {t('executive.sites.gap', { gap: formatSigned(site.gapPts) })}
                </Num>
              </div>
              <Bar value={site.oee ?? 0} tone={toneForHealth(site.oee ?? 0)} />

              {/* Spans, not a description list: this card IS the button, and
                  a <button> may only contain phrasing content. */}
              <span className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ['revenue', formatMoney(site.revenue, currency)],
                  ['margin', formatPercent(site.marginPct)],
                  ['downtimeCost', formatMoney(site.downtimeCost, currency)],
                  ['health', formatInteger(site.health)],
                ].map(([key, value]) => (
                  <span key={key} className="block">
                    <span className="block text-micro text-ink-mute">
                      {t(`executive.sites.metric.${key}`)}
                    </span>
                    <Num className="block text-body-sm font-semibold">{value}</Num>
                  </span>
                ))}
              </span>
            </Panel>
          )
        })}
      </div>

      {/* ── The league table ──────────────────────────────────────────── */}
      <Panel flush className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
          <h2 className="m-0 flex-1 text-body-sm font-semibold">
            {t('executive.league.title')}
          </h2>
          <span className="text-micro font-normal text-ink-dim">
            <Num>{t('executive.compare.target', { target: formatPercent(model.target, 0) })}</Num>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-hairline">
                <Th className="w-full">{t('executive.league.column.site')}</Th>
                <Th align="end">{t('executive.league.column.lines')}</Th>
                <Th>{t('executive.league.column.oee')}</Th>
                <Th align="end">{t('executive.league.column.gap')}</Th>
                <Th align="end">{t('executive.league.column.revenue')}</Th>
                <Th align="end">{t('executive.league.column.margin')}</Th>
                <Th align="end">{t('executive.league.column.downtimeCost')}</Th>
                <Th align="end">{t('executive.league.column.anomalies')}</Th>
                <Th>{t('executive.league.column.health')}</Th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((site) => (
                <tr
                  key={site.id}
                  onClick={() => onSelect(selected === site.id ? null : site.id)}
                  aria-selected={selected === site.id}
                  className={cn(
                    'cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-sunken',
                    selected === site.id && 'bg-sunken',
                  )}
                >
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{site.name}</span>
                      <StateBadge tone={STATE_TONE[site.state]}>
                        {t(`executive.state.${site.state}`)}
                      </StateBadge>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap text-ink-dim">
                    <Num>{formatInteger(site.lines)}</Num>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex w-28 min-w-20">
                      <Meter value={site.oee ?? 0} label={t('executive.kpi.oee')} />
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap">
                    <Num
                      className={cn(
                        'font-semibold',
                        site.gapPts < 0 ? 'text-on-amber' : 'text-on-green',
                      )}
                    >
                      {formatSigned(site.gapPts)}
                    </Num>
                  </td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap font-semibold">
                    <Num>{formatMoney(site.revenue, currency)}</Num>
                  </td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap text-ink-dim">
                    <Num>{formatPercent(site.marginPct)}</Num>
                  </td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap text-on-red">
                    <Num>{formatMoney(site.downtimeCost, currency)}</Num>
                  </td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap">
                    {site.openAlerts ? (
                      <StateBadge tone={site.criticalAlerts ? 'red' : 'amber'} dot={false}>
                        <Num>{formatInteger(site.openAlerts)}</Num>
                      </StateBadge>
                    ) : (
                      <span className="text-ink-mute">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex w-24 min-w-16">
                      <Meter
                        value={site.health ?? 0}
                        label={t('executive.sites.metric.health')}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <DemoNotice variant="sites" className="mt-0" />
    </div>
  )
}

function Th({ children, align = 'start', className }) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-eyebrow font-semibold whitespace-nowrap text-ink-dim first:ps-4 last:pe-4',
        align === 'end' ? 'text-end' : 'text-start',
        className,
      )}
    >
      {children}
    </th>
  )
}
