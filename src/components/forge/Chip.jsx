import { cn } from '@/lib/cn'

/**
 * The most reused interactive element in the product — filters, facets, tags,
 * timeframes, suggested prompts.
 *
 * Quiet until it matters: at rest it is a card surface with a hairline, and it
 * announces itself on hover. Selected takes the accent tint with Forge Orange
 * text, which is interaction, not state.
 *
 * Sized by padding rather than width, and never `nowrap` on a translatable
 * label, so a locale that runs a third longer grows the chip instead of
 * clipping it.
 */
export function Chip({ selected, className, children, as: Tag = 'button', ...rest }) {
  const interactive = Tag === 'button'
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      aria-pressed={interactive && selected !== undefined ? Boolean(selected) : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-[5px] text-body-sm transition-colors',
        selected
          ? 'border-forge/40 tint-forge font-semibold text-on-forge'
          : 'border-hairline bg-card text-ink-dim',
        // Hover response belongs to things that respond. A static chip that
        // warms its border on hover promises a click it will not honour.
        !selected && interactive && 'hover:border-forge hover:text-ink',
        // Floor legibility: on a tablet the target grows and the type steps up
        // rather than down. Density is a desk luxury.
        'max-lg:px-3.5 max-lg:py-2.5 max-lg:text-body',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** A segmented control — mutually exclusive views, sharing one sunken track. */
export function Segmented({ label, children, className }) {
  return (
    <div role="group" aria-label={label} className={cn('flex gap-[3px] rounded-md bg-sunken p-[3px]', className)}>
      {children}
    </div>
  )
}

export function SegmentedItem({ selected, label, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={Boolean(selected)}
      aria-label={label}
      className={cn(
        'flex h-[26px] w-[30px] items-center justify-center rounded-xs transition-colors',
        selected ? 'bg-forge text-white' : 'text-ink-dim hover:text-ink',
        'max-lg:size-11',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
