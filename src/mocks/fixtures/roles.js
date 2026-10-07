import { ALL_NAV_ITEMS } from '@/shell/navigation'
import { PEOPLE_DIRECTORY } from './people'
import { audit } from './audit'

/**
 * Roles and permissions.
 *
 * SYNTHETIC. Gated on `VITE_DEMO_MODE`. See `DEMO-MODE.md` §8.15.
 *
 * ── The modules are this product's modules ────────────────────────────────
 * The design invents a catalogue: "Dashboard", "Root Cause Analysis",
 * "Integrations", "Platform Admin". Some of those exist here under other names
 * and some do not exist at all, and a permission naming a screen nobody can open
 * is a permission that can never be tested. So the catalogue is
 * `ALL_NAV_ITEMS` — every module in the rail, with the route it goes to and the
 * name `app:screens` already gives it. Add a module to the product and it
 * appears here needing features; remove one and its permissions go with it.
 *
 * What is authored is the FEATURES, because an action is not derivable from a
 * route: nothing about `/app/work-orders` says that approving is a different
 * privilege from closing.
 *
 * ── The gate is the feature that means "can reach it at all" ──────────────
 * One per module, and it is what the role preview reads: strip a role of
 * `anomalies.view` and Anomalies leaves the rail it would see. Without a
 * declared gate, a permission grid is a list of checkboxes with no consequence
 * anybody can look at.
 *
 * ── How many people hold a role is counted, never authored ────────────────
 * The design writes `users: 3` beside each role, so it can claim three while the
 * directory shows one. Here it is a count over the same registry the Users
 * screen reads.
 */

/**
 * The features each module has, and which of them is the gate.
 *
 * Keyed by nav item id. A module missing from this map still appears in the
 * catalogue with a single `view` feature — which is the honest default for a
 * screen nobody has yet decided the privileges of, and better than it silently
 * dropping out of the grid.
 */
const FEATURES = {
  home: ['view', 'customise'],
  anomalies: ['view', 'acknowledge', 'resolve', 'configure'],
  oee: ['view', 'export', 'setTargets'],
  assets: ['view', 'edit', 'import'],
  sensors: ['view', 'configure'],
  shifts: ['view', 'assign', 'handover'],
  logbook: ['view', 'write'],
  workOrders: ['view', 'create', 'approve', 'close'],
  dataFusion: ['view', 'manage', 'map'],
  copilot: ['use', 'export'],
  executive: ['view', 'export'],
  reports: ['view', 'build', 'schedule'],
  settings: ['view', 'users', 'roles', 'security', 'audit'],
}

/** The catalogue: every module in the rail, with its features. */
export const PERMISSION_CATALOGUE = ALL_NAV_ITEMS.map((item) => {
  const features = FEATURES[item.id] ?? ['view']
  return {
    id: item.id,
    icon: item.icon,
    to: item.to,
    features,
    /* The first feature is always the gate, and the lists above are written in
       that order deliberately — `use` for the assistant, `view` everywhere
       else. Declaring it separately would be a second fact to keep in step. */
    gate: features[0],
  }
})

export const permissionKeys = () =>
  PERMISSION_CATALOGUE.flatMap((module) => module.features.map((f) => `${module.id}.${f}`))

const grantOf = (keys) => Object.fromEntries(keys.map((key) => [key, true]))

const everything = () => grantOf(permissionKeys())

/** Every gate and nothing else — what "read only" actually means. */
const readOnly = () =>
  grantOf(PERMISSION_CATALOGUE.filter((m) => m.id !== 'settings').map((m) => `${m.id}.${m.gate}`))

/**
 * The eight roles the product already has words for.
 *
 * `common:roles` is the vocabulary the Users table, the Create dialog and the
 * bulk import all validate against, so this list is that list rather than a
 * parallel one. A role somebody holds and this page did not know about would be
 * a role with no permissions and no way to see that.
 */
