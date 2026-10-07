import { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Num } from '@/components/forge/primitives'
import { formatDateRange } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * A date range, picked on a calendar.
 *
 * DEMO. The range is a real request parameter — `?from=&to=` — and the handler
 * generates the trace over exactly that span. It is not a decoration.
 *
 * ── Four things the prototype's calendar gets wrong ───────────────────────
 * **It opens on a hardcoded month.** `useState({ y: 2026, m: 5 })` — June 2026,
 * whatever today is. This one opens on the month the range is in, or on this
 * month.
 *
 * **It cannot cross a month boundary.** Its ordering compares day-of-month only,
 * so picking the 28th and then the 3rd of the next month puts them in the wrong
 * order and silently selects backwards. This compares instants.
 *
 * **Its grid can be wrong.** It computes the leading blanks from `Date`, which is
 * right, but then renders a fixed 31 cells regardless of the month's length.
 * This asks the month how long it is.
 *
 * **It is a second, contradicting control.** The prototype shows the calendar
 * beside the 1H/6H/24H/7D/30D pills as though they were independent, so a reader
 * can set both and the chart obeys neither. Here they are one parameter: picking
 * a range clears the pill, and picking a pill clears the range. Whichever is in
 * force is the one named beside the grid. See `windowSpec()`.
 *
 * ── Dates, not instants ───────────────────────────────────────────────────
 * A day cell means the whole day. `from` is midnight at its start and `to` is
 * midnight at the end of the second day, so a single-day range is 24 hours of
 * signal rather than a zero-length span the handler would reject.
 */

const MS_DAY = 86_400_000

/** Local midnight, so a range does not shift by the reader's UTC offset. */
const startOfDay = (year, month, day) => new Date(year, month, day).getTime()

export function DateRangePicker({ value, onChange }) {
  const { t, i18n } = useTranslation(['app', 'common'])
  const [open, setOpen] = useState(false)

  const [view, setView] = useState(() => {
    const anchor = value?.from ? new Date(value.from) : new Date()
    return { year: anchor.getFullYear(), month: anchor.getMonth() }
  })
  // The first click of a new range. Held here rather than committed, so the grid
  // can shade the span while the second date is being chosen.
  const [anchor, setAnchor] = useState(null)

  const grid = useMemo(() => {
    const first = new Date(view.year, view.month, 1)
    const days = new Date(view.year, view.month + 1, 0).getDate()
    return { lead: first.getDay(), days }
  }, [view])

  /* Weekday initials from the runtime's own calendar rather than a typed
     ["S","M","T",…]. The prototype's array is Sunday-first English and is wrong
     in every locale that starts its week on Monday. */
  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' })
    // 2024-01-07 was a Sunday; seven consecutive days give the whole cycle.
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2024, 0, 7 + index)),
    )
  }, [i18n.language])

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
        new Date(view.year, view.month, 1),
      ),
    [i18n.language, view],
  )

  const selection = anchor
    ? { from: anchor, to: anchor }
    : value
      ? { from: Date.parse(value.from), to: Date.parse(value.to) - MS_DAY }
      : null

  const inRange = (stamp) =>
    selection != null && stamp >= Math.min(selection.from, selection.to) && stamp <= Math.max(selection.from, selection.to)

  const isEdge = (stamp) => selection != null && (stamp === selection.from || stamp === selection.to)

  const pick = (day) => {
    const stamp = startOfDay(view.year, view.month, day)
    if (anchor == null) {
      setAnchor(stamp)
      return
    }
    // Ordered by instant, so a range that crosses a month or a year is still the
    // right way round.
    const from = Math.min(anchor, stamp)
    const to = Math.max(anchor, stamp)
    setAnchor(null)
    onChange({ from: new Date(from).toISOString(), to: new Date(to + MS_DAY).toISOString() })
    setOpen(false)
  }

  const shift = (delta) =>
    setView((previous) => {
      const next = new Date(previous.year, previous.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })

  const label = value
    ? formatDateRange(value.from, new Date(Date.parse(value.to) - MS_DAY).toISOString())
    : t('sensors.range.placeholder')

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // A half-made range is not a range. Closing without a second click
        // leaves what was in force, rather than committing one day nobody asked
        // for.
        if (!next) setAnchor(null)
      }}
    >
      <Popover.Trigger
        className={cn(
          'flex items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 text-body-sm',
          'transition-colors hover:border-forge focus-visible:border-forge',
          !value && 'text-ink-dim',
        )}
      >
        <Icon name="cal" size="sm" className="shrink-0 text-ink-mute" />
        <Num className="whitespace-nowrap">{label}</Num>
        <Icon name="down" size="xs" className="shrink-0 text-ink-mute" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={cn(
            'z-50 w-[18rem] rounded-sm border border-hairline bg-card p-3.5 shadow-lift',
            'dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]',
          )}
        >
          <div className="mb-2.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label={t('sensors.range.previousMonth')}
              className="flex size-7 items-center justify-center rounded-xs text-ink-dim hover:bg-sunken hover:text-ink"
            >
              <Icon name="right" size="xs" className="rotate-180 mirror-rtl" />
            </button>
            <span className="flex-1 text-center text-body-sm font-semibold">{monthLabel}</span>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label={t('sensors.range.nextMonth')}
              className="flex size-7 items-center justify-center rounded-xs text-ink-dim hover:bg-sunken hover:text-ink"
            >
              <Icon name="right" size="xs" className="mirror-rtl" />
            </button>
          </div>

          <div aria-hidden="true" className="mb-1 grid grid-cols-7 gap-0.5">
            {weekdays.map((day, index) => (
              <span key={index} className="py-0.5 text-center text-micro font-semibold text-ink-mute">
                {day}
              </span>
            ))}
          </div>

          <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: grid.lead }, (_, index) => (
              <span key={`lead-${index}`} />
            ))}
            {Array.from({ length: grid.days }, (_, index) => {
              const day = index + 1
              const stamp = startOfDay(view.year, view.month, day)
              const edge = isEdge(stamp)
              const within = inRange(stamp)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  aria-pressed={within}
                  className={cn(
                    'aspect-square rounded-xs text-body-sm tabular-nums transition-colors',
                    edge && 'bg-forge font-semibold text-white',
                    !edge && within && 'tint-forge text-on-forge',
                    !within && 'text-ink hover:bg-sunken',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex gap-2 border-t border-hairline pt-3">
            <ForgeButton
              size="sm"
              className="flex-1"
              onClick={() => {
                setAnchor(null)
                onChange(null)
                setOpen(false)
              }}
            >
              {t('sensors.range.clear')}
            </ForgeButton>
            <p className="m-0 flex-1 self-center text-micro text-ink-dim">
              {anchor == null ? t('sensors.range.hintStart') : t('sensors.range.hintEnd')}
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
