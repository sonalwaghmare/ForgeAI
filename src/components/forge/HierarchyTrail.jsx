import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

/**
 * Where a record sits in the plant, with each tier in the hue that names it.
 *
 * ── Forge Orange, the whole line ──────────────────────────────────────────
 * What the prototype does, and the decision taken here over two alternatives.
 *
 * A per-tier hue ladder was built first — DESIGN.md declares one (Site green, Line
 * cyan, Asset neutral) and nothing had ever implemented it — and it was rejected in
 * review: three hues on the quietest line of a card that already carries three
 * badges reads as decoration, and the trail's own LENGTH already says how precisely
 * the anomaly was located. One accent says "this is the plant path" in a single
 * glance and spends one colour doing it.
 *
 * ── The honest caveat ─────────────────────────────────────────────────────
 * In the prototype these segments are links — `var(--blue)` with an `onClick` to
 * the asset screen — and here they are not, because the whole card is one `Link`
 * and a nested interactive element inside a link is invalid markup that screen
 * readers announce twice. So this is accent colour on text that does not respond
 * to a click, which is the one thing Forge Orange is otherwise reserved against.
 *
 * That is a knowing trade, not an oversight. It is also self-correcting: when the
 * asset screen exists these become real links and the colour stops being a
 * promise the row cannot keep. Until then the card itself is the click target, so
 * nothing here is inert — pressing the words does navigate, just to the anomaly
 * rather than to the asset.
 *
 * ── The leaf carries weight ───────────────────────────────────────────────
 * One hue for every segment, so the attachment level is carried by weight instead:
 * the deepest present segment steps up. Colour says "plant path", weight says
 * which level the record actually hangs off.
 *
 * @param {object} props
 * @param {{plant: ?string, line: ?string, machine: ?string}} props.hierarchy
 *   The server's own shape, holes and all. Which levels are populated IS the
 *   record — see `features/anomalies/api.js`.
 * @param {boolean} [props.emptyLabel]
 *   Rendered when every level is null. A real state, since the attachment may be
 *   soft-deleted, and one the caller must draw as an absence rather than as
 *   "Unknown".
 */
export function HierarchyTrail({ hierarchy, emptyLabel, className }) {
  const { t } = useTranslation(['app', 'common'])

  // Outermost first, nulls dropped, tier carried alongside the name so the hue
  // comes from what the segment IS rather than from its position in the array.
  const segments = TIERS.map((tier) => ({ tier, name: hierarchy?.[tier] })).filter((segment) =>
    Boolean(segment.name),
  )

  if (!segments.length) {
    return (
      <span className={cn('block text-body-sm text-ink-mute', className)}>
        {emptyLabel ?? t('anomalies.noLocation')}
      </span>
    )
  }

  return (
    // The accent set once on the container rather than per segment: colour
    // inherits, so separators come along and the line reads as one path instead
    // of as tinted words with grey gaps punched between them.
    <span className={cn('block truncate text-body-sm text-on-forge', className)}>
      {segments.map((segment, index) => (
        <span key={segment.tier}>
          {index > 0 ? ' · ' : null}
          <span className={cn(index === segments.length - 1 && 'font-medium')}>{segment.name}</span>
        </span>
      ))}
    </span>
  )
}

/**
 * Outermost to innermost, in the API's own vocabulary.
 *
 * `plant` / `line` / `machine` are the wire names; the product calls the same
 * three Site / Production line / Asset. The mapping lives in
 * `features/hierarchy/api.js` and the wire value is never translated — these are
 * object keys, not labels.
 */
const TIERS = ['plant', 'line', 'machine']
