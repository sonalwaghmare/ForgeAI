import { useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '@/components/forge/Icon'
import { Num } from '@/components/forge/primitives'
import { cn } from '@/lib/cn'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'

/**
 * The investigation canvas.
 *
 * DEMO. See `DEMO-MODE.md` §8.1. Shared by the anomaly's Workboard tab and the
 * Workboards module, so the surface a board is read on is the same object in both
 * places rather than two drifting copies.
 *
 * ── This is a still of the canvas, not the canvas ─────────────────────────
 * The design's board pans, zooms, marquee-selects, drags, resizes and draws
 * connectors by hand, and persists all of it. None of that is here: cards sit at
 * fixed positions. That was a deliberate scope decision — what a reviewer needs to
 * see is what an investigation board CONTAINS and how it reads, and every one of
 * those interactions is a week of work that teaches them nothing a still does not.
 *
 * The caller states the consequence rather than hiding it: both surfaces mark the
 * toolbar read-only and close with a notice. A canvas that looked draggable and was
 * not would be worse than one that admits it.
 *
 * ── Card geometry is measured, never computed ─────────────────────────────
 * Positions are percentages and heights come from the text inside each card, so the
 * only way to know where an edge is — at this viewport, in this locale, after this
 * translation wrapped to three lines — is to read it off the DOM. Percentages in
 * the SVG would need `preserveAspectRatio="none"`, which stretches the coordinate
 * space and would shear every arrowhead.
 *
 * @param {object} props
 * @param {Array}  props.cards  `{ key, kind, x, y, w, kindLabel, title, body, series? }`
 * @param {Array}  props.links  `[fromKey, toKey]` pairs, drawn as arrows.
 */

/** Card kind → its accent and its glyph. Static map, per `lib/tone.js`. */
const CARD_KIND = {
  asset: { tone: 'watch', icon: 'machine' },
  chart: { tone: 'green', icon: 'chart' },
  rca: { tone: 'amber', icon: 'bolt' },
  pid: { tone: 'watch', icon: 'layers' },
  sop: { tone: 'violet', icon: 'list' },
  wo: { tone: 'amber', icon: 'wrench' },
  note: { tone: 'forge', icon: 'doc' },
  person: { tone: 'green', icon: 'users' },
}

/** The four edge midpoints of a measured card. */
const anchorsOf = (r) => [
  { x: r.x + r.w / 2, y: r.y },
  { x: r.x + r.w / 2, y: r.y + r.h },
  { x: r.x, y: r.y + r.h / 2 },
  { x: r.x + r.w, y: r.y + r.h / 2 },
]

/**
 * The shortest edge-to-edge run between two cards, pulled back from both.
 *
 * Sixteen candidate pairs, cheapest wins — which is what makes an arrow leave the
 * side facing its target instead of always the right edge. The 7px pullback keeps
 * the tail off one border and leaves the arrowhead just outside the other.
 */
function runBetween(from, to) {
  let best = null
  for (const a of anchorsOf(from)) {
    for (const b of anchorsOf(to)) {
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      if (!best || d < best.d) best = { a, b, d }
    }
  }
  if (!best || !best.d) return null
  const ux = (best.b.x - best.a.x) / best.d
  const uy = (best.b.y - best.a.y) / best.d
  const gap = 7
  return {
    x1: best.a.x + ux * gap,
    y1: best.a.y + uy * gap,
    x2: best.b.x - ux * gap,
    y2: best.b.y - uy * gap,
  }
}

export function BoardCanvas({ cards, links, className }) {
  const surfaceRef = useRef(null)
  const cardRefs = useRef({})
  const [board, setBoard] = useState(null)

  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return undefined

    const measure = () => {
      const measured = {}
      for (const [key, el] of Object.entries(cardRefs.current)) {
        if (!el) continue
        measured[key] = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
      }
      // Only commit a real change. The observer fires on every mutation it sees,
      // and setting identical state on each one is a render loop with extra steps.
      setBoard((prev) => {
        const next = { w: surface.clientWidth, h: surface.clientHeight, cards: measured }
        return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      })
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(surface)
    for (const el of Object.values(cardRefs.current)) if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [cards])

  return (
    /* The dotted grid is what says "canvas" before a single card is read;
       without it this is a dashboard. */
    <div
      ref={surfaceRef}
      className={cn(
        'relative min-h-[38rem] overflow-hidden rounded-sm border border-hairline bg-sunken',
        className,
      )}
      style={{
        backgroundImage: 'radial-gradient(circle, var(--border-hairline) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      {/* Drawn in the surface's own pixels — one unit is one pixel, so the
          arrowheads keep their shape at every width. Under the cards and inert,
          because the line is a statement about them, not a target. */}
      {board ? (
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${board.w} ${board.h}`}
          width={board.w}
          height={board.h}
          className="pointer-events-none absolute inset-0"
        >
          <defs>
            <marker
              id="board-arrowhead"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 Z" fill="var(--ink-mute)" />
            </marker>
          </defs>
          {links.map(([from, to]) => {
            const a = board.cards[from]
            const b = board.cards[to]
            if (!a || !b) return null
            const run = runBetween(a, b)
            if (!run) return null
            return (
              <line
                key={`${from}-${to}`}
                x1={run.x1}
                y1={run.y1}
                x2={run.x2}
                y2={run.y2}
                stroke="var(--ink-mute)"
                strokeWidth="1.25"
                markerEnd="url(#board-arrowhead)"
              />
            )
          })}
        </svg>
      ) : null}

      {cards.map((card) => (
        <BoardCard
          key={card.key}
          card={card}
          cardRef={(el) => {
            cardRefs.current[card.key] = el
          }}
        />
      ))}
    </div>
  )
}

/** One card, parked on the surface. */
function BoardCard({ card, cardRef }) {
  const kind = CARD_KIND[card.kind] ?? CARD_KIND.note

  return (
    <article
      ref={cardRef}
      className="absolute rounded-sm border border-hairline bg-card p-3 shadow-edge"
      style={{
        insetInlineStart: `${card.x}%`,
        insetBlockStart: `${card.y}%`,
        inlineSize: `${card.w}%`,
      }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn('flex size-5 items-center justify-center rounded-xs', TINT_CLASS[kind.tone])}
        >
          <Icon name={kind.icon} size="xs" className={ON_TINT_CLASS[kind.tone]} />
        </span>
        <span className="text-micro font-bold tracking-wide text-ink-mute uppercase">
          {card.kindLabel}
        </span>
      </div>

      <h4 className="m-0 text-body-sm font-semibold text-balance">{card.title}</h4>

      {card.series ? <MiniTrace values={card.series} /> : null}

      <p className="m-0 mt-1.5 text-micro font-normal text-ink-dim">
        <Num>{card.body}</Num>
      </p>
    </article>
  )
}

/**
 * The trace inside a chart card.
 *
 * Local rather than `Sparkline`, because a card on a canvas needs the area fill —
 * at this size a bare polyline reads as a squiggle, and the fill is what gives the
 * trace a mass the eye registers without stopping to read it.
 */
function MiniTrace({ values }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const W = 200
  const H = 56
  const line = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * W).toFixed(1)},${(H - ((v - min) / span) * (H - 6) - 3).toFixed(1)}`,
    )
    .join(' ')

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-2 h-14 w-full"
    >
      <defs>
        <linearGradient id="board-trace-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--hue-red)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--hue-red)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill="url(#board-trace-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--hue-red)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
