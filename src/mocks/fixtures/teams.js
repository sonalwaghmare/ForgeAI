import { HIERARCHY_NODES } from './hierarchy'
import { PEOPLE_DIRECTORY, composePerson } from './people'

/**
 * Teams.
 *
 * SYNTHETIC. Gated on `VITE_DEMO_MODE`. See `DEMO-MODE.md` §8.14.
 *
 * ── A team is a name and a purpose; everything else is its members ────────
 * The design authors `members: 2`, `sites: "Atlanta DC"`, `lead: "Jim Newman"`
 * and `status: "Active"` beside each other, so a team can report two members and
 * list three, or be Active with nobody in it. Here membership is the one
 * authored fact — a person carries their `teamId` — and the count, the sites,
 * the lead's name and whether the team is active all fall out of who is in it.
 *
 * ── A team with nobody who can sign in is not active ──────────────────────
 * Derived, not set. It is the only definition of an inactive group that cannot
 * drift: deactivate the last member and the team goes quiet, which is what the
 * word is for.
 *
 * ── `landing` is a route, and it has to resolve ───────────────────────────
 * The design's "Default Page" is free text — "Realized Value", "Site Health" —
 * naming screens the product does not have. Every one here is a path
 * `verify:mocks` checks against the router, because a default page nobody can
 * open is not a default page.
 */

export const TEAM_TYPES = ['engineering', 'operations', 'executive', 'maintenance', 'analytics']

const TEAMS = [
  {
    id: 'team_fdy_reliability',
    landingKey: 'anomalies',
    name: 'Findlay Reliability',
    type: 'engineering',
    leadId: 'usr_rel_1',
    landing: '/app/anomalies',
    channel: '#fdy-reliability',
  },
  {
    id: 'team_fdy_operations',
    landingKey: 'oee',
    name: 'Findlay Operations',
    type: 'operations',
    leadId: 'usr_mgr_1',
    landing: '/app/oee',
    channel: '#fdy-ops',
  },
  {
    id: 'team_exec',
    landingKey: 'executive',
    name: 'Executive Council',
    type: 'executive',
    leadId: 'usr_exe_1',
    landing: '/app/executive',
    channel: '#exec-council',
  },
  {
    id: 'team_pnq_maintenance',
    landingKey: 'workOrders',
    name: 'Pune Maintenance',
    type: 'maintenance',
    leadId: 'usr_tec_1',
    landing: '/app/work-orders',
    channel: '#pnq-maintenance',
  },
  {
    id: 'team_analytics',
    landingKey: 'reports',
    name: 'Analytics Guild',
    type: 'analytics',
    leadId: 'usr_ana_1',
    landing: '/app/reports',
    channel: '#analytics-guild',
  },
]

const nodeById = new Map(HIERARCHY_NODES.map((node) => [node.id, node]))

export const membersOf = (teamId) =>
  PEOPLE_DIRECTORY.filter((person) => person.teamId === teamId).map(composePerson)

/** One team, with everything its membership implies. */
export function composeTeam(team) {
  const members = membersOf(team.id)
  const lead = members.find((person) => person.id === team.leadId) ?? null
  const siteIds = [...new Set(members.map((person) => person.siteId).filter(Boolean))]

  return {
    id: team.id,
    name: team.name,
    type: team.type,
    channel: team.channel,
    landing: team.landing,
    landingKey: team.landingKey,
    /* The lead has to be IN the team. The design lets a team name a lead who is
       not a member and nothing notices; here a lead who has left the team is
       null and the row says the team has none, which is the true and actionable
       statement. */
    leadId: lead?.id ?? null,
    leadName: lead?.name ?? null,
    memberCount: members.length,
    memberIds: members.map((person) => person.id),
    siteIds,
    siteNames: siteIds.map((id) => nodeById.get(id)?.name).filter(Boolean),
    /* Enterprise when somebody in it has no plant of their own. */
    scope: members.some((person) => person.siteId === null)
      ? 'enterprise'
      : siteIds.length > 1
        ? 'multiSite'
        : 'site',
    status: members.some((person) => person.status === 'active') ? 'active' : 'dormant',
  }
}

export const allTeams = () => TEAMS.map(composeTeam)

export const teamById = (id) => TEAMS.find((team) => team.id === id) ?? null

export function teamStats(rows) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'active').length,
    dormant: rows.filter((row) => row.status === 'dormant').length,
    enterprise: rows.filter((row) => row.scope === 'enterprise').length,
  }
}
