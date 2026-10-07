import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeSelect, StaticField } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { Eyebrow, Mono } from '@/components/forge/primitives'
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH, VALUE_TYPES } from '@/features/sensors/api'
import { PARENT_ICON, describeParent, parentOf } from '@/features/hierarchy/parents'
import { ConfigField } from './ConfigField'
import { JsonPathBuilder } from './JsonPathBuilder'
import { ParentPicker } from './ParentPicker'

/**
 * One sensor's whole form, shared by onboarding and editing.
 *
 * ── Why one scrolling form and not a wizard ───────────────────────────────
 * The connection wizard next door has four steps because it earns them: it has a
 * catalogue to choose from and a network probe that gates the write. A sensor has
 * neither. What it has is seven or eight fields, of which three are generated — and
 * splitting eight fields across four screens turns a thirty-second task into four
 * page transitions. It is also the repetitive one: a connection is created once,
 * sensors are created in dozens, and every step boundary is paid again on each.
 *
 * So: one form, grouped into three plain sections, in the order the questions
 * actually arrive — what is it called, where does it live, what does it read.
 *
 * ── The connection is context, not a field ────────────────────────────────
 * Onboarding is always entered from one connection's own screen, so the connection
 * is already known; and `PUT /sensors/{id}` does not accept
 * `data_source_connection_id`, so it cannot be changed afterwards either. Stated as a
 * `StaticField` in both modes rather than drawn as a disabled select — a disabled
 * control looks like a control, takes a hover, and teaches someone to keep trying it.
 *
 * ── The third section is generated, not written ────────────────────────────
 * `connector.extractionFields` comes from the connector type's own
 * `extraction_schema`. Nothing here knows what Sparkplug needs. That is the same
 * arrangement `ConfigureStep` uses for `config_schema`, for the same reason: a
 * connector type seeded server-side gets a working sensor form with no frontend
 * release.
 *
 * @param {object} props
 * @param {{id: string, name: string}} props.connection
 * @param {?{name: string, protocolFamily: string, extractionFields: Array<object>}} props.connector
 * @param {object} props.hierarchy      `useHierarchyNodes()` result.
 * @param {object} props.assetClasses   `useAssetClasses()` result.
 * @param {Array<object>} props.waveformTypes  The seeded waveform catalogue.
 * @param {Array<object>} props.valueUnits     The seeded engineering units.
 * @param {?object} props.waveformType  The selected entry of `waveformTypes`, whose
 *   `metadataFields` generate the signal panel. Null until one is chosen.
 * @param {object} props.values
 * @param {object} props.errors
 * @param {(patch: object) => void} props.onChange
 * @param {(key: string, value: *) => void} props.onExtractionChange
 * @param {(key: string, value: *) => void} props.onMetadataChange
 * @param {boolean} [props.parentLocked]
 *   Edit mode. `SensorUpdate` accepts no parent field, so the cascade is replaced
 *   by the resolved placement stated as fact. Offering the control would be worse
 *   than hiding it: the schema sets no `model_config`, so Pydantic ignores the
 *   extra keys and a re-attach would report success and change nothing.
 */
