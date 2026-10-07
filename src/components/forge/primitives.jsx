import { cn } from '@/lib/cn'
import { formatMeasure } from '@/lib/units'

/**
 * The Eyebrow. A 10px/700/uppercase label that earns its place only when it
 * names something the heading does not — what *kind* of thing this is, in a
 * surface holding fifteen cards where several are a chart with no heading at
 * all. An eyebrow that paraphrases the heading below it is decoration and gets
 * deleted instead.
 *
 * The uppercase and tracking live in the `.eyebrow` utility rather than here,
 * so a future non-Latin locale disables both in one stylesheet condition.
 */
export function Eyebrow({ as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag className={cn('eyebrow', className)} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * Any number a user might compare. There is no exception to this — a column of
 * proportional figures cannot be scanned, and this product is columns of
 * figures.
 */
export function Num({ as: Tag = 'span', className, children, ...rest }) {
  return (
    <Tag className={cn('num', className)} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * A string the system minted: asset ids, alert ids, sensor tags, OPC node
 * paths, transaction codes. Never human prose — the distinction is load-bearing
 * when an operator is reading an id over a radio.
 *
 * Machine identifiers stay ASCII and are never routed through `t()`.
 */
export function Mono({ as: Tag = 'span', className, children, ...rest }) {
  return (
    <Tag className={cn('mono text-mono', className)} translate="no" {...rest}>
      {children}
    </Tag>
  )
}

/**
 * A machine-minted record identifier, with the `#` the design puts in front of
 * it — `#ANM-DEMO-009`.
 *
 * ── Why the sigil is a component and not typed at each call site ───────────
 * It appears on the list card, in the board column, on the detail header and in
 * the delete confirmation, and the failure mode of writing it four times is that
 * one of them loses it and nobody notices for a release. Here it cannot drift.
 *
 * The `#` is punctuation, not copy: it does not go through `t()`, and it is
 * inside `translate="no"` along with the identifier, so a page translation cannot
 * separate them or swap the sigil for a locale's own.
 *
 * Rendered as a single unbroken string rather than `#` plus a child, so it never
 * wraps between the sigil and the serial.
 */
export function Serial({ as: Tag = 'span', value, className, ...rest }) {
  return (
    <Mono as={Tag} className={className} {...rest}>
      {`#${value}`}
    </Mono>
  )
}

/**
 * A reading with its unit. The numeral is localised; the unit is whatever the
 * site reported and is never converted.
 *
 * @param {{value: number, unit: string|null}} measure
 */
export function Measure({ measure, digits, showUnit = true, className, ...rest }) {
  return (
    <span className={cn('num', className)} {...rest}>
      {formatMeasure(measure, { digits, unit: showUnit })}
    </span>
  )
}

/** A live or state dot. Circles mean people or live signals. */
export function Dot({ tone = 'green', size = 8, className }) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{ width: size, height: size, backgroundColor: `var(--hue-${tone})` }}
    />
  )
}

/** Vertical hairline separating two regions inside one row. */
export function VRule({ className }) {
  return <span aria-hidden="true" className={cn('w-px shrink-0 bg-subtle', className)} />
}

/**
 * Section heading with optional eyebrow. Keeps the "more space above a heading
 * than below it" rhythm in one place rather than per call site.
 */
export function SectionHead({ eyebrow, title, intro, id, className, children }) {
  return (
    <header className={cn('mb-6', className)}>
      {eyebrow ? <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="text-headline m-0 text-balance">
        {title}
      </h2>
      {intro ? <p className="text-body mt-3 max-w-[68ch] text-ink-dim">{intro}</p> : null}
      {children}
    </header>
  )
}
