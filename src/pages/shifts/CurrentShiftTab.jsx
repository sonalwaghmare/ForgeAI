import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { MetricCard } from '@/components/forge/MetricCard'
import { Panel } from '@/components/forge/Panel'
import { AiBadge, StateBadge } from '@/components/forge/StatusBadge'
import { EmptyState } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { formatShiftTime } from './shiftClock'

/**
 * Current Shift — the middle tab.
 *
 * DEMO. The design's live-shift board: the running banner with its progress
 * rail, six live figures, hour-by-hour OEE against the target, the crew, the
 * shift log so far, and the handover this shift received.
 *
 * ── The clock is real; the production overlay is not ──────────────────────
 * The shift itself — type, window, operator, its open anomalies and work orders
 * — is the roster row the History tab lists, so this tab cannot claim a shift
 * that is not running or an operator who is not on it. Elapsed, remaining and
 * the percentage complete are computed against the wall clock, so the rail
 * moves through the shift instead of sitting at the design's fixed 67%.
 *
 * What IS authored is the production overlay — output, line speed, rejects, the
 * hour buckets and the log lines. No endpoint reports any of it per shift. It
 * is stated as such at the foot of the tab.
 *
 * ── The hour bars stop where the shift has got to ─────────────────────────
 * The prototype draws eight bars and greys the ones past a hardcoded elapsed.
 * Here the bucket count comes from the window's own length and "done" is read
 * from the clock, so an hour that has not happened is drawn as an outline with
 * no figure over it rather than as a number nobody measured.
 */

/** Authored per-hour OEE offsets. Deterministic — a redraw must not move a bar. */
const HOUR_OFFSET = [-3.1, +1.8, +3.9, +0.7, -2.4, +2.6, -0.4, -1.5, +1.1, -0.7]

/** The log so far. Authored: no endpoint returns a running shift's entries. */
const SHIFT_LOG = [
  ['07:12', 'Changeover 330→500 ml completed, 16 min'],
  ['09:40', 'FDY-BM-03 drive-end vibration ticked up, watching'],
  ['11:05', 'Compressor C-12 coolant loop re-checked after J14 reseat — holding'],
]

/** The rest of the crew beside the rostered operator. Authored — see the notice. */
const SUPPORT_CREW = [
  { id: 'usr_rel_1', name: 'Ines Brandt', role: 'Reliability engineer', initials: 'IB', scope: 'All lines' },
  { id: 'usr_lead_1', name: 'Maya Reddy', role: 'Shift lead', initials: 'MR', scope: 'Bldg A' },
]

