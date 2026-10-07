import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect, StaticField } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Num } from '@/components/forge/primitives'
import { ENTITY_TYPES, NAME_MAX_LENGTH } from '@/features/assetClasses/api'
import {
  useAssetClasses,
  useCreateAssetClass,
  useDeleteAssetClass,
  useRenameAssetClass,
} from '@/features/assetClasses/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Asset Classes.
 *
 * The account's library of reusable types. A class is a template rather than a
 * machine on a floor: a machine model, a line configuration, a site blueprint,
 * a sensor type. Sites & Hierarchy holds the instances; this holds what they are
 * instances of, and each hierarchy record points back here.
 *
 * ── Two vocabularies, one meaning ────────────────────────────────────────
 * The API names its four types after the backend hierarchy — plant, line,
 * machine, sensor. This product names the same tiers site, production line,
 * asset, sensor, in PRODUCT.md and on every other screen. They are the same
 * things under two names, so the wire value below is exactly what the API
 * defines and only the label moves. Shipping "Plant" here would give the
 * product two words for one tier: a Site on one settings page and a Plant on
 * the next.
 *
 * ── Why a filter rail rather than a tree ─────────────────────────────────
 * Sites & Hierarchy is a tree because it has six nesting levels. This has none:
 * a class belongs to exactly one type and contains nothing. The type is a facet,
 * so it is rendered as one — and it is the API's own `?entity_type=` axis, not
 * navigation invented for the screen.
 *
 * ── No state colour ──────────────────────────────────────────────────────
 * Nothing here is running, degraded or alarming, so nothing here is coloured.
 * The four types are separated by their icon and their name. The only hue on the
 * screen is the accent on the active facet and the one primary button, which is
 * what The Rationed Hue Rule asks for: colour is how the machine raises its
 * hand, and a library is not raising its hand.
 */

/** Wire value → the icon that stands for that tier. */
const ENTITY_ICON = {
  plant: 'factory',
  line: 'conveyor',
  machine: 'machine',
  sensor: 'wave',
}

/**
 * Degrade rather than break on a type this build has never heard of.
 *
 * The enum is enforced by a Postgres type, so a fifth value means a backend
 * migration — and the backend and this app are separate repositories that ship
 * on separate branches, so the server will have it first. Without these two
 * fallbacks that day renders a missing-translation key in a table cell and an
 * empty square where the icon should be.
 */
const iconFor = (entityType) => ENTITY_ICON[entityType] ?? 'layers'
const labelFor = (t, entityType) =>
  ENTITY_ICON[entityType] ? t(`settings.assetClasses.types.${entityType}.label`) : entityType

/**
 * The type a new class defaults to.
 *
 * `machine` rather than the enum's first value: an equipment model is far and
 * away the most common thing anyone defines here, and the alternative is
 * defaulting to whatever happens to sort first.
 */
const DEFAULT_ENTITY_TYPE = 'machine'

