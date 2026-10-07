import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { AiBadge, PlainBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { formatDecimal, formatInteger, formatPercent } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { CardHead, DeltaValue, DemoNotice } from './parts'
import { toneForOee } from './oeeModel'

const HEADLINE_FACTORS = ['oee', 'availability', 'performance', 'quality', 'teep']

/**
 * AI Synopsis — the design's first tab, and the module's default view.
 *
 * The briefing, then three cards: what is suppressing OEE, what is working, and
 * the prioritised plan. Each of the three carries a short AI line above it, as
 * the design has them.
 *
 * ── The one striped card ──────────────────────────────────────────────────
 * Violet is AI authorship and nothing else in this system, and the Earned-Stripe
 * Rule says a card only takes an edge when it genuinely carries severity or
 * authorship. The briefing does — Forge AI wrote the paragraph, and the
 * paragraph is the API's own `attribution`, the same text the previous version
 * of this screen showed at the foot of the Overview. The three cards below it
 * are the platform's arithmetic dressed by an AI preamble, so they carry the
 * badge on the preamble and no stripe on the card.
 *
 * ── The numbers in the prose are the screen's own ─────────────────────────
 * The prototype's briefing quotes figures that appear nowhere else on the page
 * and states "87% confidence" on every asset in the product. Here every value
 * interpolated below comes out of the model: the gap is the target minus the
 * headline, the forgone cans are what the gap is worth at the current yield, the
 * binding constraint is whichever of the six losses is actually largest, and the
 * line and the shift named are the ones actually ranked last.
 *
 * ── The diagnosis and the plan both add up to the gap ─────────────────────
 * Three causes summing to the shortfall, five actions summing to the same
 * number. The design's do not: its three diagnoses account for 7.1 of an 8.2
 * point gap and its recommendation header claims 7.1 potential over five rows
 * that total 7.1 — two different sets of five numbers, one of which is wrong.
 */
export function SynopsisView({ model, period }) {
  const { t } = useTranslation(['app', 'common'])

  const { factors, deltas, prior, target, gapPts } = model
  const worstLoss = model.sixLosses[0]
  const tone = toneForOee(factors.oee, target)
  const badge = factors.oee >= target ? 'onTarget' : factors.oee >= target - 10 ? 'belowTarget' : 'critical'
  const direction = Math.abs(deltas.oee) < 0.05 ? 'flat' : deltas.oee > 0 ? 'up' : 'down'
  const headline = factors.oee >= target ? 'onTarget' : direction === 'down' ? 'slipping' : 'improving'

  const gapLabel = formatDecimal(gapPts) + t('oee.pts')

  return (
    <div className="flex flex-col gap-4">
      {/* ── The briefing ───────────────────────────────────────────────── */}
      <Panel stripe="violet">
        <div className="mb-3 flex flex-wrap items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-violet">
            <Icon name="ai" size="sm" className="text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <Eyebrow className="text-on-violet">
              {t('oee.synopsis.eyebrow', { window: t(`oee.period.${period}`) })}
            </Eyebrow>
            <h2 className="m-0 mt-1 text-title text-balance">
              {t(`oee.synopsis.headline.${headline}`)}
            </h2>
            <p className="mt-1 mb-0 text-body-sm text-ink-dim">
              {t('oee.synopsis.subhead', {
                oee: formatPercent(factors.oee),
                gap: gapLabel,
              })}
            </p>
          </div>
          <StateBadge tone={tone}>{t(`oee.synopsis.badge.${badge}`)}</StateBadge>
        </div>

        <p className="m-0 text-body leading-[1.65] text-ink-dim">
          {t('oee.synopsis.lead', {
            window: t(`oee.period.${period}`),
            oee: formatPercent(factors.oee),
            target: formatPercent(target, 0),
            gap: gapLabel,
            units: formatInteger(model.forgoneUnits),
          })}{' '}
          {t(`oee.synopsis.movement.${direction}`, {
            delta: formatDecimal(Math.abs(deltas.oee)) + t('oee.pts'),
            prior: t(`oee.prior.${period}`),
            prevA: formatPercent(prior.availability),
            a: formatPercent(factors.availability),
          })}{' '}
          {t('oee.synopsis.constraint', {
            loss: t(`oee.losses.name.${worstLoss.key}`).toLowerCase(),
            minutes: t('oee.min', { value: formatInteger(worstLoss.minutes) }),
            line: model.worstLine?.name ?? '—',
            shift: t(`oee.shift.${model.worstShift.key}`).toLowerCase(),
          })}
        </p>

        {/* The AI attribution paragraph, straight from the service. Content,
            not furniture, so it does not go through `t()`. */}
        {model.attribution ? (
          <p className="mt-3 mb-0 text-body leading-[1.65] text-ink-dim">{model.attribution}</p>
        ) : null}

        <dl className="m-0 mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-subtle pt-3.5">
          {HEADLINE_FACTORS.map((key) => (
            <div key={key}>
              <dt className="eyebrow">{t(`oee.kpi.${key}`)}</dt>
              <dd className="m-0 mt-0.5">
                <Num className="block text-title leading-none">{formatPercent(factors[key])}</Num>
                <DeltaValue className="mt-1" value={deltas[key]} />
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <AiBadge label={t('common:ai.authored')} />
          <span className="text-micro font-normal text-ink-dim italic">
            {t('common:ai.disclaimer')}
          </span>
        </div>
      </Panel>

      {/* ── What is suppressing OEE ────────────────────────────────────── */}
      <AiLead text={t('oee.synopsis.diagnosisIntro')} />
      <Panel>
        <CardHead
          eyebrow={t('oee.synopsis.diagnosisEyebrow')}
          title={t('oee.synopsis.diagnosisTitle')}
          right={<StateBadge tone="red">{t('oee.synopsis.recoverable', { gap: gapLabel })}</StateBadge>}
        />

        <ol className="m-0 flex list-none flex-col p-0">
          {model.diagnosis.map((row, index) => (
            <li
              key={row.key}
              className={cn('flex gap-3 py-3.5', index > 0 && 'border-t border-subtle')}
            >
              <Num className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sunken text-micro font-bold">
                {index + 1}
              </Num>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <h3 className="m-0 text-body font-semibold">
                    {t(`oee.synopsis.cause.${row.key}.title`, { line: row.lineName ?? '—' })}
                  </h3>
                  <StateBadge tone={row.tone}>
                    {t('oee.synopsis.costs', { pts: formatDecimal(row.pts) })}
                  </StateBadge>
                </div>

                <p className="m-0 text-body-sm leading-[1.6] text-ink-dim">
                  {t(`oee.synopsis.cause.${row.key}.why`, {
                    stops: row.stops,
                    minutes: formatInteger(row.minutes ?? row.cause?.minutes ?? 0),
                    mttr: t('oee.min', { value: formatInteger(Math.round(row.mttrMin ?? 0)) }),
                    mtbf: formatDecimal(row.mtbfHours ?? 0) + ' h',
                    delta: formatDecimal(row.deltaPts ?? 0) + t('oee.pts'),
                    standard: row.standardMin ?? 0,
                  })}
                </p>

                <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                  {row.evidence.map((key) => (
                    <li key={key}>
                      <PlainBadge>
                        {t(`oee.synopsis.evidence.${key}`, {
                          value: formatDecimal(100 - model.factors.availability) + t('oee.pts'),
                          minutes: formatInteger(row.minutes ?? 0),
                        })}
                      </PlainBadge>
                    </li>
                  ))}
                </ul>

                {/* The remedy sits in a green well rather than as another badge:
                    it is the one line in the card that says do this, and it
                    reads as an instruction only if it looks unlike the diagnosis
                    above it. */}
                <p
                  className={cn(
                    'm-0 mt-2.5 flex items-center gap-2 rounded-sm px-2.5 py-2 text-body-sm',
                    TINT_CLASS.green,
                    ON_TINT_CLASS.green,
                  )}
                >
                  <Icon name="arrow-right" size="sm" aria-hidden="true" />
                  {t(`oee.synopsis.fix.${row.fix}`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      {/* ── What is working ────────────────────────────────────────────── */}
      <AiLead text={t('oee.synopsis.winsIntro')} />
      <Panel>
        <CardHead eyebrow={t('oee.synopsis.winsEyebrow')} title={t('oee.synopsis.winsTitle')} />
        <div className="grid gap-3 max-md:grid-cols-1 [grid-template-columns:repeat(2,minmax(0,1fr))]">
          {model.wins.map((win) => (
            <div key={win.key} className="rounded-sm bg-sunken p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <Icon name="up" size="sm" style={{ color: 'var(--on-green)' }} aria-hidden="true" />
                <h3 className="m-0 min-w-0 flex-1 text-body font-semibold">
                  {t(`oee.synopsis.win.${win.key}.title`, {
                    line: win.lineName ?? '—',
                    oee: formatPercent(win.oee ?? 0),
                    quality: formatPercent(win.quality ?? 0),
                  })}
                </h3>
                <DeltaValue value={win.deltaPts} />
              </div>
              <p className="m-0 text-body-sm leading-[1.55] text-ink-dim">
                {t(`oee.synopsis.win.${win.key}.body`, {
                  availability: formatPercent(win.availability ?? 0),
                  stops: win.stops ?? 0,
                  scrap: formatPercent(win.scrapPct ?? 0, 2),
                })}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── The plan ───────────────────────────────────────────────────── */}
      <AiLead text={t('oee.synopsis.actionsIntro')} />
      <Panel>
        <CardHead
          eyebrow={t('oee.synopsis.actionsEyebrow')}
          title={t('oee.synopsis.actionsTitle')}
          right={<Num>{t('oee.synopsis.potential', { gap: gapLabel })}</Num>}
        />
        <ol className="m-0 flex list-none flex-col p-0">
          {model.actions.map((action, index) => (
            <li
              key={action.key}
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5',
                index > 0 && 'border-t border-subtle',
              )}
            >
              <Num className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sunken text-micro font-bold">
                {index + 1}
              </Num>
              <div className="min-w-[14rem] flex-1">
                <p className="m-0 text-body-sm font-semibold">
                  {t(`oee.synopsis.action.${action.key}.title`)}
                </p>
                <p className="mt-0.5 mb-0 text-micro font-normal text-ink-mute">
                  {t('oee.synopsis.owner', {
                    owner: action.owner,
                    effort: t(`oee.synopsis.action.${action.key}.effort`),
                  })}
                </p>
              </div>
              {action.tone ? (
                <StateBadge tone={action.tone}>
                  <Num>
                    {'+'}
                    {formatDecimal(action.gainPts)}
                    {t('oee.pts')}
                  </Num>
                </StateBadge>
              ) : (
                <PlainBadge>
                  <Num>
                    {'+'}
                    {formatDecimal(action.gainPts)}
                    {t('oee.pts')}
                  </Num>
                </PlainBadge>
              )}
              {/* `ForgeButton` has no `as`; `asChild` puts the link inside it. */}
              <ForgeButton size="sm" asChild>
                <Link to={action.to}>{t(`oee.synopsis.action.${action.key}.cta`)}</Link>
              </ForgeButton>
            </li>
          ))}
        </ol>
      </Panel>

      <DemoNotice className="mt-0" />
    </div>
  )
}

/** The one-line AI preamble the design puts above each of the three cards. */
function AiLead({ text }) {
  return (
    <p className="m-0 flex items-start gap-2.5 text-body-sm leading-[1.55] text-ink-dim">
      <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-xs bg-violet">
        <Icon name="ai" size="xs" className="text-white" />
      </span>
      {text}
    </p>
  )
}
