import { useEffect, useState } from 'react'

/**
 * Whether the reader has asked for less motion.
 *
 * Read live rather than once: the setting can change while the tab is open, and
 * anything that kept animating after somebody turned motion off would be the one
 * place in the product that ignored them.
 *
 * Shared because two different reveals need it and they must not disagree — the
 * `/copilot` page's timed reveal of a finished answer, and the dock's reveal of
 * one still arriving. A second copy is a second chance for one of them to keep
 * typing at a reader who asked it not to.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )

  useEffect(() => {
    const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return undefined
    const onChange = (event) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
