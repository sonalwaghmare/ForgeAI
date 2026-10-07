import { del, get, post, put } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { toSchemaFields } from '@/features/dataFusion/api'
import { parentFields } from '@/features/hierarchy/parents'

/**
 * Sensors — the tags read off one connection.
 *
 * ── The whole resource is live ────────────────────────────────────────────
 * `POST`, `GET` (collection and detail), `PUT` and `DELETE` are all served.
 * `PUT` arrived after this feature was written and is NARROWER than `POST` — see
 * `updateSensor` for what it will and will not accept, and why sending the extra
 * fields anyway would fail silently rather than loudly.
 *
 * ── The one paginated resource in this API ────────────────────────────────
 * Every other collection endpoint returns the whole set. `GET /sensors` takes
 * `page` and `page_size` (max 200) and answers with
 * `{items, page, page_size, total, total_pages}`. That is not a nicety here: a
 * connection can carry more than ten thousand sensors, each with an
 * `extraction_config` JSONB, so fetching the collection to slice it client-side —
 * which is what every other list screen in this app does — would pull megabytes to
 * show fifty rows.
 *
 * ── Request params are snake_case, deliberately ───────────────────────────
 * `features/alerts/api.js` sends camelCase `pageSize`, because the only thing
 * reading it is the fixture adapter. This endpoint is a real FastAPI signature
 * (`page_size: int = Query(default=50, ge=1, le=200)`) and a camelCase key would be
 * silently ignored — the server would answer page 1 of 50 and the footer would
 * disagree with the rows. So the wire names are written out as the server declares
 * them, and the conversion happens here rather than at the call site.
 */

/** Longest `name` the `sensors.name` column accepts. */
export const NAME_MAX_LENGTH = 150

/**
 * Longest `description` the column accepts, and it is REQUIRED — `Field(min_length=1,
 * max_length=500)` on both `SensorCreate` and `SensorUpdate`.
 *
 * Required with no server-side default, so there is nothing to fall back to: a
 * sensor cannot be created without one. Enforced in the form rather than left to
 * the API because `min_length` is a Pydantic constraint, which returns FastAPI's
 * own 422 shape rather than the field-keyed envelope — see `formErrors`.
 */
export const DESCRIPTION_MAX_LENGTH = 500

/**
 * The `ValueType` enum, in the order the backend declares it.
 *
 * Four members. Never translated as a wire value; the label beside it is — see
 * `dataFusion.sensors.valueType.*`.
 */
export const VALUE_TYPES = ['integer', 'float', 'enum', 'string']

/**
 * What a new sensor starts as.
 *
 * `float`, not the enum's first member. A plant sensor reads a measurement far
 * more often than a count, and the default should be the answer that is usually
 * right rather than the one that happens to be declared first.
 */
export const DEFAULT_VALUE_TYPE = 'float'

/**
 * The largest page the server will serve. `Query(..., le=200)` rejects anything
 * above it with a 422, so this is a hard ceiling rather than a preference.
 */
export const MAX_PAGE_SIZE = 200

/* ══ MASTER DATA ═══════════════════════════════════════════════════════ */

/**
 * Waveform types and value units — platform master data, not tenant records.
 *
 * Both tables are global, read-only and seeded (`WaveformType` and `ValueUnit`
 * both say so in as many words), with no create, update or delete route. The
 * same arrangement as the connector catalogue, and the same consequence: the
 * only thing this app does with them is read the list once and offer it.
 *
 * ── Both are required on a sensor, which makes them load-bearing ──────────
 * `waveform_type_id`, `waveform_metadata` and `value_unit_id` are all
 * non-nullable on `SensorCreate` AND `SensorUpdate`. So neither form can be
 * submitted before these two requests land, and neither has a defaultable value
 * to fall back on if they fail — which is why `SensorFormPage` gates on them
 * rather than degrading.
 *
 * ── A waveform type carries a schema, a value unit does not ───────────────
 * `metadata_schema` is the same `{"fields": [...]}` format as a connector's
 * `config_schema`, validated by the same server-side walk, so it is mapped with
 * the same field mapper and assembled with the same builder. It is what the
 * chosen shape needs beyond the raw signal — an engineering range and an alarm
 * band, plus an update interval for the shapes whose detection recipe is
 * phase-timing rather than threshold. Which is why the metadata fields are
 * generated from the SELECTED type and change when it changes.
 */
