import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { PlainBadge } from '@/components/forge/StatusBadge'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Mono, Num } from '@/components/forge/primitives'
import {
  CODE_MAX_LENGTH,
  ENTITY_TYPE_FOR_TIER,
  NAME_MAX_LENGTH,
  TIERS,
  TIERS_WITH_ASSET_CLASS,
  childTierOf,
} from '@/features/hierarchy/api'
import {
  useCreateNode,
  useDeleteNode,
  useHierarchyNode,
  useHierarchyNodes,
  useUpdateNode,
} from '@/features/hierarchy/queries'
import { useAssetClasses } from '@/features/assetClasses/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * Sites & Hierarchy.
 *
 * Six tiers: enterprise › region › sub-region › site › line › asset. The tier a
 * node can contain is derived from its own tier, never chosen — that is what
 * stops someone hanging an asset directly off a region and producing a tree the
 * rest of the platform cannot scope to.
 *
 * ── Live, and shaped by what the API actually accepts ────────────────────
 * The enterprise root is the account. It has no endpoint — no create, no
 * rename, no remove — so it is the one row in the tree with no controls on it.
 *
 * A short code is REQUIRED at every tier and unique among its siblings, which
 * the server enforces and reports back as a field error. It used to be optional
 * here, which would now fail at submit rather than in the form.
 *
 * Every write is a full-replace PUT. That is why the editor is populated from
 * the record rather than starting empty, and why `asset_class_id` is carried
 * through even when the form never shows it: the update schema requires the
 * field, so omitting it is a rejection and sending null on a rename would
 * silently destroy a real assignment.
 *
 * ── What the server cannot store ─────────────────────────────────────────
 * The site form used to carry a city, a country and — the important one — the
 * engineering unit system, which PRODUCT.md calls a safety property and which
 * had no other home in the product. `Plant` has no column for any of them. They
 * are removed rather than collected into a field that would silently discard
 * them; the gap is written up in BACKEND-GAPS.md.
 *
 * ── Removal warns rather than refuses ────────────────────────────────────
 * This screen used to block it: a node with children could not be removed until
 * it was emptied. That is now a warning instead, by instruction — an
 * administrator restructuring a plant should not have to delete six levels
 * bottom-up to retire a region.
 *
 * The consequence is real and is stated twice before it happens, because the
 * server soft-deletes exactly ONE row: the children keep `deleted_at = NULL`,
 * disappear from this tree the moment their parent does, and go on holding their
 * short codes against the sibling-uniqueness check. They are not deleted and they
 * are not reachable — see BACKEND-GAPS.md item 2, which is the fix this screen is
 * working around.
 */

/**
 * One measure for this page, shared by the prose and the tree.
 *
 * They used to disagree: the intro was capped at a reading measure and the tree
 * at 52rem for its two-ended rows, which put two edges 12rem apart and made the
 * page look like a layout that had drifted rather than one that was set. `ch`
 * resolves to the same pixel width in both places because both containers
 * inherit the 14px body size.
 */
const PAGE_MEASURE = 'max-w-[74ch]'

const TIER_TONE = {
  enterprise: 'violet',
  region: 'forge',
  subRegion: 'amber',
  site: 'green',
  line: 'ack',
  asset: null,
}

/** One representative glyph per tier, in a tinted tile of that tier's hue — the
 *  same object the scope menu in the top bar uses, so a level is recognisable by
 *  the same mark in both places. The legend teaches the six once, and every tree
 *  row then carries the tile alone: no text chip needs to say "SITE" beside a
 *  green factory on every line. */
const TIER_ICON = {
  enterprise: 'globe',
  region: 'globe',
  subRegion: 'map',
  site: 'factory',
  line: 'conveyor',
  asset: 'machine',
}

