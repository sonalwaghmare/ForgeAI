import { formatNumber } from './format'

/**
 * Engineering units are site configuration, not a locale preference.
 *
 * This is a safety property, not a formatting convenience. The unit of a
 * reading belongs to the asset and its site: a German plant reads `bar`
 * whether or not a US colleague is logged in, and a vibration threshold of
 * 12.5 mm/s must never silently become 0.49 in/s.
 *
 * The split this module enforces:
 *   locale  → formats the NUMERAL   (1.000,5 vs 1,000.5)
 *   site    → owns the UNIT         (mm/s vs in/s)
 *
 * There is deliberately no `convert()` export. If display conversion is ever
 * offered, it must show the canonical value alongside on any threshold, alarm
 * or work-order figure — so it belongs behind an explicit, reviewed API rather
 * than as a utility any screen can reach for.
 */

/** Digits an engineer would actually write for a given unit. */
const PRECISION = {
  'in/s': 2,
  'mm/s': 1,
  '°F': 0,
  '°C': 0,
  psi: 0,
  bar: 1,
  'gal/min': 1,
  'L/min': 0,
  'µS/cm': 0,
  dB: 0,
  A: 0,
  cpm: 0,
  '%': 1,
  h: 1,
  d: 0,
  σ: 2,
}

export function precisionFor(unit) {
  return PRECISION[unit] ?? 1
}

/**
 * Render a measurement. The numeral is localised; the unit string is passed
 * through verbatim, exactly as the site reported it.
 *
 * @param {{value: number, unit: string|null}|null|undefined} measure
 * @param {{digits?: number, unit?: boolean}} [options]
 */
export function formatMeasure(measure, options = {}) {
  if (!measure || measure.value == null) return '—'
  const { value, unit } = measure
  const digits = options.digits ?? precisionFor(unit)
  const numeral = formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  if (options.unit === false || !unit) return numeral
  // Degrees sit tight against the numeral; every other unit takes a space.
  return unit.startsWith('°') ? `${numeral}${unit}` : `${numeral} ${unit}`
}

/**
 * True when two measurements can be compared directly. Used to refuse to draw
 * a shared axis or a delta across incompatible units rather than producing a
 * meaningless number.
 */
export function comparable(a, b) {
  return Boolean(a?.unit) && a.unit === b?.unit
}

/** The unit a site uses for a quantity, for axis labels and empty fields. */
export function siteUnit(site, quantity) {
  return site?.units?.[quantity] ?? null
}
