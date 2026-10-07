import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { cn } from '@/lib/cn'
import { SAMPLE_PAYLOAD } from './samplePayload'
import { formatResolved, parsePath, renderPath, resolvePath } from './jsonPath'
import {
  JSON_TYPES,
  addChild,
  convertType,
  deleteNode,
  fromJSValue,
  isContainerType,
  makeNode,
  makeRoot,
  matchFieldsOf,
  matchValueOf,
  matcherFor,
  nodeChain,
  retarget,
  segmentsFor,
  toJSValue,
  updateNode,
} from './jsonTree'

/**
 * Building a `value_path` / `timestamp_path` by targeting a field in a payload.
 *
 * ── Target a node, get its path ───────────────────────────────────────────
 * The whole interaction is one gesture: every row carries a target control, and
 * the path to whatever is targeted is derived and shown at the top, always. There
 * is no separate "insert" step and nothing to assemble by hand — the expression is
 * a readout of the selection, not a thing you edit into existence.
 *
 * ── The payload is editable ───────────────────────────────────────────────
 * Keys, types, values, adding and deleting. A decoded broker message is the usual
 * starting point — loaded from the example, pasted, or read from a file — but a
 * payload nobody has captured yet can be built by hand, and a captured one can be
 * corrected where it does not match what the sensor will actually see.
 *
 * ── Arrays are the reason this exists ─────────────────────────────────────
 * One Sparkplug message carries several metrics together, so a topic alone cannot
 * identify a sensor's value. Targeting a field under an array member therefore has
 * to decide HOW that member is addressed, and the default is never position:
 * `$.metrics[0].value` is wrong the moment a publisher reorders its metrics, and
 * wrong silently — it reads Pressure and reports it as Temperature. Each array
 * carries a match control, defaulted to an identifying field and switchable to
 * `alias`, to any other scalar, or to position when position is genuinely meant.
 *
 * Changing the matched VALUE moves the target rather than editing the expression:
 * it is a statement about which member is meant. See `retarget`.
 *
 * ── The verdict is the match count ────────────────────────────────────────
 * `resolve_extraction_config` server-side takes `matches[0] if matches else None`.
 * So a path matching two metrics silently reads the first, and one matching none
 * stores a sensor that reads null forever. Neither is an error anywhere else in
 * the stack, which is why the count is stated here rather than the value alone.
 *
 * ── Where the payload comes from ─────────────────────────────────────────
 * There is no sample-payload endpoint — `resolve_extraction_config` is exposed by
 * no route and nothing subscribes to a topic. See `samplePayload.js`.
 */
