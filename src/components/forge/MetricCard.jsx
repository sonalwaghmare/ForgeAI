import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { Num } from './primitives'

/**
 * One headline figure in a card — the prototype's `KPI`.
 *
 * Here rather than on the OEE screen because it is the prototype's most reused
 * component after the card itself: the same four-across strip opens Lines &
 * Assets, Safety, the Executive dashboard and every line and asset detail. The
 * second copy of this is the one that starts disagreeing with the first about
 * where the delta sits.
 *
 * Not the same thing as home's `KpiTile`, which is a navigation target with a
 * hover lift and a link — that one is a shortcut to the screen that explains the
 * number, and this one is the number.
 *
 * ── The delta is coloured by direction, and the value is not ──────────────
 * Up is good for every metric this currently carries — OEE and its three
 * factors — so a positive delta is green and a negative one red. `invert` is
 * there for the metrics where that is backwards (MTTR, scrap rate, cost per
 * unit), so nobody has to reach for a literal at the call site to fix it.
 *
 * `tone` colours the VALUE and is identity, not judgement: it is what ties
 * Availability's figure to Availability's trace. A metric with no series behind
 * it passes no tone and stays in plain ink.
 *
 * @param {object} props
 * @param {string} props.label     Translated.
 * @param {string} props.value     Already formatted.
 * @param {string} [props.sub]     Caption under the value.
 * @param {string} [props.icon]
 * @param {string|null} [props.tone]
 * @param {number|null} [props.delta]   Signed. Drives the arrow and its colour.
 * @param {string} [props.deltaLabel]   Already formatted and signed.
 * @param {boolean} [props.invert]      A fall is the good direction.
 */
export function MetricCard({
  label,
  value,
  sub,
  icon,
  tone = null,
  delta = null,
  deltaLabel,
  invert = false,
  className,
}) {
  const improving = delta == null || delta === 0 ? null : invert ? delta < 0 : delta > 0
  const deltaTone = improving == null ? null : improving ? 'green' : 'red'

  return (
    <div className={cn('rounded-sm border border-hairline bg-card p-3.5 shadow-edge', className)}>
      <div className="mb-2.5 flex items-center gap-2">
        {icon ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-xs border border-hairline bg-sunken">
            <Icon
              name={icon}
              size="sm"
              className={cn(!tone && 'text-ink-dim')}
              style={tone ? { color: `var(--on-${tone})` } : undefined}
            />
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-body-sm text-ink-dim">{label}</span>
        {delta != null && delta !== 0 ? (
          <Icon
            name={improving ? 'up' : 'down'}
            size="xs"
            className="shrink-0"
            style={{ color: `var(--on-${deltaTone})` }}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <Num
        className="block text-metric-sm leading-none"
        style={tone ? { color: `var(--on-${tone})` } : undefined}
      >
        {value}
      </Num>

      {deltaLabel || sub ? (
        <p className="mt-1.5 mb-0 text-micro font-normal">
          {deltaLabel ? (
            <Num style={deltaTone ? { color: `var(--on-${deltaTone})` } : undefined}>{deltaLabel}</Num>
          ) : null}
          {deltaLabel && sub ? ' ' : null}
          {sub ? <span className="text-ink-dim">{sub}</span> : null}
        </p>
      ) : null}
    </div>
  )
}
