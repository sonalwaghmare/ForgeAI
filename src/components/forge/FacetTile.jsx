import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { Eyebrow } from './primitives'

/**
 * A row of metric tiles is the laziest thing a dashboard can do, so these are
 * not ornaments — they are controls. Each tile is a filter facet: clicking
 * "Critical · 3" filters the list beneath it and takes an accent leading edge
 * to show it is active.
 *
 * That is the entire justification for the pattern. A tile whose number nobody
 * would act on does not belong here, and a non-interactive tile must not lift:
 * if it does not move, it does not click.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string|number} props.value
 * @param {string} props.caption
 * @param {string} props.icon        Sprite name.
 * @param {string} [props.tone]      Hue for the icon and figure, when the count carries state.
 * @param {boolean} props.selected
 * @param {boolean} [props.interactive] false renders a plain block that cannot be
 *   pressed — for a facet the server cannot filter on yet. It does not lift, and
 *   the rule above is why: if it does not move, it does not click.
 */
export function FacetTile({
  label,
  value,
  caption,
  icon,
  tone,
  selected,
  interactive = true,
  className,
  ...rest
}) {
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      aria-pressed={interactive ? Boolean(selected) : undefined}
      className={cn(
        'block rounded-sm border border-hairline border-s-[3px] border-s-transparent bg-card p-3 text-start shadow-edge',
        interactive &&
          'transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-forge/40 hover:shadow-lift',
        selected && 'border-s-forge bg-sunken hover:border-s-forge',
        className,
      )}
      {...rest}
    >
      <span className="flex items-center gap-1.5">
        {/* Hue comes through the custom property, not a generated class: the
            tone is runtime data, and a template-literal class name would never
            reach Tailwind's scanner. */}
        <Icon
          name={icon}
          size="sm"
          className={tone ? undefined : 'text-ink-mute'}
          style={tone ? { color: `var(--hue-${tone})` } : undefined}
        />
        <Eyebrow as="span">{label}</Eyebrow>
      </span>
      <span
        className="num mt-1.5 block text-metric-sm"
        style={tone ? { color: `var(--on-${tone})` } : undefined}
      >
        {value}
      </span>
      <span className="mt-1 block text-micro font-normal text-ink-dim">{caption}</span>
    </Tag>
  )
}
