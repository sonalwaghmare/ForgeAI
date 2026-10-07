import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ErrorSummary } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import {
  buildExtractionConfig,
  buildWaveformMetadata,
  invalidFormat,
  missingRequired,
} from '@/features/dataFusion/api'
import { useConnection, useConnectorTypes } from '@/features/dataFusion/queries'
import { useAssetClasses } from '@/features/assetClasses/queries'
import { useHierarchyNodes } from '@/features/hierarchy/queries'
import { parentOf } from '@/features/hierarchy/parents'
import { DEFAULT_VALUE_TYPE, waveformTypeById } from '@/features/sensors/api'
import {
  useCreateSensor,
  useSensor,
  useUpdateSensor,
  useValueUnits,
  useWaveformTypes,
} from '@/features/sensors/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { SensorForm } from './SensorForm'
import { WriteFailed } from './SensorDialogs'
import { connectionPath } from './sections'

/**
 * Onboarding and editing a sensor, as a screen.
 *
 * ── Why this is not a dialog ──────────────────────────────────────────────
 * It was one, and the form did not fit: `ForgeDialog`'s body is capped at
 * `min(60vh, 32rem)`, and this form carries eight fields — three of them generated
 * from the connector's `extraction_schema` — plus a three-level placement cascade.
 * Everything past the first section lived below a scroll line, which means the
 * thing you are about to save cannot be read in one look before you save it.
 *
 * As a route it also gets what a dialog cannot have: an address someone can send,
 * a back target that survives a reload, and browser history — so the escape from a
 * half-filled form is Back rather than a discarded dialog.
 *
 * ── One component, two modes ──────────────────────────────────────────────
 * `:sensorId` present means edit. The form, its validation and its payload
 * assembly are identical either way; what differs is where the initial values come
 * from and which mutation runs. Two components would be two copies of the same
 * coercion rules to keep in step with one validator.
 */
export function SensorFormPage() {
  const { connectionId, sensorId } = useParams()
  const { t } = useTranslation(['app', 'common'])

  const connection = useConnection(connectionId)
  const catalogue = useConnectorTypes()
  const hierarchy = useHierarchyNodes()
  const assetClasses = useAssetClasses()
  const waveformTypes = useWaveformTypes()
  const valueUnits = useValueUnits()
  const sensor = useSensor(sensorId)

  const editing = Boolean(sensorId)

  useDocumentTitle(
    `${editing ? t('dataFusion.sensors.edit.title') : t('dataFusion.sensors.create.title')} · ${t('common:brand.name')}`,
  )

  const connector = useMemo(() => {
    if (connection.data?.connectorType) return connection.data.connectorType
    return (
      (catalogue.data?.items ?? []).find((type) => type.id === connection.data?.connectorTypeId) ??
      null
    )
  }, [connection.data, catalogue.data])

  /**
   * Nothing renders until every source has landed.
   *
   * The form's values are built in a `useState` initialiser, which runs exactly
   * once — mounting before the sensor or the schema arrives would initialise blank
   * and never prefill, and a full-replace PUT built from that sends empty strings
   * over stored values. `isPending` is false on failure too, so a failed request
   * falls through to the error branch rather than holding a skeleton forever.
   *
   * The waveform catalogue belongs in this list and not merely in it for tidiness.
   * `waveform_metadata` is assembled from the SELECTED type's `metadata_schema`,
   * so a form that mounted before the catalogue arrived would build it from an
   * empty field list — sending `{}` and, on an edit, replacing a stored alarm band
   * with nothing while returning 200.
   */
  const pending =
    connection.isPending ||
    catalogue.isPending ||
    hierarchy.isPending ||
    assetClasses.isPending ||
    waveformTypes.isPending ||
    valueUnits.isPending ||
    (editing && sensor.isPending)

  /**
   * The master data is a hard dependency, so a failure to load it is fatal rather
   * than degradable. `waveform_type_id` and `value_unit_id` are non-nullable with
   * no server-side default: without the lists there is nothing to choose from and
   * nothing to fall back on, so every submit would 422. Better to say the screen
   * could not load and offer a retry than to render a form that cannot be saved.
   */
  const failed =
    connection.isError || waveformTypes.isError || valueUnits.isError || (editing && sensor.isError)

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <Link
        to={connectionPath(connectionId)}
        className="inline-flex items-center gap-1.5 text-body-sm text-ink-dim transition-colors hover:text-ink"
      >
        <Icon name="right" size="xs" className="rotate-180 rtl:rotate-0" />
        {connection.data?.name ?? t('dataFusion.sensors.backToSensors')}
      </Link>

      {pending ? (
        <div className="mt-5">
          <SkeletonRows count={4} />
        </div>
      ) : failed ? (
        <ErrorState
          error={connection.error ?? sensor.error ?? waveformTypes.error ?? valueUnits.error}
          title={t(
            editing ? 'dataFusion.sensors.edit.loadFailed' : 'dataFusion.sensors.connectionFailed',
          )}
          onRetry={() => {
            connection.refetch()
            waveformTypes.refetch()
            valueUnits.refetch()
            if (editing) sensor.refetch()
          }}
          className="mt-5"
        />
      ) : (
        <Editor
          key={sensorId ?? 'new'}
          connection={connection.data}
          connector={connector}
          hierarchy={hierarchy}
          assetClasses={assetClasses}
          waveformTypes={waveformTypes.data?.items ?? []}
          valueUnits={valueUnits.data?.items ?? []}
          sensor={editing ? sensor.data : null}
        />
      )}
    </div>
  )
}

