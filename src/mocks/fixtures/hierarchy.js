/**
 * The asset hierarchy, as a flat node list.
 *
 * Six tiers: enterprise › region › subRegion › site › line › asset.
 *
 * This diverges from strict ISA-95, deliberately and on instruction. ISA-95
 * names Enterprise / Site / Area / Work Centre / Work Unit, and an earlier
 * version of this fixture modelled Country, Area, Building and Floor as separate
 * levels. Nobody manages nine levels. The tiers below are the ones an
 * administrator actually creates and maintains, with **sub-region** absorbing
 * what was Country and Area. Building and Floor are gone from the tree; if they
 * return they belong as attributes of a site, not as levels people navigate.
 *
 * Flat rather than nested because the tree is editable. Nesting makes reads
 * pretty and every insert, move and delete a recursive walk; `parentId` makes
 * the mutation trivial and the tree a derived value.
 *
 * SYNTHETIC.
 */

/** Ordered. `TIERS[n + 1]` is what you may add beneath a `TIERS[n]`. */
export const TIERS = ['enterprise', 'region', 'subRegion', 'site', 'line', 'asset']

/** Hue ladder for the tier badges — enterprise violet down to asset neutral. */
export const TIER_TONE = {
  enterprise: 'violet',
  region: 'forge',
  subRegion: 'amber',
  site: 'green',
  line: 'ack',
  asset: null,
}

export const childTierOf = (tier) => TIERS[TIERS.indexOf(tier) + 1] ?? null
export const parentTierOf = (tier) => TIERS[TIERS.indexOf(tier) - 1] ?? null

/**
 * Node shape:
 *   id        opaque, machine-minted, never translated
 *   tier      one of TIERS
 *   parentId  null only for the enterprise root
 *   name      human, editable
 *   code      short code. Sites use it as their display ID.
 *   units     SITE ONLY. Engineering units belong to the site — this is the one
 *             screen where that setting is legitimately edited.
 */