export function AssetClassesPage() {
  const { t, i18n } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('settings.assetClasses.title')} · ${t('common:brand.name')}`)

  const { data, isPending, isError, error, refetch } = useAssetClasses()
  const createClass = useCreateAssetClass()
  const renameClass = useRenameAssetClass()
  const deleteClass = useDeleteAssetClass()

  /** `null` means every type. */
  const [facet, setFacet] = useState(null)
  const [query, setQuery] = useState('')
  /** `{ mode: 'create', entityType }` or `{ mode: 'rename', node }`. */
  const [editor, setEditor] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  // Memoised for its identity, not its cost: `?? []` mints a fresh array on
  // every render while the query is pending, and that alone would invalidate
  // both memos below on each one.
  const items = useMemo(() => data?.items ?? [], [data])

  const counts = useMemo(() => {
    const map = Object.fromEntries(ENTITY_TYPES.map((type) => [type, 0]))
    for (const item of items) map[item.entityType] = (map[item.entityType] ?? 0) + 1
    return map
  }, [items])

  const inFacet = useMemo(
    () => (facet ? items.filter((item) => item.entityType === facet) : items),
    [items, facet],
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? inFacet.filter((item) => item.name.toLowerCase().includes(needle))
      : inFacet
    // Sorted by the reader's locale, not by code-unit order: "Ökonomie" belongs
    // next to "Ofen" in German and after "Z" in neither.
    return [...matched].sort((a, b) => a.name.localeCompare(b.name, i18n.language))
  }, [inFacet, query, i18n.language])

  /* One dialog at a time, and each opens with no stale failure showing. */
  function openCreate() {
    createClass.reset()
    renameClass.reset()
    setPendingDelete(null)
    setEditor({ mode: 'create', entityType: facet ?? DEFAULT_ENTITY_TYPE })
  }

  function openRename(node) {
    createClass.reset()
    renameClass.reset()
    setPendingDelete(null)
    setEditor({ mode: 'rename', node })
  }

  function openDelete(node) {
    deleteClass.reset()
    setEditor(null)
    setPendingDelete(node)
  }

  function submitEditor({ name, entityType }) {
    if (editor.mode === 'create') {
      createClass.mutate({ name, entityType }, { onSuccess: () => setEditor(null) })
    } else {
      renameClass.mutate({ id: editor.node.id, name }, { onSuccess: () => setEditor(null) })
    }
  }

  const facetLabel = facet ? labelFor(t, facet) : t('settings.assetClasses.allTypes')
  const facetIntro = facet
    ? t(`settings.assetClasses.types.${facet}.description`)
    : t('settings.assetClasses.allTypesDescription')

  // A column where every cell reads the same tells nobody anything. The type is
  // only worth a column when more than one type is on screen.
  const showTypeColumn = facet === null
  const isNarrowing = query.trim().length > 0

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-6 max-w-[74ch]">
        <h1 className="m-0 text-display">{t('settings.assetClasses.title')}</h1>
        <p className="mt-3 text-body leading-[1.6] text-ink-dim">
          {t('settings.assetClasses.intro')}
        </p>
      </header>

      {isPending ? (
        <SkeletonRows count={4} />
      ) : isError ? (
        <ErrorState
          error={error}
          title={t('settings.assetClasses.loadFailed')}
          onRetry={refetch}
        />
      ) : (
        <div className="flex items-start gap-4 max-lg:flex-col max-lg:gap-3.5">
          <div
            role="group"
            aria-label={t('settings.assetClasses.filterLabel')}
            className={cn(
              'flex shrink-0 flex-wrap gap-1.5',
              'lg:w-[15rem] lg:flex-col lg:flex-nowrap lg:gap-0',
              'lg:overflow-hidden lg:rounded-sm lg:border lg:border-hairline lg:bg-card lg:shadow-edge',
            )}
          >
            <TypeFacet
              label={t('settings.assetClasses.allTypes')}
              icon="layers"
              count={items.length}
              active={facet === null}
              onClick={() => setFacet(null)}
            />
            {ENTITY_TYPES.map((type) => (
              <TypeFacet
                key={type}
                label={labelFor(t, type)}
                icon={iconFor(type)}
                count={counts[type]}
                active={facet === type}
                onClick={() => setFacet(type)}
              />
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-3.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
              <div className="min-w-0">
                <h2 className="m-0 text-title">{facetLabel}</h2>
                <p className="mt-1 max-w-[62ch] text-body-sm text-ink-dim">{facetIntro}</p>
              </div>
              <ForgeButton variant="primary" onClick={openCreate}>
                {t('settings.assetClasses.create')}
              </ForgeButton>
            </div>

            {items.length ? (
              <div className="mb-3.5 flex min-w-[16rem] items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge">
                <Icon name="search" size="sm" className="text-ink-mute" />
                <label className="sr-only" htmlFor="class-filter">
                  {t('settings.assetClasses.searchPlaceholder')}
                </label>
                <input
                  id="class-filter"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('settings.assetClasses.searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>
            ) : null}

            {visible.length ? (
              <>
                <Panel flush className="overflow-hidden">
                  <table className="w-full border-collapse">
                    <caption className="sr-only">
                      {t('settings.assetClasses.tableCaption', { type: facetLabel })}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="eyebrow bg-sunken px-3.5 py-2.5 text-start">
                          {t('settings.assetClasses.columns.name')}
                        </th>
                        {showTypeColumn ? (
                          <th scope="col" className="eyebrow bg-sunken px-3.5 py-2.5 text-start">
                            {t('settings.assetClasses.columns.type')}
                          </th>
                        ) : null}
                        <th scope="col" className="bg-sunken px-3.5 py-2.5">
                          <span className="sr-only">
                            {t('settings.assetClasses.columns.actions')}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-subtle transition-colors hover:border-forge/30 hover:bg-sunken"
                        >
                          <td className="px-3.5 py-2.5 text-body-sm font-semibold">{item.name}</td>
                          {showTypeColumn ? (
                            <td className="px-3.5 py-2.5">
                              <span className="flex items-center gap-2 text-body-sm text-ink-dim">
                                <Icon
                                  name={iconFor(item.entityType)}
                                  size="sm"
                                  className="text-ink-mute"
                                />
                                {labelFor(t, item.entityType)}
                              </span>
                            </td>
                          ) : null}
                          <td className="px-3.5 py-2.5">
                            <span className="flex items-center justify-end gap-1">
                              <IconButton
                                bare
                                label={t('settings.assetClasses.rename', { name: item.name })}
                                onClick={() => openRename(item)}
                                className="size-8"
                              >
                                <Icon name="pencil" size="sm" />
                              </IconButton>
                              <IconButton
                                bare
                                label={t('settings.assetClasses.remove', { name: item.name })}
                                onClick={() => openDelete(item)}
                                className="size-8 hover:text-on-red"
                              >
                                <Icon name="trash" size="sm" />
                              </IconButton>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>

                {/* Shown only while a search is narrowing the list. A count that
                    never changes is furniture. */}
                {isNarrowing ? (
                  <p className="mt-2.5 mb-0 text-body-sm text-ink-dim">
                    <Num>
                      {t('settings.assetClasses.showing', {
                        shown: formatInteger(visible.length),
                        total: formatInteger(inFacet.length),
                      })}
                    </Num>
                  </p>
                ) : null}
              </>
            ) : isNarrowing ? (
              <EmptyState
                icon="search"
                title={t('settings.assetClasses.noMatch')}
                body={t('settings.assetClasses.noMatchBody')}
                action={
                  <ForgeButton onClick={() => setQuery('')}>
                    {t('common:actions.clearFilters')}
                  </ForgeButton>
                }
              />
            ) : (
              <EmptyState
                icon={facet ? iconFor(facet) : 'layers'}
                title={
                  facet
                    ? t('settings.assetClasses.emptyFacet', { type: facetLabel.toLowerCase() })
                    : t('settings.assetClasses.empty')
                }
                body={facet ? facetIntro : t('settings.assetClasses.emptyBody')}
                action={
                  <ForgeButton variant="primary" onClick={openCreate}>
                    {t('settings.assetClasses.create')}
                  </ForgeButton>
                }
              />
            )}
          </div>
        </div>
      )}

      {/* Create and rename share one dialog. A modal because this writes to the
          real record: the class it produces is what hierarchy nodes will point
          at, and a mistyped type cannot be corrected afterwards. */}
      <ClassDialog
        editor={editor}
        pending={createClass.isPending || renameClass.isPending}
        error={editor?.mode === 'create' ? createClass.error : renameClass.error}
        onClose={() => setEditor(null)}
        onSubmit={submitEditor}
      />

      <DeleteDialog
        node={pendingDelete}
        pending={deleteClass.isPending}
        error={deleteClass.error}
        onClose={() => setPendingDelete(null)}
        onConfirm={() =>
          deleteClass.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })
        }
      />
    </div>
  )
}

/* ══ FACET RAIL ════════════════════════════════════════════════════════ */

/**
 * One type filter.
 *
 * A vertical rail on the desktop and a wrapping row of chips below `lg`, from
 * one class list rather than two renderings. Padding is written per side
 * (`ps`/`pe`) rather than as `px` throughout, so nothing depends on whether
 * Tailwind emits a logical utility before or after a physical one.
 *
 * The active state takes the accent tint and, on the rail, the 3px leading edge.
 * That edge is always present and merely changes colour, so the label never
 * shifts by three pixels when you select it.
 */
function TypeFacet({ label, icon, count, active, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-sm py-2 ps-3 pe-3 text-start text-body-sm transition-colors',
        'lg:w-full lg:rounded-none lg:border-s-[3px] lg:border-s-transparent lg:py-2.5 lg:ps-[11px] lg:pe-3.5',
        active
          ? 'tint-forge font-semibold text-on-forge lg:border-s-forge'
          : 'text-ink-dim hover:bg-sunken hover:text-ink',
      )}
    >
      <Icon name={icon} size="nav" className={cn(!active && 'text-ink-mute')} />
      <span className="min-w-0 flex-1">{label}</span>
      <Num className="text-micro font-normal">{formatInteger(count)}</Num>
    </button>
  )
}

/* ══ DIALOGS ═══════════════════════════════════════════════════════════ */

function ClassDialog({ editor, pending, error, onClose, onSubmit }) {
  const { t } = useTranslation(['app', 'common'])
  if (!editor) return null

  const isCreate = editor.mode === 'create'

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="md"
      title={
        isCreate
          ? t('settings.assetClasses.createTitle')
          : t('settings.assetClasses.renameTitle', { name: editor.node.name })
      }
      description={isCreate ? t('settings.assetClasses.createIntro') : undefined}
    >
      <ClassForm
        editor={editor}
        pending={pending}
        error={error}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </ForgeDialog>
  )
}

/**
 * Create and rename share one form.
 *
 * The type is a select on create and a stated fact on rename, because the API's
 * update schema accepts a name and nothing else. A disabled dropdown would be
 * the lazy way to show that and a worse one: it still looks like a control, so
 * it teaches someone to keep trying it.
 */
function ClassForm({ editor, pending, error, onClose, onSubmit }) {
  const { t } = useTranslation(['app', 'common'])
  const isCreate = editor.mode === 'create'

  const [name, setName] = useState(isCreate ? '' : editor.node.name)
  const [entityType, setEntityType] = useState(
    isCreate ? editor.entityType : editor.node.entityType,
  )
  const [localError, setLocalError] = useState(null)

  /**
   * The server's own wording is never rendered: it is untranslated and can
   * describe internals. `fields.name` is used only as a signal that the name is
   * what it refused, and this copy says so in the product's language.
   */
  const serverRejectedName = Boolean(error?.fields?.name)
  const nameError =
    localError ?? (serverRejectedName ? t('settings.assetClasses.fields.nameRejected') : null)

  function submit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError(t('settings.assetClasses.fields.nameRequired'))
      return
    }
    setLocalError(null)
    onSubmit({ name: trimmed, entityType })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error && !serverRejectedName ? <SaveFailed error={error} /> : null}

      <Field
        id="class-name"
        label={t('settings.assetClasses.fields.name')}
        hint={t('settings.assetClasses.fields.nameHint')}
        required
        // The dialog opened because someone chose to name something.
        autoFocus
        maxLength={NAME_MAX_LENGTH}
        value={name}
        error={nameError}
        onChange={(event) => setName(event.target.value)}
      />

      {isCreate ? (
        <ForgeSelect
          id="class-entity-type"
          label={t('settings.assetClasses.fields.entityType')}
          hint={t('settings.assetClasses.fields.entityTypeHint')}
          required
          value={entityType}
          onValueChange={setEntityType}
          options={ENTITY_TYPES.map((type) => ({
            value: type,
            label: labelFor(t, type),
            icon: iconFor(type),
          }))}
        />
      ) : (
        <StaticField
          label={t('settings.assetClasses.fields.entityType')}
          hint={t('settings.assetClasses.fields.entityTypeFixed')}
          icon={iconFor(editor.node.entityType)}
        >
          {labelFor(t, editor.node.entityType)}
        </StaticField>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <ForgeButton type="submit" variant="primary" disabled={pending}>
          {isCreate ? t('settings.assetClasses.create') : t('settings.assetClasses.save')}
        </ForgeButton>
        <ForgeButton type="button" onClick={onClose}>
          {t('common:actions.cancel')}
        </ForgeButton>
      </div>
    </form>
  )
}

/**
 * A failed write, stated inside the dialog that attempted it.
 *
 * This screen talks to the real API, so a write can genuinely fail — and a
 * dialog that closes on failure, or sits there looking idle, is how a
 * disappeared record gets reported as a data-loss bug.
 */
function SaveFailed({ error }) {
  const { t } = useTranslation(['app', 'common'])
  return (
    <div role="alert" className="rounded-sm border border-hairline stripe-red bg-card p-3.5">
      <p className="m-0 text-control text-on-red">{t('settings.assetClasses.saveFailed')}</p>
      <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">
        {t(`common:${error.messageKey}`)}
      </p>
      {error.requestId ? (
        <p className="mono mt-2 mb-0 text-micro font-normal text-ink-dim">
          {t('common:errors.requestId', { id: error.requestId })}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Removal always asks.
 *
 * The deletion is soft on the server: the row keeps its identity and drops out
 * of every listing, so anything already pointing at this class keeps a reference
 * that still resolves. The copy says that rather than implying a cascade,
 * because "will this unassign my machines?" is the question anyone about to
 * press this is actually asking.
 */
function DeleteDialog({ node, pending, error, onClose, onConfirm }) {
  const { t } = useTranslation(['app', 'common'])
  if (!node) return null

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="sm"
      title={t('settings.assetClasses.deleteTitle', { name: node.name })}
      footer={
        <>
          <ForgeButton variant="danger" disabled={pending} onClick={onConfirm}>
            {t('settings.assetClasses.deleteConfirm')}
          </ForgeButton>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
        </>
      }
    >
      {error ? <SaveFailed error={error} /> : null}
      <p className={cn('m-0 text-body text-ink-dim', error && 'mt-4')}>
        {t('settings.assetClasses.deleteBody')}
      </p>
    </ForgeDialog>
  )
}
