import { HIERARCHY_NODES } from './hierarchy'
import { PEOPLE_DIRECTORY, SELF_ID, composePerson, emailOf, personById } from './people'
import { allTeams } from './teams'
import { allRoles } from './roles'
import { audit } from './audit'
import { TASKS } from './home'
import { ROSTER_SITE, shiftsForWeek } from './shifts'

/**
 * The people directory — a person, and everything this platform knows they did.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 * See `DEMO-MODE.md` §8.14.
 *
 * ── Separate from `people.js` because of what it may import ───────────────
 * That file is the registry and imports nothing, so every fixture can read it
 * without a cycle. This one reaches into the roster and the task list to work out
 * what somebody has been doing, which means it must sit downstream of both.
 *
 * ── Last active is derived, and "never" is a real answer ──────────────────
 * The design writes `last: "2m ago"` into the row, which is still saying two
 * minutes tomorrow. Here it is the end of the person's most recent shift that has
 * actually finished — the roster is the one place this product records somebody
 * doing something at a time. An account with no shifts behind it reports nothing,
 * and that is the useful answer: an enabled account that has never been used is
 * exactly what an access review is looking for, and an invented date would hide
 * it.
 *
 * ── The sites somebody covers are the sites they work at ──────────────────
 * Also not authored. It is their home plant plus wherever their open work
 * actually is, which is how somebody ends up covering two sites without anybody
 * typing "2 sites" — the design's own spelling, and a string that cannot be
 * filtered on.
 */

const nodeById = new Map(HIERARCHY_NODES.map((node) => [node.id, node]))

/** The site an asset sits under, walked up the estate rather than stored. */
function siteOfAsset(assetId) {
  let current = nodeById.get(assetId)
  while (current && current.tier !== 'site') current = nodeById.get(current.parentId)
  return current?.id ?? null
}

/**
 * Every shift this person has worked or is down to work, over four weeks.
 *
 * Four rather than one because a directory is not a rota: somebody who was off
 * last week still has a last-active date, and a one-week window would report them
 * as never having signed in.
 */
const WINDOW_DAYS = 28

function shiftsOf(id, now) {
  return shiftsForWeek(now, WINDOW_DAYS).filter((shift) => shift.operatorId === id)
}

/** What the platform last saw them do. `null` — never — is a real answer. */
export function lastActiveAt(id, now = Date.now()) {
  const ended = shiftsOf(id, now)
    .filter((shift) => shift.status === 'completed')
    .map((shift) => Date.parse(shift.endsAt))
  return ended.length ? new Date(Math.max(...ended)).toISOString() : null
}

/** The sites they cover: their own, plus wherever their open work is. */
export function sitesOfPerson(person, now = Date.now()) {
  const sites = new Set()
  if (person.siteId) sites.add(person.siteId)

  /* Working a shift means covering the plant the roster is for. It is how the
     Pune line operator turns out to cover two sites — he is on Findlay's crew,
     which is a fact the roster already states and the registry's `siteId` alone
     cannot see. */
  if (shiftsOf(person.id, now).length) sites.add(ROSTER_SITE)
  for (const task of TASKS) {
    if (task.assignee !== person.id) continue
    const siteId = siteOfAsset(task.assetId)
    if (siteId) sites.add(siteId)
  }
  return [...sites]
}

/**
 * One row of the directory.
 *
 * `scope` is the word the table prints, and it is a shape rather than a count:
 * somebody with no plant of their own covers the estate, and saying "0 sites"
 * about the COO would be arithmetic answering a question nobody asked.
 */
export function composeDirectoryEntry(person, now = Date.now()) {
  const base = composePerson(person)
  const siteIds = sitesOfPerson(base, now)
  const workedShifts = shiftsOf(base.id, now).filter((shift) => shift.status === 'completed')

  const team = base.teamId ? allTeams().find((entry) => entry.id === base.teamId) : null

  return {
    ...base,
    teamName: team?.name ?? null,
    siteIds,
    siteNames: siteIds.map((id) => nodeById.get(id)?.name).filter(Boolean),
    scope: base.siteId === null ? 'enterprise' : siteIds.length > 1 ? 'multiSite' : 'site',
    lastActiveAt: lastActiveAt(base.id, now),
    /* What they have on. Both counted from the collections that hold them, so a
       person's row and the screens those records live on cannot disagree. */
    shiftsWorked: workedShifts.length,
    openTasks: TASKS.filter((task) => task.assignee === base.id && task.status !== 'done').length,
  }
}

export const directory = (now = Date.now()) =>
  PEOPLE_DIRECTORY.map((person) => composeDirectoryEntry(person, now))

/**
 * The figures above the table.
 *
 * Every one a count of the directory itself, and every one a filter the table
 * offers — a tile that cannot be clicked is a decoration, and a tile that counts
 * something the table cannot show is worse.
 *
 * `neverSignedIn` is the design's "Pending", which it prints as a hard zero. This
 * is the same idea with something behind it: an account that exists and has no
 * activity at all.
 */