export function JsonPathBuilder({ field, value, onCommit, onClose }) {
  const { t } = useTranslation(['app', 'common'])

  /**
   * Opens empty, not on the example.
   *
   * The example is a shape, not a fact about anybody's broker — its metric names
   * are invented. Loading it by default makes it the path of least resistance, and
   * a path built against `name=='Temperature'` resolves to nothing on a plant that
   * calls the metric something else. An empty tree asks the question the form
   * actually needs answered: what does YOUR payload look like. The example stays
   * one click away for anyone who wants the shape to start from.
   */
  const [root, setRoot] = useState(() => makeRoot('object'))
  const [targetId, setTargetId] = useState(null)
  /** Field-only, keyed by array node id. See `matcherFor`. */
  const [matchers, setMatchers] = useState(() => new Map())
  /** Non-null once the expression is hand-typed: the text owns it, not the tree. */
  const [raw, setRaw] = useState(() => (value ? String(value) : null))

  const payload = useMemo(() => toJSValue(root), [root])
  const targetSegments = useMemo(
    () => (targetId ? segmentsFor(root, targetId, matchers) : null),
    [root, targetId, matchers],
  )

  /**
   * The ids on the root → target walk.
   *
   * Threaded down the tree so each array can tell which of its members the target
   * sits under, which is what its value select has to show. Derived here rather
   * than looked up per row: one walk instead of one per array.
   */
  const chainIds = useMemo(() => {
    const chain = targetId ? nodeChain(root, targetId) : null
    return chain ? chain.map((entry) => entry.id) : []
  }, [root, targetId])

  const expression = raw ?? (targetSegments ? renderPath(targetSegments) : '$')
  /** Null when the typed text is outside the subset the tree can represent. */
  const effective = raw === null ? targetSegments : parsePath(raw)
  const matches = useMemo(
    () => (effective ? resolvePath(payload, effective) : []),
    [payload, effective],
  )

  function target(id) {
    setTargetId(id)
    // Targeting is an unambiguous statement of intent; it takes the expression
    // back from whatever was typed.
    setRaw(null)
  }

  function loadPayload(nextRoot) {
    setRoot(nextRoot)
    // The old target and the old matchers refer to ids that no longer exist.
    setTargetId(null)
    setMatchers(new Map())
  }

  /* Paste state lives here rather than in the toolbar, because the buttons sit in
     the header and the textarea they disclose sits below it — a growing panel
     inside the header would shrink the tree's scrollport every time it opened. */
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState(null)

  function loadFromText(source) {
    const trimmed = source.trim()
    if (!trimmed) return setPasteError('empty')

    let parsed
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return setPasteError('invalid')
    }
    // A bare scalar is valid JSON and has nothing to target inside it, so it is
    // reported as the wrong shape rather than loaded as a tree with one row.
    if (parsed === null || typeof parsed !== 'object') return setPasteError('notAnObject')

    loadPayload(fromJSValue(parsed))
    setPasting(false)
    setPasteText('')
    setPasteError(null)
  }

  const canCommit = expression.trim().length > 0 && expression.trim() !== '$'

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="xl"
      title={t('dataFusion.sensors.builder.title', { field: field.label })}
      description={t('dataFusion.sensors.builder.intro')}
      footer={
        <>
          <ForgeButton variant="primary" disabled={!canCommit} onClick={() => onCommit(expression)}>
            {t('dataFusion.sensors.builder.use')}
          </ForgeButton>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
        </>
      }
    >
      {/* ── The header does not move, because it is not sticky ──────────────
          It was, and sticky was the wrong tool here. `ForgeDialog`'s body is the
          scrollport, so a `sticky top-0` child pins to the top of THAT — and the
          `-mt-4.5` used to pull it flush through the body's padding put its flow
          position and its pinned position 18px apart, which is the strip of tree
          that appeared above the PATH label.

          Only the tree needs to scroll, so only the tree gets a scrollport. The
          header is then an ordinary block that cannot be scrolled past, no z-index
          and no negative margins involved. */}
      <div className="-mx-5 mb-2.5 border-b border-hairline px-5 pb-3">
        <PathBar
          expression={expression}
          onChange={(text) => setRaw(text)}
          representable={effective !== null}
          matches={matches}
          hasTarget={Boolean(targetId) || raw !== null}
        />
        <PayloadButtons
          pasting={pasting}
          empty={root.children.length === 0}
          onExample={() => loadPayload(fromJSValue(SAMPLE_PAYLOAD))}
          onTogglePaste={() => {
            setPasting((open) => !open)
            setPasteError(null)
          }}
          onFile={loadFromText}
          // Back to the state the builder opens in. The typed expression is left
          // alone: clearing the payload says nothing about the path someone wrote,
          // and the verdict will now report honestly that it matches nothing.
          onClear={() => loadPayload(makeRoot('object'))}
        />
      </div>

      {pasting ? (
        <PastePanel
          text={pasteText}
          error={pasteError}
          onChange={(next) => {
            setPasteText(next)
            setPasteError(null)
          }}
          onLoad={() => loadFromText(pasteText)}
          onCancel={() => setPasting(false)}
        />
      ) : null}

      {/* The one scrolling region. Capped so the header plus the tree stay inside
          the dialog body's own `min(60vh, 32rem)` — if this grew past it the body
          would scroll too, and two nested scrollbars is the thing the header was
          pinned to work around in the first place. */}
      <div className="max-h-[min(40vh,20rem)] overflow-y-auto rounded-sm border border-hairline bg-card p-2">
        <TreeRow
          node={root}
          depth={0}
          isRoot
          targetId={targetId}
          chainIds={chainIds}
          matchers={matchers}
          onTarget={target}
          onSetRoot={setRoot}
          onSetMatcher={(id, matcher) => setMatchers((m) => new Map(m).set(id, matcher))}
          onRetarget={(arrayId, index) => target(retarget(root, targetId, arrayId, index))}
        />
      </div>
    </ForgeDialog>
  )
}

/* ══ PATH BAR ══════════════════════════════════════════════════════════ */

/**
 * The expression and its verdict, above the tree.
 *
 * Editable, because the modelled subset — keys, indices, one equality filter — is
 * smaller than what the server accepts. A compound filter, a wildcard or a
 * recursive descent is legal for `jsonpath_ng.ext` and outside what the tree can
 * draw, so those are typed here and passed through untouched. `parsePath` returns
 * null for them and the bar says the tree no longer describes the expression,
 * rather than lossily rewriting a working path into a broken one.
 */
