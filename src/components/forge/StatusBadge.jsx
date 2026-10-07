import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { Icon } from './Icon'

/**
 * The severity badge — the system's atom of meaning.
 *
 * Every status in the product resolves to one of five tones. Each is encoded at
 * least twice: a tint of its hue, a darker step of that hue as text, a shape
 * glyph revealed in colour-blind mode, and the text label itself. Severity is
 * never carried by hue alone.
 *
 * Two deliberate divergences from what the design preview shipped:
 *
 *  1. `low` carries no hue. The preview used Forge Orange, which contradicts
 *     DESIGN.md — Forge Orange is identity and interaction, never a severity.
 *     Neutral is also the honest answer: a low-severity anomaly is a note, not
 *     the machine raising its hand, and The Rationed Hue Rule says colour is
 *     how it raises its hand.
 *  2. Badge text never truncates. A severity is the one label on screen that
 *     must survive translation intact, so the badge grows and its container
 *     yields.
 *
 * Severity is set in caps, as the design has it, through the `caps` utility
 * rather than `String.toUpperCase()` — see the render for why that distinction is
 * load-bearing. Status is not: the design leaves it sentence case, and two
 * shouted labels beside each other leave neither of them emphatic.
 */

const TONES = {
  critical: { fill: 'tint-red', text: 'text-on-red', glyph: '◆' },
  high: { fill: 'tint-amber', text: 'text-on-amber', glyph: '▲' },
  medium: { fill: 'tint-watch', text: 'text-on-watch', glyph: '●' },
  low: { fill: 'bg-sunken', text: 'text-ink-dim', glyph: '■' },
  ok: { fill: 'tint-green', text: 'text-on-green', glyph: '✓' },
}

/**
 * Two vocabularies live here, because two resources do.
 *
 * `ack` is the fixture demo's abbreviation (`features/alerts`). `acknowledged`,
 * `dismissed` and the rest are the real `AnomalyStatus` enum, keyed on the wire
 * value so nothing has to translate one into the other on the way in.
 *
 * `dismissed` is its own hue and specifically not green. Resolved means the machine
 * was attended to; dismissed means somebody judged the detection not worth acting
 * on — a false positive, a duplicate, planned maintenance. Painting both green
 * would say the plant is fine in a case where nobody actually looked at it, and
 * The Rationed Hue Rule spends green on a genuine all-clear.
 *
 * It could not borrow an existing hue either. Watch was the tempting one and is
 * wrong: medium severity owns it, and a medium dismissed anomaly would carry two
 * watch pills side by side meaning different things — the same collision that kept
 * red off the Open badge. Ack cyan can never co-occur with it (a status is one
 * value) but would read as the same state across a scanned list. So Dismissed Blue
 * is a token, declared on its own axis. See `tokens.css`.
 *
 * ── `open` takes Forge Orange, which needs saying out loud ─────────────────
 * This document reserves Forge Orange for identity and interaction and forbids it
 * as a severity. Open is not a severity: it is a lifecycle status, a separate
 * axis, and the one value on that axis meaning "nobody has picked this up" — which
 * is a call to act rather than a measure of how bad. The severity ladder is
 * untouched and still owns red / amber / watch / neutral.
 *
 * It is also what the prototype's own facet strip gives Open (`var(--blue)`,
 * holding #F26522), so the badge and the tile above it now agree. The prototype's
 * row-badge map disagrees with its own tile map here — it tones Open as
 * `critical`, i.e. red — and that is the one place matching the design would have
 * put a red status pill beside a red severity pill on every open critical
 * anomaly, two reds meaning different things. The tile's colour is the one that
 * carries over.
 */
const STATUS_TONES = {
  open: { fill: 'tint-forge', text: 'text-on-forge' },
  ack: { fill: 'tint-ack', text: 'text-on-ack' },
  acknowledged: { fill: 'tint-ack', text: 'text-on-ack' },
  escalated: { fill: 'tint-amber', text: 'text-on-amber' },
  resolved: { fill: 'tint-green', text: 'text-on-green' },
  dismissed: { fill: 'tint-dismissed', text: 'text-on-dismissed' },
  unassigned: { fill: 'bg-sunken', text: 'text-ink-dim' },
}

const BASE =
  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-[3px] text-micro whitespace-normal'

/**
 * @param {object} props
 * @param {'critical'|'high'|'medium'|'low'|'ok'} props.severity
 * @param {boolean} [props.dot]  Show a leading dot in the hue.
 */
export function SeverityBadge({ severity, dot = false, className }) {
  const { t } = useTranslation()
  const tone = TONES[severity] ?? TONES.low

  return (
    /* `caps` and not `.toUpperCase()`: the accessible name stays the sentence-case
       string the locale supplied, and the caps switch themselves off for scripts
       that have no case. Applied to the root because `text-transform` inherits and
       is a no-op on the glyph and the dot. Severity only — the design leaves the
       status pill in sentence case, and two shouted labels side by side would
       leave neither of them emphatic. */
    <span className={cn(BASE, 'caps', tone.fill, tone.text, className)}>
      {dot && severity !== 'low' ? (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: `var(--hue-${HUE_BY_SEVERITY[severity]})` }}
        />
      ) : null}
      {/* Hidden until colour-blind mode, where hue can no longer be trusted
          to separate the five tones on its own. */}
      <span aria-hidden="true" className="hidden text-[0.85em] leading-none cb:inline-block">
        {tone.glyph}
      </span>
      {t(`severity.${severity}`)}
    </span>
  )
}

const HUE_BY_SEVERITY = { critical: 'red', high: 'amber', medium: 'watch', ok: 'green' }

