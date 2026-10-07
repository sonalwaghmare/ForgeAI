/**
 * The people registry.
 *
 * SYNTHETIC, like everything in this directory.
 *
 * ── This file exists because there were already two of these ──────────────
 * `PEOPLE` in `enterprise.js` held four personas with a site and a role KEY.
 * `TASK_PEOPLE` in `home.js` held six with initials and a role written out in
 * English. They overlapped on four ids and disagreed about all of them: one said
 * `plantManager`, the other said "Plant Manager", and the second was a string in
 * a fixture that the briefing card printed straight to the screen in every
 * locale.
 *
 * Adding a Users screen would have made three. So the two became this: one row
 * per person, and both of the old exports are now views over it — the same move
 * `currentSites()` made when sites stopped being a second array beside the
 * hierarchy.
 *
 * ── What is authored here is only what nothing can derive ─────────────────
 * A name, a role, a home site, whether the account is enabled, whether it has a
 * second factor. Initials and an email address are computed from the name, and
 * when somebody was last active is computed from what they have actually done —
 * see `directory.js`. The design authors all five of those, and its `last: "2m
 * ago"` column is the kind of figure that is still saying "2m ago" tomorrow.
 */

/**
 * Everyone with an account.
 *
 * The first six are the people the rest of this demo already names — they own
 * tasks, work shifts, write logbook entries and sign handovers. The last three
 * have accounts and no activity, which is deliberate: an enabled account nobody
 * has ever used, an admin with no second factor and a locked technician are the
 * three rows a security review is looking for, and a directory that only
 * contains busy people never shows them.
 *
 * `role` is a key into `common:roles`. `siteId` is `null` for somebody whose
 * remit is the whole estate rather than a plant. `teamId` is the ONE authored
 * fact about team membership — a team's size, its sites and whether it is active
 * are all read off the people in it, so a team cannot report two members and
 * list three.
 */
export const PEOPLE_DIRECTORY = [
  { id: 'usr_mgr_1', name: 'Dana Okafor', role: 'plantManager', siteId: 'site_findlay', status: 'active', mfa: true, teamId: 'team_fdy_operations' },
  { id: 'usr_rel_1', name: 'Ines Brandt', role: 'reliabilityEngineer', siteId: 'site_weissenthurm', status: 'active', mfa: true, teamId: 'team_fdy_reliability' },
  { id: 'usr_ops_1', name: 'Arjun Mehta', role: 'lineOperator', siteId: 'site_pune', status: 'active', mfa: false, teamId: 'team_fdy_operations' },
  { id: 'usr_tec_1', name: 'Karan Patel', role: 'maintenanceTechnician', siteId: 'site_findlay', status: 'active', mfa: true, teamId: 'team_pnq_maintenance' },
  { id: 'usr_ops_2', name: 'Maya Reddy', role: 'shiftLead', siteId: 'site_findlay', status: 'active', mfa: true, teamId: 'team_fdy_reliability' },
  { id: 'usr_exe_1', name: 'James Whitfield', role: 'executive', siteId: null, status: 'active', mfa: true, teamId: 'team_exec' },
  { id: 'usr_adm_1', name: 'Priya Raghavan', role: 'platformAdmin', siteId: null, status: 'active', mfa: false, teamId: null },
  { id: 'usr_tec_2', name: 'Tomás Herrera', role: 'maintenanceTechnician', siteId: 'site_pune', status: 'locked', mfa: true, teamId: 'team_pnq_maintenance' },
  { id: 'usr_ana_1', name: 'Lena Fischer', role: 'readOnly', siteId: 'site_weissenthurm', status: 'inactive', mfa: false, teamId: 'team_analytics' },
]

/** The account signed in. Was `SELF` in `home.js` and `CURRENT_USER` in `enterprise.js`. */
export const SELF_ID = 'usr_mgr_1'

export const personById = (id) => PEOPLE_DIRECTORY.find((person) => person.id === id) ?? null

/**
 * `Dana Okafor` → `DO`.
 *
 * Computed rather than carried. An authored `initials` field is a second
 * spelling of the name, and the first thing that happens to one is somebody
 * correcting a typo in the name and leaving the avatar wrong.
 */
export const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

/**
 * `Dana Okafor` → `dana.okafor@meridian.example`.
 *
 * `.example` is reserved by RFC 2606 and can never be registered, which is the
 * only responsible domain for synthetic contact details. Diacritics are folded
 * because a mail system would fold them: `Tomás` addresses as `tomas`.
 */
export const emailOf = (name) =>
  `${name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.')}@meridian.example`

/** The shape every other fixture and screen reads a person in. */
export const composePerson = (person) => ({
  id: person.id,
  name: person.name,
  initials: initialsOf(person.name),
  email: emailOf(person.name),
  role: person.role,
  siteId: person.siteId,
  status: person.status,
  mfa: person.mfa,
  teamId: person.teamId ?? null,
})

export const ALL_PEOPLE = () => PEOPLE_DIRECTORY.map(composePerson)
