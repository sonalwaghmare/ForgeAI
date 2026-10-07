import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { IconButton } from '@/components/forge/ForgeButton'
import { Chip } from '@/components/forge/Chip'
import { Mono } from '@/components/forge/primitives'
import { SeverityBadge, hueForSeverity } from '@/components/forge/StatusBadge'
import { formatHours, formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * A severity-tinted band above the content region, for the things that cannot
 * wait for the user to scroll.
 *
 * Two sources feed it and `AppShell` decides which — live anomalies when there is
 * a server, the prototype's authored alert fixture otherwise. This component
 * renders whichever fields the item actually has and nothing else: a reading, an
 * hours-to-trip figure or a sibling-sensor count appears only when it was given
 * one. A red band across the top of every screen naming a bearing is the most
 * load-bearing claim in the product, and wrong it is worse than absent.
 *
 * ── The prototype's choreography, and what it is for ───────────────────────
 * The prototype does not show one static banner. It starts with one anomaly, a
 * second arrives after nine seconds and a third after twenty, each with a short
 * tone; once there is more than one the band rotates every five seconds behind a
 * dot pager. That sequence is the demo's whole argument — a plant does not hand
 * you its problems all at once, it interrupts you — so it is reproduced rather
 * than flattened into a list.
 *
 * `staged` is what gates it, and only the fixture gets it. Real anomalies were
 * detected when they were detected; revealing three of them on a nine- and
 * twenty-second timer with a ping each would be this band inventing the moment
 * they arrived. So on live data all of them are present from the first frame and
 * the rotation is the only motion left.
 *
 * Investigating an item removes it from the band, which is the prototype's
 * behaviour and the correct one: the band is a queue of things nobody has looked
 * at yet, and an item you just opened is no longer one of them.
 *
 * ── Motion and sound both defer ────────────────────────────────────────────
 * The rotation stops on hover and on focus, and never starts under
 * `prefers-reduced-motion` — a band that moves under someone mid-sentence is
 * worse than a band they have to page themselves. The tone is wrapped in
 * try/catch because browsers refuse an AudioContext before the page has been
 * interacted with, and a demo that throws on load to play a beep is not a trade
 * worth making.
 */

/** Arrival schedule, in ms from mount. The prototype's own timings. */
const ARRIVALS = [9000, 20000]
const ROTATE_MS = 5000

/**
 * An 880 Hz sine, half a second, exponential in and out.
 *
 * Synthesised rather than shipped as a file: it is forty lines lighter than an
 * asset request, and the envelope is what stops it sounding like a system error.
 */
function ping() {
  try {
    const Context = window.AudioContext ?? window.webkitAudioContext
    if (!Context) return
    const context = new Context()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.5)
    // Released once the tone has finished, or every arrival leaks a context.
    oscillator.onended = () => context.close()
  } catch {
    /* Autoplay policy, or no Web Audio. The band still works silently. */
  }
}

