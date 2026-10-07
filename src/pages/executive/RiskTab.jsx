import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Num } from '@/components/forge/primitives'
import { formatInteger } from '@/lib/format'
import { ON_TINT_CLASS } from '@/lib/tone'
import {
  OPPORTUNITIES,
  PROBABILITY_TONE,
  RISKS,
  formatMoney,
} from './executiveModel'
import { ConfidencePill, DemoNotice } from './parts'

/**
 * Risk & Opportunity — the two ledgers, and the net between them.
 *
 * ── The last section of Performance ───────────────────────────────────────
 * Third of the three blocks the design gates on `tab==="financial"`, and
 * rendered last by `PerformanceTab` for that reason. The brief's "Review risks"
 * button called `setTab("risk")` at a tab the design never defines; it opens
 * Performance, which is where this ledger lives.
 *
 * ── The plant is named by the data ────────────────────────────────────────
 * `riskSite` is `brief.risk` — the site carrying the most critical anomalies,
 * which the server finds. The design writes "Rotterdam" into the risk label,
 * the opportunity label, the brief and the net-position paragraph, so four
 * places would need editing if the worst plant changed, and none of them would.
 *
 * ── The totals are sums ───────────────────────────────────────────────────
 * Value at risk, identified upside and the net swing are all reduced off these
 * two arrays. The prototype does the same for the headers and then writes the
 * net into a sentence by hand.
 */
export function RiskTab({ brief, riskSite, currency = 'USD' }) {
  const { t } = useTranslation('app')

  const atRisk = RISKS.reduce((sum, risk) => sum + risk.impact, 0)
  const upside = OPPORTUNITIES.reduce((sum, opp) => sum + opp.gain, 0)

  const horizonOf = (risk) =>
    risk.horizonHours != null
      ? t('executive.hours', { hours: risk.horizonHours })
      : t('executive.days', { days: risk.horizonDays })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(21rem,1fr))]">
        {/* ── Value at risk ─────────────────────────────────────────── */}
        <Panel flush className="overflow-hidden">
          <Ledger
            icon="shield"
            tone="red"
            title={t('executive.risk.title')}
            total={formatMoney(atRisk, currency)}
          />
          <ul className="m-0 flex list-none flex-col p-0">
            {RISKS.map((risk) => (
              <li key={risk.key} className="border-b border-subtle px-4 py-3 last:border-0">
                <div className="mb-1.5 flex flex-wrap items-start gap-x-2.5 gap-y-1">
                  <span className="min-w-0 flex-1 text-body-sm font-semibold">
                    {t(`executive.risk.item.${risk.key}`, { name: riskSite })}
                  </span>
                  <Num className="text-body font-semibold text-on-red">
                    {formatMoney(risk.impact, currency)}
                  </Num>
                </div>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <StateBadge tone={PROBABILITY_TONE[risk.probability]}>
                    {t(`executive.risk.probability.${risk.probability}`)}
                  </StateBadge>
                  <Num className="text-micro text-ink-mute">
                    {t('executive.risk.horizonOwner', {
                      horizon: horizonOf(risk),
                      owner: t(`executive.risk.owner.${risk.owner}`),
                    })}
                  </Num>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 min-w-0 flex-1 text-body-sm text-ink-dim">
                    {t(`executive.risk.action.${risk.key}`, { name: riskSite })}
                  </p>
                  {risk.to ? (
                    <ForgeButton size="sm" asChild>
                      <Link to={risk.to}>
                        {t('executive.risk.open')}
                        <Icon name="right" size="xs" className="mirror-rtl" />
                      </Link>
                    </ForgeButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* ── Identified upside ─────────────────────────────────────── */}
        <Panel flush className="overflow-hidden">
          <Ledger
            icon="gauge"
            tone="green"
            title={t('executive.upside.title')}
            total={formatMoney(upside, currency)}
          />
          <ul className="m-0 flex list-none flex-col p-0">
            {OPPORTUNITIES.map((opp) => (
              <li key={opp.key} className="border-b border-subtle px-4 py-3 last:border-0">
                <div className="mb-1.5 flex flex-wrap items-start gap-x-2.5 gap-y-1">
                  <span className="min-w-0 flex-1 text-body-sm font-semibold">
                    {t(`executive.upside.item.${opp.key}`, { name: riskSite })}
                  </span>
                  <Num className="text-body font-semibold text-on-green">
                    {t('executive.upside.gain', { value: formatMoney(opp.gain, currency) })}
                  </Num>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Num className="text-micro text-ink-mute">
                    {t('executive.upside.effort', {
                      effort: t(`executive.upside.effortLevel.${opp.effort}`),
                    })}
                  </Num>
                  <Num className="text-micro text-ink-mute">
                    {t('executive.upside.payback', { months: opp.paybackMonths })}
                  </Num>
                  <ConfidencePill value={opp.confidence} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* ── Net position ──────────────────────────────────────────────── */}
      <Panel stripe="violet" className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Icon name="ai" size="sm" className="text-violet" />
          <h2 className="m-0 text-title">{t('executive.net.title')}</h2>
        </div>
        <Num as="p" className="m-0 text-body leading-relaxed text-ink-dim">
          {t('executive.net.body', {
            upside: formatMoney(upside, currency),
            atRisk: formatMoney(atRisk, currency),
            net: formatMoney(upside - atRisk, currency),
            name: riskSite,
            critical: formatInteger(brief?.criticalAlerts ?? 0),
          })}
        </Num>
        <DemoNotice variant="risk" className="mt-0" />
      </Panel>
    </div>
  )
}

function Ledger({ icon, tone, title, total }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
      <Icon name={icon} size="sm" style={{ color: `var(--on-${tone})` }} aria-hidden="true" />
      <h2 className="m-0 min-w-0 flex-1 text-body-sm font-semibold">{title}</h2>
      <Num className={`text-body font-semibold ${ON_TINT_CLASS[tone]}`}>{total}</Num>
    </div>
  )
}
