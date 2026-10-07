/**
 * An editable JSON document as a node tree, and the walk that turns a targeted
 * node into JSONPath segments.
 *
 * ── Node shape ────────────────────────────────────────────────────────────
 *   { id, key, type, value, children }
 *
 * `key` is meaningful only for a child of an object. Array children carry
 * `key: null` and take their index from their position — see the note on
 * `deleteNode` for why storing it would be a bug rather than a convenience.
 *
 * ── Why a tree and not the parsed JSON ────────────────────────────────────
 * Plain JSON cannot represent a half-edited document: a key being renamed is
 * briefly empty, a number field is briefly `""`, and two sibling keys are briefly
 * identical. Every one of those collapses or throws if the source of truth is an
 * object. The tree holds them, and `toJSValue` collapses to JSON only when
 * something needs to evaluate against it.
 *
 * Stable `id`s are the other half: they survive a rename, which is what lets the
 * targeted node stay targeted while its key is being typed.
 */

/** Every type a node can be. JSON's own vocabulary — never translated. */
export const JSON_TYPES = ['string', 'number', 'boolean', 'null', 'object', 'array']

export const isContainerType = (type) => type === 'object' || type === 'array'

let counter = 0
const nextId = () => `n${(counter += 1)}`

function defaultValueFor(type) {
  if (type === 'string') return ''
  if (type === 'number') return 0
  if (type === 'boolean') return true
  return null
}

/** A fresh leaf, for the add-field affordance. */
export const makeNode = (key, type = 'string') => ({
  id: nextId(),
  key,
  type,
  value: defaultValueFor(type),
  children: [],
})

/** An empty document. */
export const makeRoot = (type = 'object') => ({
  id: nextId(),
  key: null,
  type,
  value: null,
  children: [],
})

/* ══ JSON ⇄ TREE ═══════════════════════════════════════════════════════ */

/**
 * Parsed JSON → tree.
 *
 * Array children are given `key: null`, not their index as a string. The index is
 * their position and nothing else, so it cannot go stale.
 */
export function fromJSValue(value, key = null) {
  const id = nextId()

  if (value === null) return { id, key, type: 'null', value: null, children: [] }

  if (Array.isArray(value)) {
    return {
      id,
      key,
      type: 'array',
      value: null,
      children: value.map((entry) => fromJSValue(entry, null)),
    }
  }

  if (typeof value === 'object') {
    return {
      id,
      key,
      type: 'object',
      value: null,
      children: Object.entries(value).map(([childKey, child]) => fromJSValue(child, childKey)),
    }
  }

  if (typeof value === 'number') return { id, key, type: 'number', value, children: [] }
  if (typeof value === 'boolean') return { id, key, type: 'boolean', value, children: [] }
  return { id, key, type: 'string', value: String(value), children: [] }
}

/**
 * Tree → plain JSON, for evaluating a path against.
 *
 * A number mid-edit is `''`, which is neither a number nor something to throw
 * over — it becomes 0, the same value the field will hold the moment focus
 * leaves it. Duplicate object keys collapse, last one winning, exactly as they
 * would in the JSON this represents.
 */
export function toJSValue(node) {
  if (node.type === 'null') return null
  if (node.type === 'boolean') return Boolean(node.value)
  if (node.type === 'string') return node.value ?? ''
  if (node.type === 'number') {
    if (typeof node.value === 'number') return node.value
    const parsed = Number.parseFloat(node.value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (node.type === 'array') return node.children.map(toJSValue)

  const object = {}
  for (const child of node.children) object[child.key ?? ''] = toJSValue(child)
  return object
}

/* ══ TREE OPS ══════════════════════════════════════════════════════════ */

export function updateNode(root, id, patch) {
  if (root.id === id) return { ...root, ...patch }
  if (!root.children.length) return root
  return { ...root, children: root.children.map((child) => updateNode(child, id, patch)) }
}

/**
 * Remove a node.
 *
 * No index fix-up is needed, and that is the point: array children never store
 * their index, so removing one silently renumbers the rest by moving them. The
 * source component stored the index as `key` and did not renumber, so deleting
 * the first of three left the display reading `1, 2` and the next added child
 * colliding on `2`.
 */
export function deleteNode(root, id) {
  if (!root.children.length) return root
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== id)
      .map((child) => deleteNode(child, id)),
  }
}