/** Alert lifecycle state. A separate axis from severity, so a separate scale. */
export function StatusBadge({ status, className }) {
  const { t } = useTranslation()
  const tone = STATUS_TONES[status] ?? STATUS_TONES.open
  return <span className={cn(BASE, tone.fill, tone.text, className)}>{statusLabel(t, status)}</span>
}

/**
 * A status's label, falling back to the wire value itself.
 *
 * `AnomalyStatus` is a server-side enum this app reads rather than declares, and
 * it is expected to grow — the design for the Anomalies screen already wants a
 * `snoozed` member. Without a fallback, `t()` returns the missing key and the
 * badge would read "status.snoozed" in production, which is worse than untidy:
 * it looks like a bug in the row rather than a label this release has not been
 * given yet. The raw value is at least true, and it is the same string the API
 * and the filter chip are using.
 *
 * Exported because the facet tiles and the filter selects label the same enum
 * from the same counts, and three copies of this fallback would be three places
 * for a new status to render differently.
 */
export function statusLabel(t, status) {
  // Namespace-qualified, not a bare `status.x`. This is called both from here —
  // where `t` is bound to the default namespace, which IS `common` — and from
  // screens that bind `['app', 'common']`, where the default becomes `app` and a
  // bare key would miss. An explicit prefix resolves correctly under both.
  return t(`common:status.${status}`, { defaultValue: status })
}

/**
 * How far an anomaly's root-cause analysis has got.
 *
 * ── A third axis, so a third scale ────────────────────────────────────────
 * Severity says how bad, status says who has it, this says whether the machine
 * has explained it. Three independent facts, and collapsing any of them onto the
 * severity ladder would make a badge mean two things.
 *
 * ── It lives in the AI language, because that is what it is ───────────────
 * An RCA is the one artifact on this card the machine authored, so the two states
 * where one exists take Reasoning Violet and the node glyph — the same convention
 * every other AI surface in the product uses, and the only thing violet is ever
 * allowed to mean.
 *
 * The two states where one does NOT exist are deliberately colourless. `pending`
 * is where every anomaly starts, so hueing it would put violet on almost every
 * row and spend the reservation on the absence of the thing it marks. Rendering
 * it at all — rather than omitting the badge — is what lets the row answer "has
 * this been explained?" without the reader having to know that a missing badge
 * means no.
 *
 * `approved` and `draft` are distinguished by weight rather than by a second hue:
 * an approved analysis is filled, a draft is outlined. Same reason a severity is
 * never carried by hue alone — the difference survives colour-blind mode and
 * print.
 *
 * @param {object} props
 * @param {'pending'|'queued'|'draft'|'approved'} props.status
 *   `AnomalyRcaStatus`. An unrecognised value falls back to the pending
 *   treatment and prints the raw string, so a fifth member reaching the client
 *   before this release does is legible rather than blank.
 */
export function RcaBadge({ status, className }) {
  const { t } = useTranslation()
  const tone = RCA_TONES[status] ?? RCA_TONES.pending

  return (
    <span className={cn(BASE, tone, className)}>
      <Icon name="ai" size="xs" className={HAS_RCA.has(status) ? 'text-violet' : 'text-ink-mute'} />
      {t(`rca.${status}`, { defaultValue: status })}
    </span>
  )
}

/** The two states in which an analysis actually exists. */
const HAS_RCA = new Set(['draft', 'approved'])

const RCA_TONES = {
  pending: 'bg-sunken text-ink-mute',
  queued: 'bg-sunken text-ink-dim',
  draft: 'border border-violet/40 text-on-violet',
  approved: 'tint-violet text-on-violet',
}

/**
 * A pill for a state on none of the three axes above.
 *
 * A line running or stopped, a connector connected or degraded, a sensor online.
 * These are not severities — a stopped line is not "critical", it is stopped —
 * and they are not the alert lifecycle either, so neither of those scales can
 * label them without saying something untrue.
 *
 * The caller supplies both the tone and the label, because the vocabulary is
 * per-resource and there is no shared enum to key on. What this owns is the
 * treatment: the pill, the tint, the darker text step and the dot, so every
 * state pill in the product is the same object.
 *
 * `dot` defaults on. The design draws these with one, and it is the second
 * encoding that keeps the pill readable when the hue is not — the same reason
 * `SeverityBadge` carries a glyph.
 *
 * @param {object} props
 * @param {string|null} props.tone  A hue from `lib/tone.js`. Null renders neutral.
 */
export function StateBadge({ tone, dot = true, className, children }) {
  return (
    <span
      className={cn(
        BASE,
        tone ? TINT_CLASS[tone] : 'bg-sunken',
        tone ? ON_TINT_CLASS[tone] : 'text-ink-dim',
        className,
      )}
    >
      {dot && tone ? (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: `var(--hue-${tone})` }}
        />
      ) : null}
      {children}
    </span>
  )
}

/** Neutral badge for facts that are not a state — "Unassigned", a count, a tag. */
export function PlainBadge({ className, children }) {
  return <span className={cn(BASE, 'bg-sunken text-ink-dim', className)}>{children}</span>
}

/**
 * Marks content Forge AI authored. Reasoning Violet means exactly this and
 * nothing else — never an accent, never a chart series, never a flourish.
 */
export function AiBadge({ label, className }) {
  const { t } = useTranslation()
  return (
    <span className={cn(BASE, 'border border-violet/40 text-on-violet', className)}>
      <Icon name="ai" size="xs" className="text-violet" />
      {label ?? t('ai.drafted')}
    </span>
  )
}

/** Which hue a severity maps to, for stripes and dots elsewhere. */
export function hueForSeverity(severity) {
  return HUE_BY_SEVERITY[severity] ?? null
}
