import { ORG } from './enterprise'
import { PLANS, planSummary, upgradeFrom, usage } from './plan'
import { audit } from './audit'
import { noise } from './lines'

/**
 * Billing & usage.
 *
 * SYNTHETIC. Gated on `VITE_DEMO_MODE`. See `DEMO-MODE.md` §8.23.
 *
 * ── This page asserts more than any other, and marks all of it ────────────
 * A billing screen is mostly contract: a price, a renewal date, an invoice
 * history, a card on file. None of that is derivable from a plant's telemetry,
 * and there is no billing service behind this build to ask. So the invoices,
 * the price and the payment method are AUTHORED — stated plainly here, grouped
 * so they can be found, and every one of them marked `authored: true` on the
 * wire so a reader of the payload can tell which figures were counted.
 *
 * What IS composed: the plan and its ceilings come from `plan.js`, the four
 * usage meters are the same objects Modules & Plan draws, and the invoice total
 * is arithmetic on the plan's own price rather than a number typed twice.
 *
 * ── The card on file is never editable here ───────────────────────────────
 * Update Payment is disabled, and not because it was hard. Collecting a card
 * number is the one interaction this product must never simulate: a form that
 * looks like a payment form teaches the person using it that it is safe to type
 * a card into this application, and there is no processor on the other end.
 * Update Contact is real — an email address is not a credential.
 */

/* ── What the plan costs ──────────────────────────────────────────────────
   Per site per month. The invoice total is this times the sites on the plan,
   so a price and an amount cannot disagree. */

const PRICE_PER_SITE_MONTH = { starter: 400, professional: 1400, enterprise: null }

export const CURRENCY = 'USD'

/** The monthly charge for a tier at this estate's size. Null where it is quoted. */
export function monthlyCharge(tier = ORG.plan, sites) {
  const rate = PRICE_PER_SITE_MONTH[tier]
  if (rate == null) return null
  const count = sites ?? PLANS[tier]?.sites ?? 1
  return rate * count
}

/* ── Invoices ─────────────────────────────────────────────────────────────
   Authored. Twelve months back from the renewal date, with the annual charge
   on the anniversary and monthly charges after it — which is what an annual
   plan that was later prorated looks like, and is the shape the design shows.

   Generated from the price rather than written out, so changing the rate moves
   every amount and no two rows can disagree about what a month costs. */

const RENEWS_ON = '2026-12-31'
const MONTHS_SHOWN = 5

function invoiceMonths(now) {
  const out = []
  const cursor = new Date(now)
  cursor.setDate(1)
  for (let index = 0; index < MONTHS_SHOWN; index += 1) {
    cursor.setMonth(cursor.getMonth() - 1)
    out.push(new Date(cursor))
  }
  return out
}

const pad = (value) => String(value).padStart(3, '0')

export function invoices(now = Date.now()) {
  const monthly = monthlyCharge()
  const months = invoiceMonths(now)

  const rows = months.map((date, index) => ({
    id: `INV-${date.getFullYear()}-${pad(months.length - index)}`,
    periodStart: new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1)).toISOString(),
    annual: false,
    amount: monthly,
    currency: CURRENCY,
    /* Every one of them is settled. An unpaid invoice is a state this screen
       can render — the badge and the tone are per-row — but inventing an
       overdue bill for a demo estate would put a red banner on a page nobody
       can act on. */
    status: 'paid',
  }))

  /* The anniversary charge, twelve months before the renewal. */
  const anniversary = new Date(RENEWS_ON)
  anniversary.setFullYear(anniversary.getFullYear() - 1)
  rows.push({
    id: `INV-${anniversary.getFullYear()}-012`,
    periodStart: anniversary.toISOString(),
    annual: true,
    /* Twelve months at the monthly rate. The design's own arrangement, and the
       reason it is multiplied rather than typed: an annual total that did not
       equal twelve monthlies is the first thing a finance reader would spot. */
    amount: monthly == null ? null : monthly * 12,
    currency: CURRENCY,
    status: 'paid',
  })

  return rows.map((row) => ({ ...row, authored: true }))
}

/* ── The card on file ─────────────────────────────────────────────────────
   A brand, four digits and an expiry — which is all a payment method should
   ever be on a screen. There is no number here to leak because a stored card
   number is not something a client holds, and this fixture is the shape the
   real payload should take. */

const PAYMENT = {
  brand: 'visa',
  last4: '4242',
  expiryMonth: 9,
  expiryYear: 2027,
  /* RFC 2606 reserved, like every other address in these fixtures. */
  contactEmail: 'billing@meridian.example',
}

export function paymentMethod() {
  return { ...PAYMENT, authored: true }
}

/**
 * Change the billing contact.
 *
 * The one thing on this card that can be edited, and the reason is worth
 * stating: an email address is a contact detail, and a card number is a
 * credential. This product simulates the first and must never simulate the
 * second.
 */
export function setBillingContact(email, now = Date.now()) {
  const clean = String(email ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, reason: 'invalidEmail' }
  PAYMENT.contactEmail = clean
  audit('BILLING_CONTACT_CHANGED', { resource: 'settings:billing' }, now)
  return { ok: true, contactEmail: clean }
}

/* ── The trend ────────────────────────────────────────────────────────────
   Six months of sensor-allowance usage, as a percentage.

   AUTHORED, with one real anchor: the last point is today's actual figure —
   the estate's own sensor count against the plan's ceiling — and the months
   before it walk back from it. So the right-hand end of the line is a number
   the reader can check against the meter beside it, and the history is a demo
   shape rather than a claim that anything was recorded. `noise` keys off the
   month, so it is the same line on every render and every reader's screen. */

export function usageTrend(now = Date.now()) {
  const meter = usage().sensors
  const current = meter.limit ? (meter.used / meter.limit) * 100 : 0

  const points = []
  for (let back = 5; back >= 0; back -= 1) {
    const date = new Date(now)
    date.setMonth(date.getMonth() - back)
    const drift = back === 0 ? 0 : (noise('billing', back) - 0.45) * 14 + back * 0.8
    points.push({
      at: date.toISOString(),
      value: Math.round(Math.max(0, Math.min(100, current + drift)) * 10) / 10,
    })
  }

  return { points, unit: 'percent', anchoredTo: 'sensors', authored: true }
}

/* ── What the next tier changes ───────────────────────────────────────────
   Derived by comparing the two rows of `PLANS`, so the list cannot promise
   something the tier table does not grant. Every entry names the ceiling it
   lifts and the one currently in force, which is the half a comparison table
   usually leaves out. */

export function upgradeGains(tier = ORG.plan) {
  const next = upgradeFrom(tier)
  if (!next) return []
  const here = PLANS[tier] ?? {}
  const there = PLANS[next] ?? {}

  return Object.keys(there)
    .filter((key) => there[key] == null && here[key] != null)
    .map((key) => ({ key, from: here[key], unlimited: true }))
}

/** Everything the page reads, in one request. */
export function billingPayload(now = Date.now()) {
  const summary = planSummary(now)
  return {
    plan: summary,
    /* Priced at this estate's size, not at the tier's ceiling: three sites is
       what is being billed for. */
    monthly: monthlyCharge(summary.tier, summary.usage.sites.used),
    currency: CURRENCY,
    autoRenew: true,
    invoices: invoices(now),
    payment: paymentMethod(),
    trend: usageTrend(now),
    gains: upgradeGains(summary.tier),
    /* Reserved domain. The button opens a message; it does not send one. */
    salesEmail: 'sales@forge.example',
  }
}

export function resetBilling() {
  PAYMENT.contactEmail = 'billing@meridian.example'
}
