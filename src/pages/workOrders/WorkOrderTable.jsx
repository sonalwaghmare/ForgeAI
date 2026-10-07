import { useTranslation } from 'react-i18next'
import { Panel } from '@/components/forge/Panel'
import { TablePagination } from '@/components/forge/TablePagination'
import { AiBadge, PlainBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { formatDateTime } from '@/lib/format'
import { PRIORITY_TONE } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * The table view — the same collection, flat.
 *
 * DEMO. The design's columns in the design's order: WO # · Title · Asset ·
 * Priority · Assignee · Due · Source · Status, plus a pager.
 *
 * One correction. The prototype's Source column prints the bare word "Manual"
 * for anything not AI, which reads as a category when it is really the absence
 * of one. Here a human-raised order names the person who raised it where there
 * is one, and says Unassigned where there is not — which is the fact somebody
 * scanning this column actually wants.
 */
export function WorkOrderTable({ orders, total, page, pageSize, onPage, onPageSize, onOpen }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <Panel flush className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          <thead>
            <tr className="border-b border-hairline">
              <Th>{t('workOrders.column.id')}</Th>
              {/* The one long cell takes the width so the short ones size to
                  content. Not a default — see DEMO-MODE.md §2.7. */}
              <Th className="w-full">{t('workOrders.column.title')}</Th>
              <Th>{t('workOrders.column.asset')}</Th>
              <Th>{t('workOrders.column.priority')}</Th>
              <Th>{t('workOrders.column.assignee')}</Th>
              <Th>{t('workOrders.column.due')}</Th>
              <Th>{t('workOrders.column.source')}</Th>
              <Th>{t('workOrders.column.status')}</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                onClick={() => onOpen(order)}
                className={cn(
                  'cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-sunken',
                  order.overdue && 'stripe-red',
                )}
              >
                <td className="px-4 py-2.5">
                  <Mono className="text-micro whitespace-nowrap text-ink-dim">{order.id}</Mono>
                </td>
                <td className="px-3 py-2.5 font-semibold">
                  {t(`workOrders.titles.${order.title}`, { defaultValue: order.titleText })}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">{order.assetName}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <StateBadge tone={PRIORITY_TONE[order.priority]} dot={false}>
                    {t(`workOrders.priority.${order.priority}`)}
                  </StateBadge>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                  {order.assigneeName ?? t('workOrders.unassigned')}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Num className={cn(order.overdue && 'font-semibold text-on-red')}>
                    {formatDateTime(order.dueAt, { dateStyle: 'medium' })}
                  </Num>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {order.authoredBy === 'ai' ? (
                    <AiBadge label={t('workOrders.ai')} />
                  ) : (
                    <span className="text-ink-dim">{t('workOrders.raisedBy')}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <PlainBadge>{t(`workOrders.state.${order.state}`)}</PlainBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPage}
        onPageSizeChange={onPageSize}
      />
    </Panel>
  )
}

function Th({ children, className }) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-start text-eyebrow font-semibold whitespace-nowrap text-ink-dim first:ps-4 last:pe-4',
        className,
      )}
    >
      {children}
    </th>
  )
}
