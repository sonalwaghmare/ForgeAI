import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Reveal an answer's blocks a few characters at a time.
 *
 * The design's dock does this — `setInterval` slicing a string at 45ms — and it
 * is the one piece of theatre in an assistant that earns its place: a reply
 * that appears whole reads as a lookup, which is exactly what a reader should
 * not have to think about while deciding whether to trust it.
 *
 * ── It is simulation, and it is not pretending otherwise ──────────────────
 * There is no server-sent-events stream behind this. The whole answer arrives
 * in one POST and is revealed on a timer, which is what the design does too.
 * When a real streaming endpoint lands, this hook is where the tokens arrive
 * instead of the timer, and nothing above it changes.
 *
 * ── Motion defers ─────────────────────────────────────────────────────────
 * Under `prefers-reduced-motion` the whole answer is present on the first
 * frame. That is the codebase's standing rule and it matters more here than on
 * a carousel: text that arrives under you is text you cannot re-read, and a
 * reader who has asked for less motion has usually asked for exactly this.
 *
 * ── Non-text blocks arrive whole ──────────────────────────────────────────
 * An evidence table typing itself in cell by cell is nonsense — it is a
 * structure, not prose. So it costs a fixed pause in the sequence and then
 * appears complete, which reads as the assistant finishing a thought and
 * producing a figure.
 *
 * @param {Array<object>} blocks The finished answer.
 * @param {boolean} enabled False to show everything at once.
 * @returns {{ blocks: Array<object>, streaming: boolean }}
 */
export function useStreamedBlocks(blocks, enabled = true) {
  const total = costOf(blocks)
  const reduced = usePrefersReducedMotion()
  const live = enabled && !reduced && total > 0

  const [ticked, setTicked] = useState(0)

  /* DERIVED, not written. An effect that called `setRevealed(total)` for the
     instant case would be a synchronous setState inside an effect — the lint
     rule this codebase has tripped over twice — and it is unnecessary: "show
     everything" is a function of `live`, not a state to put React into.

     Turning reduced motion on mid-stream therefore completes the answer on the
     next render rather than needing an effect to notice. */
  const revealed = live ? Math.min(ticked, total) : total

  useEffect(() => {
    if (!live) return undefined

    /* The count is kept locally as well as in state so the interval can stop
       ITSELF at the end. Deciding that inside the state updater would make the
       updater impure, and leaving the timer running past the last character is
       a tick every 30ms for as long as the tab is open. */
    let at = 0
    const step = stepFor(total)
    const timer = setInterval(() => {
      at += step
      setTicked(at)
      if (at >= total) clearInterval(timer)
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [live, total])

  return { blocks: sliceTo(blocks, revealed), streaming: revealed < total }
}

/* About 100 characters a second. Fast enough not to be waited on, slow enough
   to read as composition rather than a paint. The design uses 4 chars / 45ms;
   this is the same rate expressed at a smoother frame interval. */
const STEP = 3
const TICK_MS = 30

/* The rate is a floor, not a law. It was set against prepared answers of two or
   three sentences; a real one from the engine runs to 750 characters, which at
   100/s is seven and a half seconds of watching text arrive AFTER the six the
   model already took. At that length the effect stops reading as composition and
   starts reading as a slow page.

   So the reveal is capped in TIME rather than fixed in SPEED: short answers keep
   the designed pace, long ones speed up to land inside the ceiling. The character
   rate changes; what a reader actually notices — how long until they can read the
   whole thing — stops depending on how much the model had to say. */
const MAX_REVEAL_MS = 2500

function stepFor(total) {
  const atDesignedPace = (total / STEP) * TICK_MS
  if (atDesignedPace <= MAX_REVEAL_MS) return STEP
  return Math.ceil(total / (MAX_REVEAL_MS / TICK_MS))
}

/** What a block costs in the reveal sequence. */
function costOf(blocks) {
  return (blocks ?? []).reduce((sum, block) => sum + blockCost(block), 0)
}

function blockCost(block) {
  if (block.type === 'evidence') return STRUCTURE_PAUSE
  return (block.text ?? '').length || STRUCTURE_PAUSE
}

/* A structural block is worth a beat rather than its own length — long enough
   to read as a pause, short enough that a table is not what you are waiting
   for. */
const STRUCTURE_PAUSE = 30

/** The blocks visible at `count` characters in, with the last one clipped. */
function sliceTo(blocks, count) {
  const out = []
  let left = count

  for (const block of blocks ?? []) {
    if (left <= 0) break
    const cost = blockCost(block)

    if (block.type === 'evidence' || block.text == null) {
      // All or nothing. A half-drawn table is not a partial thought.
      if (left >= cost) out.push(block)
      left -= cost
      continue
    }

    out.push(left >= cost ? block : { ...block, text: block.text.slice(0, left) })
    left -= cost
  }

  return out
}