/* ══ THE FORM ══════════════════════════════════════════════════════════ */

function Editor({
  connection,
  connector,
  hierarchy,
  assetClasses,
  waveformTypes,
  valueUnits,
  sensor,
}) {
  const { t } = useTranslation(['app', 'common'])
  const navigate = useNavigate()

  const create = useCreateSensor()
  const update = useUpdateSensor()

  const editing = Boolean(sensor)
  const write = editing ? update : create
  const extractionFields = connector?.extractionFields ?? []

  const summaryRef = useRef(null)
  const [values, setValues] = useState(() =>
    initialValues({ extractionFields, waveformTypes, sensor, connection }),
  )
  const [showErrors, setShowErrors] = useState(false)
  /** The last sensor onboarded, held so the run can continue without a reload. */
  const [created, setCreated] = useState(null)

  /**
   * The selected waveform type, resolved from the catalogue on every render rather
   * than held in state beside its id.
   *
   * Two copies of one fact is one too many: the id is what the payload carries and
   * what the select binds to, so deriving the rest of the record from it means the
   * two can never disagree. Null when nothing is chosen yet, and also when a stored
   * id no longer resolves — see `waveformTypeById` for why that is a real state.
   */
  const waveformType = waveformTypeById(waveformTypes, values.waveformTypeId)
  const metadataFields = waveformType?.metadataFields ?? []

  const errors = formErrors({
    values,
    extractionFields,
    metadataFields,
    serverFields: write.error?.fields ?? {},
    t,
  })
  const blocked = Boolean(
    errors.name ||
    errors.description ||
    errors.parent ||
    errors.waveformTypeId ||
    errors.valueUnitId ||
    Object.keys(errors.extraction).length ||
    Object.keys(errors.waveformMetadata).length,
  )

  function submit() {
    setShowErrors(true)
    if (blocked) {
      // Focused rather than merely rendered: a keyboard user who submits an invalid
      // form otherwise gets no signal that anything happened.
      summaryRef.current?.focus()
      return
    }

    const payload = {
      name: values.name,
      description: values.description,
      parent: values.parent,
      assetClassId: values.assetClassId,
      valueType: values.valueType,
      extractionConfig: buildExtractionConfig(extractionFields, values.extraction),
      waveformTypeId: values.waveformTypeId,
      // Built from the SELECTED type's fields only. State holds every value ever
      // typed, including an `update_interval` left behind by a shape that wanted
      // one — assembling from `metadataFields` is what keeps that out of the
      // request, where the validator would have no field to match it against.
      waveformMetadata: buildWaveformMetadata(metadataFields, values.waveformMetadata),
      valueUnitId: values.valueUnitId,
    }

    if (editing) {
      // `parent` is deliberately not spread through: SensorUpdate does not accept
      // it, and Pydantic would drop it without complaint. See updateSensor.
      update.mutate(
        {
          id: sensor.id,
          name: payload.name,
          description: payload.description,
          assetClassId: payload.assetClassId,
          valueType: payload.valueType,
          extractionConfig: payload.extractionConfig,
          waveformTypeId: payload.waveformTypeId,
          waveformMetadata: payload.waveformMetadata,
          valueUnitId: payload.valueUnitId,
        },
        { onSuccess: () => back() },
      )
    } else {
      create.mutate(
        { ...payload, connectionId: connection.id },
        { onSuccess: (row) => setCreated(row) },
      )
    }
  }

  const back = () => navigate(connectionPath(connection.id))

  /**
   * Go again, keeping what a run of sensors holds constant.
   *
   * The name, the description and the extraction paths change per sensor; the
   * placement, the class, the value type, the unit and the whole signal
   * description usually do not. Onboarding forty thermocouples off one machine
   * means forty identical ranges and alarm bands, so re-typing them is forty times
   * the same four numbers — which is also forty chances to fat-finger one.
   */
  function another() {
    setCreated(null)
    create.reset()
    setShowErrors(false)
    setValues((current) => ({
      ...initialValues({ extractionFields, waveformTypes, connection }),
      parent: current.parent,
      assetClassId: current.assetClassId,
      valueType: current.valueType,
      valueUnitId: current.valueUnitId,
      waveformTypeId: current.waveformTypeId,
      waveformMetadata: current.waveformMetadata,
    }))
  }

  return (
    <>
      <header className="mt-3 mb-5">
        <h1 className="m-0 text-headline">
          {editing
            ? t('dataFusion.sensors.edit.heading', { name: sensor.name })
            : t('dataFusion.sensors.create.title')}
        </h1>
        {/* The intro is instructions for filling a form. Once one is onboarded the
            form is gone, and so is the reason to explain it. */}
        {created ? null : (
          <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
            {t(editing ? 'dataFusion.sensors.edit.intro' : 'dataFusion.sensors.create.intro')}
          </p>
        )}
      </header>

      {/* ── The confirmation REPLACES the form, it does not sit above it ─────
          Leaving the filled form on screen behind the success panel reads as a
          sensor that has not been saved yet — the fields still hold the values
          that were just written, so the page shows a record and a draft of the
          same record at once, and the sticky Onboard button below invites writing
          it twice. There is one action after a write, and it is choosing what to
          do next. */}
      {created ? (
        <Onboarded sensor={created} connector={connector} onAnother={another} onDone={back} />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {showErrors && blocked ? (
              <ErrorSummary
                ref={summaryRef}
                title={t('dataFusion.sensors.fields.fixFirst')}
                errors={{
                  'sensor-name': errors.name,
                  'sensor-description': errors.description,
                  'sensor-site': errors.parent,
                  'sensor-value-unit': errors.valueUnitId,
                  'sensor-waveform-type': errors.waveformTypeId,
                  ...anchored('cfg', errors.extraction),
                  // `wf-`, matching the `idPrefix` the metadata fields render with.
                  // The two key spaces are independent and a shared prefix would
                  // point this summary at whichever control happened to mount first.
                  ...anchored('wf', errors.waveformMetadata),
                }}
                className="max-w-[72ch]"
              />
            ) : null}

            {write.error ? (
              <WriteFailed
                error={write.error}
                action={editing ? 'update' : 'create'}
                className="max-w-[72ch]"
              />
            ) : null}

            <SensorForm
              connection={connection}
              connector={connector}
              hierarchy={hierarchy}
              assetClasses={assetClasses}
              waveformTypes={waveformTypes}
              valueUnits={valueUnits}
              waveformType={waveformType}
              values={values}
              errors={showErrors ? errors : { extraction: {}, waveformMetadata: {} }}
              onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
              parentLocked={editing}
              onExtractionChange={(key, value) =>
                setValues((current) => ({
                  ...current,
                  extraction: { ...current.extraction, [key]: value },
                }))
              }
              onMetadataChange={(key, value) =>
                setValues((current) => ({
                  ...current,
                  waveformMetadata: { ...current.waveformMetadata, [key]: value },
                }))
              }
            />
          </div>

          {/* Pinned to the bottom of the viewport rather than the end of the form,
              so the action stays reachable on a narrow window where the two columns
              have stacked. It is the page's only primary. */}
          <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap gap-2 border-t border-hairline bg-page py-3.5">
            <ForgeButton variant="primary" size="lg" disabled={write.isPending} onClick={submit}>
              {write.isPending
                ? t(editing ? 'dataFusion.sensors.edit.saving' : 'dataFusion.sensors.create.saving')
                : t(editing ? 'dataFusion.sensors.edit.save' : 'dataFusion.sensors.create.submit')}
            </ForgeButton>
            <ForgeButton size="lg" disabled={write.isPending} onClick={back}>
              {t('common:actions.cancel')}
            </ForgeButton>
          </div>
        </>
      )}
    </>
  )
}

