import { post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { toCsv } from '@/lib/csv'

/**
 * Bulk people import — the schema half.
 *
 * DEMO, but real: the wizard parses a dropped CSV with the shared reader in
 * `lib/csv.js`, matches its columns, validates every row against the roles and
 * sites that exist, and the last step creates the accounts. They appear in the
 * table, in the task assignee picker if their role does plant work, and in the
 * import history.
 *
 * The prototype simulates all five steps: it reports 47 valid rows and 1 error
 * whatever you drop, including nothing.
 *
 * The PARSER is shared with the asset import; the schema is not, and should not
 * be — an asset has a line and a criticality, a person has a role and a second
 * factor, and one validator that knew about both would know about neither.
 */

/** What a person record needs, and what is optional. */
export const PEOPLE_IMPORT_FIELDS = [
  { key: 'name', required: true },
  { key: 'email', required: true },
  { key: 'role', required: true },
  { key: 'site', required: false },
  { key: 'team', required: false },
  { key: 'mfa', required: false },
]

const ALIASES = {
  name: ['name', 'fullname', 'person', 'employee'],
  email: ['email', 'mail', 'address', 'upn'],
  role: ['role', 'permission', 'access', 'profile'],
  site: ['site', 'plant', 'location', 'facility'],
  team: ['team', 'group', 'department', 'dept'],
  mfa: ['mfa', '2fa', 'twofactor', 'secondfactor'],
}

const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Guess which source column feeds each field. Same approach as the asset import. */
export function autoMapPeople(columns) {
  const mapping = {}
  const taken = new Set()
  for (const field of PEOPLE_IMPORT_FIELDS) {
    const match = columns.find((column) => {
      if (taken.has(column)) return false
      const key = normalise(column)
      return ALIASES[field.key].some((alias) => key.includes(alias))
    })
    if (match) {
      mapping[field.key] = match
      taken.add(match)
    } else mapping[field.key] = null
  }
  return mapping
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TRUTHY = ['yes', 'true', '1', 'on', 'enabled']

/**
 * Validate one mapped row against the platform that exists.
 *
 * Errors block the row, warnings do not, and the line between them is whether
 * the platform can store something true. A row with no email has no account to
 * be. A row naming a site this estate does not have still describes a person —
 * they land without one, and the warning says so.
 */
export function validatePersonRow(row, mapping, { roles, siteNames, teamNames, existingEmails }) {
  const value = (key) => (mapping[key] ? String(row[mapping[key]] ?? '').trim() : '')
  const issues = []

  for (const field of PEOPLE_IMPORT_FIELDS) {
    if (field.required && !value(field.key)) {
      issues.push({ field: field.key, level: 'error', key: 'missing' })
    }
  }

  const email = value('email')
  if (email && !EMAIL.test(email)) {
    issues.push({ field: 'email', level: 'error', key: 'email', value: email })
  } else if (email && existingEmails.includes(email.toLowerCase())) {
    issues.push({ field: 'email', level: 'warn', key: 'duplicate', value: email })
  }

  const role = value('role')
  if (role && !roles.includes(normalise(role))) {
    issues.push({ field: 'role', level: 'error', key: 'unknownRole', value: role })
  }

  const site = value('site')
  if (site && !siteNames.some((name) => normalise(name) === normalise(site))) {
    issues.push({ field: 'site', level: 'warn', key: 'unknownSite', value: site })
  }

  const team = value('team')
  if (team && !teamNames.some((name) => normalise(name) === normalise(team))) {
    issues.push({ field: 'team', level: 'warn', key: 'unknownTeam', value: team })
  }

  return issues
}

export function validatePeople(rows, mapping, context) {
  const validated = rows.map((row, index) => {
    const issues = validatePersonRow(row, mapping, context)
    return {
      index,
      row,
      issues,
      level: issues.some((issue) => issue.level === 'error')
        ? 'error'
        : issues.length
          ? 'warn'
          : 'ready',
    }
  })
  return {
    validated,
    ready: validated.filter((entry) => entry.level === 'ready').length,
    warnings: validated.filter((entry) => entry.level === 'warn').length,
    errors: validated.filter((entry) => entry.level === 'error').length,
  }
}

/** A validated, mapped row as the endpoint takes it. */
export function toPersonRecord(row, mapping) {
  const value = (key) => (mapping[key] ? String(row[mapping[key]] ?? '').trim() : '')
  return {
    name: value('name'),
    email: value('email').toLowerCase(),
    role: normalise(value('role')),
    site: value('site'),
    team: value('team'),
    mfa: TRUTHY.includes(value('mfa').toLowerCase()),
  }
}

export const importPeople = (body) => post(endpoints.people.import, body)

/**
 * The template, with two filled rows.
 *
 * Real people from this estate, so a reader sees the shape a value takes rather
 * than inferring it from a header — and a file downloaded here and dropped
 * straight back in validates clean except for the duplicate warning, which is
 * the fastest way to confirm the loop works end to end.
 */
export function peopleTemplateCsv() {
  return toCsv(
    PEOPLE_IMPORT_FIELDS.map((field) => field.key),
    [
      ['Ada Okonkwo', 'ada.okonkwo@meridian.example', 'maintenanceTechnician', 'Findlay Plant', 'Findlay Operations', 'yes'],
      ['Rui Tavares', 'rui.tavares@meridian.example', 'reliabilityEngineer', 'Pune Plant', '', 'no'],
    ],
  )
}
