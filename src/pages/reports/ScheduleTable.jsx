import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState } from '@/components/forge/States'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Num } from '@/components/forge/primitives'
import { formatDateTime } from '@/lib/format'
import { templateName } from './reportMeta'

/**
 * Standing deliveries.
 *
 * DEMO. See `DEMO-MODE.md` §8.9.
 *
 * ── Next run is computed, and absent when there will not be one ───────────
 * The design prints "Mon 06:00" and "1 Sep 06:00" as authored strings, so the
 * table is wrong the day after it was written and stays wrong. Here the instant
 * comes off the cadence and the clock, and a PAUSED schedule shows no next run
 * at all — printing one for a delivery that will not fire is the single most
 * misleading thing this table could say.
 */
export function ScheduleTable({ schedules, onNew }) {
  const { t } = useTranslation(['app', 'common'])

  if (!schedules.length) {
    return (
      <EmptyState
        icon="cal"
        title={t('reports.scheduled.empty')}
        body={t('reports.scheduled.emptyBody')}
        action={
          <ForgeButton variant="primary" onClick={onNew}>
            {t('reports.scheduled.new')}
          </ForgeButton>
        }
      />
    )
  }

  return (
    <Panel flush className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3">
        <h2 className="m-0 flex-1 text-micro font-semibold tracking-wide text-ink-dim uppercase">
          {t('reports.scheduled.title')}
        </h2>
        <ForgeButton size="sm" onClick={onNew}>
          <Icon name="plus" size="xs" />
          {t('reports.scheduled.new')}
        </ForgeButton>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          <thead>
            <tr className="border-b border-hairline">
              <Th className="w-full">{t('reports.scheduled.column.report')}</Th>
              <Th>{t('reports.scheduled.column.cadence')}</Th>
              <Th>{t('reports.scheduled.column.next')}</Th>
              <Th>{t('reports.scheduled.column.recipients')}</Th>
              <Th>{t('reports.scheduled.column.format')}</Th>
              <Th>{t('reports.scheduled.column.status')}</Th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr key={schedule.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-2.5 font-semibold">
                  {templateName(t, schedule.templateId)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                  {t(`reports.cadence.${schedule.cadence}`)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                  {schedule.nextRunAt ? (
                    <Num>
                      {formatDateTime(schedule.nextRunAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </Num>
                  ) : (
                    <span className="text-ink-mute">{t('reports.scheduled.noNext')}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                  <Num>
                    {t('reports.scheduled.recipientCount', {
                      audience: t(`reports.audience.${schedule.audience}`),
                      count: schedule.recipients,
                    })}
                  </Num>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                  {schedule.formats.map((entry) => t(`reports.format.${entry}`)).join(' + ')}
                </td>
                <td className="px-3 py-2.5">
                  <StateBadge tone={schedule.status === 'active' ? 'green' : 'ack'}>
                    {t(`reports.scheduled.${schedule.status}`)}
                  </StateBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function Th({ className, children }) {
  return (
    <th
      scope="col"
      className={`bg-sunken px-3 py-2.5 text-start text-micro font-semibold tracking-wide whitespace-nowrap text-ink-dim uppercase first:ps-4 ${className ?? ''}`}
    >
      {children}
    </th>
  )
}
