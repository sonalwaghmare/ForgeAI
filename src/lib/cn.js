import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * DESIGN.md names type roles by job rather than by size — `text-body`,
 * `text-control`, `text-micro`. tailwind-merge has no way to know those are font
 * sizes, so by default it files them under text-COLOR and silently drops
 * whichever class came first:
 *
 *   twMerge('text-ink-dim', 'text-body')   → 'text-body'      colour deleted
 *   twMerge('text-control', 'text-white')  → 'text-white'     size deleted
 *
 * Both failures are invisible in the light theme, because an element that loses
 * its colour inherits near-black ink and looks approximately correct. The bug
 * only surfaces where the inherited colour is wrong — a dark surface, or a
 * button that quietly renders at the wrong size.
 *
 * Registering the custom scale in the font-size group is the fix. Anything added
 * to `--text-*` in index.css must be added here too, or it silently starts
 * eating colours.
 */
const TYPE_ROLES = [
  'display',
  'headline',
  'title',
  'body',
  'body-sm',
  'metric',
  'metric-sm',
  'control',
  'micro',
  'label',
  'mono',
]

/**
 * The same problem, second instance. DESIGN.md names shadows for their job —
 * `shadow-edge`, `shadow-lift` — and tailwind-merge reads an unknown
 * `shadow-<word>` as a shadow *colour* rather than a shadow *size*. So
 * `cn('shadow-lg', 'shadow-lift')` kept BOTH and painted two shadows, which is
 * how a shadcn primitive's `shadow-lg` survived being overridden.
 *
 * Registering them in the `shadow` group is the fix. Anything added to
 * `--shadow-*` in index.css belongs here.
 */
const SHADOW_ROLES = ['edge', 'lift', 'dock', 'accent']

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TYPE_ROLES }],
      shadow: [{ shadow: SHADOW_ROLES }],
    },
  },
})

/** Merge conditional class names, with later Tailwind utilities winning. */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export { TYPE_ROLES, SHADOW_ROLES }
