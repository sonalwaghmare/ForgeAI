import { DATE_FORMAT_KEYS, TIME_FORMATS } from '@/lib/orgFormats'
import { ORG } from './enterprise'
import { HIERARCHY_NODES, sitesOf } from './hierarchy'
import { audit, auditLog } from './audit'
import { directory } from './directory'
import { ALL_FUSION_SOURCES, composeSource, resetSourcePauses } from './fusion'
import { resetFusionConfig } from './fusionProfiles'
import { resetFusionMapping } from './fusionMapping'
import { resetNotifications } from './notifications'
import { resetRoles } from './roles'
import { resetSecurity, securitySettings } from './security'

/**
 * Organisation settings — the General page.
 *
 * SYNTHETIC. Gated on `VITE_DEMO_MODE`. See `DEMO-MODE.md` §8.21.
 *
 * ── The identity here is the identity everywhere ──────────────────────────
 * `name` writes back to `ORG`, which the scope selector, the executive brief
 * and the assistant all read. Renaming the organisation on this page renames it
 * in the top bar, which is the only way a reader can tell the field did
 * anything. A settings screen that stores a name nowhere anything reads it is
 * the most common way a form appears to work.
 *
 * ── Measurement units are NOT an organisation setting here ────────────────
 * The design offers Metric/Imperial across the whole org. This product holds
 * units on the SITE, because Findlay reads 0.49 in/s and Weißenthurm reads
 * 12.5 mm/s and those are the same physical limit — `alerts.js` refuses to
 * convert between them and calls a single-unit display of the pair a safety
 * defect. An org-wide switch would either be ignored or would do the thing that
 * file exists to prevent. The control stays where the design puts it, disabled,
 * reading Per site, with the reason. §0.
 *
 * ── Session timeout is the Security page's setting, not a copy ────────────
 * The design puts it on both screens. Two controls over one value is how a
 * session ends up 1 hour on one page and 8 on the other, so this one reads and
 * writes `security.js`. The card says which page owns it.
 */

/* ── What this page owns ──────────────────────────────────────────────────
   `unitSystem` is absent on purpose — see above. `sessionTimeout` is absent for
   the same kind of reason: it exists, but somewhere else. */

const DEFAULTS = {
  /* Identity. `name` is not held here at all — it is `ORG.name`, and `valueOf`
     reads it from there so the two cannot drift. */
  displayName: 'Meridian',
  /**
   * The organisation's mark.
   *
   * `null` means the bundled default, which the page holds — a fixture has no
   * business importing an image asset, and a path written here would be a second
   * place for the file's location to be wrong. Anything else is a data URL from
   * the upload control.
   *
   * Session state like every other demo write, so a replacement is lost on
   * reload and the default returns. That is the same contract as every other
   * write in this directory rather than a special weakness of this one: there is
   * no object store behind this build, and the honest place to say so is the
   * hint under the control.
   */
  logo: null,
  industry: 'metalPackaging',
  tagline: 'Predictive intelligence for heavy industry',

  /* Regional. The default formatting for anything not stamped with a site's own
     zone; a shift at Findlay still prints in Findlay's. */
  timeZone: 'America/New_York',
  dateFormat: 'dmy',
  timeFormat: 'h24',
  language: 'en',

  /* Platform defaults. Both are real: the landing page is what `/app` resolves
     to, and saving a default site moves the scope selector to it. */
  landingPage: 'home',
  defaultSiteId: 'site_findlay',
  dataRetention: 'y1',
}

export const INDUSTRIES = [
  'metalPackaging',
  'automotive',
  'chemicals',
  'foodBeverage',
  'oilGas',
  'pharma',
  'pulpPaper',
  'steel',
]

export const DATA_RETENTION = ['m6', 'y1', 'y3', 'y7', 'forever']

/** The zones this estate actually operates in, plus UTC. Not a list of 400. */
export const timeZones = () => [
  ...new Set([...sitesOf().map((site) => site.timeZone).filter(Boolean), 'UTC']),
]

/** Session state, like every other demo write. */
const STATE = new Map()

const valueOf = (key) => {
  if (key === 'name') return ORG.name
  return STATE.has(key) ? STATE.get(key) : DEFAULTS[key]
}

const WRITABLE = new Set(['name', ...Object.keys(DEFAULTS)])

/**
 * Everything the page reads, in one payload.
 *
 * The options travel with it because none of them can be authored on the page:
 * the sites come from the hierarchy, the landing pages from the navigation rail,
 * and the session timeout from the Security page that owns it. The languages are
 * the one option the client owns — what strings shipped is not something this
 * layer can know — so the page reads them from the i18n build.
 */
