import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, TextArea } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { AiBadge, SeverityBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent } from '@/lib/format'
import { ON_TINT_CLASS, PRIORITY_TONE, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { exportHandover } from './handoverExport'
import {
  HANDOVER_LOGBOOK,
  HANDOVER_MATERIAL,
  HANDOVER_SAFETY,
  HANDOVER_WORK_ORDERS,
  downtimeEvents,
  lossMinutes,
  oeeFactors,
  qualityDefects,
} from './handoverDetail'

/**
 * The two handover modals: read one, and write one.
 *
 * DEMO.
 *
 * Both are `lg` — 720px, the documented step for a document rather than a form.
 * A handover report is read end to end before it is accepted, and squeezing four
 * tables into 540px is how somebody acknowledges a shift they did not finish
 * reading.
 */

/* ══ REPORT ══════════════════════════════════════════════════════════════ */

export function HandoverReportDialog({ open, handover, report, pending, onClose, onEdit, onAcknowledge, onExported }) {
  const { t } = useTranslation(['app', 'common'])

  const pair = t('handovers.shiftPair', {
    from: t(`common:shiftShort.${handover.from}`),
    to: t(`common:shiftShort.${handover.to}`),
  })

  const facts = [
    ['outgoing', handover.outgoing],
    ['incoming', handover.incoming],
    ['window', handover.window],
    ['plant', report.siteName],
  ]

  /* The seven sections the record does not carry, composed from the ones it
     does — see `handoverDetail.js` for why they are derived rather than typed. */
  const factors = oeeFactors(handover.oee)
  const losses = lossMinutes(factors)
  const maxLoss = Math.max(1, ...losses.rows.map((row) => row.minutes))
  const downtime = downtimeEvents(losses, report.carried)
  /* Output, read off the production table rather than restated beside it. */
  const produced =
    Number(
      String(report.production.find((row) => row.key === 'cansProduced')?.value ?? '').replace(
        /[^\d]/g,
        '',
      ),
    ) || 0
  const quality = qualityDefects(produced)

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      size="lg"
      // A document, not a form. The default 32rem cap turns four sections and
      // two tables into a porthole; the design gives the whole card 88vh.
      bodyClassName="max-h-[min(72vh,46rem)]"
      title={t('handovers.report.title')}
      description={t('handovers.report.subtitle', {
        site: report.siteName,
        pair,
        date: handover.date,
      })}
      // All four right-aligned, in the design's order: Close · Export · Edit ·
      // Acknowledge. Close is not pushed to the far edge — on a document the
      // reader's eye ends at the bottom right, and that is where every choice
      // about what to do next should be.
      footer={
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <ForgeButton onClick={onClose}>{t('common:actions.close')}</ForgeButton>
          <ForgeButton
            onClick={() => {
              exportHandover({
                handover,
                report,
                t,
                labels: { title: t('handovers.report.title') },
              })
              onExported?.()
            }}
          >
            <Icon name="down" size="xs" />
            {t('common:actions.export')}
          </ForgeButton>
          <ForgeButton onClick={onEdit}>{t('handovers.report.edit')}</ForgeButton>
          {/* Acknowledging is the act that closes the ritual, so it is the one
              primary on the dialog — and it disappears once it has been done,
              rather than sitting there inviting a second acknowledgement. */}
          {handover.status !== 'acknowledged' ? (
            <ForgeButton variant="primary" disabled={pending} onClick={onAcknowledge}>
              {t('handovers.report.acknowledge')}
            </ForgeButton>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Four across, as the design has them, collapsing to two rather than
            reflowing to whatever fits — these are a set and they read as a row. */}
        <dl className="m-0 grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
          {facts.map(([key, value]) => (
            <div key={key} className="rounded-sm border border-hairline bg-card px-3 py-2.5">
              <dt className="eyebrow">{t(`handovers.report.${key}`)}</dt>
              <dd className="m-0 mt-1 text-body-sm font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <section>
          <Eyebrow className="mb-2">{t('handovers.report.executiveSummary')}</Eyebrow>
          <p className="m-0 max-w-[68ch] text-body leading-[1.65] text-ink-dim">{report.summary}</p>
        </section>

        <section>
          <Eyebrow className="mb-2">{t('handovers.report.production')}</Eyebrow>
          <div className="overflow-x-auto rounded-sm border border-hairline">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {['metric', 'value', 'target'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="eyebrow border-b border-hairline px-3.5 py-2 text-start whitespace-nowrap"
                    >
                      {t(`handovers.report.productionColumns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.production.map((row) => (
                  <tr key={row.key} className="border-b border-subtle last:border-b-0">
                    <td className="px-3.5 py-2 text-ink-dim">{t(`handovers.metric.${row.key}`)}</td>
                    <td className="px-3.5 py-2">
                      <Num className="font-semibold">{row.value}</Num>
                    </td>
                    <td className="px-3.5 py-2 text-ink-dim">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 4 · OEE and loss accounting ─────────────────────────────────
            Composed from this record's own OEE, so the factors multiply to the
            headline and the loss minutes are what its availability did not
            cover. See `handoverDetail.js`. */}
        <section>
          <Eyebrow className="mb-2">{t('handovers.report.oee')}</Eyebrow>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
            <div className="rounded-sm border border-hairline bg-sunken p-3.5">
              <div className="mb-2.5 flex flex-wrap items-baseline gap-2">
                <Num
                  className={cn(
                    'text-metric-sm',
                    factors.oee >= factors.target ? 'text-on-green' : 'text-on-amber',
                  )}
                >
                  {formatPercent(factors.oee, 1)}
                </Num>
                <span className="text-micro text-ink-mute">
                  <Num>{t('handovers.report.oeeTarget', { target: factors.target })}</Num>
                </span>
              </div>
              {[
                ['availability', factors.availability],
                ['performance', factors.performance],
                ['quality', factors.quality],
              ].map(([key, value]) => (
                <div key={key} className="mb-2 last:mb-0">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="flex-1 text-micro font-semibold">
                      {t(`handovers.report.factor.${key}`)}
                    </span>
                    <Num className="text-body-sm font-semibold">{formatPercent(value, 1)}</Num>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-pill bg-card">
                    <div
                      className="h-full rounded-pill"
                      style={{
                        width: `${Math.min(100, value)}%`,
                        backgroundColor: 'var(--hue-forge)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-sm border border-hairline bg-sunken p-3.5">
              <Eyebrow as="p" className="mb-2.5">
                <Num>{t('handovers.report.lossTotal', { minutes: losses.downtime })}</Num>
              </Eyebrow>
              {losses.rows.map((row) => (
                <div key={row.key} className="mb-1.5 flex items-center gap-2 last:mb-0">
                  <span className="w-24 shrink-0 truncate text-micro">
                    {t(`handovers.report.loss.${row.key}`)}
                  </span>
                  <span className="h-3 flex-1 overflow-hidden rounded-xs bg-card">
                    <span
                      className={cn('block h-full rounded-xs', TINT_CLASS[row.tone])}
                      style={{ width: `${(row.minutes / maxLoss) * 100}%` }}
                    />
                  </span>
                  <Num className="w-10 shrink-0 text-end text-micro font-semibold">
                    {t('shifts.detail.minutes', { count: row.minutes })}
                  </Num>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5 · downtime events ─────────────────────────────────────────── */}
        {downtime.length ? (
          <section>
            <Eyebrow className="mb-2">{t('handovers.report.downtime')}</Eyebrow>
            <div className="overflow-x-auto rounded-sm border border-hairline">
              <table className="w-full border-collapse text-body-sm">
                <thead>
                  <tr className="bg-sunken">
                    {['time', 'asset', 'reason', 'duration', 'class', 'linked'].map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="eyebrow border-b border-hairline px-3.5 py-2 text-start whitespace-nowrap"
                      >
                        {t(`handovers.report.downtimeColumns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {downtime.map((row) => (
                    <tr key={row.at} className="border-b border-subtle last:border-b-0">
                      <td className="px-3.5 py-2">
                        <Mono className="text-micro text-ink-dim">{row.at}</Mono>
                      </td>
                      <td className="px-3.5 py-2 font-semibold">{row.asset}</td>
                      <td className="px-3.5 py-2 text-ink-dim">
                        {t(`handovers.report.downtimeReason.${row.reasonKey}`)}
                      </td>
                      <td className="px-3.5 py-2 whitespace-nowrap">
                        <Num>{t('shifts.detail.minutes', { count: row.minutes })}</Num>
                      </td>
                      <td className="px-3.5 py-2">
                        <StateBadge tone={row.planned ? null : 'amber'}>
                          {t(row.planned ? 'handovers.report.planned' : 'handovers.report.unplanned')}
                        </StateBadge>
                      </td>
                      <td className="px-3.5 py-2">
                        {row.linked ? (
                          <Mono className="text-on-forge">{row.linked}</Mono>
                        ) : (
                          <span className="text-ink-mute">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* ── 6 · quality ─────────────────────────────────────────────────── */}
        <section>
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <Eyebrow className="flex-1">{t('handovers.report.quality')}</Eyebrow>
            <span className="text-micro text-ink-mute">
              <Num>
                {t('handovers.report.qualityTotal', {
                  total: formatPercent(quality.total, 2),
                  spec: formatPercent(quality.spec, 1),
                })}
              </Num>
            </span>
          </div>
          <div className="overflow-x-auto rounded-sm border border-hairline">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {['defect', 'units', 'rate', 'source'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="eyebrow border-b border-hairline px-3.5 py-2 text-start whitespace-nowrap"
                    >
                      {t(`handovers.report.qualityColumns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quality.rows.map((row) => (
                  <tr key={row.key} className="border-b border-subtle last:border-b-0">
                    <td className="px-3.5 py-2">{t(`handovers.report.defect.${row.key}`)}</td>
                    <td className="px-3.5 py-2">
                      <Num className="font-semibold">{formatInteger(row.units)}</Num>
                    </td>
                    <td className="px-3.5 py-2 text-ink-dim">
                      <Num>{formatPercent(row.rate, 2)}</Num>
                    </td>
                    <td className="px-3.5 py-2 text-ink-dim">
                      {t(`handovers.report.defectSource.${row.sourceKey}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <Eyebrow className="mb-2">{t('handovers.report.carried')}</Eyebrow>
          <div className="overflow-x-auto rounded-sm border border-hairline">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {['id', 'severity', 'description', 'state'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="eyebrow border-b border-hairline px-3.5 py-2 text-start whitespace-nowrap"
                    >
                      {t(`handovers.report.carriedColumns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.carried.map((row) => (
                  <tr key={row.id} className="border-b border-subtle last:border-b-0">
                    <td className="px-3.5 py-2">
                      <Mono className="font-semibold text-on-forge">{row.id}</Mono>
                    </td>
                    <td className="px-3.5 py-2">
                      <SeverityBadge severity={row.severity} dot />
                    </td>
                    <td className="px-3.5 py-2 text-ink-dim">{row.description}</td>
                    <td className="px-3.5 py-2 text-ink-dim">
                      {t(`handovers.carriedState.${row.state}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 8 · work orders ─────────────────────────────────────────────── */}
        <section>
          <Eyebrow className="mb-2">{t('handovers.report.workOrders')}</Eyebrow>
          <div className="overflow-x-auto rounded-sm border border-hairline">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {['id', 'task', 'priority', 'state', 'assignee'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="eyebrow border-b border-hairline px-3.5 py-2 text-start whitespace-nowrap"
                    >
                      {t(`handovers.report.workOrderColumns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HANDOVER_WORK_ORDERS.map((row) => (
                  <tr key={row.id} className="border-b border-subtle last:border-b-0">
                    <td className="px-3.5 py-2">
                      <Mono className="font-semibold text-on-forge">{row.id}</Mono>
                    </td>
                    <td className="px-3.5 py-2 text-ink-dim">
                      {t(`handovers.report.workOrderTask.${row.titleKey}`)}
                    </td>
                    <td className="px-3.5 py-2">
                      <StateBadge tone={PRIORITY_TONE[row.priority]}>
                        {t(`workOrders.priority.${row.priority}`)}
                      </StateBadge>
                    </td>
                    <td
                      className={cn(
                        'px-3.5 py-2 whitespace-nowrap',
                        row.stateKey === 'overdue' ? 'text-on-red' : 'text-ink-dim',
                      )}
                    >
                      {t(`handovers.report.workOrderState.${row.stateKey}`)}
                    </td>
                    <td className="px-3.5 py-2 text-ink-dim">
                      {row.assignee ?? <span className="text-ink-mute">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 9 · safety, EHS and permits ─────────────────────────────────── */}
        <section>
          <Eyebrow className="mb-2">{t('handovers.report.safety')}</Eyebrow>
          <dl className="m-0 mb-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))]">
            {[
              ['incidents', formatInteger(HANDOVER_SAFETY.incidents), HANDOVER_SAFETY.incidents ? 'red' : 'green'],
              ['nearMisses', formatInteger(HANDOVER_SAFETY.nearMisses), HANDOVER_SAFETY.nearMisses ? 'amber' : 'green'],
              ['permits', formatInteger(HANDOVER_SAFETY.permits.length), 'green'],
              ['loto', formatInteger(HANDOVER_SAFETY.loto.length), 'green'],
            ].map(([key, value, tone]) => (
              <div key={key} className="rounded-sm border border-hairline bg-card px-3 py-2.5">
                <dt className="eyebrow">{t(`handovers.report.safetyStat.${key}`)}</dt>
                <dd className="m-0 mt-1">
                  <Num className={cn('text-body-sm font-semibold', ON_TINT_CLASS[tone])}>
                    {value}
                  </Num>
                </dd>
              </div>
            ))}
          </dl>
          <ul className="m-0 list-none rounded-sm border border-hairline bg-sunken p-3">
            {[...HANDOVER_SAFETY.permits, ...HANDOVER_SAFETY.loto].map((row) => (
              <li key={row.id} className="flex flex-wrap gap-2.5 py-1 text-body-sm">
                <Mono className="w-20 shrink-0 text-micro text-ink-mute">{row.id}</Mono>
                <span className="min-w-0 flex-1 text-ink-dim">
                  {t(`handovers.report.permit.${row.descriptionKey}`)}
                </span>
                <span className="text-micro font-semibold text-on-green">
                  {t(`handovers.report.permitState.${row.stateKey}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 10 · material, consumables and WIP ──────────────────────────── */}
        <section>
          <Eyebrow className="mb-2">{t('handovers.report.material')}</Eyebrow>
          <dl className="m-0 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
            {HANDOVER_MATERIAL.map((row) => (
              <div key={row.key} className="rounded-sm border border-hairline bg-card px-3 py-2.5">
                <dt className="eyebrow">{t(`handovers.report.materialItem.${row.key}`)}</dt>
                <dd className="m-0 mt-1">
                  <Num className="block text-body-sm font-semibold">{row.value}</Num>
                  <span className="mt-0.5 block text-micro text-ink-mute">
                    {t(`handovers.report.materialNote.${row.noteKey}`)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── 11 · logbook entries inside the window ──────────────────────── */}
        <section>
          <Eyebrow className="mb-2">{t('handovers.report.logbook')}</Eyebrow>
          <ul className="m-0 flex list-none flex-col p-0">
            {HANDOVER_LOGBOOK.map((entry) => (
              <li
                key={entry.at}
                className="flex gap-2.5 border-b border-subtle py-2.5 last:border-0"
              >
                <Mono className="w-10 shrink-0 text-micro text-ink-mute">{entry.at}</Mono>
                <div className="min-w-0">
                  <p className="m-0 text-body-sm leading-relaxed text-ink-dim">
                    <span className="font-semibold text-ink">{entry.author}</span> — {entry.body}
                  </p>
                  <p className="m-0 mt-1 text-micro text-on-forge">{entry.tags}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <Eyebrow className="mb-2">{t('handovers.report.pending')}</Eyebrow>
          {/* An ordered list, because the order is the priority the outgoing
              lead set — not a bulleted set of equals. */}
          <ol className="m-0 flex list-none flex-col p-0">
            {report.pending.map((item, index) => (
              <li
                key={item}
                className="flex gap-2.5 border-t border-subtle py-2 text-body-sm first:border-t-0"
              >
                <Num className="shrink-0 font-bold text-on-forge">{index + 1}.</Num>
                <span className="text-ink-dim">{item}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 12 · sign-off ───────────────────────────────────────────────
            Green because it is a completed control, and it states who
            acknowledged where the record says somebody did — the design prints
            an acknowledgement on every report including the drafts. */}
        <section>
          <div className="flex flex-wrap items-center gap-2.5 rounded-sm border border-hairline tint-green px-3.5 py-2.5">
            <Icon name="shield" size="xs" className="text-on-green" />
            <span className="min-w-0 flex-1 text-body-sm text-on-green">
              {t('handovers.report.signedOff', {
                name: handover.outgoing,
                at: handover.window.split('–').pop().trim(),
              })}
            </span>
            {handover.status === 'acknowledged' ? (
              <span className="text-body-sm font-semibold text-on-green">
                {t('handovers.report.acknowledgedBy', { name: handover.incoming })}
              </span>
            ) : null}
          </div>
        </section>

        <p className="m-0 text-body-sm text-ink-mute italic">
          {t('handovers.report.demoNotice')}
        </p>
      </div>
    </ForgeDialog>
  )
}

/* ══ FORM ════════════════════════════════════════════════════════════════ */

/** Today at the end of the shift, formatted for `datetime-local`. */
function defaultShiftEnd() {
  const date = new Date()
  date.setHours(22, 0, 0, 0)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function HandoverFormDialog({ open, handover, report, people, pending, onClose, onSubmit, onExported }) {
  const { t } = useTranslation(['app', 'common'])

  const [outgoing, setOutgoing] = useState(handover.outgoing)
  const [incoming, setIncoming] = useState(handover.incoming)
  const [shiftEnd, setShiftEnd] = useState(defaultShiftEnd())
  const [summary, setSummary] = useState(report.summary)
  const [notes, setNotes] = useState('')

  const names = people.map((person) => ({ value: person.name, label: person.name }))

  const submit = (status) =>
    onSubmit({ status, outgoing, incoming, shiftEnd, summary, notes }, incoming)

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      size="lg"
      bodyClassName="max-h-[min(72vh,46rem)]"
      title={t('handovers.form.title')}
      description={t('handovers.form.description')}
      footer={
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <ForgeButton
            onClick={() => {
              exportHandover({
                handover,
                report: { ...report, summary },
                t,
                labels: { title: t('handovers.report.title') },
              })
              onExported?.()
            }}
          >
            <Icon name="down" size="xs" />
            {t('common:actions.export')}
          </ForgeButton>
          <ForgeButton disabled={pending} onClick={() => submit('draft')}>
            {t('handovers.form.saveDraft')}
          </ForgeButton>
          <ForgeButton variant="primary" disabled={pending} onClick={() => submit('published')}>
            {t('handovers.form.publish')}
          </ForgeButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* The machine says what it did before you read what it wrote. */}
        <p className="m-0 flex items-start gap-2.5 rounded-sm border border-hairline stripe-violet bg-card px-3.5 py-2.5 text-body-sm text-ink-dim">
          <Icon name="ai" size="sm" className="mt-0.5 shrink-0 text-violet" />
          <span>{t('handovers.form.aiBanner')}</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <ForgeSelect
            label={t('handovers.form.outgoing')}
            value={outgoing}
            onValueChange={setOutgoing}
            options={names}
          />
          <ForgeSelect
            label={t('handovers.form.incoming')}
            value={incoming}
            onValueChange={setIncoming}
            options={names}
          />
          <Field
            type="datetime-local"
            label={t('handovers.form.shiftEnd')}
            value={shiftEnd}
            onChange={(event) => setShiftEnd(event.target.value)}
          />
          <ForgeSelect
            label={t('handovers.form.plant')}
            value={report.siteName}
            onValueChange={() => {}}
            options={[{ value: report.siteName, label: report.siteName }]}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-control text-ink">{t('handovers.form.executiveSummary')}</span>
            <AiBadge label={t('handovers.form.aiDrafted')} />
          </div>
          <TextArea
            label={t('handovers.form.executiveSummary')}
            // Labelled above by the row that carries the AI badge, so the
            // control's own label is announced but not drawn twice.
            className="[&>label]:sr-only"
            rows={4}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-control text-ink">{t('handovers.form.productionAlerts')}</span>
            <AiBadge label={t('handovers.form.aiDrafted')} />
          </div>
          {/* Read-only on purpose: these three lines are computed from the shift,
              and letting somebody retype the can count would put a number in the
              record that nothing produced. */}
          <ul className="m-0 flex list-none flex-col gap-1 rounded-sm bg-sunken px-3.5 py-3 p-0 text-body-sm text-ink-dim">
            {report.aiDraft.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <TextArea
          label={t('handovers.form.notes')}
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t('handovers.form.notesPlaceholder')}
        />
      </div>
    </ForgeDialog>
  )
}
