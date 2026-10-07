import { HIERARCHY_NODES } from './hierarchy'

/**
 * Data Fusion — the document and media registry.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 * See `DEMO-MODE.md` §8.10.
 *
 * ── Landed with the Overview, ahead of the screens that render it ─────────
 * Data Overview counts documents and media on two of its five cards. Building
 * that screen before these collections existed would have meant authoring two
 * numbers, and then making the Documents and Media screens match them three
 * passes later. So the records land first and the counts are counts.
 *
 * What is deliberately NOT here yet is the inheritance resolver. It belongs with
 * the screen that draws the inheritance path, which is pass 4 — a function
 * nothing calls is a function nothing checks.
 *
 * ── Four levels of scope, not the prototype's six ─────────────────────────
 * `fusion-store.jsx` inherits a document down asset → model → site → line →
 * component → sensor → enterprise. Two of those cannot be honestly reproduced
 * here:
 *
 *   - MODEL is `/v1/asset-classes`, a LIVE resource. Binding a fixture link to a
 *     record the API owns means a document pointing at a class somebody deleted
 *     this morning.
 *   - COMPONENT and SENSOR ids in this codebase are unique within their asset,
 *     not globally — `VIBX` exists on several machines — so `{k:'sensor', id}`
 *     has no single referent.
 *
 * What is left is the estate's own graph: enterprise → site → line → asset. That
 * is a real hierarchy with real inheritance, and every link resolves to a node
 * `verify:mocks` can find. The idea the design is worth copying for survives
 * intact; it is the depth that is ours rather than the prototype's.
 */

/**
 * The eight document types, with the extension each is normally filed as.
 *
 * `tone` is a hue name and not a hex — the prototype carries `col:"#EF4444"` on
 * every one of these, which is exactly the literal the Single-Palette Rule
 * exists to keep out of the codebase.
 */
export const DOC_TYPES = [
  { id: 'manual', ext: 'PDF', tone: 'red', icon: 'doc' },
  { id: 'sop', ext: 'DOC', tone: 'forge', icon: 'doc' },
  { id: 'drawing', ext: 'DWG', tone: 'green', icon: 'layers' },
  { id: 'datasheet', ext: 'PDF', tone: 'violet', icon: 'doc' },
  { id: 'certificate', ext: 'PDF', tone: 'amber', icon: 'shield' },
  { id: 'policy', ext: 'PDF', tone: null, icon: 'shield' },
  { id: 'report', ext: 'PDF', tone: 'watch', icon: 'chart' },
  { id: 'layout', ext: 'DWG', tone: 'green', icon: 'map' },
]

export const MEDIA_TYPES = [
  { id: 'photo', tone: 'forge', icon: 'eye' },
  { id: 'model3d', tone: 'violet', icon: 'layers' },
  { id: 'thermal', tone: 'amber', icon: 'bolt' },
  { id: 'video', tone: 'watch', icon: 'eye' },
]

/**
 * Scope levels, shallowest last — the order the inheritance path reads in.
 *
 * `unplaced` is not a level of the ladder and is deliberately first: it means
 * nobody has decided where the record goes yet. That is a different fact from
 * enterprise-wide, which is a decision — and the two look identical from the
 * links alone, since both have none. One authored bit, `pending`, separates
 * them, and it is the only thing about a record's placement that is authored.
 */
export const DOC_SCOPES = ['unplaced', 'instance', 'line', 'site', 'enterprise']

/**
 * The twelve documents.
 *
 * `scope` is not a second fact beside `links` — it is the SHALLOWEST tier any
 * link points at, and `verify:mocks` asserts the two agree. Writing both and
 * hoping is how a document ends up marked enterprise-wide while pointing at one
 * bodymaker.
 *
 * `sizeKb` and `pages` are numbers rather than the prototype's "8.4 MB" strings,
 * so they can be summed, sorted and formatted in the reader's locale.
 */
