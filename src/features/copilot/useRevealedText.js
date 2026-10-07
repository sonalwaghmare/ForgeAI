import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Reveal text that is still arriving, a few characters at a time.
 *
 * ── Why a second reveal, and how it differs from the page's ───────────────
 * `pages/copilot/useStreamedBlocks` reveals a FINISHED answer on a timer: the
 * whole string is known on the first frame and the hook decides how long to take
 * over it. This one cannot work that way, because the string grows underneath it
 * — the engine emits one `delta` per verified sentence, so the target is longer
 * every few hundred milliseconds and is not known until `done`.
 *
 * That difference is the whole reason this exists rather than reusing the other.
 * A hook that plans a duration against a total it thinks is final will finish
 * early and then jerk forward each time another sentence lands, which looks worse
 * than no animation at all.
 *
 * ── It never gets ahead of what was verified ──────────────────────────────
 * It only ever shows a prefix of text it has actually been given. There is no
 * prediction and no placeholder: every character on screen came out of a delta
 * the verifier had already passed. What it changes is the pace, not the content —
 * so if the engine stops sending, this stops, and a reader is never shown a
 * sentence the turn did not stand behind.
 *
 * ── Chasing, not pacing ───────────────────────────────────────────────────
 * The step is derived from how far behind it is. A sentence landing whole makes
 * the backlog jump, so the rate rises to clear it inside `CATCH_UP_MS` and drops
 * back once caught up. A short answer types at the designed pace; a long one
 * never leaves the reader watching a queue drain after the model has finished.
 *
 * Under `prefers-reduced-motion` the text is whatever has arrived, immediately.
 *
 * ── A turn read back out of the database is not arriving ─────────────────
 * `instant` exists for replay. A reloaded conversation hands this hook complete
 * text on the first frame, and without the flag every one of those turns types
 * itself out again on mount — twenty-six answers animating at once, which is the
 * panel inventing activity that is months old. `active` cannot carry that
 * distinction: it is about whether MORE may arrive, and for the last replayed turn
 * it is false either way.
 *
 * @param {string} text Everything received so far.
 * @param {boolean} active Whether more may still arrive.
 * @param {boolean} [instant] Show all of it at once — a turn being replayed, not written.
 * @returns {{ text: string, catchingUp: boolean }}
 */
export function useRevealedText(text, active, instant = false) {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(0)

  /* The count is mirrored in a ref so the interval can read its own latest value
     without being torn down and rebuilt on every tick — an interval whose effect
     depends on the state it sets restarts continuously and never keeps time. */
  const at = useRef(0)

  useEffect(() => {
    /* A new turn's text is shorter than the last one's, which is the only way the
       target ever goes backwards. Rewinding the counter with it keeps the reveal
       from thinking it is already finished. Done here rather than during render:
       a ref read while rendering belongs to whichever pass happens to run first. */
    if (text.length < at.current) at.current = text.length

    if (reduced || instant) return undefined
    if (at.current >= text.length) return undefined

    const timer = setInterval(() => {
      const behind = text.length - at.current
      if (behind <= 0) {
        clearInterval(timer)
        return
      }
      at.current += Math.max(STEP, Math.ceil(behind / (CATCH_UP_MS / TICK_MS)))
      if (at.current > text.length) at.current = text.length
      setShown(at.current)
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [text, reduced, instant])

  /* DERIVED rather than written, so reduced motion takes effect on the next
     render instead of needing an effect to set state — the synchronous-setState-
     in-an-effect rule this codebase has tripped over before. */
  const revealed = reduced || instant ? text : text.slice(0, Math.min(shown, text.length))

  /* A replayed turn is never catching up. Left derived from lengths it would be
     false anyway, but only by arithmetic — stating it means the caret cannot appear
     on an old answer if the reveal is ever changed. */
  return { text: revealed, catchingUp: !instant && (active || revealed.length < text.length) }
}

/* About 100 characters a second at rest — the rate the design uses, and the same
   one the page's reveal settles on. */
const STEP = 3
const TICK_MS = 30

/* However far behind it falls, it is caught up within this. Sets the ceiling on
   how long a reader waits after the engine has finished talking. */
const CATCH_UP_MS = 600