const toWaveformType = (row) => ({
  id: row.id,
  key: row.key,
  name: row.name,
  metadataFields: toSchemaFields(row.metadata_schema),
})

/**
 * `symbol` is separate from `name` and both are shown: the name disambiguates
 * ("Pounds per Square Inch"), the symbol is what appears beside a reading
 * ("psi"). It is legitimately empty for `count`, so nothing may assume it prints.
 */
const toValueUnit = (row) => ({
  id: row.id,
  key: row.key,
  name: row.name,
  symbol: row.symbol ?? '',
})

/** @returns {Promise<{items: Array<object>}>} */
export async function fetchWaveformTypes(signal) {
  const data = await get(endpoints.sensors.waveformTypes, { signal })
  return { items: (data?.items ?? []).map(toWaveformType) }
}

/** @returns {Promise<{items: Array<object>}>} */
export async function fetchValueUnits(signal) {
  const data = await get(endpoints.sensors.valueUnits, { signal })
  return { items: (data?.items ?? []).map(toValueUnit) }
}

/**
 * The waveform type a stored id refers to, or null.
 *
 * Null is a state the form has to handle rather than an impossibility: the two
 * tables are seeded and a sensor holds a foreign key into them, so a database
 * seeded before a type existed — or one where the seed was re-run after a key
 * rename — can hold an id the catalogue no longer lists. Without this the edit
 * form would generate its metadata fields from an empty list, quietly drop every
 * stored `range`/`alarm` value, and write the loss back on the next save.
 */
export const waveformTypeById = (types, id) => (types ?? []).find((type) => type.id === id) ?? null

/**
 * Wire → app.
 *
 * `extractionConfig` is carried through as the plain object the server stored. It
 * is the whole of it, unmasked — nothing in a sensor is a credential, unlike a
 * connection's `auth.password` — so an edit form can round-trip it without the
 * blank-and-ask-again dance `ConnectionDialogs` needs.
 *
 * What is NOT here, because `SensorOut` does not carry it: the parent's name, the
 * connection's name, the asset class's name, and `created_at`. Every one of those
 * is a client-side join against a list the screen has already cached.
 */
const toSensor = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  plantId: row.plant_id,
  lineId: row.line_id,
  machineId: row.machine_id,
  assetClassId: row.asset_class_id,
  connectionId: row.data_source_connection_id,
  valueType: row.value_type,
  extractionConfig: row.extraction_config ?? {},
  waveformTypeId: row.waveform_type_id,
  waveformMetadata: row.waveform_metadata ?? {},
  valueUnitId: row.value_unit_id,
})

/**
 * One page of sensors for one connection.
 *
 * @param {{connectionId: string, page: number, pageSize: number}} params
 * @returns {Promise<{items: Array<object>, page: number, pageSize: number, total: number, totalPages: number}>}
 */
export async function fetchSensors({ connectionId, page, pageSize }, signal) {
  const data = await get(endpoints.sensors.list, {
    signal,
    params: {
      data_source_connection_id: connectionId,
      page,
      page_size: pageSize,
    },
  })

  return {
    items: (data?.items ?? []).map(toSensor),
    // Echoed back by the server rather than assumed from what was asked for: a
    // clamped or defaulted page must move the footer, not be contradicted by it.
    page: data?.page ?? page,
    pageSize: data?.page_size ?? pageSize,
    total: data?.total ?? 0,
    totalPages: data?.total_pages ?? 0,
  }
}

/** One sensor. */
export async function fetchSensor(id, signal) {
  return toSensor(await get(endpoints.sensors.detail(id), { signal }))
}