const SYSTEM_ROLES = [
  { id: 'platformAdmin', tone: 'violet', grant: everything() },
  {
    id: 'plantManager',
    tone: 'green',
    grant: grantOf([
      'home.view', 'home.customise',
      'anomalies.view', 'anomalies.acknowledge', 'anomalies.resolve',
      'oee.view', 'oee.export', 'oee.setTargets',
      'assets.view', 'assets.edit',
      'sensors.view',
      'shifts.view', 'shifts.assign', 'shifts.handover',
      'logbook.view', 'logbook.write',
      'workOrders.view', 'workOrders.create', 'workOrders.approve', 'workOrders.close',
      'copilot.use',
      'reports.view',
      'settings.view', 'settings.users',
    ]),
  },
  {
    id: 'reliabilityEngineer',
    tone: 'ack',
    grant: grantOf([
      'home.view',
      'anomalies.view', 'anomalies.acknowledge', 'anomalies.configure',
      'oee.view',
      'assets.view', 'assets.edit', 'assets.import',
      'sensors.view', 'sensors.configure',
      'logbook.view', 'logbook.write',
      'workOrders.view', 'workOrders.create',
      'dataFusion.view', 'dataFusion.manage', 'dataFusion.map',
      'copilot.use', 'copilot.export',
      'reports.view', 'reports.build',
    ]),
  },
  {
    id: 'shiftLead',
    tone: 'forge',
    grant: grantOf([
      'home.view',
      'anomalies.view', 'anomalies.acknowledge',
      'oee.view',
      'assets.view',
      'sensors.view',
      'shifts.view', 'shifts.assign', 'shifts.handover',
      'logbook.view', 'logbook.write',
      'workOrders.view', 'workOrders.create', 'workOrders.close',
      'copilot.use',
    ]),
  },
  {
    id: 'maintenanceTechnician',
    tone: 'amber',
    grant: grantOf([
      'home.view',
      'anomalies.view', 'anomalies.acknowledge',
      'assets.view',
      'logbook.view', 'logbook.write',
      'workOrders.view', 'workOrders.create', 'workOrders.close',
      'copilot.use',
    ]),
  },
  {
    id: 'lineOperator',
    tone: 'watch',
    grant: grantOf([
      'home.view',
      'anomalies.view', 'anomalies.acknowledge',
      'oee.view',
      'assets.view',
      'logbook.view', 'logbook.write',
      'workOrders.view',
      'copilot.use',
    ]),
  },
  {
    id: 'executive',
    tone: 'dismissed',
    grant: grantOf([
      'home.view',
      'anomalies.view',
      'oee.view', 'oee.export',
      'executive.view', 'executive.export',
      'reports.view', 'reports.schedule',
      'copilot.use', 'copilot.export',
    ]),
  },
  { id: 'readOnly', tone: null, grant: readOnly() },
]

/* ── Custom roles ─────────────────────────────────────────────────────────
   Session state, like every other demo write. A system role cannot be edited or
   removed — it is the vocabulary the rest of the product validates against, and
   deleting `maintenanceTechnician` would leave two people holding a role that no
   longer exists. Duplicating one is how you get an editable copy, which is what
   the design offers and the only safe version of it. */

const CUSTOM = []

const isSystem = (id) => SYSTEM_ROLES.some((role) => role.id === id)

export function composeRole(role) {
  const holders = PEOPLE_DIRECTORY.filter((person) => person.role === role.id)
  const granted = Object.entries(role.grant).filter(([, on]) => on).map(([key]) => key)
  const reaches = PERMISSION_CATALOGUE.filter((module) => role.grant[`${module.id}.${module.gate}`])

  return {
    id: role.id,
    name: role.name ?? null,
    description: role.description ?? null,
    tone: role.tone ?? null,
    system: isSystem(role.id),
    grant: role.grant,
    granted,
    grantCount: granted.length,
    /* Counted over the directory rather than written down beside the role. */
    userCount: holders.length,
    userIds: holders.map((person) => person.id),
    /* What somebody with this role would find in the rail. The grid means this. */
    reaches: reaches.map((module) => module.id),
    moduleCount: reaches.length,
  }
}

export const allRoles = () => [...SYSTEM_ROLES, ...CUSTOM].map(composeRole)

export const roleById = (id) => [...SYSTEM_ROLES, ...CUSTOM].find((role) => role.id === id) ?? null

export function roleStats(rows) {
  return {
    total: rows.length,
    system: rows.filter((row) => row.system).length,
    custom: rows.filter((row) => !row.system).length,
    /* Everybody who holds any role. Counted once — summing `userCount` would
       double anybody holding two, which cannot happen today and would be a
       silent wrong answer the day it can. */
    assigned: new Set(rows.flatMap((row) => row.userIds)).size,
  }
}

/** Create a custom role, or replace one. System roles are refused. */
export function saveRole({ id, name, description, tone, grant }) {
  if (!name?.trim()) return null
  if (id && isSystem(id)) return null

  const keys = new Set(permissionKeys())
  const clean = Object.fromEntries(
    Object.entries(grant ?? {}).filter(([key, on]) => on && keys.has(key)),
  )

  const record = {
    id: id ?? `role_custom_${CUSTOM.length + 1}`,
    name: name.trim(),
    description: description?.trim() || null,
    tone: tone ?? null,
    grant: clean,
  }

  const index = CUSTOM.findIndex((role) => role.id === record.id)
  if (index >= 0) CUSTOM[index] = record
  else CUSTOM.push(record)
  audit(index >= 0 ? 'ROLE_UPDATED' : 'ROLE_CREATED', {
    resource: `role:${record.id}`,
    detail: { name: record.name, permissions: Object.keys(clean).length },
  })
  return composeRole(record)
}

/**
 * Remove a custom role.
 *
 * Refused while anybody holds it, and refused outright for a system role. A role
 * that vanishes from under the people holding it leaves them with a permission
 * set nothing can resolve — the same reason there is no Delete on the Users
 * screen.
 */
export function deleteRole(id) {
  if (isSystem(id)) return null
  const index = CUSTOM.findIndex((role) => role.id === id)
  if (index < 0) return null
  if (PEOPLE_DIRECTORY.some((person) => person.role === id)) return null
  const [removed] = CUSTOM.splice(index, 1)
  audit('ROLE_DELETED', { resource: `role:${id}`, detail: { name: removed.name } })
  return { id, deleted: true }
}

export function resetRoles() {
  CUSTOM.length = 0
}