export function CurrentShiftTab({
  shift,
  live,
  scope,
  handover,
  onHandover,
  onScope,
  onViewReport,
}) {
  const { t } = useTranslation(['app', 'common'])

  /* Ticking once a minute rather than once a second: the only things on this
     tab that move are elapsed and the percentage, and neither is measured
     finer than a minute. A per-second interval would rerender the whole board
     sixty times for one changed digit. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  /* ── Three outcomes, and only one of them is "nothing is running" ──────
   *
   * The shell's top bar resolves a window from the clock and the roster row
   * carries the same rule computed server-side, so with the whole span in hand
   * they agree. Where they can still part company is scope: "Just me" narrows
   * the roster and the top bar does not narrow with it. Reporting that as "no
   * shift is running" put two contradictory answers on one screen, which is
   * worse than either — so the narrowed case names the shift the shell named
   * and offers the way back to it.
   *
   * The plain empty state stays for the case it was written for: the shell
   * itself has no window, which is a gap in the rota rather than a bug here. */
  if (!shift) {
    if (live && scope === 'mine') {
      return (
        <EmptyState
          icon="cal"
          title={t('shifts.current.notMineTitle', {
            shift: t(`shifts.type.${live.shift}`),
          })}
          body={t('shifts.current.notMineBody')}
          action={<ForgeButton onClick={onScope}>{t('shifts.scope.all')}</ForgeButton>}
        />
      )
    }
    return (
      <EmptyState
        icon="cal"
        title={t('shifts.current.noneTitle')}
        body={t('shifts.current.noneBody')}
      />
    )
  }

  /* Every figure below is keyed off THIS window — the roster row's own
     `startsAt`/`endsAt`, which the fixture builds from the same `SHIFTS`
     windows the shell's resolver reads. So elapsed, remaining, the percentage
     and the hour buckets cannot drift from the range the top bar prints. */
  const start = new Date(shift.startsAt).getTime()
  const end = new Date(shift.endsAt).getTime()
  const total = Math.max(1, Math.round((end - start) / 60_000))
  const elapsed = Math.min(total, Math.max(0, Math.round((now - start) / 60_000)))
  const remaining = total - elapsed
  const percent = Math.round((elapsed / total) * 100)

  const oee = shift.oee ?? 0
  const target = 85

  /* Whole hours in the window, and how many of them are behind us. */
  const buckets = Math.max(1, Math.round(total / 60))
  const complete = Math.floor(elapsed / 60)
  const hours = Array.from({ length: buckets }, (_, index) => {
    const at = new Date(start + index * 3_600_000)
    return {
      label: String(at.getHours()).padStart(2, '0'),
      value: Math.round((oee + HOUR_OFFSET[index % HOUR_OFFSET.length]) * 10) / 10,
      done: index < complete,
    }
  })

  const critical = shift.anomalies.filter((entry) => entry.severity === 'critical').length
  const high = shift.anomalies.length - critical

  /* The rostered operator leads the crew list; the other two are authored. */
  const crew = [
    {
      id: shift.operatorId,
      name: shift.operatorName,
      role: shift.operatorRole ?? '',
      initials: shift.operatorInitials ?? '',
      scope: 'Line 1',
    },
    ...SUPPORT_CREW,
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* ── the running banner ──────────────────────────────────────────── */}
      <Panel stripe="green">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h2 className="m-0 text-title">
              {t('shifts.current.heading', { shift: t(`shifts.type.${shift.type}`) })}{' '}
              <Mono className="text-body font-normal text-ink-dim">
                {formatShiftTime(shift.startsAt)}–{formatShiftTime(shift.endsAt)}
              </Mono>
            </h2>
            <p className="mt-1 mb-0 text-body-sm text-ink-dim">
              <Num>
                {t('shifts.current.who', {
                  operator: shift.operatorName,
                  elapsed: hhmm(elapsed),
                  total: hhmm(total),
                })}
              </Num>
            </p>
          </div>
          <div className="flex-1" />
          <StateBadge tone="green">{t('shifts.status.active')}</StateBadge>
          <ForgeButton variant="primary" onClick={onHandover}>
            <Icon name="ai" size="xs" />
            {t('shifts.detail.endShift')}
          </ForgeButton>
        </div>

        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('shifts.current.progressLabel')}
          className="h-1.5 w-full overflow-hidden rounded-pill bg-sunken"
        >
          <div
            className="h-full rounded-pill"
            style={{ width: `${percent}%`, backgroundColor: 'var(--hue-green)' }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 text-micro text-ink-mute">
          <Mono>{formatShiftTime(shift.startsAt)}</Mono>
          <Num className="font-semibold text-ink">
            {t('shifts.current.progress', { percent, remaining: hhmm(remaining) })}
          </Num>
          <Mono>{formatShiftTime(shift.endsAt)}</Mono>
        </div>
      </Panel>

      {/* ── the six figures ─────────────────────────────────────────────── */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
        <MetricCard
          label={t('shifts.current.kpi.oee')}
          value={formatPercent(oee, 1)}
          sub={t('shifts.current.kpi.oeeSub', { target })}
          tone={oee >= target ? 'green' : 'amber'}
        />
        <MetricCard
          label={t('shifts.current.kpi.output')}
          value={t('shifts.current.kpi.outputValue', { value: 268.4 })}
          sub={t('shifts.current.kpi.outputSub', { percent: 92 })}
        />
        <MetricCard
          label={t('shifts.current.kpi.speed')}
          value={t('shifts.current.kpi.speedValue', { value: 1712 })}
          sub={t('shifts.current.kpi.speedSub', { target: 1800 })}
          tone="amber"
        />
        <MetricCard
          label={t('shifts.current.kpi.downtime')}
          value={t('shifts.detail.minutes', { count: shift.downtimeMinutes ?? 0 })}
          sub={t('shifts.current.kpi.downtimeSub', { stops: 1 })}
          tone={shift.downtimeMinutes > 30 ? 'amber' : null}
        />
        <MetricCard
          label={t('shifts.current.kpi.alerts')}
          value={formatInteger(shift.anomalies.length)}
          sub={t('shifts.current.kpi.alertsSub', { critical, high })}
          tone={shift.anomalies.length ? 'red' : null}
        />
        <MetricCard
          label={t('shifts.current.kpi.rejects')}
          value={formatPercent(0.9, 1)}
          sub={t('shifts.current.kpi.rejectsSub', { spec: formatPercent(1.2, 1) })}
          tone="green"
        />
      </div>

      <div className="grid gap-4 [grid-template-columns:minmax(0,1.4fr)_minmax(17rem,1fr)] max-xl:grid-cols-1">
        {/* ── hour by hour ─────────────────────────────────────────────── */}
        <Panel>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Eyebrow as="h3" className="m-0 flex-1">
              {t('shifts.current.hourly')}
            </Eyebrow>
            <span className="text-micro text-ink-mute">
              <Num>{t('shifts.current.hourlyTarget', { target })}</Num>
            </span>
          </div>

          <div className="relative flex h-36 items-end gap-2">
            {/* The target rule, positioned off the same 0–100 scale the bars use. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t border-dashed"
              style={{ bottom: `${target}%`, borderColor: 'var(--hue-green)' }}
            />
            {hours.map((hour) => (
              <div key={hour.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <Num
                  className={cn(
                    'mb-1 text-center text-micro font-semibold',
                    hour.done ? (hour.value >= target ? 'text-on-green' : 'text-on-amber') : 'text-ink-mute',
                  )}
                >
                  {hour.done ? formatInteger(Math.round(hour.value)) : '—'}
                </Num>
                <div
                  className={cn(
                    'w-full rounded-t-xs',
                    hour.done
                      ? hour.value >= target
                        ? 'tint-green'
                        : 'tint-amber'
                      : 'border border-dashed border-hairline',
                  )}
                  style={{ height: `${Math.max(2, hour.value)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2">
            {hours.map((hour) => (
              <Mono key={hour.label} className="min-w-0 flex-1 text-center text-micro text-ink-mute">
                {hour.label}
              </Mono>
            ))}
          </div>
        </Panel>

        {/* ── crew + log ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel flush>
            <div className="border-b border-hairline px-4 py-2.5">
              <Eyebrow as="h3" className="m-0">
                {t('shifts.current.crew', { total: crew.length })}
              </Eyebrow>
            </div>
            <ul className="m-0 flex list-none flex-col p-0 px-4 py-1.5">
              {crew.map((person) => (
                <li key={person.id} className="flex items-center gap-2.5 py-1.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-micro font-semibold text-ink-dim">
                    {person.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold">{person.name}</span>
                    <span className="block truncate text-micro text-ink-mute">{person.role}</span>
                  </span>
                  <span className="shrink-0 text-micro text-ink-mute">{person.scope}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel flush>
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
              <Eyebrow as="h3" className="m-0 flex-1">
                {t('shifts.current.log', { total: SHIFT_LOG.length })}
              </Eyebrow>
              <ForgeButton size="sm" variant="ghost" asChild>
                <Link to="/app/logbook">{t('shifts.detail.logbook')}</Link>
              </ForgeButton>
            </div>
            <ul className="m-0 flex list-none flex-col p-0 px-4 py-1.5">
              {SHIFT_LOG.map(([at, entry]) => (
                <li
                  key={at}
                  className="flex gap-2.5 border-b border-subtle py-2 last:border-0 text-body-sm"
                >
                  <Mono className="w-10 shrink-0 text-micro text-ink-mute">{at}</Mono>
                  <span className="text-ink-dim">{entry}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {/* ── the handover this shift received ─────────────────────────────
          The most recent filed record from the archive, not a second copy of
          one. Its figures are read off that record, so this card and the
          Handovers screen cannot disagree about the shift that closed. */}
      {handover ? (
        <Panel>
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <Icon name="cal" size="xs" className="text-ink-mute" />
            <h3 className="m-0 text-body font-semibold">{t('shifts.current.received')}</h3>
            <StateBadge tone={handover.status === 'acknowledged' ? 'green' : null}>
              {t(`handovers.status.${handover.status}`)}
            </StateBadge>
            <Mono className="text-micro text-ink-mute">{handover.id}</Mono>
            <div className="flex-1" />
            <ForgeButton size="sm" asChild>
              <Link to="/app/handovers">{t('shifts.allHandovers')}</Link>
            </ForgeButton>
          </div>

          <p className="m-0 mb-2 text-micro text-ink-mute">
            <Num>
              {t('shifts.current.receivedMeta', {
                date: handover.date,
                window: handover.window,
                outgoing: handover.outgoing,
                incoming: handover.incoming,
              })}
            </Num>
          </p>

          {handover.report?.summary ? (
            <>
              <p className="m-0 mb-2 flex">
                <AiBadge />
              </p>
              <p className="m-0 mb-3 max-w-[68ch] text-body-sm leading-relaxed text-ink-dim">
                {handover.report.summary}
              </p>
            </>
          ) : null}

          <dl className="m-0 mb-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,8.5rem),1fr))]">
            {[
              ['oee', formatPercent(handover.oee)],
              ['carried', formatInteger(handover.report?.carried?.length ?? 0)],
              ['pending', formatInteger(handover.pending ?? 0)],
            ].map(([key, value]) => (
              <div key={key} className="rounded-sm border border-hairline bg-sunken px-3 py-2">
                <dt className="eyebrow">{t(`shifts.current.receivedStat.${key}`)}</dt>
                <dd className="m-0 mt-0.5">
                  <Num className="text-body-sm font-semibold">{value}</Num>
                </dd>
              </div>
            ))}
          </dl>

          <ForgeButton onClick={onViewReport}>{t('shifts.current.viewReport')}</ForgeButton>
        </Panel>
      ) : null}

      <p className="m-0 text-body-sm text-ink-mute italic">{t('shifts.current.demoNotice')}</p>
    </div>
  )
}

/** `322` → `5h 22m`. */
function hhmm(minutes) {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}