function PathBar({ expression, onChange, representable, matches, hasTarget }) {
  const { t } = useTranslation(['app', 'common'])
  const inputId = useId()

  const count = matches.length
  // Idle is checked FIRST. Nothing targeted and nothing typed also produces no
  // segments, which is indistinguishable from an unrepresentable expression by
  // shape alone — and reporting "the tree cannot draw this" over an empty builder
  // accuses the reader of something they have not done yet.
  const idle = !hasTarget
  const verdict = idle
    ? 'idle'
    : !representable
      ? 'unknown'
      : count === 1
        ? 'one'
        : count === 0
          ? 'none'
          : 'many'

  return (
    // Plain block. The header that holds this and the payload buttons is the part
    // that does not scroll — see the note at the call site.
    <div>
      <label htmlFor={inputId} className="eyebrow mb-1.5 block">
        {t('dataFusion.sensors.builder.pathLabel')}
      </label>

      <input
        id={inputId}
        value={expression}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-describedby={`${inputId}-verdict`}
        className={cn(
          'mono w-full rounded-sm border bg-card px-3 py-2.5 text-mono text-ink outline-none transition-colors',
          verdict === 'none' ? 'border-red' : 'border-hairline focus:border-forge',
        )}
      />

      <p
        id={`${inputId}-verdict`}
        role="status"
        className={cn(
          'mt-2 mb-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-sm px-2.5 py-1.5 text-body-sm',
          verdict === 'one'
            ? 'tint-green text-on-green'
            : verdict === 'none'
              ? 'tint-red text-on-red'
              : verdict === 'many'
                ? 'tint-amber text-on-amber'
                : 'bg-sunken text-ink-dim',
        )}
      >
        <span className="font-semibold">
          {t(`dataFusion.sensors.builder.verdict.${verdict}`, { count })}
        </span>
        {verdict === 'one' || verdict === 'many' ? (
          <Mono className="min-w-0 truncate">{formatResolved(matches[0])}</Mono>
        ) : null}
      </p>

      {!idle && !representable ? (
        <p className="mt-1.5 mb-0 flex items-start gap-1.5 text-body-sm text-ink-dim">
          <Icon name="bolt" size="xs" className="mt-0.5 shrink-0" />
          <span>{t('dataFusion.sensors.builder.beyondBuilder')}</span>
        </p>
      ) : null}
    </div>
  )
}

/* ══ PAYLOAD SOURCE ════════════════════════════════════════════════════ */

/**
 * Where the payload comes from, and how to empty it.
 *
 * Lives in the header, so the ways to load one stay reachable no matter how far
 * the tree has scrolled. The panel Paste opens does NOT live here — a textarea
 * unfolding inside the header would push the tree's scrollport down as it grew,
 * shrinking the thing you are trying to read.
 *
 * Clear used to sit apart from three ways of putting a payload IN — Load example,
 * Paste JSON, Upload file. Those three are commented out below rather than
 * deleted: the wiring they hang off is intact and untouched (`onExample`,
 * `onTogglePaste` and `onFile` are still passed in, `PastePanel` still renders on
 * `pasting`, and the i18n keys are still in the locale), so restoring any of them
 * is uncommenting one block.
 *
 * Clear is not styled as `danger` — nothing stored is at risk, this is a scratch
 * surface — and it is disabled once the tree is already empty, so it cannot be
 * pressed for no effect.
 */
// The four commented-out controls' props are still accepted and still passed by
// the caller — renamed to `_`-prefixed here only because lint requires that of an
// argument nothing reads. Restoring a button means uncommenting it and dropping
// the underscore.
function PayloadButtons({
  pasting: _pasting,
  empty,
  onExample: _onExample,
  onTogglePaste: _onTogglePaste,
  onFile: _onFile,
  onClear,
}) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
      <Eyebrow className="me-1">{t('dataFusion.sensors.builder.payloadLabel')}</Eyebrow>

      {/* <ForgeButton size="sm" onClick={onExample}>
        {t('dataFusion.sensors.builder.loadExample')}
      </ForgeButton>

      // A disclosure, so it says so. `aria-expanded` is the correct state here —
      // `pressed` belongs to IconButton and would leak to the DOM from this one.
      <ForgeButton
        size="sm"
        aria-expanded={pasting}
        aria-controls="payload-paste"
        onClick={onTogglePaste}
      >
        {t('dataFusion.sensors.builder.pasteJson')}
      </ForgeButton>

      <ForgeButton size="sm" onClick={() => fileRef.current?.click()}>
        {t('dataFusion.sensors.builder.uploadFile')}
      </ForgeButton>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => onFile(String(reader.result))
          reader.readAsText(file)
          // Cleared so re-picking the same file fires change again.
          event.target.value = ''
        }}
      /> */}

      <ForgeButton size="sm" disabled={empty} onClick={onClear}>
        {t('dataFusion.sensors.builder.clear')}
      </ForgeButton>
    </div>
  )
}

