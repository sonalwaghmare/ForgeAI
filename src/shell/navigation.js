/**
 * The global navigation model.
 *
 * `entitlement` names the key in the org's entitlement response that gates the
 * item — plan tier decides which modules render, so this is data rather than a
 * conditional at the call site.
 *
 * `built: false` items are honest placeholders. The rail is part of the shell
 * and showing the real information architecture matters, but a screen that does
 * not exist yet says so rather than faking one.
 *
 * `beta: true` tags an item whose screen is real but incomplete — the module is
 * reachable and does something, and the rail says out loud that it is not finished.
 * That is a claim about maturity, not about whether a route exists, so it is
 * independent of `built`/`demoBuilt`.
 *
 * `demoBuilt: true` is the third state: a screen that exists, is complete, and
 * is entirely authored — so it is real under `VITE_DEMO_MODE` and a placeholder
 * without it. `isBuilt()` is the one place that resolves the pair, so a screen
 * cannot end up registered as a route while the rail still calls it unbuilt.
 */
import { config } from '@/services/config'

/** Whether this item has a screen behind it right now. */
export const isBuilt = (item) => Boolean(item.built || (config.demoMode && item.demoBuilt))
export const NAV_GROUPS = [
  {
    id: 'overview',
    items: [{ id: 'home', to: '/app/home', icon: 'home', entitlement: 'overview', built: true }],
  },
  {
    id: 'monitor',
    items: [
      { id: 'anomalies', to: '/app/anomalies', icon: 'bolt', entitlement: 'anomalies', built: true },
      { id: 'oee', to: '/app/oee', icon: 'gauge', entitlement: 'oee', built: false, demoBuilt: true },
      { id: 'assets', to: '/app/assets', icon: 'factory', entitlement: 'assets', built: false, demoBuilt: true },
      { id: 'sensors', to: '/app/sensors', icon: 'chart', entitlement: 'sensors', built: false, demoBuilt: true, beta: true },
      { id: 'shifts', to: '/app/shifts', icon: 'cal', entitlement: 'shifts', built: false, demoBuilt: true },
      { id: 'logbook', to: '/app/logbook', icon: 'search', entitlement: 'logbook', built: false, demoBuilt: true },
    ],
  },
  {
    id: 'act',
    items: [
      { id: 'workOrders', to: '/app/work-orders', icon: 'wrench', entitlement: 'workOrders', built: false, demoBuilt: true },
      /* Workboards. Beta: the canvas does not yet drag and nothing persists — see
         the notice on the module itself. */
      { id: 'workboards', to: '/app/workboards', icon: 'board', entitlement: 'workboards', built: false, demoBuilt: true, beta: true },
      { id: 'dataFusion', to: '/app/data-fusion', icon: 'plug', entitlement: 'dataFusion', built: true },
    ],
  },
  {
    id: 'agents',
    items: [{ id: 'copilot', to: '/app/copilot', icon: 'ai', entitlement: 'copilot', built: false, demoBuilt: true }],
  },
  {
    id: 'insights',
    items: [
      { id: 'executive', to: '/app/executive', icon: 'map', entitlement: 'executive', built: false, demoBuilt: true },
      /* Analytics & Reports was missing from this list entirely — the only
         module in the prototype's information architecture with no rail item,
         so the screen existed in the design and was unreachable here. */
      { id: 'reports', to: '/app/reports', icon: 'chart', entitlement: 'analytics', built: false, demoBuilt: true },
    ],
  },
  {
    id: 'admin',
    items: [{ id: 'settings', to: '/app/settings', icon: 'gear', entitlement: 'settings', built: true }],
  },
]

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)
