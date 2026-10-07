/**
 * `GET /asset-hierarchy` → the flat node list every hierarchy screen reads.
 *
 * Its own module, with no imports, because it is the one piece of hierarchy code
 * that is pure: a nested response in, a flat array out. That makes it verifiable
 * against a real response without standing up the transport around it.
 *
 * ── The shape it consumes ─────────────────────────────────────────────────
 *   { alias, name, regions: [{ id, name, short_code,
 *       subregions: [{ …, plants: [{ …, lines: [{ …, machines: [ … ] }] }] }] }] }
 *
 * ── What it cannot produce ────────────────────────────────────────────────
 * `is_active` and `asset_class_id` are absent from this endpoint at every level.
 * `isActive` is therefore `null` — UNKNOWN, deliberately not `false` and not
 * `true`. Consumers must test `=== false`, since falsiness would read every node
 * in the account as out of service. Anything that needs the real values reads the
 * record itself; see `fetchNode`.
 */

/** Which key each tier nests its children under, and what tier those children are. */
const NESTING = {
  region: ['subregions', 'subRegion'],
  subRegion: ['plants', 'site'],
  site: ['lines', 'line'],
  line: ['machines', 'asset'],
  asset: [null, null],
}

/**
 * @param {object} tree      The unwrapped `data` of `GET /asset-hierarchy`.
 * @param {string} rootId    Sentinel id for the account root.
 * @returns {Array<object>}  Root first, then every node in document order.
 */
export function flattenHierarchy(tree, rootId) {
  const items = [
    {
      id: rootId,
      tier: 'enterprise',
      parentId: null,
      // The only place the account's own name and alias are served.
      name: tree?.name ?? '',
      code: tree?.alias ?? null,
      isActive: true,
      assetClassId: null,
      readOnly: true,
    },
  ]

  const walk = (rows, tier, parentId) => {
    const [childKey, childTier] = NESTING[tier]

    for (const row of rows ?? []) {
      items.push({
        id: row.id,
        tier,
        parentId,
        name: row.name,
        code: row.short_code ?? null,
        isActive: null,
        assetClassId: null,
      })
      if (childKey) walk(row[childKey], childTier, row.id)
    }
  }

  walk(tree?.regions, 'region', rootId)

  return items
}
