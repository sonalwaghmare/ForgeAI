import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { AiBadge, SeverityBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent } from '@/lib/format'
import { SHIFT_STATE_TONE } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { shiftFigures } from './projectedFigures'
import { formatShiftDate, formatShiftTime } from './shiftClock'

/**
 * The shift the table has selected.
 *
 * DEMO. The design's right-hand panel: the shift card, the operator, four
 * figures, the anomalies raised on it, and an AI handover summary with the two
 * actions.
 *
 * ── The anomalies are the real ones ───────────────────────────────────────
 * The prototype renders `Array.from({length: s.anomalies})` and labels the rows
 * from a fixed list — "Coolant flow drop · C-12", "Vibration spike · BM-03",
 * "Bearing temp rise · HX-204" — so every shift with three anomalies has the
 * same three, and one of them names a heat exchanger from a different demo.
 * These are the alerts whose detection time falls inside the shift's window, and
 * each links to the machine it is on.
 *
 * ── Handover is the record that already exists ────────────────────────────
 * The design opens a second, freshly-authored handover report from here. We have
 * an archive, a report and a create flow already built; a completed shift links
 * to its own handover and an active one offers to end and write it. Two handover
 * documents for one shift boundary is the contradiction this avoids.
 */
export function ShiftDetailPanel({ shift, onSchedule, onHandover }) {
  const { t } = useTranslation(['app', 'common'])

  if (!shift) {
    return (
      <Panel className="text-center">
        <p className="m-0 text-body-sm text-ink-dim">{t('shifts.detail.none')}</p>
      </Panel>
    )
  }

  const tone = SHIFT_STATE_TONE[shift.status] ?? null

  /* The SAME resolver the table and the crew drill-down use. This panel used to
     read `shift.oee` and `shift.anomalies.length` directly, so one selected row
     printed 70.0% · 3 · 2 in the table and — · 0 · 0 here. Three surfaces, one
     rule; the whole reason `shiftFigures` was lifted out of the page. */
  const figures = shiftFigures(shift)
  const plannedLabel = t('shifts.planned')
  /* Italic and muted where the figure is a plan, exactly as the table draws it —
     a reader moving their eye from the row to the panel must not have to learn a
     second convention for the same fact. */
  const planned = figures.projected ? 'text-ink-mute italic' : undefined

  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-title">{t(`shifts.type.${shift.type}`)}</h2>
          <Mono className="text-micro text-ink-dim">
            {formatShiftTime(shift.startsAt)} – {formatShiftTime(shift.endsAt)}
          </Mono>
          <span className="ms-auto" />
          <StateBadge tone={tone}>{t(`shifts.status.${shift.status}`)}</StateBadge>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-micro font-semibold text-ink-dim">
            {shift.operatorInitials}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-body-sm font-semibold">{shift.operatorName}</p>
            <p className="m-0 text-micro font-normal text-ink-dim">
              {shift.operatorRole} · {formatShiftDate(shift.date, { dateStyle: 'medium' })}
            </p>
          </div>
        </div>

        {/* All four run through `figures`, so all four agree with the row that
            opened this panel — including Downtime, which had no counterpart in
            the table and sat as the one dash among filled cells. It is derived
            from the projected OEE by the standard cascade rather than drawn
            separately, so it cannot contradict the figure beside it. */}
        <dl className="m-0 grid grid-cols-2 gap-2">
          <Figure
            label={t('shifts.column.oee')}
            className={planned}
            title={figures.projected ? plannedLabel : undefined}
          >
            {formatPercent(figures.oee, 1)}
          </Figure>
          <Figure
            label={t('shifts.detail.downtime')}
            className={planned}
            title={figures.projected ? plannedLabel : undefined}
          >
            {figures.downtimeMinutes == null
              ? '—'
              : t('shifts.detail.minutes', { count: figures.downtimeMinutes })}
          </Figure>
          <Figure
            label={t('shifts.column.anomalies')}
            className={planned}
            title={figures.projected ? plannedLabel : undefined}
          >
            {formatInteger(figures.anomalies)}
          </Figure>
          <Figure
            label={t('shifts.column.workOrders')}
            className={planned}
            title={figures.projected ? plannedLabel : undefined}
          >
            {formatInteger(figures.workOrders)}
          </Figure>
        </dl>

        {figures.projected ? (
          <p className="m-0 text-micro text-ink-mute italic">{t('shifts.plannedShort')}</p>
        ) : null}
      </Panel>

      {shift.anomalies.length ? (
        <Panel flush className="overflow-hidden">
          <h3 className="m-0 border-b border-hairline px-4 py-2.5 text-body-sm font-semibold">
            {t('shifts.detail.anomalies')}
          </h3>
          <ul className="m-0 list-none p-0">
            {shift.anomalies.map((alert) => (
              <li key={alert.id} className="border-b border-hairline last:border-0">
                <Link
                  to={`/app/assets/${alert.assetId}?view=detailed&tab=alerts`}
                  className="flex flex-wrap items-center gap-2 px-4 py-2.5 no-underline transition-colors hover:bg-sunken"
                >
                  <SeverityBadge severity={alert.severity} />
                  <span className="min-w-0 flex-1 text-body-sm text-ink">
                    {alert.sensor}
                    <span className="text-ink-dim"> · {alert.assetName}</span>
                  </span>
                  <Mono className="text-micro text-ink-dim">{alert.id}</Mono>
                  <Icon name="right" size="xs" className="text-ink-mute mirror-rtl" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {shift.workOrders.length ? (
        <Panel flush className="overflow-hidden">
          <h3 className="m-0 border-b border-hairline px-4 py-2.5 text-body-sm font-semibold">
            {t('shifts.detail.workOrders')}
          </h3>
          <ul className="m-0 list-none p-0">
            {shift.workOrders.map((order) => (
              <li key={order.id} className="border-b border-hairline last:border-0">
                <Link
                  to={`/app/work-orders?wo=${order.id}`}
                  className="flex flex-wrap items-center gap-2 px-4 py-2.5 no-underline transition-colors hover:bg-sunken"
                >
                  <Mono className="text-micro text-ink-dim">{order.id}</Mono>
                  <span className="min-w-0 flex-1 text-body-sm text-ink">
                    {t(`workOrders.titles.${order.title}`, { defaultValue: order.title })}
                  </span>
                  <StateBadge tone={null} dot={false}>
                    {t(`workOrders.state.${order.state}`)}
                  </StateBadge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel stripe="violet" className="flex flex-col gap-2.5">
        <p className="m-0">
          <AiBadge label={t('shifts.detail.aiSummary')} />
        </p>
        <p className="m-0 text-body-sm text-ink-dim">
          <Num>
            {t(`shifts.detail.summary.${shift.status}`, {
              count: shift.anomalies.length,
              orders: shift.workOrders.length,
              oee: shift.oee == null ? '—' : formatPercent(shift.oee, 1),
              operator: shift.operatorName,
            })}
          </Num>
        </p>

        {/* ── The handover action ───────────────────────────────────────
            Four states, and every one of them is a button. The first version of
            this offered nothing at all for a completed shift with no report
            filed — which is most of them, since the archive holds seven and the
            week holds twenty-one — so the commonest row on the screen had a
            sentence where its action should be.

            A DRAFT is not a filed report, so it says Edit and opens the form.
            A published one says View and opens the report. A shift that ended
            with nothing filed says Write, because that is the thing somebody
            looking at this row is there to do. Only a shift still running says
            End shift.

            All four open the report IN PLACE rather than navigating to the
            archive — the design does, and leaving the screen loses the shift the
            reader was looking at. The dialog is the archive's own. */}
        <div className="flex flex-wrap gap-2">
          {shift.status === 'active' ? (
            <ForgeButton variant="primary" size="sm" className="flex-1" onClick={onHandover}>
              {t('shifts.detail.endShift')}
            </ForgeButton>
          ) : shift.handoverStatus === 'draft' ? (
            <ForgeButton variant="primary" size="sm" className="flex-1" onClick={onHandover}>
              <Icon name="pencil" size="xs" />
              {t('shifts.detail.editHandover')}
            </ForgeButton>
          ) : shift.handoverId ? (
            <ForgeButton size="sm" className="flex-1" onClick={onHandover}>
              {t('shifts.detail.viewHandover')}
            </ForgeButton>
          ) : shift.status === 'completed' ? (
            <ForgeButton variant="primary" size="sm" className="flex-1" onClick={onHandover}>
              <Icon name="ai" size="xs" />
              {t('shifts.detail.writeHandover')}
            </ForgeButton>
          ) : (
            <p className="m-0 flex-1 self-center text-micro font-normal text-ink-mute">
              {t('shifts.detail.notStarted')}
            </p>
          )}
          <ForgeButton size="sm" onClick={onSchedule}>
            <Icon name="cal" size="xs" />
            {t('shifts.detail.schedule')}
          </ForgeButton>
        </div>

        {/* ── The design's Logbook button ───────────────────────────────
            Left out of the first pass because there was nowhere for it to go.
            It goes to THIS shift's entries rather than to the whole log: the
            question somebody asks from a shift row is "what did the crew write
            down on it", and a filter is the answer to that. */}
        <ForgeButton asChild variant="ghost" size="sm" className="self-start">
          <Link to={`/app/logbook?shift=${shift.id}`}>
            <Icon name="search" size="xs" />
            {t('shifts.detail.logbook')}
          </Link>
        </ForgeButton>
      </Panel>
    </div>
  )
}

function Figure({ label, children, className, title }) {
  return (
    <div className="rounded-sm bg-sunken px-3 py-2">
      <dt>
        <Eyebrow as="span">{label}</Eyebrow>
      </dt>
      <dd className="m-0 mt-0.5">
        <Num className={cn('text-title font-semibold', className)} title={title}>
          {children}
        </Num>
      </dd>
    </div>
  )
}
