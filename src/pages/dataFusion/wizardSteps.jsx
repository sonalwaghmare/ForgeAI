import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { NAME_MAX_LENGTH, endpointLabel } from '@/features/dataFusion/api'
import { cn } from '@/lib/cn'
import { formatMeasure } from '@/lib/units'
import { ConfigField } from './ConfigField'

/**
 * The four steps of the connection wizard, shared by Connect-source (create) and
 * the edit dialog.
 *
 * ── Why they are shared ───────────────────────────────────────────────────
 * A generated form over the same `config_schema` is the whole point: connect and
 * edit read the same catalogue, run the same probe against the same endpoint, and
 * write the same payload shape. Two copies of these steps would drift into two
 * copies of the coercion rules the server's validator relies on — see
 * buildConnectionConfig for why that is worse than it looks.
 *
 * ── What edit changes, and why here ───────────────────────────────────────
 * `ConnectionUpdate` has no `plant_id` and no `connector_type_id`, so a
 * connection cannot move site or change protocol. Both are still shown so the
 * wizard's shape carries between screens, and both are LOCKED where they appear:
 * step 1's radios are disabled and cannot deselect, step 4's site select is
 * disabled with the current value pre-selected. The alternative — hiding those
 * steps on edit — is a different wizard, not the same one.
 */

export const WIZARD_STEPS = ['connector', 'configure', 'test', 'details']

/* ══ STEP INDICATOR ════════════════════════════════════════════════════ */

/**
 * Where you are in four steps.
 *
 * An ordered list rather than a row of decorated divs, so a screen reader gets
 * "1 of 4" from the markup; the current step carries `aria-current`.
 */
/**
 * @param {object} props
 * @param {number} props.current
 * @param {string[]} [props.steps] Defaults to this wizard's own four. The demo
 *   families' wizard has four differently-named steps and the same chrome; a
 *   second copy of this would be a second place to fix the next spacing change.
 * @param {string} [props.ns] Key prefix for the step labels.
 */
