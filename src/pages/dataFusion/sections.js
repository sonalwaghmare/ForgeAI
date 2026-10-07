/**
 * The Data Fusion information architecture — eleven sections in five groups,
 * carried across from the design prototype.
 *
 * The grouping is the right shape and worth keeping: sources are grouped by what
 * they *are* — a live signal feed, a system of record, a document store — and
 * the fusion work that runs on top of them is grouped separately. A flat list of
 * eleven would make an OPC-UA gateway and a knowledge graph look like the same
 * kind of thing.
 *
 * `built: false` sections are honest placeholders that name what they will hold.
 * Showing the real IA matters here more than anywhere else in the product —
 * this module is the answer to "what can Forge AI actually ingest" — and a
 * section that says what is coming beats a screen of plausible-looking source
 * rows nobody can trust.
 */
import { config } from '@/services/config'

export const FUSION_GROUPS = [
  {
    id: 'overview',
    sections: [{ id: 'overview', icon: 'chart', built: false, demoBuilt: true }],
  },
  {
    id: 'liveData',
    sections: [
      { id: 'ot', icon: 'gauge', built: false, demoBuilt: true },
      { id: 'iot', icon: 'bolt', built: true },
      { id: 'vision', icon: 'eye', built: false, demoBuilt: true },
    ],
  },
  {
    id: 'systems',
    sections: [
      { id: 'business', icon: 'wrench', built: false, demoBuilt: true },
      { id: 'stores', icon: 'layers', built: false, demoBuilt: true },
    ],
  },
  {
    id: 'knowledge',
    sections: [
      { id: 'documents', icon: 'doc', built: false, demoBuilt: true },
      { id: 'media', icon: 'eye', built: false, demoBuilt: true },
    ],
  },
  {
    id: 'fusion',
    sections: [
      { id: 'context', icon: 'search', built: false, demoBuilt: true },
      { id: 'graph', icon: 'ai', built: false, demoBuilt: true },
      { id: 'pipelines', icon: 'plug', built: false, demoBuilt: true },
    ],
  },
]

export const ALL_FUSION_SECTIONS = FUSION_GROUPS.flatMap((group) => group.sections)

/**
 * Whether a section has a screen behind it right now.
 *
 * The same three-state arrangement `shell/navigation.js` uses, and resolved in
 * one place for the same reason: a section cannot end up registered as a route
 * while the rail still sends it to the "not built yet" panel.
 */
export const isSectionBuilt = (section) =>
  Boolean(section.built || (config.demoMode && section.demoBuilt))

export const fusionPath = (sectionId) => `/app/data-fusion/${sectionId}`

/**
 * One connection and its sensors, nested under the `iot` section rather than
 * beside it.
 *
 * Nesting keeps "IoT & Sensors" lit in the section rail while you are inside one
 * source — a twelfth top-level section would have claimed that sensors are a source
 * family, when they are what a source family contains.
 */
export const connectionPath = (connectionId) => `${fusionPath('iot')}/${connectionId}`

/**
 * Onboarding and editing are screens, not dialogs.
 *
 * The form carries eight fields, three of them generated, plus a three-level
 * cascade — more than a dialog's 60vh body can hold without scrolling, and a form
 * you have to scroll to see the end of is one you cannot check before saving. On a
 * route it also gets a URL, a back target, and browser history.
 */
export const newSensorPath = (connectionId) => `${connectionPath(connectionId)}/sensors/new`
export const sensorPath = (connectionId, sensorId) =>
  `${connectionPath(connectionId)}/sensors/${sensorId}`
