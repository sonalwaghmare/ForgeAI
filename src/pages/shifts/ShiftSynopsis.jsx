import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { AiBadge, StateBadge } from '@/components/forge/StatusBadge'
import { TrendChart } from '@/components/forge/TrendChart'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent } from '@/lib/format'
import { formatShiftDate } from './shiftClock'

/**
 * The AI Synopsis tab.
 *
 * DEMO. See `DEMO-MODE.md` §8.5. A briefing paragraph, three insight cards and
 * the week's OEE by shift.
 *
 * ── Everything in the paragraph is a figure the cards also show ───────────
 * Composed in the handler off the same rows the History tab lists — see
 * `shiftSynopsis()`. The prototype composes its paragraph too, and then asserts
 * "mostly on the C-12 coolant loop" as a literal whichever shift turns out to be
 * the roughest and whatever was actually wrong with it. Here the asset is the
 * one carrying most of that shift's anomalies, found from the alert records.
 *
 * ── The chart's heading is measured ───────────────────────────────────────
 * The design's reads "OEE has been recovering since Wednesday's dip" above a
 * chart that may be doing nothing of the sort — it is a caption, typed once. The
 * synopsis carries a `trend` computed by comparing the week's two halves, and
 * this heading says up, down or flat according to it.
 */
