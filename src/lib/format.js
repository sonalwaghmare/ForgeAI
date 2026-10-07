import i18n from '@/i18n'

/**
 * Every number, date, percentage and duration the user sees passes through
 * here. Nothing is hand-formatted: the prototype's `DD/MM/YYYY` and fixed 24h
 * clock become locale-derived defaults that an org can still override.
 *
 * Formatters are cached — constructing an Intl formatter is expensive and these
 * run inside table rows.
 */

const cache = new Map()
const memo = (key, build) => {
  let f = cache.get(key)
  if (!f) {
    f = build()
    cache.set(key, f)
  }
  return f
}

/**
 * The organisation's formatting preferences — the override this file's header
 * has always described.
 *
 * Three facts, and only three, because these are the three the General page
 * offers and the three `Intl` can act on:
 *
 *   - `formattingLocale` decides field ORDER. `Intl` will not take DD/MM/YYYY as
 *     an instruction; it takes a locale and gives you that locale's order, so
 *     the setting names the locale that produces the order asked for. This is
 *     deliberately separate from the interface language: a German plant reading
 *     an English interface still wants its own date order.
 *   - `hour12` decides the clock.
 *   - `timeZone` is the DEFAULT only. A caller that passes one — a shift printed
 *     in its own site's zone — keeps it, because that is the more specific fact
 *     and the whole reason `formatTime` takes the argument.
 *
 * Null everywhere until something sets it, so with the flag off, or before the
 * settings load, every formatter behaves exactly as it did before.
 */
const org = { formattingLocale: null, hour12: null, timeZone: null }

export function setOrgFormatting(next = {}) {
  const changed = Object.keys(org).some((key) => org[key] !== (next[key] ?? null))
  if (!changed) return
  for (const key of Object.keys(org)) org[key] = next[key] ?? null
  /* The cache is keyed by locale and options, and both just moved under it. */
  cache.clear()
}

const locale = () => org.formattingLocale || i18n.resolvedLanguage || 'en'

/** The clock and zone an org has asked for, as Intl options. */
const orgTimeOptions = () => ({
  ...(org.hour12 == null ? {} : { hour12: org.hour12 }),
  ...(org.timeZone ? { timeZone: org.timeZone } : {}),
})

export function formatNumber(value, options = {}) {
  if (value == null || Number.isNaN(value)) return '—'
  const key = `n:${locale()}:${JSON.stringify(options)}`
  return memo(key, () => new Intl.NumberFormat(locale(), options)).format(value)
}

/**
 * Money.
 *
 * The currency is a property of the site, not of the reader's locale — a plant
 * in Ohio reports dollars whoever is looking at it — so it is passed in, while
 * the grouping and the symbol's position come from the locale as everywhere
 * else. Whole units: nobody reads maintenance spend to the cent.
 */
export function formatCurrency(value, currency = 'USD') {
  return formatNumber(value, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/** Fractional digits default to what an engineer would write, not to 3. */
export function formatDecimal(value, digits = 1) {
  return formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatInteger(value) {
  return formatNumber(value, { maximumFractionDigits: 0 })
}

/**
 * A large count, shortened — 11.4k, 28M, 1.4B.
 *
 * For headline figures only, where the exact digits are not the point and their
 * width is: "28,018,672" in a KPI card wraps, dominates the tile, and invites a
 * reader to compare digits nobody will act on. Anywhere the number is meant to
 * be reconciled — a table cell, an invoice, a tag count somebody will check
 * against a broker — use `formatInteger` and print all of it.
 *
 * `Intl` does the abbreviating, so the suffix is the reader's own: "28M" in
 * English, "2800万" in Japanese, "28 mln" in Polish.
 */
export function formatCompact(value) {
  if (value == null) return '—'
  /* One decimal from 10k upwards, so 1,533,714 reads 1.5M rather than 2M.
     Rounding a million and a half to "2M" loses a third of the value in the one
     place a reader is most likely to quote the figure back. Below 10k there is
     nothing to abbreviate and the digits are printed. */
  return formatNumber(value, {
    notation: 'compact',
    maximumFractionDigits: Math.abs(value) >= 10_000 ? 1 : 0,
  })
}

/** `value` is already a percentage (74.2), not a ratio. */
export function formatPercent(value, digits = 1) {
  if (value == null) return '—'
  return formatNumber(value / 100, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatSigned(value, digits = 1) {
  if (value == null) return '—'
  return formatNumber(value, {
    signDisplay: 'exceptZero',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatDateTime(value, options) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  const opts = { ...orgTimeOptions(), ...(options ?? { dateStyle: 'medium', timeStyle: 'short' }) }
  const key = `dt:${locale()}:${JSON.stringify(opts)}`
  return memo(key, () => new Intl.DateTimeFormat(locale(), opts)).format(date)
}

export function formatTime(value, timeZone) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  // The caller's zone wins over the org default: a shift is printed in the zone
  // its plant is actually in, which is the more specific fact.
  const opts = { hour: '2-digit', minute: '2-digit', ...orgTimeOptions(), ...(timeZone ? { timeZone } : {}) }
  const key = `t:${locale()}:${JSON.stringify(opts)}`
  return memo(key, () => new Intl.DateTimeFormat(locale(), opts)).format(date)
}

export function formatDateRange(from, to) {
  const key = `dr:${locale()}`
  const f = memo(key, () => new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }))
  return f.formatRange(new Date(from), new Date(to))
}

const RELATIVE_STEPS = [
  ['year', 365 * 24 * 60],
  ['month', 30 * 24 * 60],
  ['week', 7 * 24 * 60],
  ['day', 24 * 60],
  ['hour', 60],
  ['minute', 1],
]

/** "34 minutes ago", "2 days ago" — via Intl, so it translates for free. */
export function formatRelative(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  const minutes = (date.getTime() - Date.now()) / 60_000
  const abs = Math.abs(minutes)

  const f = memo(`rt:${locale()}`, () => new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }))
  if (abs < 1) return f.format(0, 'minute')

  for (const [unit, perUnit] of RELATIVE_STEPS) {
    if (abs >= perUnit) return f.format(Math.round(minutes / perUnit), unit)
  }
  return f.format(Math.round(minutes), 'minute')
}

/** Decimal hours as a duration: 4.5 → "4h 30m". */
export function formatHours(hours) {
  if (hours == null) return '—'
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  const parts = []
  if (whole) parts.push(`${formatInteger(whole)}h`)
  if (minutes) parts.push(`${formatInteger(minutes)}m`)
  return parts.length ? parts.join(' ') : '0m'
}

/**
 * Initials for an avatar, from whatever name the API returned.
 *
 * Derived rather than stored: the sign-in response carries a display name and
 * nothing else, so an `initials` field would have to be invented here anyway.
 *
 * First and last word, so "Rohan Kurian" → "RK" and a three-part name does not
 * become three letters in a circle sized for two. A single word falls back to
 * its first two characters, which reads better than one lonely letter.
 *
 * Uses the spread, not slice: a name can begin with a character outside the BMP,
 * and `"👤x".slice(0, 2)` would cut it in half and render a replacement glyph.
 */
export function initialsFrom(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '—'
  if (words.length === 1) return [...words[0]].slice(0, 2).join('').toUpperCase()
  return ([...words[0]][0] + [...words.at(-1)][0]).toUpperCase()
}
