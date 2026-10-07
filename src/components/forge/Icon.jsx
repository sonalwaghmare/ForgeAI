import { cn } from '@/lib/cn'

const SIZES = {
  xs: 'size-3.5', // 14px — inside eyebrows and dense chips
  sm: 'size-[13px]',
  md: 'size-4', // 16px — default
  nav: 'size-[18px]',
  lg: 'size-6',
}

/**
 * Draws one icon from the sprite.
 *
 * Decorative by default: an icon beside a text label adds nothing for a screen
 * reader, so it is hidden. Pass `label` only when the icon is the sole carrier
 * of meaning, and it must come from the i18n layer.
 *
 * @param {object} props
 * @param {string} props.name       Sprite id without the `i-` prefix.
 * @param {'xs'|'sm'|'md'|'nav'|'lg'} [props.size]
 * @param {string} [props.label]    Accessible name. Omit for decorative icons.
 * @param {string} [props.className]
 */
export function Icon({ name, size = 'md', label, className, ...rest }) {
  return (
    <svg
      className={cn('shrink-0 fill-none stroke-current', SIZES[size], className)}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <use href={`#i-${name}`} />
    </svg>
  )
}

/**
 * The Forge mark. A hexagon with a lit core, used from a 10px inline chip up to
 * the app logo. Filled core by design — it represents a graph node.
 */
export function ForgeMark({ className, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('shrink-0', className)} aria-hidden="true" {...rest}>
      <polygon
        points="12,2.4 20,7 20,17 12,21.6 4,17 4,7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  )
}
