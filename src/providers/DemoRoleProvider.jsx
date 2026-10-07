import { createContext, useContext, useMemo, useState } from 'react'

/**
 * The role switcher.
 *
 * Explicitly a demo affordance, not authorisation. PRODUCT.md is unambiguous:
 * RBAC is deferred, and switching role changes the AI briefing and nothing else.
 * It grants no permission, hides no data, and must never be mistaken for access
 * control — the server decides that, and today there is no server.
 *
 * It exists because "the briefing changes by who is reading" is the product's
 * second positioning claim, and a claim nobody can see demonstrated is a claim
 * nobody believes.
 *
 * It exposes a ROLE and nothing else. It used to also hand out the fixture
 * `person` holding that role, which the shell then rendered as the signed-in
 * account — so the nav rail introduced you as Dana Okafor, Plant Manager. The
 * identity now comes from the sign-in response, and this provider no longer
 * carries a person for anything to mistake for one.
 */

const DemoRoleContext = createContext(null)

export const DEMO_ROLES = ['lineOperator', 'plantManager', 'executive']

/* CXO by default. The briefing changes by who is reading, and the executive one
   is the version that makes that claim visible in a single screen — a plant
   manager's brief and an operator's read as the same page to somebody who has
   not seen both. */
export function DemoRoleProvider({ children, initialRole = 'executive' }) {
  const [role, setRole] = useState(initialRole)

  const value = useMemo(() => ({ role, setRole, roles: DEMO_ROLES }), [role])

  return <DemoRoleContext.Provider value={value}>{children}</DemoRoleContext.Provider>
}

export function useDemoRole() {
  const context = useContext(DemoRoleContext)
  if (!context) throw new Error('useDemoRole must be used inside DemoRoleProvider')
  return context
}