export function SitesHierarchyPage() {
  const { t } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('settings.hierarchy.title')} · ${t('common:brand.name')}`)

  const { data, isPending, isError, error, refetch } = useHierarchyNodes()
  const createNode = useCreateNode()
  const updateNode = useUpdateNode()
  const deleteNode = useDeleteNode()

  /**
   * COLLAPSED, not expanded — the set is inverted on purpose.
   *
   * A tree that opens closed makes the first thing an administrator does on this
   * screen "click five times to see what they already own". Tracking the closed
   * nodes instead means the empty initial set IS everything open, with no effect
   * seeding state from a response that has not arrived yet, and no window where
   * the tree renders shut before the seed lands.
   *
   * It also fixes Collapse all, which used to seed `{root}` and so left the root
   * open and its whole first generation on screen — the one thing the button is
   * named for closing.
   */
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [filter, setFilter] = useState('')
  /** `{ mode: 'create'|'edit', parent?, node? }` — one editor open at a time. */
  const [editor, setEditor] = useState(null)
  /** `{ node, count }` — the record a confirmation is open for. */
  const [removing, setRemoving] = useState(null)

  const nodes = useMemo(() => data?.items ?? [], [data])

  const childrenOf = useMemo(() => {
    const map = new Map()
    for (const node of nodes) {
      if (!map.has(node.parentId)) map.set(node.parentId, [])
      map.get(node.parentId).push(node)
    }
    // Siblings arrive in whatever order the database returned them, which is no
    // order at all. Sorted by code, because that is what an administrator reads
    // down the column looking for the one they want.
    for (const list of map.values()) {
      list.sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''))
    }
    return map
  }, [nodes])

  const root = nodes.find((node) => node.parentId === null)

  /**
   * Filtering keeps a node if it matches OR any descendant matches, so typing a
   * machine id still shows you the path down to it. A filter that hides the
   * parents of its own matches is unusable on a tree.
   */
  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return null
    const keep = new Set()
    const matches = (node) =>
      [node.name, node.code].filter(Boolean).some((value) => value.toLowerCase().includes(query))

    const walk = (node) => {
      const kids = childrenOf.get(node.id) ?? []
      const childKept = kids.map(walk).some(Boolean)
      if (matches(node) || childKept) {
        keep.add(node.id)
        return true
      }
      return false
    }
    if (root) walk(root)
    return keep
  }, [filter, childrenOf, root])

  function toggle(id) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function requestDelete(node) {
    setEditor(null)
    deleteNode.reset()
    setRemoving({ node, count: (childrenOf.get(node.id) ?? []).length })
  }

  function openCreate(parent) {
    setRemoving(null)
    createNode.reset()
    updateNode.reset()
    setEditor({ mode: 'create', parent })
  }

  function openEdit(node) {
    setRemoving(null)
    createNode.reset()
    updateNode.reset()
    setEditor({ mode: 'edit', node })
  }

  function submitEditor(values) {
    if (editor.mode === 'create') {
      createNode.mutate(
        { parentTier: editor.parent.tier, parentId: editor.parent.id, values },
        {
          onSuccess: () => {
            // Reveal what was just created rather than leaving it hidden inside
            // a collapsed parent.
            setCollapsed((current) => {
              const next = new Set(current)
              next.delete(editor.parent.id)
              return next
            })
            setEditor(null)
          },
        },
      )
    } else {
      updateNode.mutate(
        { tier: editor.node.tier, id: editor.node.id, values },
        { onSuccess: () => setEditor(null) },
      )
    }
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className={cn('mb-6', PAGE_MEASURE)}>
        {/* Display size, like every other screen that owns its page. Settings
            renders no title of its own above this, so at headline size the page
            read as a subsection of something that was not there. */}
        <h1 className="m-0 text-display">{t('settings.hierarchy.title')}</h1>
        <p className="mt-3 text-body leading-[1.6] text-ink-dim">{t('settings.hierarchy.intro')}</p>
      </header>

      {/* ── Tree on the left, editor on the right ────────────────────────
          The tree is capped rather than let run to the full 1700px page: its
          rows are a name at one end and a short code, a child count and three
          controls at the other, so a full-width row is mostly the gap between
          them. Capped, the two ends stay in one glance.

          The editor is a panel beside the tree rather than a modal over it.
          Creating a node is a statement about a PLACE in the hierarchy, and a
          modal hides the one thing that gives the form its meaning — which
          parent you are adding under, and what is already there. */}
      <div className="flex items-start gap-5 max-xl:flex-col">
        <div className={cn('w-full min-w-0 flex-1', PAGE_MEASURE)}>
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge">
              <Icon name="search" size="sm" className="text-ink-mute" />
              <label className="sr-only" htmlFor="tree-filter">
                {t('settings.hierarchy.searchPlaceholder')}
              </label>
              <input
                id="tree-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t('settings.hierarchy.searchPlaceholder')}
                className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
              />
            </div>
            <ForgeButton
              size="sm"
              onClick={() => setCollapsed(new Set())}
            >
              {t('settings.hierarchy.expandAll')}
            </ForgeButton>
            <ForgeButton size="sm" onClick={() => setCollapsed(new Set(nodes.map((node) => node.id)))}>
              {t('settings.hierarchy.collapseAll')}
            </ForgeButton>
          </div>

          {isPending ? (
            <SkeletonRows count={5} />
          ) : isError ? (
            <ErrorState
              error={error}
              title={t('settings.hierarchy.loadFailed')}
              onRetry={refetch}
            />
          ) : visible && visible.size === 0 ? (
            <Panel className="text-center">
              <p className="m-0 text-body-sm text-ink-dim">{t('settings.hierarchy.noMatch')}</p>
            </Panel>
          ) : (
            <Panel flush className="overflow-hidden">
              <TierKey />
              <ul
                className="m-0 list-none p-0"
                role="tree"
                aria-label={t('settings.hierarchy.title')}
              >
                {root ? (
                  <TreeNode
                    node={root}
                    depth={0}
                    childrenOf={childrenOf}
                    collapsed={collapsed}
                    visible={visible}
                    onToggle={toggle}
                    onAdd={openCreate}
                    onEdit={openEdit}
                  />
                ) : null}
              </ul>
            </Panel>
          )}
        </div>

        {/* Sticky, so a long tree can be scrolled while the form stays put.
            Below xl it stops being a column and becomes a block above the tree,
            where a 400px aside would leave neither side usable. */}
        {editor ? (
          <aside className="sticky top-6 w-[25rem] shrink-0 max-xl:static max-xl:order-first max-xl:w-full">
            <NodePanel
              editor={editor}
              pending={createNode.isPending || updateNode.isPending}
              error={editor.mode === 'create' ? createNode.error : updateNode.error}
              /* Counted from the tree rather than from the record: the node's own
                 endpoint says nothing about what hangs off it, and this is the
                 figure the warning beside Remove has to be right about. */
              childCount={
                editor.mode === 'edit' ? (childrenOf.get(editor.node.id) ?? []).length : 0
              }
              onClose={() => setEditor(null)}
              onDelete={requestDelete}
              onSubmit={submitEditor}
            />
          </aside>
        ) : null}
      </div>

      <DeleteDialog
        target={removing}
        pending={deleteNode.isPending}
        error={deleteNode.error}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          deleteNode.mutate(
            { tier: removing.node.tier, id: removing.node.id },
            { onSuccess: () => setRemoving(null) },
          )
        }}
      />
    </div>
  )
}

/* ══ DIALOGS ═══════════════════════════════════════════════════════════ */

/**
 * Create and edit, in the panel beside the tree.
 *
 * ── A panel, not a modal ──────────────────────────────────────────────────
 * Creating a node is a statement about a PLACE in the hierarchy — this line, on
 * that site. A modal covers the one thing that gives the form its meaning: which
 * parent is being added under and what is already there. Beside the tree, the
 * answer stays legible while the form is filled, and a mistaken parent is visible
 * before the write rather than after it.
 *
 * ── Edit reads the record it is about to overwrite ────────────────────────
 * `/asset-hierarchy` serves id, name and short code. `is_active` and
 * `asset_class_id` are not in it, and every update in this API is a full replace —
 * so a form prefilled from the tree alone would switch the record off and unassign
 * its class the moment it saved. One extra read, only when a form opens.
 */
function NodePanel({ editor, pending, error, childCount, onClose, onDelete, onSubmit }) {
  const { t } = useTranslation(['app', 'common'])

  const isCreate = editor.mode === 'create'
  const tier = isCreate ? childTierOf(editor.parent.tier) : editor.node.tier
  const tierLabel = t(`settings.hierarchy.tiers.${tier}`).toLowerCase()

  const detail = useHierarchyNode(isCreate ? null : { tier, id: editor.node.id })

  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="m-0 text-title">
            {isCreate
              ? t('settings.hierarchy.createTitle', { tier: tierLabel })
              : t('settings.hierarchy.editTitle', { name: editor.node.name })}
          </h2>
          {isCreate ? (
            <p className="mt-1 mb-0 text-body-sm text-ink-dim">
              {t('settings.hierarchy.createUnder', { parent: editor.parent.name })}
            </p>
          ) : null}
        </div>
        <IconButton
          bare
          label={t('common:actions.close')}
          onClick={onClose}
          className="-me-1 size-7 shrink-0"
        >
          <Icon name="x" size="sm" />
        </IconButton>
      </div>

      {!isCreate && detail.isPending ? (
        <SkeletonRows count={2} />
      ) : !isCreate && detail.isError ? (
        <ErrorState
          error={detail.error}
          title={t('settings.hierarchy.loadFailed')}
          onRetry={detail.refetch}
        />
      ) : (
        <NodeEditor
          /* Re-keyed per record: NodeEditor seeds its fields in `useState`
             initialisers, which run once, so switching from one node to another
             without this would keep the first one's values. */
          key={isCreate ? `new-${editor.parent.id}` : editor.node.id}
          editor={isCreate ? editor : { ...editor, node: detail.data }}
          tier={tier}
          pending={pending}
          error={error}
          childCount={childCount}
          onClose={onClose}
          onDelete={onDelete}
          onSubmit={onSubmit}
        />
      )}
    </Panel>
  )
}

/**
 * The confirmation, and the second statement of the consequence.
 *
 * It used to have two modes: confirm an empty record, refuse a full one. The
 * refusal is gone — a full branch is now removable and the dialog's job is to make
 * sure nobody does it by accident. The warning is repeated here rather than
 * assumed read in the panel behind, because this is the click that cannot be taken
 * back.
 */
function DeleteDialog({ target, pending, error, onClose, onConfirm }) {
  const { t } = useTranslation(['app', 'common'])
  if (!target) return null

  const nested = target.count > 0

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="sm"
      title={t('settings.hierarchy.deleteTitle', { name: target.node.name })}
      footer={
        <>
          <ForgeButton variant="danger" disabled={pending} onClick={onConfirm}>
            {t('settings.hierarchy.deleteConfirm')}
          </ForgeButton>
          <ForgeButton onClick={onClose}>{t('settings.hierarchy.cancel')}</ForgeButton>
        </>
      }
    >
      {error ? <WriteFailed error={error} className="mb-4" /> : null}

      {/* Amber and striped, the same shape `WriteFailed` uses — but amber, because
          nothing has gone wrong yet. It is describing what this action will do. */}
      {nested ? (
        <div className="mb-4 rounded-sm border border-hairline stripe-amber bg-card p-3.5">
          <p className="m-0 text-body-sm text-on-amber">
            {t('settings.hierarchy.deleteNested', {
              name: target.node.name,
              count: target.count,
            })}
          </p>
        </div>
      ) : null}

      <p className="m-0 text-body text-ink-dim">{t('settings.hierarchy.deleteBody')}</p>
    </ForgeDialog>
  )
}

/**
 * A failed write, stated where it was attempted.
 *
 * The server's own wording is never rendered: it is untranslated and can
 * describe internals. Field-level complaints are routed to their control; this
 * carries everything else.
 */
function WriteFailed({ error, className }) {
  const { t } = useTranslation(['app', 'common'])
  return (
    <div
      role="alert"
      className={cn('rounded-sm border border-hairline stripe-red bg-card p-3.5', className)}
    >
      <p className="m-0 text-control text-on-red">{t('settings.hierarchy.writeFailed')}</p>
      <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">{t(`common:${error.messageKey}`)}</p>
      {error.requestId ? (
        <p className="mono mt-2 mb-0 text-micro font-normal text-ink-dim">
          {t('common:errors.requestId', { id: error.requestId })}
        </p>
      ) : null}
    </div>
  )
}

/* ══ TREE ══════════════════════════════════════════════════════════════ */

function TreeNode({
  node,
  depth,
  childrenOf,
  collapsed,
  visible,
  onToggle,
  onAdd,
  onEdit,
}) {
  const { t } = useTranslation(['app', 'common'])
  const kids = (childrenOf.get(node.id) ?? []).filter((child) => !visible || visible.has(child.id))
  const isOpen = !collapsed.has(node.id) || Boolean(visible)
  const childTier = childTierOf(node.tier)

  return (
    <li role="treeitem" aria-expanded={kids.length ? isOpen : undefined}>
      <div
        // py-1 with size-7 controls: a 36px row. The 24px tier tile fits inside
        // that without touching it — an earlier version of this tile was 40px and
        // held every row open at 52px on its own, which is why it is sized to the
        // row rather than the row to it.
        className="group flex flex-wrap items-center gap-2 border-b border-subtle px-3 py-1 hover:bg-sunken"
        // Indentation is inline padding, so RTL reverses the whole tree for free.
        style={{ paddingInlineStart: `${12 + depth * 18}px` }}
      >
        {kids.length ? (
          <IconButton
            bare
            label={
              isOpen
                ? t('settings.hierarchy.collapse', { name: node.name })
                : t('settings.hierarchy.expand', { name: node.name })
            }
            onClick={() => onToggle(node.id)}
            className="size-5"
          >
            <Icon
              name={isOpen ? 'down' : 'right'}
              size="sm"
              className={cn(!isOpen && 'mirror-rtl')}
            />
          </IconButton>
        ) : (
          <span className="size-5 shrink-0" aria-hidden="true" />
        )}

        {/* ── The row itself opens the editor ──────────────────────────────
            Everything between the disclosure arrow and the add button is one
            button, so the target is the whole row rather than a 28px pencil at the
            far end — the thing an administrator is pointing at when they mean
            "this one". A real `<button>`, not a click handler on the div: it earns
            keyboard operation, focus-visible and Enter/Space for free, and it
            cannot swallow the disclosure arrow or the add button, because those are
            siblings rather than descendants.

            The root is the account. The API serves no way to rename or remove it,
            so it is the one row that is text rather than a control — no target
            that leads to a form with nothing it can save. */}
        {node.readOnly ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <RowFacts node={node} kids={kids} childTier={childTier} />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onEdit(node)}
            aria-label={t('settings.hierarchy.edit', { name: node.name })}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm text-start"
          >
            <RowFacts node={node} kids={kids} childTier={childTier} />
          </button>
        )}

        {/* One control, in a fixed slot that is rendered whether or not this row
            can use it — an asset contains nothing, so its slot stands empty rather
            than closing up. That is what keeps the add buttons in a true column
            instead of stepping in by 28px on the last row.

            Add is the only icon here. Edit had one too and it was redundant the
            moment the row itself became the target — two controls, side by side,
            for the same record and the same result. Removal is not here at all: it
            lives in the editor panel, where the precondition can be stated before
            the click rather than after it. */}
        <span className="flex size-7 shrink-0 items-center justify-center">
          {childTier ? (
            <IconButton
              bare
              label={t('settings.hierarchy.addChild', {
                tier: t(`settings.hierarchy.tiers.${childTier}`).toLowerCase(),
                parent: node.name,
              })}
              onClick={() => onAdd(node)}
              className="size-7"
            >
              <Icon name="plus" size="sm" />
            </IconButton>
          ) : null}
        </span>

      </div>

      {isOpen && kids.length ? (
        <ul className="m-0 list-none p-0" role="group">
          {kids.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              childrenOf={childrenOf}
              collapsed={collapsed}
              visible={visible}
              onToggle={onToggle}
              onAdd={onAdd}
              onEdit={onEdit}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * What a row says about its node: name, out-of-service badge, short code, and how
 * many children it holds.
 *
 * Extracted only because it is rendered inside a `<button>` on every row except
 * the account root, which is plain text — and the two must not be allowed to
 * drift apart.
 */
function RowFacts({ node, kids, childTier }) {
  const { t } = useTranslation('app')

  return (
    <>
      {/* Inside the pressable region rather than beside it, so the glyph is part
          of the target that opens this record and not a decoration sitting next to
          one. It is what identifies the tier on the row — the key strip at the top
          of the tree teaches these six once and every row then carries the mark
          alone. */}
      <TierIcon tier={node.tier} />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-body-sm font-semibold',
            // `=== false`, never falsiness: `/asset-hierarchy` does not serve
            // `is_active`, so the flat list carries null for it and testing
            // truthiness would dim every row in the tree.
            node.isActive === false && 'text-ink-dim',
          )}
        >
          {node.name}
        </span>
      </span>

      {/* Not a severity — a record that is switched off is not a machine that is
          broken. Neutral, and labelled rather than left to a colour. */}
      {node.isActive === false ? <PlainBadge>{t('settings.hierarchy.inactive')}</PlainBadge> : null}

      {node.code ? <Mono className="text-ink-dim max-lg:hidden">{node.code}</Mono> : null}

      {kids.length ? (
        <Num className="text-micro font-normal text-ink-dim">
          {t('settings.hierarchy.childCount', {
            count: kids.length,
            tier: t(`settings.hierarchy.tiers.${childTier}`).toLowerCase(),
          })}
        </Num>
      ) : null}
    </>
  )
}

/**
 * The tier as a glyph, in the tier's own hue.
 *
 * The hue ladder is unchanged — violet enterprise, forge region, amber
 * sub-region, green site, ack line, neutral asset — but it is now carried by the
 * stroke rather than by a 28px tinted disc behind it. Six coloured circles down
 * the left edge of every row read as status lights on records that have no
 * status, and each one set the row's height on its own.
 *
 * `ON_TINT_CLASS` rather than the raw hue: these are strokes on the card, and a
 * semantic hue is a fill value, not automatically a stroke value (DESIGN.md, The
 * Tint-Text Rule).
 */
/**
 * The tier key — one line, at the top of the tree it explains.
 *
 * ── Five versions, one question ───────────────────────────────────────────
 * Where does a reference belong on a screen whose subject is underneath it?
 *
 * It began as names separated by chevrons, which is the exact typographic form of
 * a breadcrumb — and a breadcrumb asserts the opposite of what this says: one
 * path YOU are on, rather than the shape EVERY path must take. Restating it as an
 * indented ladder fixed the meaning and cost 170px above the fold. Folding it into
 * a `<details>` bought the space back and charged a click for something that should
 * simply be true on arrival. Moving it to the margin made it free and put it in the
 * corner of the eye, away from the rows it names.
 *
 * ── What it is now ────────────────────────────────────────────────────────
 * The tree's own header strip, inside the card, above the first row, on one 26px
 * line. A legend for a list belongs ON the list — it needs no space of its own, it
 * cannot drift away from what it annotates, and it disappears with the tree on the
 * filter's empty state, which is correct: there are no rows left to decode.
 *
 * ── The separator is a plain arrow, by instruction ────────────────────────
 * It was a descending elbow — the tree-connector mark, chosen because a chevron
 * points forward and so reads as a path rather than as containment. Overruled: at
 * 8px, inside a 26px strip, the elbow was a smudge nobody could read as anything,
 * and the six coloured glyphs plus the strip's position on the tree already say
 * this is a key to the rows below rather than a trail.
 *
 * A shafted arrow, `arrow-right`, not the bare `right` chevron: the chevron is this
 * system's disclosure and navigation mark, and borrowing it here made the strip read
 * as six places you could walk to. The tail turns it into a relation between two
 * things standing beside each other. `mirror-rtl`, so it turns around with the text.
 */
function TierKey() {
  const { t } = useTranslation('app')

  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-hairline bg-sunken px-3 py-1.5">
      {TIERS.map((tier, index) => (
        <li key={tier} className="flex items-center gap-1.5">
          {index ? (
            <Icon name="arrow-right" size="xs" className="mirror-rtl text-ink-mute" />
          ) : null}
          <TierIcon tier={tier} bare />
          {/* `font-normal`: the micro role is 600 by default, which at 11px in a
              strip of six repeated items reads as six small headings. */}
          <span className="text-micro font-normal text-ink-dim">
            {t(`settings.hierarchy.tiers.${tier}`)}
          </span>
        </li>
      ))}
    </ol>
  )
}

function TierIcon({ tier, bare = false }) {
  const tone = TIER_TONE[tier]
  const glyph = (
    <Icon
      name={TIER_ICON[tier]}
      size="xs"
      className={tone ? ON_TINT_CLASS[tone] : 'text-ink-mute'}
    />
  )
  if (bare) return glyph
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md',
        // Asset is the one tier with no hue — the ladder rations colour to the
        // five levels a scope can be set to, and an asset is not one of them. It
        // takes the neutral fill rather than borrowing a neighbour's.
        tone ? TINT_CLASS[tone] : 'bg-sunken',
      )}
    >
      {glyph}
    </span>
  )
}

/* ══ EDITOR ════════════════════════════════════════════════════════════ */

/**
 * Create and edit share one form. The tier is never a field: on create it is
 * derived from the parent, and on edit it cannot change — moving a node between
 * tiers is a different operation with different consequences and it does not
 * belong behind a select nobody expects to reshape their plant.
 */
function NodeEditor({ editor, tier, pending, error, childCount, onClose, onDelete, onSubmit }) {
  const { t } = useTranslation(['app', 'common'])
  const isCreate = editor.mode === 'create'
  const node = editor.node
  // Allowed, and warned about: the server soft-deletes exactly one row and leaves
  // its children listed with a parent that no longer exists.
  const hasChildren = childCount > 0
  const takesAssetClass = TIERS_WITH_ASSET_CLASS.has(tier)

  const [name, setName] = useState(isCreate ? '' : (node.name ?? ''))
  const [code, setCode] = useState(isCreate ? '' : (node.code ?? ''))
  const [isActive, setIsActive] = useState(isCreate ? true : (node.isActive ?? true))
  const [assetClassId, setAssetClassId] = useState(isCreate ? '' : (node.assetClassId ?? ''))
  const [errors, setErrors] = useState({})

  // Only fetched for the three tiers that can carry one. A region form has no
  // business asking the server for a class list it will never show.
  const { data: classData } = useAssetClasses({ enabled: takesAssetClass })
  const entityType = ENTITY_TYPE_FOR_TIER[tier]
  const classOptions = useMemo(() => {
    const rows = (classData?.items ?? []).filter((row) => row.entityType === entityType)
    return [
      { value: '', label: t('settings.hierarchy.fields.noAssetClass') },
      ...rows.map((row) => ({ value: row.id, label: row.name })),
    ]
  }, [classData, entityType, t])

  /**
   * A field the server rejected outranks the local check — it is the authority
   * on what it just refused, and the only thing that knows a sibling already
   * holds this code. Its wording is not rendered; this copy says it instead.
   */
  const serverFields = error?.fields ?? {}
  const nameError =
    errors.name ?? (serverFields.name ? t('settings.hierarchy.fields.nameRejected') : null)
  const codeError =
    errors.code ?? (serverFields.short_code ? t('settings.hierarchy.fields.codeTaken') : null)

  function submit(event) {
    event.preventDefault()
    const next = {}
    if (!name.trim()) next.name = t('settings.hierarchy.fields.nameRequired')
    // Optional here until the API made it a requirement at every tier. A form
    // that still called it optional would be a rejection waiting to happen.
    if (!code.trim()) next.code = t('settings.hierarchy.fields.codeRequired')
    setErrors(next)
    if (Object.keys(next).length) return

    onSubmit({
      name,
      code,
      isActive,
      // Carried through even when the form never showed it: the update schema
      // requires the field, and sending null on a rename would wipe a real
      // assignment made somewhere else.
      assetClassId: takesAssetClass ? assetClassId : null,
    })
  }

  // Escape is the dialog's job — Radix owns it, along with the focus trap and
  // restoring focus to the row that opened this.
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error && !serverFields.name && !serverFields.short_code ? (
        <WriteFailed error={error} />
      ) : null}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
        <Field
          id="node-name"
          label={t('settings.hierarchy.fields.name')}
          required
          // The form opened because someone chose to name something. Put the
          // caret where they are already about to type.
          autoFocus
          maxLength={NAME_MAX_LENGTH}
          value={name}
          error={nameError}
          onChange={(event) => setName(event.target.value)}
        />

        <Field
          id="node-code"
          label={t('settings.hierarchy.fields.code')}
          hint={t('settings.hierarchy.fields.codeHint')}
          required
          maxLength={CODE_MAX_LENGTH}
          value={code}
          error={codeError}
          onChange={(event) => setCode(event.target.value)}
          inputClassName="mono uppercase"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </div>

      {takesAssetClass ? (
        <ForgeSelect
          id="node-asset-class"
          label={t('settings.hierarchy.fields.assetClass')}
          hint={t('settings.hierarchy.fields.assetClassHint')}
          value={assetClassId}
          onValueChange={setAssetClassId}
          options={classOptions}
        />
      ) : null}

      {/* Not a delete. A line taken out of service keeps its history, its
          children and its identity — it simply stops being current. */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-hairline bg-card px-3.5 py-3">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="mt-0.5 accent-forge"
        />
        <span>
          <span className="block text-control text-ink">
            {t('settings.hierarchy.fields.active')}
          </span>
          <span className="mt-1 block text-body-sm text-ink-dim">
            {t('settings.hierarchy.fields.activeHint')}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <ForgeButton type="submit" variant="primary" disabled={pending}>
          {isCreate ? t('settings.hierarchy.create') : t('settings.hierarchy.save')}
        </ForgeButton>
        <ForgeButton type="button" onClick={onClose}>
          {t('settings.hierarchy.cancel')}
        </ForgeButton>
      </div>

      {/* ── Removal lives here, below a rule, and only on an existing record ──
          It used to be a trash icon on every row, one tab stop away from the add
          button and two pixels from the pencil — a destructive action at the same
          weight and the same size as the two safe ones beside it, repeated down
          the tree. Here it is named in words, separated by a hairline, and reached
          only from the form for the specific thing it would delete.

          A node with children is removable, and the consequence is stated BEFORE
          the click rather than discovered after it — the children are not deleted,
          they are cut loose. Amber, not red: nothing has failed, this is describing
          what the action will do. The dialog says it again on the way through,
          because that is the click that cannot be undone. */}
      {isCreate ? null : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-subtle pt-4">
          {hasChildren ? (
            <p id="remove-nested" className="m-0 max-w-[24rem] text-body-sm text-on-amber">
              {t('settings.hierarchy.deleteNested', { name: node.name, count: childCount })}
            </p>
          ) : null}
          <ForgeButton
            type="button"
            variant="danger"
            className="ms-auto"
            disabled={pending}
            aria-describedby={hasChildren ? 'remove-nested' : undefined}
            onClick={() => onDelete(node)}
          >
            <Icon name="trash" size="sm" />
            {t('settings.hierarchy.remove')}
          </ForgeButton>
        </div>
      )}
    </form>
  )
}