export function StepIndicator({ current, steps = WIZARD_STEPS, ns = 'dataFusion.connect.steps' }) {
  const { t } = useTranslation('app')

  return (
    <ol className="mb-5 flex list-none flex-wrap items-center gap-y-2 p-0">
      {steps.map((id, index) => {
        const done = index < current
        const active = index === current

        return (
          <li key={id} className="flex items-center gap-2">
            <span aria-current={active ? 'step' : undefined} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'num flex size-[22px] shrink-0 items-center justify-center rounded-full text-micro',
                  done && 'bg-green text-white',
                  active && 'bg-forge text-white',
                  !done && !active && 'bg-sunken text-ink-dim',
                )}
              >
                {done ? <Icon name="check" size="xs" /> : index + 1}
              </span>
              <span
                className={cn('text-body-sm', active ? 'font-semibold text-ink' : 'text-ink-dim')}
              >
                {t(`${ns}.${id}`)}
              </span>
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="mx-2 h-px w-4 bg-hairline" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/* ══ STEP 1 — CONNECTOR ════════════════════════════════════════════════ */

/**
 * The catalogue, two columns of radio cards.
 *
 * ── Create: clicking a card advances, arrowing between them does not ─────
 * `event.detail` separates a pointer activation (reports 1+) from a keyboard one
 * (reports 0). A mouse or a tap advances; a keyboard selects freely and advances
 * with Continue. See the note in `ConnectSourceWizard` for the full argument.
 *
 * ── Edit: locked ─────────────────────────────────────────────────────────
 * `ConnectionUpdate` has no `connector_type_id`, so the connector cannot change
 * on edit. The step still renders — the wizard's shape is the same on both
 * screens — but every radio is disabled, the click-to-advance is gone, and the
 * hint says why the choice cannot be revisited.
 *
 * @param {object} props
 * @param {object} props.catalogue
 * @param {Array<object>} props.types
 * @param {string|null} props.selectedId
 * @param {(id: string) => void} props.onSelect
 * @param {() => void} props.onAdvance
 * @param {boolean} [props.locked]     Edit mode: no selection, no advance-on-click.
 */
export function ConnectorStep({
  catalogue,
  types,
  selectedId,
  onSelect,
  onAdvance,
  locked = false,
}) {
  const { t } = useTranslation(['app', 'common'])

  if (catalogue.isPending) return <SkeletonRows count={2} />
  if (catalogue.isError) {
    return (
      <ErrorState
        error={catalogue.error}
        title={t('dataFusion.connect.catalogueFailed')}
        onRetry={catalogue.refetch}
      />
    )
  }
  if (!types.length) {
    return (
      <p className="m-0 rounded-sm bg-sunken p-4 text-body-sm text-ink-dim">
        {t('dataFusion.connect.noConnectors')}
      </p>
    )
  }

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">{t('dataFusion.connect.chooseConnector')}</legend>
      {locked ? (
        <p className="mb-3 flex items-start gap-1.5 text-body-sm text-ink-dim">
          <Icon name="lock" size="xs" className="mt-0.5 shrink-0" />
          <span>{t('dataFusion.edit.connectorLocked')}</span>
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
        {types.map((type) => {
          const selected = type.id === selectedId
          // In locked mode, the un-selected cards are drawn as visibly disabled
          // rather than hidden: hiding them would erase the choice that was
          // originally made, which is the one thing this step still says.
          const dimmed = locked && !selected

          return (
            <label
              key={type.id}
              className={cn(
                'flex items-center gap-2.5 rounded-sm border bg-card p-3.5 transition-colors',
                locked ? 'cursor-not-allowed' : 'cursor-pointer',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-on-forge',
                selected
                  ? 'border-forge tint-forge'
                  : dimmed
                    ? 'border-hairline opacity-50'
                    : 'border-hairline hover:border-forge/40 hover:bg-sunken',
              )}
            >
              <input
                type="radio"
                name="connector-type"
                value={type.id}
                checked={selected}
                disabled={locked}
                onChange={() => {
                  if (!locked) onSelect(type.id)
                }}
                onClick={(event) => {
                  // Pointer only. See the note at the top of this step.
                  if (!locked && event.detail > 0) onAdvance()
                }}
                className="sr-only"
              />
              <Icon
                name="plug"
                size="nav"
                className={selected ? 'text-on-forge' : 'text-ink-dim'}
              />
              <span className="min-w-0">
                <span className="block text-body-sm font-semibold text-ink" translate="no">
                  {type.name}
                </span>
                <Mono className="mt-0.5 block truncate text-ink-dim uppercase">
                  {type.protocolFamily}
                </Mono>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/* ══ STEP 2 — CONFIGURATION ════════════════════════════════════════════ */

/**
 * Display name, then everything the connector type declares.
 *
 * ── `wasMasked` is the edit-mode credential hint ─────────────────────────
 * `GET /connections/{id}` masks stored credentials as eight bullet characters,
 * and PUT probes the config before saving — so the mask cannot be round-tripped.
 * Edit blanks those fields; this hint says so, next to the exact field that was
 * cleared. Empty on create.
 *
 * @param {object} props
 * @param {object} props.connector
 * @param {string} props.name
 * @param {string|null} props.nameError
 * @param {(next: string) => void} props.onNameChange
 * @param {Record<string, *>} props.values
 * @param {Record<string, boolean>} props.missing
 * @param {Set<string>} [props.wasMasked]         Edit mode: fields cleared from the masked read.
 * @param {(key: string, value: *) => void} props.onChange
 * @param {Record<string, string>} [props.serverFields]  Server-rejected field messages.
 */
export function ConfigureStep({
  connector,
  name,
  nameError,
  onNameChange,
  values,
  missing,
  wasMasked,
  onChange,
  serverFields = {},
}) {
  const { t } = useTranslation(['app', 'common'])

  if (!connector) {
    return (
      <p className="m-0 rounded-sm bg-sunken p-3 text-body-sm text-ink-dim">
        {t('dataFusion.edit.noSchema')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        id="wizard-name"
        label={t('dataFusion.connect.name')}
        hint={t('dataFusion.connect.nameHint')}
        required
        autoFocus
        maxLength={NAME_MAX_LENGTH}
        placeholder={connector.name}
        value={name}
        error={nameError ?? undefined}
        onChange={(event) => onNameChange(event.target.value)}
      />

      {connector.fields.map((field) => (
        <ConfigField
          key={field.key}
          field={field}
          value={values[field.key]}
          hint={
            wasMasked?.has(field.key) ? t('dataFusion.edit.credentialBlanked') : undefined
          }
          error={
            (missing[field.key] ? t('dataFusion.connect.fieldRequired') : undefined) ??
            serverFields[field.key]
          }
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
    </div>
  )
}

/* ══ STEP 3 — TEST ═════════════════════════════════════════════════════ */

/**
 * The probe, given the whole step.
 *
 * Every state (idle, testing, passed, failed, error) draws differently and every
 * one of them has to hold three facts at once: the verdict, the round trip, and
 * the address being dialled. See the note at the top of this module and the
 * `ProbePanel` file for the reasoning behind the diagram, the number and the
 * verbatim rendering of the server's diagnostic on failure.
 */
export function TestStep({ connector, values, probe, onTest }) {
  const { t } = useTranslation(['app', 'common'])

  const { state } = probe
  const testing = state === 'testing'
  const passed = state === 'passed'
  const failed = state === 'failed'
  const address = endpointLabel(connector, values)
  const seconds = probe.durationMs != null ? probe.durationMs / 1000 : null

  return (
    <div className="flex flex-col items-center py-5 text-center">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-12 items-center justify-center rounded-xl',
          passed ? 'tint-green' : failed ? 'tint-red' : 'bg-sunken',
        )}
      >
        <Icon
          name={passed ? 'check' : failed ? 'x' : 'plug'}
          size="lg"
          className={
            passed
              ? 'text-on-green'
              : failed
                ? 'text-on-red'
                : testing
                  ? 'text-on-forge'
                  : 'text-ink-dim'
          }
        />
      </span>

      <p
        role="status"
        className={cn(
          'mt-3.5 mb-0 text-body font-semibold',
          passed ? 'text-on-green' : failed ? 'text-on-red' : 'text-ink',
        )}
      >
        {state === 'idle'
          ? t('dataFusion.connect.readyTitle')
          : t(`dataFusion.connect.verdict.${state}`)}
      </p>

      {state === 'idle' ? (
        <p className="mx-auto mt-1.5 mb-0 max-w-[46ch] text-body-sm text-ink-dim">
          {t('dataFusion.connect.readyBody')}
        </p>
      ) : seconds != null && (passed || failed) ? (
        <Num className="mt-1.5 block text-body-sm text-ink-dim">
          {t('dataFusion.connect.roundTrip', {
            duration: formatMeasure({ value: seconds, unit: 's' }, { digits: 2 }),
          })}
        </Num>
      ) : null}

      {address ? (
        <Mono className="mt-2 block max-w-full truncate text-ink-dim">{address}</Mono>
      ) : (
        <span className="mt-2 text-micro font-normal text-ink-dim">
          {t('dataFusion.connect.noAddress')}
        </span>
      )}

      {testing ? (
        <span
          aria-hidden="true"
          className="relative mt-4 hidden h-1.5 w-60 max-w-full overflow-hidden rounded-full bg-sunken motion-safe:block"
        >
          <span className="absolute inset-y-0 w-[30%] rounded-full bg-on-forge animate-probe" />
        </span>
      ) : null}

      <ForgeButton
        variant={passed ? 'secondary' : 'primary'}
        className="mt-4"
        disabled={testing}
        onClick={onTest}
      >
        {testing
          ? t('dataFusion.connect.testingShort')
          : state === 'idle'
            ? t('dataFusion.connect.run')
            : t('dataFusion.connect.testAgain')}
      </ForgeButton>

      {failed && probe.detail ? (
        <div
          role="alert"
          className="mt-4 w-full rounded-sm border border-hairline stripe-red bg-card p-3.5 text-start"
        >
          <Eyebrow>{t('dataFusion.connect.reportedBySource')}</Eyebrow>
          <Mono className="mt-1.5 block break-words text-on-red">{probe.detail}</Mono>
        </div>
      ) : null}

      {state === 'error' && probe.transportError ? (
        <div
          role="alert"
          className="mt-4 w-full rounded-sm border border-hairline stripe-red bg-card p-3.5 text-start"
        >
          <p className="m-0 text-body-sm text-ink-dim">
            {t(`common:${probe.transportError.messageKey}`)}
          </p>
          {probe.transportError.requestId ? (
            <p className="mono mt-2 mb-0 text-micro font-normal text-ink-dim">
              {t('common:errors.requestId', { id: probe.transportError.requestId })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ══ STEP 4 — DETAILS ══════════════════════════════════════════════════ */

/**
 * Site, and whether to start (or keep) reading.
 *
 * ── `siteLocked` is edit mode ────────────────────────────────────────────
 * `ConnectionUpdate` accepts neither `plant_id` nor anything that could change
 * the site. On edit the select is drawn disabled with the stored value
 * pre-selected — same control, no interactive affordance — and the hint above it
 * says why. The alternative of hiding the field entirely erases a scope decision
 * the reader may need to see to trust what they are saving.
 *
 * ── Write errors are absorbed here on both modes ─────────────────────────
 * The server probes on create AND update. A rejected write with
 * `fields.connection_config` is a statement about the endpoint and belongs on
 * step 3, so the parent routes back rather than showing it here. Everything
 * else — a rejected name, a validation refusal, a dropped request — lands in
 * this step because this is the one holding the submit button.
 */
export function DetailsStep({
  hierarchy,
  plantId,
  onPlantChange,
  isActive,
  onActiveChange,
  siteError,
  writeError,
  siteLocked = false,
}) {
  const { t } = useTranslation(['app', 'common'])

  const sites = (hierarchy.data?.items ?? [])
    .filter((node) => node.tier === 'site')
    .map((node) => ({ value: node.id, label: node.name }))

  const fields = writeError?.fields ?? {}
  const nameRejected = Boolean(fields.name)
  const resolvedSiteError =
    siteError ?? (fields.plant_id ? t('dataFusion.connect.siteRejected') : undefined)

  // A write that failed for a reason not owned by another step — the probe panel
  // owns `connection_config`, step 2 owns `name`. What is left is the generic
  // rejection, and it lands here because this is the step holding the write's
  // button.
  const genericError =
    writeError && !fields.connection_config && !nameRejected && !fields.plant_id ? writeError : null

  return (
    <div className="flex flex-col gap-4">
      {fields.connection_config ? (
        <div role="alert" className="rounded-sm border border-hairline stripe-red bg-card p-3.5">
          <p className="m-0 text-control text-on-red">
            {t('dataFusion.connect.createUnreachable')}
          </p>
          <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">
            {t('dataFusion.connect.createUnreachableBody')}
          </p>
          <Mono className="mt-2 block break-words text-on-red">{fields.connection_config}</Mono>
        </div>
      ) : genericError ? (
        <div role="alert" className="rounded-sm border border-hairline stripe-red bg-card p-3.5">
          <p className="m-0 text-control text-on-red">{t('dataFusion.connect.createFailed')}</p>
          <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">
            {t(`common:${genericError.messageKey}`)}
          </p>
          {genericError.requestId ? (
            <p className="mono mt-2 mb-0 text-micro font-normal text-ink-dim">
              {t('common:errors.requestId', { id: genericError.requestId })}
            </p>
          ) : null}
        </div>
      ) : null}

      {nameRejected ? (
        <div role="alert" className="rounded-sm border border-hairline stripe-red bg-card p-3.5">
          <p className="m-0 text-control text-on-red">{t('dataFusion.connect.nameRejected')}</p>
        </div>
      ) : null}

      <Eyebrow>{t('dataFusion.connect.scope')}</Eyebrow>

      {siteLocked ? (
        <ForgeSelect
          id="wizard-site"
          label={t('common:hierarchy.site')}
          hint={t('dataFusion.edit.siteLocked')}
          required
          disabled
          value={plantId}
          onValueChange={() => {}}
          options={sites.length ? sites : [{ value: plantId, label: plantId }]}
          placeholder={t('dataFusion.connect.choose')}
        />
      ) : hierarchy.isError ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-control text-ink">{t('common:hierarchy.site')}</span>
          <p className="m-0 flex items-start gap-1.5 text-body-sm text-on-red">
            <Icon name="bolt" size="xs" className="mt-0.5 shrink-0" />
            <span>{t('dataFusion.connect.hierarchyFailed')}</span>
          </p>
        </div>
      ) : (
        <ForgeSelect
          id="wizard-site"
          label={t('common:hierarchy.site')}
          hint={t('dataFusion.connect.siteHint')}
          required
          value={plantId}
          onValueChange={onPlantChange}
          options={sites}
          error={resolvedSiteError}
          placeholder={
            hierarchy.isPending
              ? t('common:loading')
              : sites.length
                ? t('dataFusion.connect.choose')
                : t('dataFusion.connect.noSites')
          }
        />
      )}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-hairline bg-card px-3.5 py-3">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => onActiveChange(event.target.checked)}
          className="mt-0.5 accent-forge"
        />
        <span>
          <span className="block text-control text-ink">{t('dataFusion.connect.active')}</span>
          <span className="mt-1 block text-body-sm text-ink-dim">
            {t('dataFusion.connect.activeHint')}
          </span>
        </span>
      </label>
    </div>
  )
}