export function SeverityBanner({ alerts = [], staged = true, onInvestigate }) {
  const { t } = useTranslation(['app', 'common'])

  const [arrived, setArrived] = useState(1)
  const [index, setIndex] = useState(0)
  const [investigated, setInvestigated] = useState([])
  const [dismissed, setDismissed] = useState(false)
  const [held, setHeld] = useState(false)

  // The first render must not ping — nothing arrived, the page just opened.
  const mounted = useRef(false)

  useEffect(() => {
    if (!staged) return undefined
    if (alerts.length < 2) return undefined
    const timers = ARRIVALS.slice(0, alerts.length - 1).map((delay, position) =>
      setTimeout(() => {
        setArrived(position + 2)
        // Land on the new one. An arrival you have to page to is a notification
        // that failed to notify.
        setIndex(position + 1)
        if (mounted.current) ping()
      }, delay),
    )
    mounted.current = true
    return () => timers.forEach(clearTimeout)
  }, [alerts.length, staged])

  // Derived, not stored: unstaged means everything the server sent is present from
  // the first frame, and writing that into `arrived` from an effect would be one
  // cascading render per query resolution to reach a value already known here.
  const revealed = staged ? arrived : alerts.length
  const visible = alerts.slice(0, revealed).filter((alert) => !investigated.includes(alert.id))

  useEffect(() => {
    if (held || visible.length < 2) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = setInterval(() => setIndex((current) => (current + 1) % visible.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [held, visible.length])

  if (dismissed || !visible.length) return null

  const active = visible[Math.min(index, visible.length - 1)]
  const hue = hueForSeverity(active.severity) ?? 'red'

  /**
   * The second line, built from what the item actually has.
   *
   * Written as a filtered list rather than as one template string because an
   * anomaly carries no component and no sibling-sensor count, and a template would
   * render the separators around the holes where they should have been. The asset
   * only appears here when the headline came from a title — the fixture's headline
   * already names it, and saying it twice reads as a rendering fault.
   */
  const meta = [
    active.headline ? active.assetName : null,
    active.lineName,
    active.component,
    active.cascadeSensors != null ? t('banner.cascade', { count: active.cascadeSensors }) : null,
    formatRelative(active.detectedAt),
  ].filter(Boolean)

  function investigate() {
    onInvestigate?.(active)
    setInvestigated((current) => [...current, active.id])
    setIndex(0)
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-3 px-4.5 py-1.5',
        'max-lg:flex-wrap max-lg:py-2.5',
      )}
      style={{
        // The leading edge and the wash both follow the severity, so the band
        // reads before it is read. Logical, so it mirrors under dir="rtl".
        borderInlineStartWidth: 3,
        borderInlineStartStyle: 'solid',
        borderInlineStartColor: `var(--hue-${hue})`,
        background: `color-mix(in srgb, var(--hue-${hue}) 9%, var(--surface-page))`,
      }}
      role="status"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      {/* The prototype's pulsing dot. Not the shared `Dot`, which does not
          animate and has no glow — this one is the alarm lamp. */}
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full motion-safe:animate-pulse"
        style={{
          backgroundColor: `var(--hue-${hue})`,
          boxShadow: `0 0 8px var(--hue-${hue})`,
        }}
      />

      <SeverityBadge severity={active.severity} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-body-sm font-semibold">
          {t('banner.newAnomaly')} ·{' '}
          {/* The detector already writes "{sensor}: {what happened}". Where that
              exists it is used verbatim; the fixture has no title and composes one
              from its own authored parts instead. */}
          {active.headline ??
            `${t(`common:anomalyTypes.${active.anomalyType}`)} on ${active.assetName}`}
          {active.etaHours != null
            ? ` — ${t('banner.eta', { hours: formatHours(active.etaHours) })}`
            : ''}
        </div>
        <div className="truncate text-micro font-normal text-ink-dim">
          <Mono>{active.id}</Mono>
          {meta.map((part, position) => (
            <span key={`${active.id}-${position}`}> · {part}</span>
          ))}
        </div>
      </div>

      {visible.length > 1 ? (
        <div
          className="flex shrink-0 items-center gap-1"
          role="group"
          aria-label={t('banner.count', { current: index + 1, total: visible.length })}
        >
          {visible.map((alert, position) => (
            <button
              key={alert.id}
              type="button"
              aria-label={t('banner.goTo', { id: alert.id })}
              aria-current={position === index}
              onClick={() => setIndex(position)}
              className={cn(
                'h-1.5 rounded-pill transition-all',
                position === index ? 'w-4' : 'w-1.5 opacity-40 hover:opacity-70',
              )}
              style={{ backgroundColor: `var(--hue-${hue})` }}
            />
          ))}
        </div>
      ) : null}

      <Chip className="shrink-0" onClick={investigate}>
        {t('common:actions.investigate')}
      </Chip>

      <IconButton
        bare
        label={t('common:actions.dismiss')}
        onClick={() => setDismissed(true)}
        className="size-7 shrink-0"
      >
        <Icon name="x" size="sm" />
      </IconButton>
    </div>
  )
}
