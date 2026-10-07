import { cn } from '@/lib/cn'

/**
 * The root-cause radar — what the screen shows while the agent is working.
 *
 * ── Why a radar and not a spinner ─────────────────────────────────────────
 * A spinner says "waiting". This operation is not waiting: it is the agent turning
 * through a field of sensor signals looking for a cause, and it can run for a
 * minute or more. The radar says what is actually happening, which is the whole
 * point of a product whose north star is showing its working. It is also the
 * prototype's own device, requested directly.
 *
 * ── Anatomy, from the prototype ───────────────────────────────────────────
 * Two concentric rings in the two border weights, a violet wedge sweeping at a
 * constant 2.2s, and a lit core. Nothing else — no ticks, no grid, no blips. The
 * rings give the sweep something to travel against; a sweep alone in empty space
 * reads as a loading toy.
 *
 * The wedge is the one gradient that ships in this product. It is an alpha falloff
 * because that is how a real sweep decays, it is single-hue, and it lives in the
 * `radar-field` utility so it cannot spread by copy-paste — see the long note
 * beside that utility in `styles/index.css`.
 *
 * ── Motion and the people who cannot take it ──────────────────────────────
 * Under `prefers-reduced-motion` the rotation stops and the wedge fades in place
 * instead; opacity is not movement. And the caller's status text is `aria-live`, so
 * the state is carried by words rather than by the animation for anyone who is not
 * watching it. The whole thing is `aria-hidden` — it is a picture of a process, and
 * announcing "radar" tells a screen-reader user nothing the heading does not.
 *
 * @param {object} props
 * @param {number} [props.size]  Diameter in px. 150 is the prototype's figure.
 */
export function RadarSweep({ size = 150, className }) {
  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn('relative shrink-0', className)}
    >
      {/* Outer and inner rings, in the system's two border weights. The inner one
          sits at 28% inset, which is where the prototype puts it. */}
      <span className="absolute inset-0 rounded-full border border-hairline" />
      <span className="absolute inset-[28%] rounded-full border border-subtle" />

      {/* The sweep. `transform-origin` is the centre by default on a square, but it
          is stated because the whole effect depends on it and a future padding
          change would silently move it. */}
      <span className="radar-field animate-radar-sweep absolute inset-0 origin-center rounded-full" />

      {/* The lit core. `shadow-accent`'s glow is orange, so the halo here is a
          second ring of violet at low alpha rather than a box-shadow — same
          reason everything else reads its colour from a token. */}
      <span className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet size-2 rtl:translate-x-1/2" />
      <span className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full tint-violet size-5 rtl:translate-x-1/2" />
    </div>
  )
}
