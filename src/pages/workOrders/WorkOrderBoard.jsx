import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { AiBadge, PlainBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { WO_STATES } from '@/features/workOrders/api'
import { formatInteger, formatRelative } from '@/lib/format'
import { PRIORITY_TONE } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * The kanban board — six columns, one per state.
 *
 * DEMO. See `DEMO-MODE.md` §8.7.
 *
 * ── The Move button, not drag-and-drop ────────────────────────────────────
 * The design uses a button too, and it is the right call rather than a
 * shortcut: this board is an approval workflow, not a free arrangement. Dragging
 * implies any column is a legal destination, and most are not — a draft cannot
 * become Completed. The button offers the one move the workflow allows and names
 * it, and the server rejects anything else.
 *
 * ── The column counts are counted ─────────────────────────────────────────
 * Off the same filtered set the cards come from, in the handler. A header that
 * says 4 above three cards is the commonest way a board like this goes wrong.
 *
 * ── The AI badge is provenance ────────────────────────────────────────────
 * It marks an order Forge AI drafted. The prototype's form offers Source as a
 * select, so anyone can award it to themselves; here it is set by the server and
 * cannot be typed.
 */

export function WorkOrderBoard({ orders, columns, onOpen, onAdvance, advancing }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    /* The scroller needs clearance inside it: a card's leading edge and its
       hover lift sit outside the content box, and `overflow-x` clips the block
       axis too. See DEMO-MODE.md §2.7. */
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pt-1 pb-3">
      {WO_STATES.map((state) => {
        const items = orders.filter((order) => order.state === state)
        return (
          <section key={state} className="flex w-[17rem] shrink-0 flex-col">
            <header className="mb-2 flex items-center gap-2 px-1">
              <Eyebrow as="h2" className="m-0">
                {t(`workOrders.state.${state}`)}
              </Eyebrow>
              <Num className="text-micro font-normal text-ink-dim">
                {formatInteger(columns[state] ?? items.length)}
              </Num>
            </header>

            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <p className="m-0 rounded-sm border border-dashed border-hairline px-3 py-5 text-center text-micro font-normal text-ink-dim">
                  {t('workOrders.emptyColumn')}
                </p>
              ) : (
                items.map((order) => (
                  <Card
                    key={order.id}
                    order={order}
                    onOpen={() => onOpen(order)}
                    onAdvance={() => onAdvance(order)}
                    advancing={advancing === order.id}
                    t={t}
                  />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Card({ order, onOpen, onAdvance, advancing, t }) {
  return (
    <Panel
      interactive
      // Earned: an order that is late, or urgent and still open. Not every card,
      // or the edge stops meaning anything.
      stripe={order.overdue ? 'red' : order.priority === 'urgent' && order.open ? 'amber' : null}
      className="flex cursor-pointer flex-col gap-2 p-3"
      onClick={(event) => {
        if (event.target.closest('button')) return
        onOpen()
      }}
    >
      <div className="flex items-center gap-2">
        <Mono className="text-micro text-ink-mute">{order.id}</Mono>
        <span className="ms-auto" />
        <StateBadge tone={PRIORITY_TONE[order.priority]} dot={false}>
          {t(`workOrders.priority.${order.priority}`)}
        </StateBadge>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="m-0 text-start text-body-sm font-semibold text-ink hover:underline"
      >
        {t(`workOrders.titles.${order.title}`, { defaultValue: order.titleText })}
      </button>

      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro font-normal text-ink-dim">
        <Icon name="machine" size="xs" className="shrink-0" />
        <span className="truncate">{order.assetName}</span>
        {order.authoredBy === 'ai' ? <AiBadge label={t('workOrders.ai')} /> : null}
        {order.blockedByParts.length ? (
          <PlainBadge>{t('workOrders.partsShort')}</PlainBadge>
        ) : null}
        <Num
          className={cn('ms-auto whitespace-nowrap', order.overdue && 'font-semibold text-on-red')}
        >
          {formatRelative(order.dueAt)}
        </Num>
      </p>

      {order.nextState ? (
        <button
          type="button"
          onClick={onAdvance}
          disabled={advancing}
          className="w-full rounded-xs border border-hairline bg-sunken px-2 py-1.5 text-micro font-semibold text-ink-dim transition-colors hover:border-forge hover:text-ink disabled:opacity-50"
        >
          {t('workOrders.moveTo', { state: t(`workOrders.state.${order.nextState}`) })}
        </button>
      ) : null}
    </Panel>
  )
}