/**
 * The sensor exists, and the run can continue.
 *
 * Named rather than a bare confirmation, because onboarding happens in dozens and a
 * list of what you just created is the only audit trail during a run. "Onboard
 * another" keeps the placement and value type — what a run holds constant while the
 * name and the path change.
 */
function Onboarded({ sensor, connector, onAnother, onDone }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <Panel className="mb-5 max-w-[72ch] stripe-green">
      <div className="flex flex-wrap items-start gap-3">
        <Icon name="check" size="lg" className="mt-0.5 shrink-0 text-on-green" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-body font-semibold text-ink">{sensor.name}</p>
          <p className="mt-1 mb-0 text-body-sm text-ink-dim">
            {t(`dataFusion.sensors.valueType.${sensor.valueType}`)}
            {connector ? <span translate="no">{` · ${connector.name}`}</span> : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ForgeButton onClick={onAnother}>{t('dataFusion.sensors.create.another')}</ForgeButton>
            <ForgeButton onClick={onDone}>{t('dataFusion.sensors.create.done')}</ForgeButton>
          </div>
        </div>
      </div>
    </Panel>
  )
}

/* ══ FORM STATE ════════════════════════════════════════════════════════ */

/**
 * Blank values for a fresh sensor, or the stored ones re-read for editing.
 *
 * A new sensor's placement is seeded from the connection's own site — the record
 * has already answered that question, so asking it again is a click nobody owes.
 */