export const FUSION_DOCS = [
  {
    id: 'DOC-1001',
    name: 'Stolle BM-90 Service Manual',
    type: 'manual',
    links: [{ k: 'asset', id: 'FDY-BM-03' }, { k: 'asset', id: 'FDY-BM-07' }],
    rev: 'Rev C',
    sizeKb: 8602,
    pages: 412,
    owner: 'Ines Brandt',
    date: '2024-08-01',
    tags: ['bearing', 'service', '§7.3'],
    lang: 'en',
    source: 'sharePoint',
    verified: true,
  },
  {
    id: 'DOC-1002',
    name: 'Howden WRVi 321L Compressor Manual',
    type: 'manual',
    links: [{ k: 'asset', id: 'FDY-CMP-12' }],
    rev: 'Rev B',
    sizeKb: 6246,
    pages: 288,
    owner: 'Ines Brandt',
    date: '2023-11-14',
    tags: ['compressor', 'screw'],
    lang: 'en',
    source: 'vendorPortal',
    verified: true,
  },
  {
    id: 'DOC-1003',
    name: 'SOP-VIB-04 · Vibration Response',
    type: 'sop',
    links: [{ k: 'site', id: 'site_findlay' }],
    rev: 'v2.1',
    sizeKb: 420,
    pages: 9,
    owner: 'Dana Okafor',
    date: '2026-02-11',
    tags: ['vibration', 'triage'],
    lang: 'en',
    source: 'upload',
    verified: true,
  },
  {
    id: 'DOC-1004',
    name: 'FDY-L1 Coolant Loop P&ID',
    type: 'drawing',
    links: [{ k: 'line', id: 'line_fdy_1' }],
    rev: 'Rev C',
    sizeKb: 2252,
    pages: 12,
    owner: 'Ines Brandt',
    date: '2026-05-12',
    tags: ['p&id', 'coolant'],
    lang: 'en',
    source: 'cadVault',
    verified: true,
  },
  {
    id: 'DOC-1005',
    name: 'FDY-L2 Bodymaker P&ID',
    type: 'drawing',
    links: [{ k: 'line', id: 'line_fdy_2' }],
    rev: 'Rev A',
    sizeKb: 1946,
    pages: 8,
    owner: 'Ines Brandt',
    date: '2026-04-02',
    tags: ['p&id', 'bodymaker'],
    lang: 'en',
    source: 'cadVault',
    // The one unverified document in the set. The Documents screen filters on
    // this and the Overview counts it, so it has to be somebody's real state
    // rather than a flag every record happens to share.
    verified: false,
  },
  {
    id: 'DOC-1006',
    name: 'Bearing 6205-2RS Datasheet',
    type: 'datasheet',
    links: [{ k: 'asset', id: 'FDY-BM-03' }, { k: 'asset', id: 'FDY-CMP-12' }],
    rev: 'v1.0',
    sizeKb: 310,
    pages: 4,
    owner: 'Karan Patel',
    date: '2023-06-20',
    tags: ['bearing', 'spare'],
    lang: 'en',
    source: 'vendorPortal',
    verified: true,
  },
  {
    id: 'DOC-1007',
    name: 'FDY-BM-03 Commissioning Report',
    type: 'report',
    links: [{ k: 'asset', id: 'FDY-BM-03' }],
    rev: 'final',
    sizeKb: 1126,
    pages: 24,
    owner: 'Dana Okafor',
    date: '2019-07-18',
    tags: ['commissioning'],
    lang: 'en',
    source: 'upload',
    verified: true,
  },
  {
    id: 'DOC-1008',
    name: 'VIB-204 Calibration Certificate',
    type: 'certificate',
    links: [{ k: 'asset', id: 'FDY-BM-03' }],
    rev: '2026-01',
    sizeKb: 180,
    pages: 2,
    owner: 'Karan Patel',
    date: '2026-01-22',
    tags: ['calibration', 'iso'],
    lang: 'en',
    source: 'upload',
    verified: true,
    // The only document that expires. Drives the Overview's attention list —
    // and it is a real date rather than a flag, so "expiring soon" is arithmetic.
    expires: '2027-01-22',
  },
  {
    id: 'DOC-1009',
    name: 'HSE Lockout/Tagout Policy',
    type: 'policy',
    links: [],
    rev: 'v4.0',
    sizeKb: 640,
    pages: 18,
    owner: 'Ines Brandt',
    date: '2025-09-30',
    tags: ['loto', 'safety'],
    lang: 'en',
    source: 'sharePoint',
    verified: true,
  },
  {
    id: 'DOC-1010',
    name: 'Findlay Floor Plan — Building A',
    type: 'layout',
    links: [{ k: 'site', id: 'site_findlay' }],
    rev: 'Rev 7',
    sizeKb: 3482,
    pages: 3,
    owner: 'Dana Okafor',
    date: '2026-02-02',
    tags: ['layout', 'bay1-4'],
    lang: 'en',
    source: 'cadVault',
    verified: true,
  },
  {
    id: 'DOC-1011',
    name: 'ABB M3BP Motor Manual',
    type: 'manual',
    links: [{ k: 'asset', id: 'FDY-BM-03' }, { k: 'asset', id: 'WTM-PRS-04' }],
    rev: 'Rev 2.4',
    sizeKb: 3891,
    pages: 156,
    owner: 'Ines Brandt',
    date: '2024-03-05',
    tags: ['motor', 'winding'],
    lang: 'en',
    source: 'vendorPortal',
    verified: true,
  },
  {
    id: 'DOC-1012',
    name: 'Coolant 247-X Safety Data Sheet',
    type: 'policy',
    links: [],
    rev: 'v2.0',
    sizeKb: 297,
    pages: 24,
    owner: 'Ines Brandt',
    date: '2026-01-08',
    tags: ['msds', 'hazcom'],
    lang: 'en',
    source: 'sharePoint',
    verified: true,
  },
]

