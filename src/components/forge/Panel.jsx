import { cn } from '@/lib/cn'
import { STRIPE_CLASS } from '@/lib/tone'

/**
 * The card. Hairline border, base corner, an edge shadow so faint it reads as
 * an edge rather than a lift.
 *
 * The Earned-Stripe Rule: `stripe` is only ever passed when the card genuinely
 * carries severity or AI authorship. A card with neither has no coloured edge.
 * This is what separates the device from the coloured-left-border cliché — if
 * every card has a stripe the stripe means nothing, and the one card that
 * actually matters stops being findable. On a healthy screen almost nothing is
 * striped.
 *
 * @param {object} props
 * @param {'red'|'amber'|'watch'|'green'|'violet'|'forge'|null} [props.stripe]
 * @param {boolean} [props.flush]        Body is a table; it supplies its own padding.
 * @param {boolean} [props.interactive]  Lifts on hover. If it does not move, it does not click.
 */
export function Panel({
  stripe = null,
  flush = false,
  interactive = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={cn(
        'rounded-sm border border-hairline bg-card shadow-edge',
        flush ? 'p-0' : 'p-4.5',
        interactive &&
          'transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-forge/40 hover:shadow-lift',
        // Authored logically. Writing this physically silently inverts the
        // whole depth model under dir="rtl".
        stripe && STRIPE_CLASS[stripe],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Sunken well — table headers, inset regions, hovered rows. */
export function Well({ className, children, ...rest }) {
  return (
    <div className={cn('rounded-sm bg-sunken p-4', className)} {...rest}>
      {children}
    </div>
  )
}