function initialValues({ extractionFields, waveformTypes, sensor, connection }) {
  const extraction = prefill(extractionFields, sensor?.extractionConfig)

  /**
   * Waveform metadata is prefilled from the STORED type's schema, not the selected
   * one — on a fresh sensor nothing is selected yet, so there is nothing to
   * prefill and the map starts empty. On an edit it is the type the sensor
   * actually holds, which is why this resolves the id rather than taking the first
   * entry: prefilling from the wrong schema would leave every stored number
   * unread and then overwrite it on save.
   */
  const stored = sensor ? waveformTypeById(waveformTypes, sensor.waveformTypeId) : null

  return {
    name: sensor?.name ?? '',
    description: sensor?.description ?? '',
    parent: sensor
      ? parentOf(sensor)
      : connection?.plantId
        ? { tier: 'site', id: connection.plantId }
        : null,
    assetClassId: sensor?.assetClassId ?? '',
    valueType: sensor?.valueType ?? DEFAULT_VALUE_TYPE,
    extraction,
    /**
     * Both start blank on a new sensor and are required, so onboarding cannot get
     * past them by accident.
     *
     * Neither is defaulted to its list's first entry, which would be the tempting
     * thing to do with a required select. There is no defensible default: the
     * catalogue is seeded in insertion order, so "first" means Sinusoidal and
     * Celsius for reasons that have nothing to do with the sensor being onboarded —
     * and a pre-filled wrong answer is worse than an empty required one, because
     * the empty one gets looked at.
     */
    waveformTypeId: sensor?.waveformTypeId ?? '',
    waveformMetadata: prefill(stored?.metadataFields ?? [], sensor?.waveformMetadata),
    valueUnitId: sensor?.valueUnitId ?? '',
  }
}

/**
 * A generated field set's starting values, flat and keyed by dotted schema key.
 *
 * Flat here and nested on the wire: `setPath` in `buildConnectionConfig` does the
 * conversion on the way out and `readPath` does it on the way in, so the form
 * state in between is one level deep and a control binds to `values[field.key]`
 * without walking anything.
 *
 * Shared by both generated sections because the rules are identical — a checkbox
 * coerces to a boolean so an absent stored value cannot make it `undefined` and
 * turn the input uncontrolled, and everything else starts as `''` for the same
 * reason.
 */
function prefill(fields, storedConfig) {
  const values = {}
  for (const field of fields) {
    const stored = storedConfig ? readPath(storedConfig, field.key) : undefined
    values[field.key] = field.type === 'checkbox' ? Boolean(stored) : (stored ?? '')
  }
  return values
}

/**
 * Field-keyed errors → the DOM ids `ErrorSummary` links to.
 *
 * The prefix is a parameter because there are two generated field sets on this
 * screen with independent key spaces, and `ConfigField` namespaces their ids for
 * exactly that reason. The dot substitution has to match its own, or every anchor
 * silently points at nothing.
 */
function anchored(prefix, fieldErrors) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, message]) => [
      `${prefix}-${key.replace(/\./g, '-')}`,
      message,
    ]),
  )
}

/** Reads a dotted schema key out of a stored config, which may be nested. */
function readPath(config, key) {
  if (!config) return undefined
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), config)
}