/* ── Arrived, not yet placed ──────────────────────────────────────────────
   Three documents the S3 document-backup sync pulled in. They are real records
   in the register — they count, they are searchable, they have owners — and
   nobody has said what they are about. That is the queue Contextualisation
   exists to clear, and it has to be populated by something that plausibly
   produced it rather than by a screen's need for rows.

   `src_s3_docs` in `fusion.js` is that something: it declares 840 objects under
   `s3://meridian-plant-docs`, and these are three of them. The filenames are
   what a plant's file share actually looks like, which is the point — two carry
   an asset code somebody can match on and one does not. */
const UNPLACED_DOCS = [
  {
    id: 'DOC-1013',
    name: 'FDY-CMP-12 Seal Replacement Procedure.pdf',
    type: 'sop',
    links: [],
    pending: true,
    rev: 'v1.2',
    sizeKb: 486,
    pages: 11,
    owner: 'Karan Patel',
    date: '2026-07-28',
    tags: ['seal', 'procedure'],
    lang: 'en',
    source: 'cloudStore',
    verified: false,
  },
  {
    id: 'DOC-1014',
    name: 'Bodymaker BM-07 Tooling Setup.docx',
    type: 'sop',
    links: [],
    pending: true,
    rev: 'v3.0',
    sizeKb: 232,
    pages: 6,
    owner: 'Ines Brandt',
    date: '2026-08-03',
    tags: ['tooling', 'setup'],
    lang: 'en',
    source: 'cloudStore',
    verified: false,
  },
  {
    id: 'DOC-1015',
    name: 'Scanned drawing 2019-114.pdf',
    type: 'drawing',
    links: [],
    pending: true,
    rev: '—',
    sizeKb: 1740,
    pages: 2,
    owner: 'Dana Okafor',
    date: '2026-08-11',
    tags: [],
    lang: 'en',
    source: 'cloudStore',
    verified: false,
  },
]

FUSION_DOCS.push(...UNPLACED_DOCS)

/** The four media records. */
export const FUSION_MEDIA = [
  {
    id: 'MED-201',
    name: 'FDY-BM-03 Drive End',
    type: 'photo',
    links: [{ k: 'asset', id: 'FDY-BM-03' }],
    sizeKb: 2150,
    date: '2026-06-02',
    owner: 'Karan Patel',
    tags: ['inspection'],
  },
  {
    id: 'MED-202',
    name: 'Bodymaker BM-90 · 3D Assembly',
    type: 'model3d',
    links: [{ k: 'asset', id: 'FDY-BM-03' }, { k: 'asset', id: 'FDY-BM-07' }],
    sizeKb: 49_152,
    date: '2025-09-14',
    owner: 'Ines Brandt',
    tags: ['cad', 'glb'],
  },
  {
    id: 'MED-203',
    name: 'FDY-CMP-12 Bearing Housing · Thermal',
    type: 'thermal',
    links: [{ k: 'asset', id: 'FDY-CMP-12' }],
    sizeKb: 860,
    date: '2026-06-09',
    owner: 'Karan Patel',
    tags: ['thermal', 'hotspot'],
  },
  {
    id: 'MED-204',
    name: 'Findlay Line 2 Walkthrough',
    type: 'video',
    links: [{ k: 'line', id: 'line_fdy_2' }],
    sizeKb: 126_976,
    date: '2026-03-22',
    owner: 'Arjun Mehta',
    tags: ['training'],
  },
]