export function directoryStats(rows) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'active').length,
    inactive: rows.filter((row) => row.status === 'inactive').length,
    locked: rows.filter((row) => row.status === 'locked').length,
    mfaOn: rows.filter((row) => row.mfa).length,
    mfaOff: rows.filter((row) => !row.mfa).length,
    neverSignedIn: rows.filter((row) => row.lastActiveAt === null).length,
  }
}

/* ── Writes ───────────────────────────────────────────────────────────────
   Module state, like every other demo write in this directory. What can be
   changed here is what an administrator of this platform decides: whether an
   account may sign in. Everything else on the row belongs somewhere else — a
   name to the person, a role to the roles page, a site to the hierarchy, a last
   sign-in to the log — and offering any of them as a field would make this
   screen a second source of truth for a fact it does not own. */

const STATUSES = ['active', 'inactive', 'locked']

/**
 * Every bulk import that has been run.
 *
 * Empty to begin with, which is what the design draws too — its Import History
 * tab is an empty state and nothing in the prototype ever fills it. Here running
 * the wizard writes a row, so the tab is the record of something that happened
 * rather than a screen nobody reaches.
 */
const IMPORTS = []

export const importHistory = () => [...IMPORTS].reverse()

/**
 * Create the accounts a validated import produced.
 *
 * Created rather than counted: the rows land in the registry, appear in the
 * table, and are assignable if their role does plant work. A row whose email
 * already exists UPDATES that person's role and second factor rather than making
 * a second account — an import run twice must not double the directory, and the
 * summary says which it did.
 */
export function importPeople({ records = [], filename = 'import.csv', by = SELF_ID }, now = Date.now()) {
  const siteByName = new Map(
    HIERARCHY_NODES.filter((node) => node.tier === 'site').map((node) => [node.name, node.id]),
  )

  let created = 0
  let updated = 0
  let skipped = 0

  for (const record of records) {
    if (!record?.email || !record?.name || !knownRole(record.role)) {
      skipped += 1
      continue
    }
    const existing = PEOPLE_DIRECTORY.find(
      (person) => emailOf(person.name).toLowerCase() === String(record.email).toLowerCase(),
    )
    if (existing) {
      existing.role = record.role
      existing.mfa = Boolean(record.mfa)
      updated += 1
      continue
    }
    PEOPLE_DIRECTORY.push({
      id: `usr_imp_${PEOPLE_DIRECTORY.length + 1}`,
      name: record.name,
      role: record.role,
      siteId: siteByName.get(record.site) ?? null,
      status: 'active',
      mfa: Boolean(record.mfa),
      teamId: teamIdByName(record.team),
    })
    created += 1
  }

  const entry = {
    id: `IMP-${IMPORTS.length + 1}`,
    filename,
    at: new Date(now).toISOString(),
    byId: by,
    byName: personById(by)?.name ?? null,
    rows: records.length,
    created,
    updated,
    skipped,
  }
  IMPORTS.push(entry)
  audit('USERS_IMPORTED', {
    resource: `import:${entry.id}`,
    detail: { file: filename, created, updated, skipped },
    actorId: by,
  }, now)
  return entry
}

/**
 * The roles a row may name.
 *
 * Read from the roles collection at call time, not copied here. The first
 * version was a hardcoded list of the eight built-in ones, which meant a custom
 * role could be created on the Roles page and then refused by the very screens
 * that offer it — a fourth copy of a vocabulary this module spent its first pass
 * collapsing to one.
 */
const knownRole = (id) => allRoles().some((role) => role.id === id)

const teamIdByName = (name) =>
  name ? (allTeams().find((team) => team.name === name)?.id ?? null) : null

/**
 * Create one account by hand.
 *
 * The same path the import takes, so a person added here and a person imported
 * are the same kind of record. New accounts start with no second factor and no
 * activity, which is true of every account on its first day and is what puts a
 * new row straight into the two tiles that matter.
 */
export function createPerson({ name, role, siteId = null, teamId = null }) {
  if (!name?.trim() || !knownRole(role)) return null
  const record = {
    id: `usr_new_${PEOPLE_DIRECTORY.length + 1}`,
    name: name.trim(),
    role,
    siteId,
    status: 'active',
    mfa: false,
    teamId,
  }
  PEOPLE_DIRECTORY.push(record)
  audit('ACCOUNT_CREATED', { resource: `user:${record.id}`, detail: { name: record.name, role } })
  return composeDirectoryEntry(record)
}

export function setPersonStatus(id, status) {
  if (!STATUSES.includes(status)) return null
  const person = personById(id)
  if (!person) return null
  /* Written onto the registry row itself rather than an override map beside it.
     `PEOPLE_DIRECTORY` is the record; a parallel map would let the roster and
     this screen disagree about whether somebody still has an account. */
  const was = person.status
  person.status = status
  /* Recorded here rather than at the route, so an audit entry cannot be missed
     by a second caller who forgot to write one. */
  if (was !== status) {
    audit(
      status === 'locked'
        ? 'ACCOUNT_LOCKED'
        : status === 'inactive'
          ? 'ACCOUNT_DEACTIVATED'
          : 'ACCOUNT_REACTIVATED',
      { resource: `user:${person.id}`, detail: { name: person.name, from: was, to: status } },
    )
  }
  return composeDirectoryEntry(person)
}