export function ShiftSynopsis({ synopsis, shifts, onInspect, onHandover, onScope }) {
  const { t } = useTranslation(['app', 'common'])

  if (!synopsis) return null

  /* Oldest first, so the chart reads left to right through the week. The table
     is newest first, which is the right order for a list and the wrong one for a
     time axis — two directions on one screen is a §3.1 correction, and the fix
     is to be explicit about which each one is. */
  const chronological = [...shifts].reverse()
  const run = chronological.filter((shift) => shift.oee != null)

  /* ── The plot is whole days only, ending yesterday ─────────────────────
   *
   * A week that includes today is a week with a hole in it: two of today's three
   * shifts have not run, so the chart either stops a third of the way in or
   * reserves width for work nobody has done. Neither is "a week of data".
   *
   * So the chart plots COMPLETE days — the seven ending yesterday. Today is
   * Sunday? Then it runs last Sunday to Saturday: twenty-one shifts, every one
   * of them finished, the line edge to edge. The shift running now is not on it
   * and does not need to be — the Active shift card above says what it is doing,
   * and this chart is about days that are over.
   *
   * The count follows the range control: one week is 21 shifts, two is 42. */
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const weeks = Math.max(1, Math.round(shifts.length / 21))
  const complete = chronological.filter(
    (shift) => shift.date < todayKey && shift.oee != null,
  )
  const plotted = complete.slice(-(weeks * 21))
  const plottedDays = new Set(plotted.map((shift) => shift.date)).size

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="m-0 mb-2 flex flex-wrap items-center gap-2">
          <AiBadge label={t('shifts.synopsis.briefingLabel')} />
        </p>
        <Panel stripe="violet">
          <p className="m-0 text-body leading-relaxed">
            <Num>
              {t('shifts.synopsis.briefing', {
                shifts: formatInteger(synopsis.shifts),
                oee: formatPercent(synopsis.averageOee, 1),
                workOrders: formatInteger(synopsis.workOrders),
                downtime: formatInteger(synopsis.downtimeMinutes),
              })}
            </Num>
            {synopsis.worst ? (
              <>
                {' '}
                <Num>
                  {t('shifts.synopsis.worst', {
                    shift: t(`shifts.type.${synopsis.worst.type}`),
                    date: formatShiftDate(synopsis.worst.date, { weekday: 'long' }),
                    count: synopsis.worst.anomalies,
                    oee: formatPercent(synopsis.worst.oee, 1),
                  })}
                </Num>
                {synopsis.worst.asset ? (
                  <> {t('shifts.synopsis.worstAsset', { asset: synopsis.worst.asset })}</>
                ) : null}
              </>
            ) : null}
            {synopsis.active ? (
              <>
                {' '}
                <Num>
                  {t('shifts.synopsis.active', {
                    shift: t(`shifts.type.${synopsis.active.type}`),
                    operator: synopsis.active.operatorName,
                    oee: formatPercent(synopsis.active.oee, 1),
                    count: synopsis.active.anomalies,
                  })}
                </Num>
              </>
            ) : (
              <> {t('shifts.synopsis.noActive')}</>
            )}
          </p>
        </Panel>
      </section>

      <section>
        <Eyebrow as="h2" className="mb-2">
          {t('shifts.synopsis.attention')}
        </Eyebrow>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
          <InsightCard
            icon="bolt"
            tone={synopsis.anomalies ? 'red' : 'green'}
            title={t('shifts.synopsis.carryover')}
            badge={formatInteger(synopsis.anomalies)}
            body={t('shifts.synopsis.carryoverBody')}
            action={
              <ForgeButton asChild size="sm" className="w-full">
                <Link to="/app/anomalies">
                  {t('shifts.synopsis.reviewAnomalies')}
                  <Icon name="right" size="xs" className="mirror-rtl" />
                </Link>
              </ForgeButton>
            }
            t={t}
          />

          <InsightCard
            icon="cal"
            tone={synopsis.active ? 'green' : null}
            title={t('shifts.synopsis.activeShift')}
            badge={synopsis.active ? t('shifts.synopsis.live') : t('shifts.synopsis.between')}
            body={
              synopsis.active
                ? t('shifts.synopsis.activeBody', {
                    shift: t(`shifts.type.${synopsis.active.type}`),
                    operator: synopsis.active.operatorName,
                    oee: formatPercent(synopsis.active.oee, 1),
                    downtime: formatInteger(synopsis.active.downtimeMinutes),
                  })
                : t('shifts.synopsis.betweenBody')
            }
            action={
              synopsis.active ? (
                /* The design's own action on this card, and it opens the
                   handover report over the page rather than sending the reader
                   to the archive. */
                <ForgeButton size="sm" className="w-full" onClick={onHandover}>
                  {t('shifts.synopsis.endShift')}
                  <Icon name="right" size="xs" className="mirror-rtl" />
                </ForgeButton>
              ) : null
            }
            t={t}
          />

          <InsightCard
            icon="chart"
            tone={synopsis.worst ? 'amber' : null}
            title={t('shifts.synopsis.dip')}
            badge={
              synopsis.worst
                ? formatShiftDate(synopsis.worst.date, { weekday: 'short' })
                : t('shifts.synopsis.none')
            }
            body={
              synopsis.worst
                ? t('shifts.synopsis.dipBody', {
                    shift: t(`shifts.type.${synopsis.worst.type}`),
                    oee: formatPercent(synopsis.worst.oee, 1),
                    count: synopsis.worst.anomalies,
                  })
                : t('shifts.synopsis.dipNone')
            }
            action={
              synopsis.worst ? (
                <ForgeButton size="sm" className="w-full" onClick={() => onInspect(synopsis.worst.id)}>
                  {t('shifts.synopsis.inspectShift')}
                  <Icon name="right" size="xs" className="mirror-rtl" />
                </ForgeButton>
              ) : null
            }
            t={t}
          />
        </div>
      </section>

      <section>
        <Eyebrow as="h2" className="mb-2">
          {synopsis.trend
            ? t(`shifts.synopsis.trend.${synopsis.trend.direction}`, {
                points: Math.abs(synopsis.trend.deltaPts),
              })
            : t('shifts.synopsis.trend.unknown')}
        </Eyebrow>
        <Panel>
          <h3 className="m-0 mb-3 text-title">{t('shifts.synopsis.chartTitle')}</h3>
          {plotted.length ? (
            <TrendChart
              series={[
                {
                  key: 'oee',
                  label: t('shifts.synopsis.chartSeries'),
                  /* Every shift up to the one running now. `TrendChart` still
                     breaks the line at a null, which covers a gap in the middle
                     of a span — a shift with no figure between two that have
                     one. */
                  values: plotted.map((shift) => shift.oee),
                  /* Orange, because OEE is orange everywhere else in this
                     product — the top bar's sparkline, the OEE module's own
                     trend card. `muted` was defensible for a lone series over a
                     band and wrong here: a reader who has just come from either
                     of those screens should not have to work out that the grey
                     line is the same measure. */
                  tone: 'forge',
                },
              ]}
              band={[70, 85]}
              bandLabel={t('shifts.synopsis.chartBand')}
              label={t('shifts.synopsis.chartTitle')}
              xLabel={t('shifts.synopsis.chartAxis')}
              /* WEEKDAYS over a single week — Mon … Sun, as the design has it,
                 which is only meaningful because the roster is aligned to the
                 calendar week rather than to the last seven days.

                 Over two or four weeks a label per day would be fourteen or
                 twenty-eight of them in a grey smear, so the step widens to a
                 whole week and the label carries the date the week starts. The
                 step is always a multiple of three: a label has to land on the
                 first shift of a day, not in the middle of one. */
              xTicks={(() => {
                /* About seven labels whatever the span, and always on the first
                   shift of a day rather than in the middle of one — hence a step
                   that is a multiple of three.

                   Weekdays only while the span is a week or less, as the design
                   has it. Past that they repeat, and "Mon" appearing twice on
                   one axis is worse than a date. */
                const dayStep = Math.max(1, Math.round(plottedDays / 7))
                const weekdays = plottedDays <= 7
                return plotted.map((shift, index) =>
                  index % (dayStep * 3) === 0
                    ? formatShiftDate(
                        shift.date,
                        weekdays ? { weekday: 'short' } : { day: 'numeric', month: 'short' },
                      )
                    : '',
                )
              })()}
              legend={false}
              format={(value) => formatPercent(value, 1)}
            />
          ) : (
            <p className="m-0 text-body-sm text-ink-dim">{t('shifts.synopsis.chartEmpty')}</p>
          )}
          <p className="m-0 mt-2 text-micro font-normal text-ink-dim">
            <Num>{t('shifts.synopsis.chartNote', { count: run.length })}</Num>
            {onScope ? (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={onScope}
                  className="text-on-forge underline-offset-2 hover:underline"
                >
                  {t('shifts.synopsis.seeAll')}
                </button>
              </>
            ) : null}
          </p>
        </Panel>
      </section>
    </div>
  )
}

function InsightCard({ icon, tone, title, badge, body, action, t }) {
  return (
    <Panel className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Icon
          name={icon}
          size="sm"
          className={tone ? undefined : 'text-ink-mute'}
          style={tone ? { color: `var(--on-${tone})` } : undefined}
        />
        <h3 className="m-0 flex-1 text-body-sm font-semibold">{title}</h3>
        <StateBadge tone={tone} dot={false}>
          <Num>{badge}</Num>
        </StateBadge>
      </div>
      <p className="m-0 flex-1 text-body-sm text-ink-dim">{body}</p>
      {action ?? (
        <p className="m-0 text-micro font-normal text-ink-mute">{t('shifts.synopsis.noAction')}</p>
      )}
    </Panel>
  )
}