/**
 * Everything wrong with the form right now, keyed the way the controls are.
 *
 * Required-and-blank is checked here because this is where the offending control
 * is on screen to be pointed at. Nothing else is: `validate_extraction_config` is
 * the authority on types and select options, and the parent's account ownership is
 * a fact only the server holds — reimplementing either would be a copy that drifts
 * from the validator it mirrors.
 *
 * One rule is checked locally because it must be. Exactly-one-parent is a Pydantic
 * `model_validator`, so violating it returns FastAPI's 422 shape rather than the
 * field-keyed envelope, and `apiError.js` flattens that to the key `body` — which
 * names no control. So the form guarantees a parent before it sends.
 *
 * `serverFields` merges the server's own field-keyed `reason` in, so a rejection
 * from `validate_extraction_config` lands under the field it names.
 */
function formErrors({ values, extractionFields, metadataFields, serverFields, t }) {
  const errors = { extraction: {}, waveformMetadata: {} }

  if (!values.name.trim()) errors.name = t('dataFusion.sensors.fields.nameRequired')
  // Locally checked for the same reason exactly-one-parent is: `min_length=1` is a
  // Pydantic constraint, so violating it returns FastAPI's 422 shape rather than
  // the field-keyed envelope, and `apiError.js` flattens that to the key `body` —
  // which names no control and so points at nothing on screen.
  if (!values.description.trim()) {
    errors.description = t('dataFusion.sensors.fields.descriptionRequired')
  }
  if (!values.parent?.id) errors.parent = t('dataFusion.sensors.fields.parentRequired')

  // Both are non-nullable UUIDs with no default, and both would come back as a
  // Pydantic 422 rather than a field error — same reasoning as `description`.
  if (!values.waveformTypeId) {
    errors.waveformTypeId = t('dataFusion.sensors.fields.waveformTypeRequired')
  }
  if (!values.valueUnitId) errors.valueUnitId = t('dataFusion.sensors.fields.valueUnitRequired')

  for (const key of Object.keys(missingRequired(extractionFields, values.extraction))) {
    errors.extraction[key] = t('dataFusion.sensors.fields.extractionRequired')
  }

  // Format is checked only on fields that carry a value, so a blank required
  // field reports "required" rather than both at once.
  for (const key of Object.keys(invalidFormat(extractionFields, values.extraction))) {
    errors.extraction[key] = t('dataFusion.sensors.fields.extractionFormat')
  }

  /**
   * The same two checks over the waveform type's fields, and `metadataFields` is
   * the SELECTED type's list — so nothing is demanded for a shape that is not
   * chosen. When no type is selected the list is empty, which is correct: the
   * unanswered question is the type itself, reported above, and demanding a range
   * for a shape nobody has picked would be two errors for one omission.
   *
   * `missingRequired` coerces before testing, so a `number` field holding the
   * unparseable "12.5.3" reports as missing rather than passing through to a
   * server-side type error. Every field in every seeded `metadata_schema` is a
   * required number, which makes that the common path rather than an edge.
   */
  for (const key of Object.keys(missingRequired(metadataFields, values.waveformMetadata))) {
    errors.waveformMetadata[key] = t('dataFusion.sensors.fields.metadataRequired')
  }
  for (const key of Object.keys(invalidFormat(metadataFields, values.waveformMetadata))) {
    errors.waveformMetadata[key] = t('dataFusion.sensors.fields.metadataFormat')
  }

  /**
   * The server's own field-keyed `reason`, merged onto whichever section declares
   * the key.
   *
   * Both `validate_config` calls raise `ValidationAppError` with a flat
   * `dict[str, str]`, and the envelope carries no indication of which schema
   * rejected — only the message prefix ("Extraction config is invalid." versus
   * "Waveform metadata is invalid.") distinguishes them, and matching on English
   * prose from a server would be worse than the ambiguity. So each key is matched
   * against the field list that declares it. The two key spaces do not overlap in
   * any seeded schema; if one ever did, the error would show in both places, which
   * is the failure that costs least.
   */
  if (serverFields.name) errors.name = t('dataFusion.sensors.fields.nameRejected')
  for (const field of extractionFields) {
    if (serverFields[field.key]) {
      errors.extraction[field.key] = t('dataFusion.sensors.fields.extractionRejected')
    }
  }
  for (const field of metadataFields) {
    if (serverFields[field.key]) {
      errors.waveformMetadata[field.key] = t('dataFusion.sensors.fields.metadataRejected')
    }
  }

  return errors
}