export const HIERARCHY_NODES = [
  { id: 'ent_meridian', tier: 'enterprise', parentId: null, name: 'Meridian Industrial', code: 'MERIDIAN' },

  /* ── Americas ────────────────────────────────────────────────────── */
  { id: 'reg_americas', tier: 'region', parentId: 'ent_meridian', name: 'Americas', code: 'AM' },
  { id: 'sub_us_midwest', tier: 'subRegion', parentId: 'reg_americas', name: 'US Midwest', code: 'AM-MW' },
  {
    id: 'site_findlay',
    tier: 'site',
    parentId: 'sub_us_midwest',
    name: 'Findlay Plant',
    code: 'FDY',
    city: 'Findlay',
    country: 'US',
    countryName: 'United States',
    timeZone: 'America/New_York',
    /* Where the plant actually is. Real coordinates for a real town — the
       executive map projects these, so a pin is in Ohio rather than at a
       layout percentage. The prototype positions its pins with
       `left: {lat}%; top: {lng}%` on a blank rectangle, which is not a
       coordinate system. */
    coords: { lat: 41.0442, lon: -83.6499 },
    product: 'Beverage can bodies',
    commissioned: '2019-04',
    unitSystem: 'imperial',
    units: { vibration: 'in/s', temperature: '°F', pressure: 'psi', flow: 'gal/min', throughput: 'cpm' },
  },
  { id: 'line_fdy_1', tier: 'line', parentId: 'site_findlay', name: 'Line 1', code: 'FDY-L1' },
  { id: 'FDY-CUP-01', tier: 'asset', parentId: 'line_fdy_1', name: 'Cupper', code: 'FDY-CUP-01' },
  { id: 'FDY-BM-03', tier: 'asset', parentId: 'line_fdy_1', name: 'Bodymaker 3', code: 'FDY-BM-03' },
  { id: 'FDY-TRM-01', tier: 'asset', parentId: 'line_fdy_1', name: 'Trimmer', code: 'FDY-TRM-01' },
  { id: 'FDY-WSH-01', tier: 'asset', parentId: 'line_fdy_1', name: 'Washer', code: 'FDY-WSH-01' },
  { id: 'FDY-DEC-02', tier: 'asset', parentId: 'line_fdy_1', name: 'Decorator 2', code: 'FDY-DEC-02' },
  { id: 'FDY-OVN-01', tier: 'asset', parentId: 'line_fdy_1', name: 'IBO Oven', code: 'FDY-OVN-01' },
  { id: 'FDY-NCK-01', tier: 'asset', parentId: 'line_fdy_1', name: 'Necker', code: 'FDY-NCK-01' },
  { id: 'FDY-PAL-01', tier: 'asset', parentId: 'line_fdy_1', name: 'Palletizer', code: 'FDY-PAL-01' },

  { id: 'line_fdy_2', tier: 'line', parentId: 'site_findlay', name: 'Line 2', code: 'FDY-L2' },
  { id: 'FDY-CUP-02', tier: 'asset', parentId: 'line_fdy_2', name: 'Cupper', code: 'FDY-CUP-02' },
  { id: 'FDY-BM-07', tier: 'asset', parentId: 'line_fdy_2', name: 'Bodymaker 7', code: 'FDY-BM-07' },
  { id: 'FDY-DEC-04', tier: 'asset', parentId: 'line_fdy_2', name: 'Decorator 4', code: 'FDY-DEC-04' },
  { id: 'FDY-PAL-02', tier: 'asset', parentId: 'line_fdy_2', name: 'Palletizer', code: 'FDY-PAL-02' },

  { id: 'line_fdy_util', tier: 'line', parentId: 'site_findlay', name: 'Compressed Air', code: 'FDY-UTL' },
  { id: 'FDY-CMP-12', tier: 'asset', parentId: 'line_fdy_util', name: 'Compressor C-12', code: 'FDY-CMP-12' },
  { id: 'FDY-CHL-02', tier: 'asset', parentId: 'line_fdy_util', name: 'Chiller CH-02', code: 'FDY-CHL-02' },

  /* ── EMEA ────────────────────────────────────────────────────────── */
  { id: 'reg_emea', tier: 'region', parentId: 'ent_meridian', name: 'EMEA', code: 'EM' },
  { id: 'sub_rhineland', tier: 'subRegion', parentId: 'reg_emea', name: 'Rhineland', code: 'EM-RH' },
  {
    id: 'site_weissenthurm',
    tier: 'site',
    parentId: 'sub_rhineland',
    name: 'Weißenthurm Works',
    code: 'WTM',
    city: 'Weißenthurm',
    country: 'DE',
    countryName: 'Germany',
    timeZone: 'Europe/Berlin',
    coords: { lat: 50.4183, lon: 7.4525 },
    product: 'Can ends and closures',
    commissioned: '2016-09',
    unitSystem: 'metric',
    units: { vibration: 'mm/s', temperature: '°C', pressure: 'bar', flow: 'L/min', throughput: 'cpm' },
  },
  { id: 'line_wtm_1', tier: 'line', parentId: 'site_weissenthurm', name: 'Ends Line 1', code: 'WTM-L1' },
  { id: 'WTM-PRS-04', tier: 'asset', parentId: 'line_wtm_1', name: 'Shell Press 4', code: 'WTM-PRS-04' },
  { id: 'WTM-CVR-02', tier: 'asset', parentId: 'line_wtm_1', name: 'Conversion Press 2', code: 'WTM-CVR-02' },

  /* ── APAC ────────────────────────────────────────────────────────── */
  { id: 'reg_apac', tier: 'region', parentId: 'ent_meridian', name: 'APAC', code: 'AP' },
  { id: 'sub_west_india', tier: 'subRegion', parentId: 'reg_apac', name: 'Western India', code: 'AP-WI' },
  {
    id: 'site_pune',
    tier: 'site',
    parentId: 'sub_west_india',
    name: 'Pune Plant',
    code: 'PNQ',
    city: 'Pune',
    country: 'IN',
    countryName: 'India',
    timeZone: 'Asia/Kolkata',
    coords: { lat: 18.5204, lon: 73.8567 },
    product: 'Beverage can bodies',
    commissioned: '2022-02',
    unitSystem: 'metric',
    units: { vibration: 'mm/s', temperature: '°C', pressure: 'bar', flow: 'L/min', throughput: 'cpm' },
  },
  { id: 'line_pnq_1', tier: 'line', parentId: 'site_pune', name: 'Line 1', code: 'PNQ-L1' },
  { id: 'PNQ-BM-02', tier: 'asset', parentId: 'line_pnq_1', name: 'Bodymaker 2', code: 'PNQ-BM-02' },
  { id: 'PNQ-NCK-01', tier: 'asset', parentId: 'line_pnq_1', name: 'Necker', code: 'PNQ-NCK-01' },
]

/** Build the nested tree from the flat list. Derived, never stored. */
export function buildTree(nodes = HIERARCHY_NODES) {
  const byId = new Map(nodes.map((node) => [node.id, { ...node, children: [] }]))
  let root = null
  for (const node of byId.values()) {
    if (node.parentId === null) {
      root = node
      continue
    }
    byId.get(node.parentId)?.children.push(node)
  }
  return root
}

/** Flat list for the scope selector, each entry carrying its depth and path. */
export function buildScopes(nodes = HIERARCHY_NODES) {
  const out = []
  const walk = (node, depth, path) => {
    out.push({ id: node.id, name: node.name, tier: node.tier, depth, path: [...path, node.name] })
    node.children?.forEach((child) => walk(child, depth + 1, [...path, node.name]))
  }
  const root = buildTree(nodes)
  if (root) walk(root, 0, [])
  return out
}

/** Every descendant id of a node, for delete guards and counts. */
export function descendantsOf(id, nodes = HIERARCHY_NODES) {
  const out = []
  const queue = [id]
  while (queue.length) {
    const current = queue.shift()
    for (const node of nodes) {
      if (node.parentId === current) {
        out.push(node)
        queue.push(node.id)
      }
    }
  }
  return out
}

/** Sites only, in tree order. What every scoped query and the unit rule read. */
export function sitesOf(nodes = HIERARCHY_NODES) {
  return nodes.filter((node) => node.tier === 'site')
}