/**
 * Paste a decoded payload.
 *
 * Discloses in the scrolling body rather than opening a second dialog over this
 * one: a modal above a modal traps focus twice and leaves no way to see the tree
 * it is about to replace.
 */
function PastePanel({ text, error, onChange, onLoad, onCancel }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <div className="mb-2.5 rounded-sm border border-hairline bg-sunken p-3">
      <label className="eyebrow mb-1.5 block" htmlFor="payload-paste">
        {t('dataFusion.sensors.builder.pasteLabel')}
      </label>
      <textarea
        id="payload-paste"
        value={text}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-invalid={error ? true : undefined}
        placeholder={'{ "topic": "…", "metrics": [ … ] }'}
        className={cn(
          'mono w-full resize-y rounded-sm border bg-card px-3 py-2 text-mono text-ink outline-none placeholder:text-ink-dim',
          error ? 'border-red' : 'border-hairline focus:border-forge',
        )}
      />
      {error ? (
        <p role="alert" className="mt-1.5 mb-0 flex items-start gap-1.5 text-body-sm text-on-red">
          <Icon name="bolt" size="xs" className="mt-0.5 shrink-0" />
          <span>{t(`dataFusion.sensors.builder.pasteError.${error}`)}</span>
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <ForgeButton size="sm" variant="primary" onClick={onLoad}>
          {t('dataFusion.sensors.builder.pasteLoad')}
        </ForgeButton>
        <ForgeButton size="sm" onClick={onCancel}>
          {t('common:actions.cancel')}
        </ForgeButton>
      </div>
      <p className="mt-2 mb-0 text-body-sm text-ink-dim">
        {t('dataFusion.sensors.builder.replaceNote')}
      </p>
    </div>
  )
}

/* ══ TREE ══════════════════════════════════════════════════════════════ */

/**
 * One node, its controls, and everything under it.
 *
 * Every row can be targeted, containers included: a path to an object is unusual
 * for an extraction field and it is not this control's job to forbid it — the
 * verdict already reports what such a path resolves to.
 */
function TreeRow({
  node,
  depth,
  isRoot = false,
  arrayIndex = null,
  targetId,
  chainIds,
  matchers,
  onTarget,
  onSetRoot,
  onSetMatcher,
  onRetarget,
}) {
  const { t } = useTranslation(['app', 'common'])
  const [collapsed, setCollapsed] = useState(false)

  const container = isContainerType(node.type)
  const targeted = targetId === node.id
  const label = isRoot ? '$' : (node.key ?? String(arrayIndex))

  /** Which member of this array the target sits under. -1 when none does. */
  const activeIndex =
    node.type === 'array' ? node.children.findIndex((child) => chainIds.includes(child.id)) : -1

  const patch = (values) => onSetRoot((root) => updateNode(root, node.id, values))

  return (
    <div>
      <div
        style={{ paddingInlineStart: `${depth * 20}px` }}
        className={cn(
          'group flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-sm py-1 pe-1',
          targeted ? 'tint-forge' : 'hover:bg-sunken',
        )}
      >
        <TargetDot
          targeted={targeted}
          label={t('dataFusion.sensors.builder.target', { name: label })}
          onClick={() => onTarget(node.id)}
        />

        {container ? (
          <IconButton
            bare
            label={t(
              collapsed
                ? 'dataFusion.sensors.builder.expand'
                : 'dataFusion.sensors.builder.collapse',
              { name: label },
            )}
            onClick={() => setCollapsed((open) => !open)}
            className="size-5 shrink-0"
          >
            <Icon name={collapsed ? 'right' : 'down'} size="xs" />
          </IconButton>
        ) : (
          <span aria-hidden="true" className="size-5 shrink-0" />
        )}

        {/* Root has no key. An array member is identified by its position, which is
            not editable because it is not stored — it IS the position. */}
        {isRoot ? (
          <Mono className="shrink-0 text-ink">$</Mono>
        ) : arrayIndex !== null ? (
          <Num className="w-6 shrink-0 text-end text-micro font-normal text-ink-dim">
            {arrayIndex}
          </Num>
        ) : (
          <input
            value={node.key ?? ''}
            onChange={(event) => patch({ key: event.target.value })}
            placeholder={t('dataFusion.sensors.builder.keyPlaceholder')}
            aria-label={t('dataFusion.sensors.builder.keyLabel')}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="mono w-32 shrink-0 rounded-sm border border-hairline bg-card px-2 py-1 text-mono text-ink outline-none focus:border-forge"
          />
        )}

        <TreeSelect
          label={t('dataFusion.sensors.builder.typeLabel', { name: label })}
          value={node.type}
          onChange={(next) => onSetRoot((root) => convertType(root, node.id, next))}
          options={JSON_TYPES}
        />

        <ValueEditor node={node} onPatch={patch} />

        {container ? (
          <Num className="shrink-0 text-micro font-normal text-ink-dim">
            {t('dataFusion.sensors.builder.itemCount', { count: node.children.length })}
          </Num>
        ) : null}

        <span className="ms-auto flex shrink-0 items-center gap-0.5">
          {container ? (
            <IconButton
              bare
              label={t('dataFusion.sensors.builder.addChild', { name: label })}
              onClick={() => {
                onSetRoot((root) =>
                  addChild(root, node.id, makeNode(node.type === 'array' ? null : '', 'string')),
                )
                setCollapsed(false)
              }}
              className="size-7 opacity-60 group-hover:opacity-100"
            >
              <Icon name="plus" size="xs" />
            </IconButton>
          ) : null}
          {isRoot ? null : (
            <IconButton
              bare
              label={t('dataFusion.sensors.builder.deleteNode', { name: label })}
              onClick={() => onSetRoot((root) => deleteNode(root, node.id))}
              className="size-7 opacity-60 group-hover:opacity-100 hover:text-on-red"
            >
              <Icon name="trash" size="xs" />
            </IconButton>
          )}
        </span>
      </div>

      {container && !collapsed ? (
        <>
          {node.type === 'array' && node.children.length ? (
            <ArrayMatcher
              node={node}
              depth={depth}
              activeIndex={activeIndex}
              matcher={matcherFor(matchers, node)}
              onChange={(matcher) => onSetMatcher(node.id, matcher)}
              // With a target already under this array, switching member keeps the
              // same field and moves across. With none, the member itself becomes
              // the target — there is no deeper selection to preserve.
              onPickMember={(index) =>
                activeIndex >= 0 ? onRetarget(node.id, index) : onTarget(node.children[index].id)
              }
            />
          ) : null}

          {node.children.length ? (
            node.children.map((child, index) => (
              <TreeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                arrayIndex={node.type === 'array' ? index : null}
                targetId={targetId}
                chainIds={chainIds}
                matchers={matchers}
                onTarget={onTarget}
                onSetRoot={onSetRoot}
                onSetMatcher={onSetMatcher}
                onRetarget={onRetarget}
              />
            ))
          ) : isRoot ? (
            /* Nothing loaded yet. This is the builder's opening state, so it names
               the three ways in rather than describing the absence. */
            <p className="m-0 px-4 py-8 text-center text-body-sm text-ink-dim">
              {t('dataFusion.sensors.builder.emptyPayload')}
            </p>
          ) : (
            <p
              style={{ paddingInlineStart: `${(depth + 1) * 20 + 24}px` }}
              className="m-0 py-1 text-body-sm text-ink-dim"
            >
              {t('dataFusion.sensors.builder.emptyContainer')}
            </p>
          )}
        </>
      ) : null}
    </div>
  )
}

/**
 * Target this node.
 *
 * Drawn as a radio rather than given an icon: exactly one node is targeted at a
 * time, which is what a radio means, and the sprite carries no crosshair that
 * would say it more clearly than the shape does.
 */
function TargetDot({ targeted, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={targeted}
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-forge',
        targeted
          ? 'border-forge bg-forge'
          : 'border-hairline bg-card hover:border-forge opacity-60 group-hover:opacity-100',
      )}
    >
      {targeted ? <span className="size-1.5 rounded-full bg-white" /> : null}
    </button>
  )
}