export function addChild(root, parentId, child) {
  if (root.id === parentId) return { ...root, children: [...root.children, child] }
  if (!root.children.length) return root
  return { ...root, children: root.children.map((node) => addChild(node, parentId, child)) }
}

/**
 * Change a node's type.
 *
 * ── Children survive object ⇄ array ───────────────────────────────────────
 * The two container types hold the same children; only how they are addressed
 * differs. The source component dropped them on every conversion — its ternary
 * returned `[]` from both branches, which reads as an intention that was never
 * finished — so a misclick on the type select silently deleted an entire subtree.
 * Here they carry across, and going object → array simply stops using the keys
 * while keeping them, so switching back is lossless too.
 *
 * Collapsing a container to a scalar does drop them, because a string has nowhere
 * to put them. That one is unavoidable and visible: the child rows disappear as
 * you watch.
 */
export function convertType(root, id, nextType) {
  const current = findNode(root, id)
  if (!current) return root

  const keepsChildren = isContainerType(current.type) && isContainerType(nextType)

  return updateNode(root, id, {
    type: nextType,
    value: isContainerType(nextType) ? null : defaultValueFor(nextType),
    children: keepsChildren ? current.children : [],
  })
}

export function findNode(root, id) {
  if (root.id === id) return root
  for (const child of root.children) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return null
}

/** Root → target, inclusive. Null when the id is not in this tree. */
export function nodeChain(root, targetId) {
  if (root.id === targetId) return [root]
  for (const child of root.children) {
    const below = nodeChain(child, targetId)
    if (below) return [root, ...below]
  }
  return null
}

/* ══ MATCHING ══════════════════════════════════════════════════════════ */

/**
 * The field the matcher offers first when an array is addressed.
 *
 * Order is not cosmetic. Addressing by position emits `$.metrics[0].value`, which
 * is wrong the moment a publisher reorders its metrics — and wrong silently, by
 * reading Pressure and reporting it as Temperature. An identifying field is
 * order-independent, so it is chosen ahead of the index whenever one exists.
 *
 * `alias` is in this list because Sparkplug metrics carry one; `label` and `title`
 * because the payloads that are not Sparkplug tend to.
 */
const PREFERRED_MATCH_FIELDS = ['name', 'id', 'key', 'alias', 'tag', 'label', 'title']

const isScalar = (node) => !isContainerType(node.type)

/**
 * Every field of an array's object children that can sit on the left of a filter.
 *
 * Direct scalars, plus one level of nesting expressed dotted (`properties.unit`),
 * because a metric's identifying detail is often one level in. Deeper than that is
 * reachable by typing the expression — the control stops where the list would
 * stop being scannable.
 *
 * Containers are excluded: `properties == something` is an expression that can
 * never match.
 */
export function matchFieldsOf(arrayNode) {
  const fields = []
  const add = (name) => {
    if (name && !fields.includes(name)) fields.push(name)
  }

  for (const item of arrayNode.children) {
    if (item.type !== 'object') continue
    for (const child of item.children) {
      if (isScalar(child)) add(child.key)
      else if (child.type === 'object') {
        for (const grandchild of child.children) {
          if (isScalar(grandchild)) add(`${child.key}.${grandchild.key}`)
        }
      }
    }
  }

  return fields
}