/* One media record from the same S3 sync. A phone photograph filed under its
   camera's own name, which is exactly the object that needs a human to say what
   it is of. */
FUSION_MEDIA.push({
  id: 'MED-205',
  name: 'IMG_4471.jpg',
  type: 'photo',
  links: [],
  pending: true,
  sizeKb: 3180,
  date: '2026-08-09',
  owner: 'Karan Patel',
  tags: [],
})

/* ── Derivations ──────────────────────────────────────────────────────── */

/**
 * The estate, indexed — rebuilt when it grows.
 *
 * A `new Map(...)` taken once at module load is a snapshot, and this estate is
 * not static: the bulk-import route appends assets to `HIERARCHY_NODES` at
 * runtime. An imported machine was invisible to the resolver, so the
 * enterprise-wide LOTO policy reached eighteen of nineteen assets and the
 * nineteenth showed an empty Documents tab. Caught by a check, not by eye.
 */
let indexed = { at: 0, map: new Map() }
function nodeIndex() {
  if (indexed.at !== HIERARCHY_NODES.length) {
    indexed = {
      at: HIERARCHY_NODES.length,
      map: new Map(HIERARCHY_NODES.map((node) => [node.id, node])),
    }
  }
  return indexed.map
}

const nodeById = { get: (id) => nodeIndex().get(id) }

/** Tier order, shallowest first, for resolving a record's scope from its links. */
const SCOPE_OF_TIER = { asset: 'instance', line: 'line', site: 'site' }
const SCOPE_DEPTH = { enterprise: 0, site: 1, line: 2, instance: 3 }

/**
 * How widely a record applies — read from its links, never authored beside them.
 *
 * The shallowest link wins: a manual pointing at two bodymakers is still an
 * instance document, and one pointing at a site applies to everything under it.
 * No links at all means enterprise, which is the only case where the absence of
 * a target is itself the statement.
 */
export function scopeOf(record) {
  if (record.pending && !(record.links ?? []).length) return 'unplaced'
  const scopes = (record.links ?? [])
    .map((link) => SCOPE_OF_TIER[nodeById.get(link.id)?.tier] ?? null)
    .filter(Boolean)
  if (!scopes.length) return 'enterprise'
  return scopes.reduce((widest, scope) =>
    SCOPE_DEPTH[scope] < SCOPE_DEPTH[widest] ? scope : widest,
  )
}

/** A link, resolved to the node it names. `null` for a target that has gone. */
export const linkTarget = (link) => nodeById.get(link.id) ?? null

/** Every site a record reaches, walking each link up to its site. */
export function sitesOfRecord(record) {
  const sites = new Set()
  for (const link of record.links ?? []) {
    let node = nodeById.get(link.id)
    while (node && node.tier !== 'site') node = nodeById.get(node.parentId)
    if (node) sites.add(node.id)
  }
  return [...sites]
}

/** Wire shape for a document. */
export function composeDoc(doc, now = Date.now()) {
  const type = DOC_TYPES.find((entry) => entry.id === doc.type) ?? null
  const expiresInDays = doc.expires
    ? Math.round((new Date(doc.expires).getTime() - now) / 86_400_000)
    : null

  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    ext: type?.ext ?? 'PDF',
    tone: type?.tone ?? null,
    icon: type?.icon ?? 'doc',
    scope: scopeOf(doc),
    links: (doc.links ?? []).map((link) => {
      const node = linkTarget(link)
      return { kind: link.k, id: link.id, name: node?.name ?? null, code: node?.code ?? null }
    }),
    siteIds: sitesOfRecord(doc),
    rev: doc.rev,
    sizeKb: doc.sizeKb ?? null,
    pages: doc.pages ?? null,
    owner: doc.owner,
    date: doc.date,
    tags: doc.tags ?? [],
    lang: doc.lang,
    source: doc.source,
    verified: Boolean(doc.verified),
    uploaded: Boolean(doc.uploaded),
    pending: Boolean(doc.pending),
    expires: doc.expires ?? null,
    expiresInDays,
  }
}

