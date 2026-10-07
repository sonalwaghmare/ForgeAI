import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { AiBadge, PlainBadge, SeverityBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { formatDateTime, formatHours, formatRelative } from '@/lib/format'
import { PRIORITY_TONE } from '@/lib/tone'

/**
 * One work order, opened.
 *
 * DEMO. The design's modal: badges, four facts, an advance button, delete and
 * edit. Four departures, all of them things the prototype's version cannot do.
 *
 * **The advance button is the only way to change state.** The prototype also has
 * Status as a free select in the edit form, so an order can be marked Completed
 * without ever being approved — on a screen whose subject is an approval
 * workflow. Here the workflow owns the state and the server rejects a move it
 * does not allow.
 *
 * **On Hold is its own action.** It is not anybody's successor, so it cannot be
 * reached by pressing Move: pausing work is a decision, and it gets a button
 * that says so, with Resume beside it.
 *
 * **Delete confirms.** The prototype deletes on the first click.
 *
 * **The order is connected to the rest of the platform.** Its asset, its anomaly
 * and its parts shortfall are links and facts rather than strings — the whole
 * reason this record exists is that something on a machine needs doing.
 */
export function WorkOrderDetailDialog({ order, pending, onClose, onAdvance, onHold, onEdit, onDelete }) {
  const { t } = useTranslation(['app', 'common'])
  const [confirming, setConfirming] = useState(false)

  if (!order) return null

  const title = t(`workOrders.titles.${order.title}`, { defaultValue: order.titleText })

  return (
    <ForgeDialog
      open={Boolean(order)}
      onOpenChange={(next) => {
        if (!next) {
          setConfirming(false)
          onClose()
        }
      }}
      size="md"
      title={`${order.id} · ${title}`}
      footer={
        confirming ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <p className="m-0 flex-1 text-body-sm text-ink-dim">{t('workOrders.deleteConfirm')}</p>
            <ForgeButton onClick={() => setConfirming(false)}>
              {t('common:actions.cancel')}
            </ForgeButton>
            <ForgeButton variant="danger" disabled={pending} onClick={() => onDelete(order)}>
              {t('workOrders.deleteYes')}
            </ForgeButton>
          </div>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <ForgeButton variant="danger" onClick={() => setConfirming(true)}>
              <Icon name="trash" size="xs" />
              {t('common:actions.delete', { defaultValue: 'Delete' })}
            </ForgeButton>
            <span className="ms-auto" />
            <ForgeButton onClick={onClose}>{t('common:actions.close')}</ForgeButton>
            <ForgeButton onClick={() => onEdit(order)}>
              <Icon name="pencil" size="xs" />
              {t('workOrders.edit')}
            </ForgeButton>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge tone={PRIORITY_TONE[order.priority]} dot={false}>
            {t(`workOrders.priority.${order.priority}`)}
          </StateBadge>
          <PlainBadge>{t(`workOrders.state.${order.state}`)}</PlainBadge>
          {order.authoredBy === 'ai' ? <AiBadge label={t('workOrders.aiDrafted')} /> : null}
          {order.overdue ? (
            <StateBadge tone="red">{t('workOrders.overdue')}</StateBadge>
          ) : null}
        </div>

        <dl className="m-0 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
          <Fact label={t('workOrders.column.asset')}>
            <Link
              to={`/app/assets/${order.assetId}`}
              className="text-ink no-underline hover:underline"
            >
              {order.assetName}
            </Link>
            <Mono className="mt-0.5 block text-micro font-normal text-ink-dim">
              {order.assetCode} · {order.lineName}
            </Mono>
          </Fact>
          <Fact label={t('workOrders.column.assignee')}>
            {order.assigneeName ?? t('workOrders.unassigned')}
          </Fact>
          <Fact label={t('workOrders.column.due')}>
            <Num className={order.overdue ? 'text-on-red' : undefined}>
              {formatDateTime(order.dueAt, { dateStyle: 'medium' })}
            </Num>
            <Num className="mt-0.5 block text-micro font-normal text-ink-dim">
              {formatRelative(order.dueAt)}
            </Num>
          </Fact>
          <Fact label={t('workOrders.estimate')}>
            <Num>{formatHours(order.estimateHours)}</Num>
          </Fact>
        </dl>

        {/* The anomaly this order answers. A work order raised off an alert and
            an alert with no visible work against it are the two halves of one
            record; the prototype shows neither to the other. */}
        {order.alert ? (
          <div className="rounded-sm border border-hairline bg-sunken p-3.5">
            <Eyebrow className="mb-1.5">{t('workOrders.raisedFrom')}</Eyebrow>
            <p className="m-0 flex flex-wrap items-center gap-2 text-body-sm">
              <SeverityBadge severity={order.alert.severity} />
              <Mono>{order.alert.id}</Mono>
              <span className="text-ink-dim">{order.alert.sensor}</span>
            </p>
          </div>
        ) : null}

        {/* Why an order is stuck, derived from its own parts list rather than
            authored as a reason nobody can check. */}
        {order.blockedByParts.length ? (
          <div className="rounded-sm border border-hairline bg-sunken p-3.5">
            <Eyebrow className="mb-1.5">{t('workOrders.blocked')}</Eyebrow>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {order.blockedByParts.map((part) => (
                <li key={part.sku} className="flex flex-wrap items-center gap-2 text-body-sm">
                  <Mono>{part.sku}</Mono>
                  <Num className="text-ink-dim">
                    {t('workOrders.partShort', { short: part.short, onHand: part.onHand })}
                  </Num>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {order.gates.length ? (
          <div>
            <Eyebrow className="mb-1.5">{t('workOrders.gates')}</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {order.gates.map((gate) => (
                <PlainBadge key={gate}>
                  <Icon name="lock" size="xs" />
                  {t(`workOrders.gate.${gate}`, { defaultValue: gate })}
                </PlainBadge>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {order.nextState ? (
            <ForgeButton variant="primary" disabled={pending} onClick={() => onAdvance(order)}>
              {t('workOrders.advanceTo', { state: t(`workOrders.state.${order.nextState}`) })}
              <Icon name="right" size="xs" className="mirror-rtl" />
            </ForgeButton>
          ) : null}
          {order.canHold ? (
            <ForgeButton disabled={pending} onClick={() => onHold(order)}>
              {t('workOrders.putOnHold')}
            </ForgeButton>
          ) : null}
        </div>
      </div>
    </ForgeDialog>
  )
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt>
        <Eyebrow as="span">{label}</Eyebrow>
      </dt>
      <dd className="m-0 mt-1 text-body-sm font-semibold">{children}</dd>
    </div>
  )
}