/**
 * A node's value, by type.
 *
 * Containers get nothing — their value is their children, edited on their own
 * rows. `null` states itself, because an empty cell where a value belongs reads as
 * a field nobody filled in rather than as a deliberate null.
 */
function ValueEditor({ node, onPatch }) {
  const { t } = useTranslation('app')

  if (isContainerType(node.type)) return null

  if (node.type === 'null') {
    return <Mono className="shrink-0 text-ink-dim">null</Mono>
  }

  if (node.type === 'boolean') {
    return (
      <button
        type="button"
        onClick={() => onPatch({ value: !node.value })}
        className={cn(
          'mono shrink-0 rounded-sm px-2 py-1 text-mono transition-colors',
          node.value ? 'tint-green text-on-green' : 'tint-red text-on-red',
        )}
      >
        {String(Boolean(node.value))}
      </button>
    )
  }

  return (
    <input
      value={node.value ?? ''}
      type={node.type === 'number' ? 'number' : 'text'}
      onChange={(event) =>
        onPatch({
          value:
            node.type === 'number'
              ? event.target.value === ''
                ? ''
                : Number(event.target.value)
              : event.target.value,
        })
      }
      placeholder={t('dataFusion.sensors.builder.valuePlaceholder')}
      aria-label={t('dataFusion.sensors.builder.valueLabel')}
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      className={cn(
        'mono min-w-0 rounded-sm border border-hairline bg-card px-2 py-1 text-mono text-ink outline-none focus:border-forge',
        node.type === 'number' ? 'w-32 shrink-0' : 'flex-1 basis-40',
      )}
    />
  )
}

