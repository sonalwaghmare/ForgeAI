import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { IconButton } from '@/components/forge/ForgeButton'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { formatDecimal } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The Series table under the plot.
 *
 * DEMO. Style, visibility, name, state, tag, description, min, max, mean, unit
 * and the actions — the design's columns, in the design's order.
 *
 * ── Every figure is the plotted one ───────────────────────────────────────
 * Min, max and mean come from `entry.stats`, computed in the handler over the
 * exact array the chart draws. The prototype authors `min: 0, max: 80, mean:
 * 38.4` on a row whose generated series ranges 24 to 42, so the table describes
 * a chart that is not on the screen.
 *
 * ── The eye actually hides the line ───────────────────────────────────────
 * And a hidden series stays in the table with its statistics, because "what does
 * this look like without the temperature trace" is the reason to hide one, not
 * "I no longer care what it reads".
 *
 * ── P&IDs are the asset's real documents ──────────────────────────────────
 * The design shows a chip reading `CAN-LINE-1-PID-001 ▾` on every row, the same
 * string on all four. Here the column links to the asset's Documents tab, which
 * is where its actual P&IDs are — and an asset with none says so rather than
 * borrowing a code from another plant.
 */

const STATE_TONE = { violation: 'red', warning: 'amber', ok: 'green' }

export function SeriesTable({ chart, visible, onToggle, onRemove, onAdd }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <section className="rounded-sm border border-hairline bg-card shadow-edge">
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3">
        <h2 className="m-0 flex-1 text-title">{t('sensors.workstation.series')}</h2>
        <Num className="text-micro font-normal text-ink-dim">
          {t('sensors.workstation.seriesCount', {
            shown: chart.series.filter((entry) => visible[entry.id] !== false).length,
            total: chart.series.length,
          })}
        </Num>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-sm border border-hairline bg-card px-3 py-1.5 text-body-sm transition-colors hover:border-forge"
        >
          <Icon name="plus" size="xs" />
          {t('sensors.workstation.addSeries')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          <thead>
            <tr className="border-b border-hairline">
              <Th className="w-0">{t('sensors.workstation.column.style')}</Th>
              <Th className="w-0">{t('sensors.workstation.column.visible')}</Th>
              {/* The one column that carries a long value takes the width, so
                  the short ones size to content instead of the browser sharing
                  it evenly and wrapping everything. See DEMO-MODE.md §2.7. */}
              <Th className="w-full">{t('sensors.workstation.column.name')}</Th>
              <Th>{t('sensors.workstation.column.state')}</Th>
              <Th>{t('sensors.workstation.column.tag')}</Th>
              <Th>{t('sensors.workstation.column.description')}</Th>
              <Th align="end">{t('sensors.workstation.column.min')}</Th>
              <Th align="end">{t('sensors.workstation.column.max')}</Th>
              <Th align="end">{t('sensors.workstation.column.mean')}</Th>
              <Th>{t('sensors.workstation.column.unit')}</Th>
              <Th>{t('sensors.workstation.column.pids')}</Th>
              <Th className="w-0">
                <span className="sr-only">{t('sensors.workstation.column.actions')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {chart.series.map((entry) => {
              const shown = visible[entry.id] !== false
              return (
                <tr
                  key={entry.id}
                  className={cn('border-b border-hairline last:border-0', !shown && 'opacity-55')}
                >
                  <td className="ps-4 pe-2 py-2.5">
                    <span
                      aria-hidden="true"
                      className="inline-block h-[3px] w-5 rounded-full"
                      style={{ backgroundColor: `var(--hue-${entry.tone})` }}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <IconButton
                      label={t(shown ? 'sensors.workstation.hide' : 'sensors.workstation.show', {
                        series: entry.name,
                      })}
                      onClick={() => onToggle(entry.id)}
                    >
                      <Icon name="eye" size="sm" className={shown ? undefined : 'text-ink-mute'} />
                    </IconButton>
                  </td>
                  <td className="px-2 py-2.5 font-semibold">{entry.name}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <StateBadge tone={STATE_TONE[entry.state] ?? 'green'}>
                      {t(`sensors.state.${entry.state}`)}
                    </StateBadge>
                  </td>
                  <td className="px-2 py-2.5">
                    <Mono className="text-micro whitespace-nowrap text-ink-dim">{entry.tag}</Mono>
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap text-ink-dim">{entry.description}</td>
                  <td className="px-2 py-2.5 text-end whitespace-nowrap">
                    <Num>{formatDecimal(entry.stats.min, 2)}</Num>
                  </td>
                  <td className="px-2 py-2.5 text-end whitespace-nowrap">
                    <Num>{formatDecimal(entry.stats.max, 2)}</Num>
                  </td>
                  <td className="px-2 py-2.5 text-end whitespace-nowrap">
                    <Num
                      className="font-semibold"
                      style={
                        entry.state === 'ok' ? undefined : { color: `var(--on-${STATE_TONE[entry.state]})` }
                      }
                    >
                      {formatDecimal(entry.stats.mean, 2)}
                    </Num>
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap text-ink-dim">{entry.unit}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <Link
                      to={`/app/assets/${entry.assetId}?view=detailed&tab=documents`}
                      className="inline-flex items-center gap-1 rounded-xs border border-hairline bg-sunken px-2 py-[3px] text-micro text-ink-dim transition-colors hover:border-forge hover:text-ink"
                    >
                      <Icon name="doc" size="xs" />
                      <Mono>{entry.assetCode}</Mono>
                    </Link>
                  </td>
                  <td className="ps-2 pe-4 py-2.5">
                    <IconButton
                      label={t('sensors.workstation.removeSeries', { series: entry.name })}
                      onClick={() => onRemove(entry.id)}
                      // A chart of one series is still a chart; a chart of none
                      // is a blank rectangle with a toolbar over it.
                      disabled={chart.series.length <= 1}
                    >
                      <Icon name="trash" size="sm" />
                    </IconButton>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Th({ children, align = 'start', className }) {
  return (
    <th
      className={cn(
        'px-2 py-2 text-eyebrow font-semibold whitespace-nowrap text-ink-dim',
        align === 'end' ? 'text-end' : 'text-start',
        className,
      )}
    >
      {children}
    </th>
  )
}