export function SensorForm({
  connection,
  connector,
  hierarchy,
  assetClasses,
  waveformTypes,
  valueUnits,
  waveformType,
  values,
  errors,
  onChange,
  onExtractionChange,
  onMetadataChange,
  parentLocked = false,
}) {
  const { t, i18n } = useTranslation(['app', 'common'])

  /** Which jsonpath field has the builder open. Purely local chrome. */
  const [building, setBuilding] = useState(null)

  // Only sensor-typed classes. `ENTITY_TYPE_FOR_TIER` cannot supply this — it maps
  // hierarchy tiers, and a sensor is not a hierarchy node — so `'sensor'` is named
  // directly. The list is fetched unfiltered and narrowed here, which is the same
  // thing SitesHierarchyPage does with it.
  const sensorClasses = (assetClasses.data?.items ?? []).filter(
    (entry) => entry.entityType === 'sensor',
  )

  const extractionFields = connector?.extractionFields ?? []

  /**
   * The chosen shape's own field set, and the reason this panel is generated
   * rather than written: it is four fields for `random_walk`, `exponential` and
   * `constant`, and five for the six shapes whose detection recipe needs the
   * update interval to do phase-timing maths. Nothing here knows which is which.
   */
  const metadataFields = waveformType?.metadataFields ?? []

  return (
    /**
     * Two columns above xl, stacked below.
     *
     * The split is not decorative: it is what removes the scroll. Identity and
     * placement answer "which asset is this", the extraction fields answer "which
     * value" — two independent questions, so putting them side by side costs no
     * reading order and halves the height. `items-start` keeps the shorter column
     * from stretching to match the taller one, which would leave a panel of empty
     * card.
     */
    <div className="grid max-w-[76rem] items-start gap-x-6 gap-y-5 xl:grid-cols-2">
      <div className="flex flex-col gap-5">
        {/* ── Identity ────────────────────────────────────────────────── */}
        <Panel className="flex flex-col gap-4">
          <Eyebrow>{t('dataFusion.sensors.sections.identity')}</Eyebrow>
          <Field
            id="sensor-name"
            label={t('dataFusion.sensors.fields.name')}
            hint={t('dataFusion.sensors.fields.nameHint')}
            required
            autoFocus
            maxLength={NAME_MAX_LENGTH}
            value={values.name}
            error={errors.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />

          {/* Required, not optional — `Field(min_length=1)` on both create and
              update. Marked as such rather than left for the server to reject,
              because a Pydantic length constraint returns FastAPI's 422 shape and
              `apiError.js` flattens that to the key `body`, which names no
              control. So the form would show "something was wrong" beside nothing. */}
          <Field
            id="sensor-description"
            label={t('dataFusion.sensors.fields.description')}
            hint={t('dataFusion.sensors.fields.descriptionHint')}
            required
            maxLength={DESCRIPTION_MAX_LENGTH}
            value={values.description}
            error={errors.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />

          <StaticField
            label={t('dataFusion.sensors.fields.connection')}
            hint={t('dataFusion.sensors.fields.connectionLocked')}
            icon="plug"
          >
            <span className="min-w-0 truncate">
              {connection.name}
              {connector ? (
                <span className="text-ink-dim" translate="no">
                  {' · '}
                  {connector.name}
                </span>
              ) : null}
            </span>
          </StaticField>
        </Panel>

        {/* ── Placement ───────────────────────────────────────────────── */}
        <Panel className="flex flex-col gap-4">
          <Eyebrow>{t('dataFusion.sensors.sections.placement')}</Eyebrow>

          {parentLocked ? (
            <LockedParent nodes={hierarchy.data?.items ?? []} values={values} />
          ) : hierarchy.isError ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-control text-ink">{t('dataFusion.sensors.fields.parent')}</span>
              <p className="m-0 flex items-start gap-1.5 text-body-sm text-on-red">
                <Icon name="bolt" size="xs" className="mt-0.5 shrink-0" />
                <span>{t('dataFusion.sensors.fields.hierarchyFailed')}</span>
              </p>
            </div>
          ) : (
            <ParentPicker
              nodes={hierarchy.data?.items ?? []}
              language={i18n.language}
              parent={values.parent}
              onChange={(parent) => onChange({ parent })}
              error={errors.parent}
              pending={hierarchy.isPending}
            />
          )}

          {/* ── Always rendered, even with nothing to choose ──────────────────
              This used to be hidden when the account had defined no sensor
              classes, on the reasoning that a select offering only "No class" is
              a control that can only be left alone. That was wrong in the way
              that costs support time: `asset_class_id` is a real, nullable,
              round-tripping field, and a control that vanishes is
              indistinguishable from a product that has no such concept. Someone
              looking for where to classify a sensor found nothing and had no way
              to learn that the answer was to define a class first.

              So it is always here, always shows what exists, and its hint says so
              when nothing does. Empty or not, the payload is the same: the
              sentinel maps back to `''` and `createSensor` sends
              `asset_class_id: null`. */}
          <ForgeSelect
            id="sensor-asset-class"
            label={t('dataFusion.sensors.fields.assetClass')}
            hint={t(
              sensorClasses.length
                ? 'dataFusion.sensors.fields.assetClassHint'
                : 'dataFusion.sensors.fields.assetClassNone',
            )}
            value={values.assetClassId || NO_CLASS}
            onValueChange={(next) => onChange({ assetClassId: next === NO_CLASS ? '' : next })}
            options={[
              {
                value: NO_CLASS,
                label: t('dataFusion.sensors.fields.noAssetClass'),
              },
              ...sensorClasses.map((entry) => ({
                value: entry.id,
                label: entry.name,
              })),
            ]}
          />
        </Panel>
      </div>

      <div className="flex flex-col gap-5">
        {/* ── Reading ─────────────────────────────────────────────────── */}
        <Panel className="flex flex-col gap-4">
          <Eyebrow>{t('dataFusion.sensors.sections.reading')}</Eyebrow>

          <ForgeSelect
            id="sensor-value-type"
            label={t('dataFusion.sensors.fields.valueType')}
            hint={t('dataFusion.sensors.fields.valueTypeHint')}
            required
            value={values.valueType}
            onValueChange={(next) => onChange({ valueType: next })}
            options={VALUE_TYPES.map((type) => ({
              value: type,
              label: t(`dataFusion.sensors.valueType.${type}`),
            }))}
          />

          {/* Beside the value type, because the two answer one question together:
              how the reading is stored, and what it is a reading OF. Required with
              no default — there are seventeen units and no honest guess among
              them, so this is a deliberate choice rather than a pre-filled one. */}
          <UnitSelect
            units={valueUnits}
            value={values.valueUnitId}
            error={errors.valueUnitId}
            onChange={(next) => onChange({ valueUnitId: next })}
          />

          {extractionFields.length ? (
            extractionFields.map((field) => (
              <ConfigField
                key={field.key}
                field={field}
                value={values.extraction[field.key]}
                error={errors.extraction?.[field.key]}
                onChange={(value) => onExtractionChange(field.key, value)}
                onOpenBuilder={setBuilding}
              />
            ))
          ) : (
            /* `opcua_standard.extraction_schema` is `{"fields": []}`, so this branch is
               reachable today and will stay reachable until that schema is seeded.
               The validator accepts `{}` for it, which means the sensor saves and has
               no way to say which node it reads. Saying so is the only honest thing
               the form can do — inventing a NodeId field here would be a field the
               server neither validates nor uses. */
            <div className="rounded-sm border border-hairline stripe-amber bg-card p-3.5">
              <p className="m-0 text-control text-on-amber">
                {t('dataFusion.sensors.noExtractionSchema')}
              </p>
              <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">
                {t('dataFusion.sensors.noExtractionSchemaBody', {
                  connector: connector?.name ?? '',
                })}
              </p>
            </div>
          )}
        </Panel>

        {/* ── Signal ──────────────────────────────────────────────────────
            Its own panel rather than more of "what it reads", because it answers a
            different question. The extraction fields say WHERE the value comes
            from; this says what the value is expected to LOOK like — the shape, its
            engineering range, and the band outside which it is an alarm. That is
            what the anomaly detectors downstream read, and it is the one part of
            this form describing the signal rather than the plumbing.

            Second in the column, not first: nobody can describe a signal's range
            before saying which signal. */}
        <Panel className="flex flex-col gap-4">
          <Eyebrow>{t('dataFusion.sensors.sections.signal')}</Eyebrow>

          <ForgeSelect
            id="sensor-waveform-type"
            label={t('dataFusion.sensors.fields.waveformType')}
            hint={t('dataFusion.sensors.fields.waveformTypeHint')}
            required
            error={errors.waveformTypeId}
            placeholder={t('dataFusion.sensors.fields.chooseWaveform')}
            value={values.waveformTypeId}
            onValueChange={(next) => onChange({ waveformTypeId: next })}
            options={waveformTypes.map((type) => ({
              value: type.id,
              label: type.name,
            }))}
          />

          {/* ── The fields arrive with the choice, and outlive it ─────────────
              Generated from the SELECTED type's `metadata_schema`, so switching
              from Constant to Sinusoidal grows an "Update Interval" field and
              switching back removes it.

              What it does NOT do is clear the four shared values. `range.min` means
              the same thing under every shape, and a form that discarded a typed
              engineering range because someone corrected the waveform would be
              punishing them for the correction. The values are held flat and only
              the selected type's keys are read on submit, so an orphaned
              `update_interval` sits in state and is never sent. */}
          {values.waveformTypeId ? (
            metadataFields.length ? (
              metadataFields.map((field) => (
                <ConfigField
                  key={field.key}
                  idPrefix="wf"
                  field={field}
                  value={values.waveformMetadata[field.key]}
                  error={errors.waveformMetadata?.[field.key]}
                  onChange={(value) => onMetadataChange(field.key, value)}
                />
              ))
            ) : (
              /* A selected id the catalogue does not list, or one whose schema is
                 empty. Reachable the same way `noExtractionSchema` is: these tables
                 are seeded, and a sensor holds a foreign key into them. Saying so
                 beats rendering an empty panel that looks finished. */
              <p className="m-0 text-body-sm text-on-amber">
                {t('dataFusion.sensors.noWaveformSchema')}
              </p>
            )
          ) : (
            <p className="m-0 text-body-sm text-ink-dim">{t('dataFusion.sensors.waveformFirst')}</p>
          )}
        </Panel>
      </div>

      {building ? (
        <JsonPathBuilder
          field={building}
          value={values.extraction[building.key] ?? ''}
          onCommit={(expression) => {
            onExtractionChange(building.key, expression)
            setBuilding(null)
          }}
          onClose={() => setBuilding(null)}
        />
      ) : null}
    </div>
  )
}

/**
 * Where the sensor attaches, stated rather than offered.
 *
 * A `StaticField` and not a disabled cascade: three greyed-out selects look like
 * controls, take a hover, and teach someone to keep trying them. This states the
 * placement as the fact it now is.
 *
 * An id that no longer resolves is shown raw with a warning — deletion is soft
 * everywhere in this API and nothing cascades, so a sensor outlives the machine it
 * was attached to.
 */
function LockedParent({ nodes, values }) {
  const { t } = useTranslation(['app', 'common'])

  const parent = values.parent ?? parentOf(values)
  const attached = describeParent(nodes, parent)

  return (
    <StaticField
      label={t('dataFusion.sensors.fields.parent')}
      hint={t('dataFusion.sensors.fields.parentLocked')}
      icon={attached ? PARENT_ICON[attached.tier] : 'bolt'}
    >
      {attached ? (
        <span className="min-w-0 truncate">
          {attached.name}
          {attached.trail.length ? (
            <span className="text-ink-dim">{` · ${attached.trail.join(' · ')}`}</span>
          ) : null}
        </span>
      ) : (
        <span className="min-w-0 truncate text-on-amber">
          {t('dataFusion.sensors.parentUnresolved')}
        </span>
      )}
    </StaticField>
  )
}

/** "No asset class". Radix rejects an item whose value is the empty string. */
const NO_CLASS = '__no_class__'

/**
 * The engineering unit, named and symbolised in one option.
 *
 * Both halves are shown because neither is sufficient. "psi" alone is unreadable
 * to anyone who has not met it; "Pounds per Square Inch" alone does not match what
 * is printed beside a reading. So the label carries the name and the symbol in
 * parentheses — which is also what makes Radix's typeahead find `°C` by typing
 * "cel".
 *
 * `count` has an empty symbol, legitimately, so the parenthesis is conditional
 * rather than always appended. `ForgeSelect` renders a plain string per option and
 * cannot take markup, so the symbol cannot be a `<Mono>` here; the name-first
 * ordering is what keeps the list alphabetically scannable instead.
 */
function UnitSelect({ units, value, error, onChange }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <ForgeSelect
      id="sensor-value-unit"
      label={t('dataFusion.sensors.fields.valueUnit')}
      hint={t('dataFusion.sensors.fields.valueUnitHint')}
      required
      error={error}
      placeholder={t('dataFusion.sensors.fields.chooseUnit')}
      value={value}
      onValueChange={onChange}
      options={units.map((unit) => ({
        value: unit.id,
        label: unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name,
      }))}
    />
  )
}

/**
 * A compact restatement of the extraction paths, for the table and the delete
 * confirmation — wherever a sensor has to be identified by what it reads rather
 * than by its name.
 *
 * Reads whichever key the connector type calls its value path rather than assuming
 * `value_path`: the schema is connector-specific and this is display only, so it
 * takes the first `jsonpath` field it finds and states nothing when there is none.
 */
export function primaryPathOf(connector, extractionConfig) {
  const field = (connector?.extractionFields ?? []).find((entry) => entry.type === 'jsonpath')
  if (!field) return null
  const value = extractionConfig?.[field.key]
  return typeof value === 'string' && value ? value : null
}

/** The same, rendered. Machine string: monospace, never translated. */
export function PathCell({ path }) {
  if (!path) return <span className="text-ink-mute">—</span>
  return <Mono className="block max-w-[22rem] truncate text-ink-dim">{path}</Mono>
}