/**
 * How this array is addressed, and which member is meant.
 *
 * The field select is the real decision and the reason position is not the
 * default. The value select is a shortcut for the same thing targeting does:
 * changing it moves the target to the equivalent field under another member, so
 * comparing Temperature against Pressure is one click rather than a re-descent.
 */
function ArrayMatcher({ node, depth, activeIndex, matcher, onChange, onPickMember }) {
  const { t } = useTranslation(['app', 'common'])

  const fields = matchFieldsOf(node)
  const values =
    matcher.kind === 'filter' ? node.children.map((item) => matchValueOf(item, matcher.field)) : []

  // Nothing targeted under this array yet, so the select previews the first member
  // rather than showing an empty control.
  const shownIndex = activeIndex >= 0 ? activeIndex : 0
  const BY_INDEX = '__index__'

  return (
    <div
      style={{ paddingInlineStart: `${(depth + 1) * 20 + 4}px` }}
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 py-1"
    >
      <span className="text-micro font-normal text-ink-dim">
        {t('dataFusion.sensors.builder.matchBy')}
      </span>

      <TreeSelect
        label={t('dataFusion.sensors.builder.matchField')}
        value={matcher.kind === 'filter' ? matcher.field : BY_INDEX}
        onChange={(next) =>
          onChange(next === BY_INDEX ? { kind: 'index' } : { kind: 'filter', field: next })
        }
        options={[...fields, BY_INDEX]}
        renderOption={(option) =>
          option === BY_INDEX ? t('dataFusion.sensors.builder.byIndex') : option
        }
      />

      {matcher.kind === 'filter' && values.some((entry) => entry !== undefined) ? (
        <>
          <span aria-hidden="true" className="text-micro text-ink-mute">
            =
          </span>
          <TreeSelect
            label={t('dataFusion.sensors.builder.matchValue')}
            value={String(shownIndex)}
            onChange={(next) => onPickMember(Number(next))}
            options={values.map((_, index) => String(index))}
            renderOption={(index) => String(values[Number(index)] ?? '—')}
          />
        </>
      ) : null}
    </div>
  )
}

/**
 * A compact select for tree chrome.
 *
 * Native, following `TablePagination`'s rows-per-page control and for the same
 * reason: `ForgeSelect` is a 44px form field with a visible label above it and a
 * Radix listbox underneath, none of which fits a control that repeats on every row
 * of a dense tree. A native `<select>` is keyboard-accessible and screen-reader
 * labelled without being told what a combobox is.
 */
function TreeSelect({ label, value, onChange, options, renderOption = (option) => option }) {
  const id = useId()

  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mono shrink-0 rounded-sm border border-hairline bg-card px-1.5 py-1 text-mono text-ink-dim outline-none transition-colors focus:border-forge"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {renderOption(option)}
          </option>
        ))}
      </select>
    </>
  )
}
