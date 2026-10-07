import { createContext, useContext, useMemo, useState } from 'react'
import { ROOT_ID } from '@/features/hierarchy/api'

/**
 * The active point in the hierarchy.
 *
 * Client state, so it lives in context rather than in TanStack Query — Query
 * owns what the server said, this owns what the user is looking at.
 *
 * ── Two scopes, and why ──────────────────────────────────────────────────
 * `nodeId` is the live one. It names a real record from the account's own
 * hierarchy and drives what the top bar says you are looking at.
 *
 * `siteId` and `params` are the demo scope, and they are deliberately NOT
 * changed by selecting a live node. Every scoped read in the product — the
 * anomaly list, the KPI strip, the briefing, site health — is still answered
 * from fixtures keyed to fixture site ids. Passing a real UUID into them would
 * not scope anything; it would return nothing, and the app would look broken
 * rather than partially built.
 *
 * So selecting a live node currently changes the label and not the data. That
 * is the honest state of it, and it collapses to one scope the moment those
 * endpoints exist: `params` starts reading `nodeId` and this comment goes.
 */

const ScopeContext = createContext(null)

export function ScopeProvider({ children, initialSiteId = 'site_findlay' }) {
  const [nodeId, setNodeId] = useState(ROOT_ID)
  const [siteId, setSiteId] = useState(initialSiteId)

  const value = useMemo(
    () => ({
      /** The live hierarchy node the user is looking at. */
      nodeId,
      setNodeId,

      /** The demo scope. Fixture-keyed, and not what the selector sets. */
      siteId,
      setSiteId,
      /** Params every scoped fixture query spreads into its request. */
      params: siteId ? { siteId } : {},
    }),
    [nodeId, siteId],
  )

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export function useScope() {
  const context = useContext(ScopeContext)
  if (!context) throw new Error('useScope must be used inside ScopeProvider')
  return context
}
