import { buildScopes, buildTree, descendantsOf, sitesOf } from './hierarchy'
import { SELF_ID, composePerson, personById } from './people'

/**
 * The demo universe: Meridian Industrial.
 *
 * ALL FIGURES IN THIS DIRECTORY ARE SYNTHETIC. They are authored to be
 * plausible and internally consistent so the product can be understood, and
 * they must never be presented as measured. Real API responses replace them
 * wholesale.
 *
 * Three sites in three countries, which is the point: it is the only shape
 * that makes the site-owned-units rule visible. Findlay reads in inches per
 * second and °F because Ohio does; Weißenthurm reads in mm/s and °C because
 * the Rhineland does. Neither changes because of who is logged in.
 */

export const ORG = {
  id: 'org_meridian',
  name: 'Meridian Industrial',
  plan: 'professional',
  /** Language the assistant writes in. English today; the parameter is real. */
  aiOutputLocale: 'en',
}

/**
 * Sites, derived from the hierarchy node list rather than duplicated here.
 *
 * They used to be a second array, which meant adding a site in Settings left
 * this list stale — two sources of truth for the same thing. The hierarchy is
 * now the only place a site is defined, and `units` travels with it because
 * engineering units are site configuration.
 */
export function currentSites() {
  return sitesOf().map((site) => ({
    ...site,
    lines: descendantsOf(site.id).filter((n) => n.tier === 'line').length,
    assets: descendantsOf(site.id).filter((n) => n.tier === 'asset').length,
    sensors: SENSOR_COUNTS[site.id] ?? 0,
  }))
}

/** Authored per site; a real deployment counts live tags from the historian. */
const SENSOR_COUNTS = {
  site_findlay: 1180,
  site_weissenthurm: 860,
  site_pune: 520,
}

export const siteById = (id) => currentSites().find((s) => s.id === id)

/** The nested tree, derived at call time so Settings edits are reflected. */
export const HIERARCHY = buildTree()

/** Flat list for the scope selector, with the depth each entry sits at. */
export const SCOPES = buildScopes()

/**
 * Demo personas. The role switcher changes the AI briefing only — RBAC later.
 *
 * A view over `people.js`, not a list of its own. These four used to be authored
 * here and six more were authored in `home.js`, disagreeing about the four they
 * shared; the registry is now single and this is the named-persona lookup onto
 * it. `site` keeps its old spelling because callers read it.
 */
const persona = (id) => {
  const person = composePerson(personById(id))
  return { ...person, site: person.siteId }
}

export const PEOPLE = {
  operator: persona('usr_ops_1'),
  manager: persona('usr_mgr_1'),
  reliability: persona('usr_rel_1'),
  exec: persona('usr_exe_1'),
}

export const CURRENT_USER = persona(SELF_ID)