export function orgSettings(navItems = [], now = Date.now()) {
  return {
    settings: {
      name: ORG.name,
      ...Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, valueOf(key)])),
    },
    options: {
      industries: INDUSTRIES,
      timeZones: timeZones(),
      dateFormats: DATE_FORMAT_KEYS,
      timeFormats: TIME_FORMATS,
      dataRetention: DATA_RETENTION,
      /* Only pages that exist. A default landing page pointing at a placeholder
         is a preference that strands whoever sets it. */
      landingPages: navItems.map((item) => ({ value: item.id, to: item.to })),
      sites: sitesOf().map((site) => ({ value: site.id, label: site.name })),
    },
    /* Read, never copied. The card prints it and links to the page that owns
       it, so the two screens cannot report different timeouts. */
    sessionTimeout: securitySettings('', now).settings.sessionTimeout,
    /* Every site's own units, so the disabled control can say what is actually
       in force rather than merely refusing. */
    siteUnits: sitesOf().map((site) => ({
      id: site.id,
      name: site.name,
      unitSystem: site.unitSystem,
    })),
  }
}

/** Change it. Only the fields this page owns, and the org name goes to `ORG`. */
export function saveOrgSettings(values = {}, now = Date.now()) {
  const changed = []

  for (const [key, value] of Object.entries(values)) {
    if (!WRITABLE.has(key)) continue
    if (valueOf(key) === value) continue
    if (key === 'name') {
      const clean = String(value).trim()
      if (!clean) continue
      ORG.name = clean
    } else {
      STATE.set(key, value)
    }
    changed.push(key)
  }

  if (changed.length) {
    audit('SETTINGS_CHANGED', { resource: 'settings:org', detail: { fields: changed.join(', ') } }, now)
  }
  return { changed }
}

/* ── The danger zone ──────────────────────────────────────────────────────
   Two of the three do something. The third refuses, in place. */

/**
 * Put every setting back.
 *
 * What it resets is named rather than implied: the settings modules that hold
 * session state. It deliberately does NOT reset the audit log — a log you can
 * clear from a settings page is not an audit log — and the reset itself is
 * written to it, which is the only way somebody looking later can tell it
 * happened.
 *
 * It does not touch accounts either. A person is not a setting, and "reset all
 * settings" quietly deactivating somebody would be the worst kind of surprise.
 */
export function resetAllSettings(now = Date.now()) {
  STATE.clear()
  ORG.name = ORIGINAL_NAME
  resetSecurity()
  resetRoles()
  resetNotifications()
  resetFusionConfig()
  resetFusionMapping()
  resetSourcePauses()

  audit('SETTINGS_RESET', { resource: 'settings:org' }, now)
  return { reset: RESET_SCOPE }
}

/** What the confirmation names, and what a check asserts it matches. */
export const RESET_SCOPE = [
  'organisation',
  'security',
  'roles',
  'notifications',
  'connections',
  'contextualisation',
]

const ORIGINAL_NAME = ORG.name

/**
 * Everything this account holds, as one document.
 *
 * Assembled from the fixtures rather than a snapshot written for the button, so
 * an export taken after a change contains the change. It carries what a person
 * asking for their data would mean by it — the organisation, its estate, its
 * people, its connections and the log — and it is honest about being synthetic,
 * because a file that leaves the product should not need this repository open
 * beside it to be understood.
 */
export function exportAll(now = Date.now()) {
  return {
    exportedAt: new Date(now).toISOString(),
    synthetic: true,
    note: 'Demo fixture data. Nothing in this file was measured.',
    /* Without the mark. A replaced logo is a base64 data URL running to tens of
       kilobytes, and an export is a document about the organisation rather than a
       carrier for its image bytes. */
    organisation: (({ logo: _logo, ...rest }) => ({ ...ORG, ...rest }))(
      orgSettings([], now).settings,
    ),
    sites: sitesOf().map((site) => ({
      id: site.id,
      name: site.name,
      timeZone: site.timeZone,
      unitSystem: site.unitSystem,
    })),
    hierarchy: HIERARCHY_NODES.map((node) => ({
      id: node.id,
      tier: node.tier,
      parentId: node.parentId ?? null,
      name: node.name,
    })),
    people: directory(now).map((person) => ({
      id: person.id,
      name: person.name,
      email: person.email,
      role: person.role,
      status: person.status,
    })),
    sources: ALL_FUSION_SOURCES().map((source) => {
      const row = composeSource(source, now)
      return { id: row.id, name: row.name, category: row.category, status: row.status }
    }),
    auditLog: auditLog(now),
  }
}

export function resetOrg() {
  STATE.clear()
  ORG.name = ORIGINAL_NAME
}