/**
 * Create.
 *
 * `parent` is `{tier, id}` and becomes exactly one of `plant_id`/`line_id`/
 * `machine_id` — see `parentFields`. All three keys are sent, two of them null.
 *
 * A rejected parent comes back as `NotFoundError("Plant"|"Line"|"Machine")` at 404,
 * NOT as a field error: the server verifies the parent belongs to the caller's
 * account before it validates anything else. A parent that is missing entirely is
 * caught by a Pydantic `model_validator`, which returns FastAPI's own 422 shape
 * rather than the field-keyed envelope — so the form checks that itself before
 * sending. See SensorForm.
 *
 * ── `asset_class_id` is the one optional reference here ───────────────────
 * `|| null` rather than omitted, and that distinction matters: the column is
 * nullable and the schema declares `uuid | None = None`, so null is a legitimate
 * stored value meaning "unclassified". The other two references —
 * `waveform_type_id` and `value_unit_id` — are NOT nullable and have no default,
 * so they are sent as given and a blank one is a form error rather than a null.
 *
 * @param {{
 *   name: string, description: string, parent: {tier: string, id: string},
 *   assetClassId: ?string, connectionId: string, valueType: string,
 *   extractionConfig: object, waveformTypeId: string, waveformMetadata: object,
 *   valueUnitId: string,
 * }} input
 */
export async function createSensor({
  name,
  description,
  parent,
  assetClassId,
  connectionId,
  valueType,
  extractionConfig,
  waveformTypeId,
  waveformMetadata,
  valueUnitId,
}) {
  const row = await post(endpoints.sensors.list, {
    name: name.trim(),
    description: description.trim(),
    ...parentFields(parent),
    asset_class_id: assetClassId || null,
    data_source_connection_id: connectionId,
    value_type: valueType,
    extraction_config: extractionConfig,
    waveform_type_id: waveformTypeId,
    waveform_metadata: waveformMetadata,
    value_unit_id: valueUnitId,
  })
  return toSensor(row)
}

/**
 * Update.
 *
 * ── The payload is narrower than create, and that is the contract ─────────
 * `SensorUpdate` accepts `name`, `description`, `asset_class_id`, `value_type`,
 * `extraction_config`, `waveform_type_id`, `waveform_metadata` and
 * `value_unit_id` — everything create takes EXCEPT the parent trio and
 * `data_source_connection_id`. So neither where a sensor attaches nor which
 * broker it reads from can change after onboarding, the same shape
 * `ConnectionUpdate` takes when it drops `plant_id` and `connector_type_id`.
 *
 * Sending the excluded keys anyway would be worse than useless: the schema sets
 * no `model_config`, so Pydantic IGNORES unknown keys rather than rejecting them.
 * A form that offered to re-attach a sensor would report success and change
 * nothing. So the fields are absent here and locked in the form — see
 * SensorForm's `parentLocked`.
 *
 * ── A full replace, which is what makes the prefill load-bearing ───────────
 * Every field listed above is required on the way in and overwrites what is
 * stored. There is no partial-patch semantics anywhere in this API. That is why
 * `useSensor` sets `staleTime: 0` and why the form gates on the waveform
 * catalogue: a form that rendered before the schema arrived would assemble
 * `waveform_metadata` from an empty field list and blank a stored alarm band on
 * save, reporting success.
 *
 * @param {{
 *   id: string, name: string, description: string, assetClassId: ?string,
 *   valueType: string, extractionConfig: object, waveformTypeId: string,
 *   waveformMetadata: object, valueUnitId: string,
 * }} input
 */
export async function updateSensor({
  id,
  name,
  description,
  assetClassId,
  valueType,
  extractionConfig,
  waveformTypeId,
  waveformMetadata,
  valueUnitId,
}) {
  const row = await put(endpoints.sensors.detail(id), {
    name: name.trim(),
    description: description.trim(),
    asset_class_id: assetClassId || null,
    value_type: valueType,
    extraction_config: extractionConfig,
    waveform_type_id: waveformTypeId,
    waveform_metadata: waveformMetadata,
    value_unit_id: valueUnitId,
  })
  return toSensor(row)
}

/**
 * Soft delete. The row keeps its identity with `deleted_at` set and drops out of
 * the listing.
 *
 * Nothing downstream is notified: `delete_sensor` carries a standing TODO to
 * publish a config-update event so the tag leaves active ingestion, and there is
 * no event bus in the backend to publish it to. So the confirmation says the
 * sensor stops being listed, and does not claim it stops being read.
 */
export async function deleteSensor(id) {
  await del(endpoints.sensors.detail(id))
  return { id, deleted: true }
}