/** Wire shape for a media record. */
export function composeMedia(item) {
  const type = MEDIA_TYPES.find((entry) => entry.id === item.type) ?? null
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    tone: type?.tone ?? null,
    icon: type?.icon ?? 'eye',
    scope: scopeOf(item),
    links: (item.links ?? []).map((link) => {
      const node = linkTarget(link)
      return { kind: link.k, id: link.id, name: node?.name ?? null, code: node?.code ?? null }
    }),
    siteIds: sitesOfRecord(item),
    sizeKb: item.sizeKb ?? null,
    date: item.date,
    owner: item.owner,
    tags: item.tags ?? [],
    uploaded: Boolean(item.uploaded),
    pending: Boolean(item.pending),
  }
}

/**
 * Everything a link can point at, grouped by tier.
 *
 * Served to the upload wizard rather than imported by it, so the picker cannot
 * offer a machine the estate does not have — and so it grows on its own when
 * somebody adds a line. The prototype's `FUSION_TARGETS` is a hand-written
 * parallel list of four sites and six assets, none of which are this estate's.
 */
export function linkTargets() {
  const label = (node) => ({ id: node.id, name: node.name, code: node.code })
  return {
    site: HIERARCHY_NODES.filter((node) => node.tier === 'site').map(label),
    line: HIERARCHY_NODES.filter((node) => node.tier === 'line').map(label),
    asset: HIERARCHY_NODES.filter((node) => node.tier === 'asset').map(label),
  }
}

/**
 * Add an uploaded document to the register.
 *
 * Module state, like the tasks and handovers fixtures: an upload has to survive
 * a navigation or the wizard behind it is a form that throws its own result
 * away. Resets on reload, which is the right lifetime for a demo.
 *
 * `verified` is false and is NOT a parameter. A document is verified when
 * somebody has checked the revision, and the person who just uploaded it has by
 * definition not done that yet — letting the upload assert it would make the
 * flag mean "somebody typed this" rather than "somebody checked this".
 */
export function addFusionDoc(payload) {
  const next = `DOC-${1013 + FUSION_DOCS.filter((doc) => doc.uploaded).length}`
  const record = {
    id: next,
    name: payload.name,
    type: payload.type,
    links: payload.links ?? [],
    rev: payload.rev || 'v1.0',
    /* The design's wizard sends a fixed "1.2 MB / 12 pages" for every upload.
       Nothing here knows a file's real size — no file is stored — so these are
       null, and the register prints an em dash rather than the same invented
       figure on every row somebody adds. */
    sizeKb: null,
    pages: null,
    owner: payload.owner,
    date: payload.date,
    tags: payload.tags ?? [],
    lang: payload.lang || 'en',
    source: 'upload',
    verified: false,
    expires: payload.expires || undefined,
    // Recorded rather than acted on: there is no OCR behind this build. It is
    // what the uploader asked for, and it survives to whatever lands later.
    ocrRequested: Boolean(payload.ocr),
    uploaded: true,
  }
  FUSION_DOCS.unshift(record)
  return record
}

/**
 * Add an uploaded media record.
 *
 * Same shape of honesty as `addFusionDoc`: no file is stored, so `sizeKb` is
 * null rather than the design's fixed "2.4 MB" on every upload, and the card
 * prints the date alone.
 */
export function addFusionMedia(payload) {
  const record = {
    id: `MED-${205 + FUSION_MEDIA.filter((item) => item.uploaded).length}`,
    name: payload.name,
    type: payload.type,
    links: payload.links ?? [],
    sizeKb: null,
    date: payload.date,
    owner: payload.owner,
    tags: payload.tags ?? [],
    uploaded: true,
  }
  FUSION_MEDIA.unshift(record)
  return record
}

/* ── Inheritance ──────────────────────────────────────────────────────────
   The idea from the design worth keeping: a document is visible on an asset if
   it is attached to that asset OR to anything above it in the estate. One
   upload of a site SOP appears on every machine at that site, and the asset's
   own Documents tab says which level it arrived from rather than implying
   somebody attached it there.

   This is also the function that ends a duplicate. `assetDocuments()` in
   `lines.js` used to author six documents per asset with a hand-written `via`
   field, reusing ids — D-1009, D-1012 — that this registry also carries, with
   different names and different owners. Two lists of one collection, and no way
   for the disagreement to surface. That function now calls this one. */

