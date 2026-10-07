import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Num } from '@/components/forge/primitives'
import { formatPercent } from '@/lib/format'
import { toneForOee } from './oeeModel'

/**
 * OEE by hour and day — the design's heatmap.
 *
 * ── Five steps, not a continuous ramp ─────────────────────────────────────
 * The prototype uses five hardcoded hex greens, ambers and reds. Here each cell
 * takes one of the palette's own hues at one of two opacities, which gives the
 * same five steps out of tokens rather than out of literals — so the map is
 * correct in dark mode and in colour-blind mode, which the prototype's is not.
 *
 * ── It is a grid of buttons, not a grid of divs ───────────────────────────
 * The readout is the only place a cell's value is legible, and in the prototype
 * it appears on hover only, which leaves 168 unreadable squares for anyone not
 * using a mouse. Each cell is focusable and carries its reading as its
 * accessible name, and the visible readout follows focus as well as hover.
 *
 * ── The axis is computed ──────────────────────────────────────────────────
 * Day labels come from each row's own date through `Intl`, so they are the days
 * that actually ran and they are the reader's own locale's names for them. The
 * design hardcodes Mon–Sun, which is the right axis one week in seven.
 */

/** Two opacity steps × three hues gives the design's five-band ramp. */
function paint(value, target) {
  const tone = toneForOee(value, target)
  if (value >= target) return { background: `var(--hue-green)` }
  if (value >= target - 4) return { background: `var(--hue-green)`, opacity: 0.55 }
  if (value >= target - 12) return { background: `var(--hue-${tone})`, opacity: 0.75 }
  if (value >= target - 20) return { background: `var(--hue-amber)` }
  return { background: `var(--hue-red)`, opacity: value >= target - 28 ? 0.7 : 1 }
}

const LEGEND = [-26, -18, -11, -3, 2]

export function OeeHeatmap({ rows, target = 85 }) {
  const { t, i18n } = useTranslation('app')
  const [active, setActive] = useState(null)

  const dayName = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' })
  const hourLabel = (hour) => `${String(hour).padStart(2, '0')}:00`
  // `new Date('2026-08-13')` parses as UTC midnight and renders as the 12th in
  // any negative offset. Split and construct locally instead.
  const localDate = (key) => {
    const [year, month, day] = key.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return (
    <div>
      {/* The hour ruler. Six labels rather than twenty-four, spaced on the same
          grid the cells use so they line up with the columns they name. */}
      <div className="mb-1.5 grid gap-[3px] ps-9 [grid-template-columns:repeat(24,minmax(0,1fr))]">
        {Array.from({ length: 24 }, (_, hour) =>
          hour % 4 === 0 ? (
            <span
              key={hour}
              className="col-span-4 text-micro font-normal text-ink-mute"
              aria-hidden="true"
            >
              {hourLabel(hour)}
            </span>
          ) : null,
        )}
      </div>

      {rows.map((row) => {
        const label = dayName.format(localDate(row.date))
        return (
          <div key={row.date} className="mb-[3px] flex items-center gap-[3px]">
            <span className="w-9 shrink-0 text-micro font-semibold text-ink-mute" aria-hidden="true">
              {label}
            </span>
            <div className="grid flex-1 gap-[3px] [grid-template-columns:repeat(24,minmax(0,1fr))]">
              {row.cells.map((cell) => {
                const on = active && active.date === row.date && active.hour === cell.hour
                return (
                  <button
                    key={cell.hour}
                    type="button"
                    onMouseEnter={() => setActive({ ...cell, date: row.date, label })}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive({ ...cell, date: row.date, label })}
                    onBlur={() => setActive(null)}
                    className="h-[17px] rounded-xs transition-[outline-color] outline-2 outline-offset-1 outline-transparent focus-visible:outline-forge"
                    style={{
                      ...paint(cell.value, target),
                      // The hovered cell stays at full strength and the rest
                      // step back, which is what makes one square findable in
                      // a field of 168.
                      ...(active && !on ? { opacity: 0.45 } : null),
                    }}
                    aria-label={t('oee.heatmap.cellLabel', {
                      day: label,
                      hour: hourLabel(cell.hour),
                      value: formatPercent(cell.value),
                    })}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Reserved height, so the card does not jump by a line every time the
            pointer crosses a square. */}
        <p className="m-0 min-h-5 flex-1 text-body-sm">
          {active ? (
            <>
              {t('oee.heatmap.readout', {
                day: active.label,
                hour: hourLabel(active.hour),
                value: formatPercent(active.value),
              })}
              {active.value < 70 ? (
                <span style={{ color: 'var(--on-red)' }}> · {t('oee.heatmap.belowFloor')}</span>
              ) : null}
            </>
          ) : (
            <span className="text-ink-mute">{t('oee.heatmap.hint')}</span>
          )}
        </p>

        <span className="text-micro font-normal text-ink-mute">{t('oee.heatmap.low')}</span>
        {LEGEND.map((offset) => (
          <span
            key={offset}
            aria-hidden="true"
            className="h-2.5 w-4 rounded-xs"
            style={paint(target + offset, target)}
          />
        ))}
        <span className="text-micro font-normal text-ink-mute">{t('oee.heatmap.high')}</span>
      </div>

      <p className="mt-3 mb-0 text-micro font-normal text-ink-mute">{t('oee.heatmap.caption')}</p>

      {/* The whole grid, once, for anyone reading it linearly. 168 focusable
          cells is a lot of tabbing; a table is how you get the same facts
          without it. */}
      <table className="sr-only">
        <caption>{t('oee.heatmap.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('oee.trend.xLabel')}</th>
            {Array.from({ length: 24 }, (_, hour) => (
              <th key={hour} scope="col">
                {hourLabel(hour)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <th scope="row">{dayName.format(localDate(row.date))}</th>
              {row.cells.map((cell) => (
                <td key={cell.hour}>
                  <Num>{formatPercent(cell.value)}</Num>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