/** A dotted field's value on one array item, as JSON. Undefined when absent. */
export function matchValueOf(itemNode, field) {
  let node = itemNode
  for (const part of String(field).split('.')) {
    if (!node || node.type !== 'object') return undefined
    node = node.children.find((child) => child.key === part)
  }
  return node ? toJSValue(node) : undefined
}

/**
 * How one array is addressed, defaulted rather than written into state on first
 * render — so the tree draws the same way every time it opens on the same payload,
 * and nothing has to be initialised before anything can be shown.
 *
 * Stores the FIELD only, never the value. Which element is addressed follows from
 * which node is targeted, so a stored value could contradict the selection.
 */
export function matcherFor(matchers, arrayNode) {
  const stored = matchers.get(arrayNode.id)
  if (stored) return stored

  const available = matchFieldsOf(arrayNode)
  const preferred = PREFERRED_MATCH_FIELDS.find((name) => available.includes(name))
  return preferred ? { kind: 'filter', field: preferred } : { kind: 'index' }
}

/* ══ TREE → SEGMENTS ═══════════════════════════════════════════════════ */

/**
 * The targeted node, as the segment list `jsonPath.js` renders and resolves.
 *
 * Walks root → target and asks each level how it addresses its child: an object
 * by key, an array by its matcher. Producing segments rather than a string is what
 * keeps the expression and the live preview derived from one source — see the note
 * at the top of `jsonPath.js`.
 *
 * @returns {Array<object>|null} Null when the target is not in this tree, which
 *   happens for one render after the payload is replaced under a selection.
 */
export function segmentsFor(root, targetId, matchers) {
  const chain = nodeChain(root, targetId)
  if (!chain) return null

  const segments = []

  for (let depth = 0; depth < chain.length - 1; depth += 1) {
    const parent = chain[depth]
    const child = chain[depth + 1]
    const index = parent.children.indexOf(child)

    if (parent.type !== 'array') {
      segments.push({ kind: 'key', key: child.key ?? '' })
      continue
    }

    const matcher = matcherFor(matchers, parent)
    const value = matcher.kind === 'filter' ? matchValueOf(child, matcher.field) : undefined

    // A filter needs something to compare against. An item missing the matched
    // field falls back to its position rather than emitting `==undefined`, which
    // is not an expression any evaluator accepts.
    if (matcher.kind === 'filter' && value !== undefined) {
      segments.push({ kind: 'filter', field: matcher.field, value })
    } else {
      segments.push({ kind: 'index', index })
    }
  }

  return segments
}

/**
 * The same node, under a different element of one array.
 *
 * Changing the match VALUE is really a statement about which element is meant, so
 * it moves the target rather than editing the expression: sitting on
 * `metrics[0].properties.unit` and switching the value to Pressure lands on
 * `metrics[1].properties.unit`, not on `metrics[1]`.
 *
 * Falls back to the element itself when the relative path does not exist under it —
 * arrays of unlike objects are legal, and landing somewhere real beats landing
 * nowhere.
 *
 * @returns {string} The id to target.
 */
export function retarget(root, targetId, arrayNodeId, nextIndex) {
  const chain = nodeChain(root, targetId)
  if (!chain) return targetId

  const at = chain.findIndex((node) => node.id === arrayNodeId)
  if (at < 0 || at + 1 >= chain.length) return targetId

  const nextItem = chain[at].children[nextIndex]
  if (!nextItem) return targetId

  // How the old target sat under its element: a key at each object level, a
  // position at each array level.
  const steps = []
  for (let depth = at + 1; depth < chain.length - 1; depth += 1) {
    const parent = chain[depth]
    const child = chain[depth + 1]
    steps.push(
      parent.type === 'array' ? { index: parent.children.indexOf(child) } : { key: child.key },
    )
  }

  let cursor = nextItem
  for (const step of steps) {
    const next =
      step.key !== undefined
        ? cursor.children.find((child) => child.key === step.key)
        : cursor.children[step.index]
    if (!next) return cursor.id
    cursor = next
  }

  return cursor.id
}