/** The chain from an asset up to the enterprise: [asset, line, site]. */
function ancestryOf(assetId) {
  const chain = []
  let node = nodeById.get(assetId)
  while (node) {
    chain.push(node)
    node = nodeById.get(node.parentId)
  }
  return chain
}

/** Tier → the word the asset's Documents tab prints in its "Applies via" column. */
const VIA_OF_TIER = { asset: 'asset', line: 'line', site: 'site' }

/**
 * Every document visible on one asset, each carrying WHY.
 *
 * `via` is the closest level that put it there, which is the useful reading: a
 * document attached both to this machine and to its line belongs to the machine,
 * and saying "line" would send somebody looking in the wrong place.
 *
 * An enterprise document — one with no links at all — reaches every asset. That
 * is the only case where the absence of a target is itself the statement.
 */
export function resolveDocsForAsset(assetId, now = Date.now()) {
  const chain = ancestryOf(assetId)
  if (!chain.length) return []
  const rank = new Map(chain.map((node, index) => [node.id, index]))

  return FUSION_DOCS.map((doc) => {
    if (!(doc.links ?? []).length) return { doc, via: 'enterprise', distance: 99 }

    const hit = (doc.links ?? [])
      .filter((link) => rank.has(link.id))
      .map((link) => ({ via: VIA_OF_TIER[nodeById.get(link.id).tier], at: rank.get(link.id) }))
      .sort((a, b) => a.at - b.at)[0]

    return hit ? { doc, via: hit.via, distance: hit.at } : null
  })
    .filter(Boolean)
    /* Nearest first. The machine's own certificate above the enterprise LOTO
       policy — a register sorted by how specific it is answers "what applies
       here" before "what applies everywhere". */
    .sort((a, b) => a.distance - b.distance || a.doc.name.localeCompare(b.doc.name))
    .map(({ doc, via }) => ({ ...composeDoc(doc, now), via }))
}

/** The other direction: which assets a document reaches. Used by its own drawer. */
export function assetsReachedBy(docId) {
  return HIERARCHY_NODES.filter((node) => node.tier === 'asset')
    .filter((node) => resolveDocsForAsset(node.id).some((doc) => doc.id === docId))
    .map((node) => ({ id: node.id, name: node.name, code: node.code }))
}

/** Every media record visible on one asset, by the same rule. */
export function resolveMediaForAsset(assetId) {
  const chain = ancestryOf(assetId)
  const ids = new Set(chain.map((node) => node.id))
  return FUSION_MEDIA.filter((item) => (item.links ?? []).some((link) => ids.has(link.id))).map(
    composeMedia,
  )
}

/** Counts the Overview needs, all of them counts of something in this file. */
export function knowledgeStats(now = Date.now()) {
  const docs = FUSION_DOCS.map((doc) => composeDoc(doc, now))
  return {
    documents: docs.length,
    // A record nobody has placed is not "unverified" in the sense this card
    // means — that is a sign-off on a revision, and these have not got as far as
    // having somebody look at them. They are counted by the queue instead.
    unverified: docs.filter((doc) => !doc.verified && !doc.pending).length,
    unplaced: docs.filter((doc) => doc.pending && !doc.links.length).length,
    expiringSoon: docs.filter((doc) => doc.expiresInDays != null && doc.expiresInDays <= 180).length,
    // Uploads carry no page count — nothing knows one — so they contribute
    // nothing rather than turning the total into NaN.
    pages: docs.reduce((sum, doc) => sum + (doc.pages ?? 0), 0),
    media: FUSION_MEDIA.length,
    mediaKb: FUSION_MEDIA.reduce((sum, item) => sum + (item.sizeKb ?? 0), 0),
    /* CAD alone, not all media. The Overview card says "MB CAD indexed", and a
       124 MB training video is the largest thing in this registry — counting it
       there would make the sentence false by a factor of three while looking
       more impressive, which is the exact trade this codebase does not make. */
    cadKb: FUSION_MEDIA.filter((item) => item.type === 'model3d').reduce(
      (sum, item) => sum + (item.sizeKb ?? 0),
      0,
    ),
  }
}
