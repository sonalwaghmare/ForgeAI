import { del, get, post, put } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Data Fusion — connections, their connector types, and the reachability probe.
 *
 * All LIVE. The whole resource: list, read, create, update, delete, test.
 *
 * The catalogue is what makes a generated form possible at all.
 * `config_schema.fields` names, orders and types every value a connector needs,
 * so both the Connect-source wizard and the edit dialog loop that array rather
 * than hardcoding MQTT's five fields and OPC-UA's five twice over. A connector
 * type seeded server-side gets a working form with no frontend release — which is
 * the entire reason the backend models it this way.
 *
 * ── Two server behaviours shape everything below ──────────────────────────
 * `validate_connection_config` requires every declared field to be PRESENT in the
 * payload, blank ones as explicit null. See buildConnectionConfig.
 *
 * `_ensure_reachable` runs on create AND update, so both of those calls open a
 * real connection to the plant network before they write. They can take seconds,
 * and they reject a config that does not answer instead of storing it.
 */

/** Longest `name` the `connections.name` column accepts. */
export const NAME_MAX_LENGTH = 150

/**
 * What a stored credential looks like coming back out.
 *
 * `_mask_config` replaces `auth.password` with this exact string on every detail
 * read. It is recognised rather than merely displayed, because an update carries
 * the whole config back and the mask is not a password: `_ensure_reachable` would
 * try to authenticate with eight bullet characters and refuse the save. So the
 * edit form blanks the field and asks for it again — see BACKEND-GAPS.
 *
 * It also cannot be told apart from "no password set": the mask is applied
 * whenever an `auth` object exists, including when `password` is null.
 */
export const MASKED_VALUE = '••••••••'

/**
 * Field types the schema can declare, and which control each one renders.
 *
 * Anything outside this set falls back to a text input rather than rendering
 * nothing: the backend can add a type before this app ships support for it, and
 * a field that silently disappears takes its value with it.
 *
 * `jsonpath` is declared by `extraction_schema`, never by `config_schema` — no
 * connector's own settings are a query. It coerces exactly like `text` (the
 * server's `_TYPE_CHECKS` entry is `isinstance(v, str)`); what differs is the
 * control, which offers the JSONPath builder. See ConfigField.
 */
export const FIELD_TYPES = ['text', 'number', 'password', 'checkbox', 'select', 'jsonpath']

/**
 * @param {{key: string, label: string, type: string, required?: boolean,
 *   options?: string[], regex?: string}} field
 */
const toField = (field) => ({
  key: field.key,
  label: field.label,
  type: FIELD_TYPES.includes(field.type) ? field.type : 'text',
  required: Boolean(field.required),
  options: field.options ?? null,
  // Structural validation the server declares per field — an OPC-UA NodeId is
  // `ns=2;s=…`, a Sparkplug topic is `spBv1.0/…`, a JSONPath starts at `$`.
  // `_field_errors` enforces it with `re.fullmatch` and its own comment invites
  // the client to do the same, so it is carried rather than dropped. See
  // `invalidFormat`.
  regex: field.regex ?? null,
})

/**
 * A whole `{"fields": [...]}` schema, mapped.
 *
 * Exported because THREE server-side schemas share this exact format and one
 * validator: `config_schema` (a connection's settings), `extraction_schema` (how
 * one sensor picks its value out of a message) and `metadata_schema` (a waveform
 * type's range and alarm band). `connector_config_validator.validate_config` is
 * called with all three, so a second field mapper elsewhere would be a second
 * set of type fallbacks and a second place to forget `regex`.
 *
 * A missing or malformed schema maps to an empty list rather than throwing. That
 * is a real state, not a defensive flourish — `opcua_standard.extraction_schema`
 * is `{}` on the seeded database today.
 *
 * @param {?{fields?: Array<object>}} schema
 * @returns {Array<{key: string, label: string, type: string, required: boolean,
 *   options: ?string[], regex: ?string}>}
 */
export const toSchemaFields = (schema) => (schema?.fields ?? []).map(toField)

/**
 * Two field lists, same format, different resource.
 *
 * `fields` comes from `config_schema` and describes what the CONNECTION needs —
 * a host, a port, a credential. `extractionFields` comes from `extraction_schema`
 * and describes what one SENSOR on that connection needs in order to pick its own
 * value out of a decoded message. `ConnectorTypeOut` has always returned both;
 * this app used to drop the second, which left the sensor form with nothing to
 * generate itself from.
 *
 * For `mqtt_sparkplug` the extraction list is `topic`, `value_path`,
 * `timestamp_path`. For `opcua_standard` it is EMPTY — see SensorForm for what
 * the form says when a connector type declares no extraction fields at all.
 */
const toConnectorType = (row) => ({
  id: row.id,
  key: row.key,
  name: row.name,
  protocolFamily: row.protocol_family,
  fields: toSchemaFields(row.config_schema),
  extractionFields: toSchemaFields(row.extraction_schema),
})

/** @returns {Promise<{items: Array<object>}>} */
export async function fetchConnectorTypes(signal) {
  const data = await get(endpoints.dataFusion.connectorTypes, { signal })
  return { items: (data?.items ?? []).map(toConnectorType) }
}

/* ══ CONFIG ASSEMBLY ═══════════════════════════════════════════════════ */

/**
 * Writes a dotted schema key into a nested object.
 *
 * `auth.username` is a path, not a flat key with a dot in it. The server reads
 * `connection_config["auth"]["username"]` — `_test_mqtt` and `_test_opcua` both
 * do `connection_config.get("auth")` and then `auth.get("username")` — so a flat
 * `{"auth.username": "x"}` would leave every credential unread and every
 * authenticated probe failing for a reason nothing on screen could explain.
 */
function setPath(target, path, value) {
  const parts = path.split('.')
  let node = target
  for (const part of parts.slice(0, -1)) {
    node[part] ??= {}
    node = node[part]
  }
  node[parts.at(-1)] = value
}

/**
 * One form value, coerced to what the wire needs.
 *
 * The schema's `type` decides this, never the shape of what was typed. Two of
 * them are load-bearing rather than cosmetic:
 *
 * **`checkbox` must be a real boolean.** The server does `bool(use_tls)`, and in
 * Python the string `"false"` is `True`. Sending a checkbox as text would turn
 * TLS on for a broker that was told to leave it off.
 *
 * **`password` is not trimmed.** Every other string is — hosts and endpoints get
 * pasted with stray whitespace — but a credential's leading or trailing space is
 * part of the credential, and stripping it produces an authentication failure
 * nobody can reproduce.
 *
 * @returns {*} `null` when the field is empty. Never `undefined` — see
 *   buildConnectionConfig for why an omission is not allowed.
 */
function coerce(field, raw) {
  if (field.type === 'checkbox') return Boolean(raw)

  if (raw == null) return null

  if (field.type === 'password') return raw === '' ? null : raw

  if (field.type === 'number') {
    const text = String(raw).trim()
    if (text === '') return null
    const parsed = Number(text)
    // A non-numeric string would fail the server's own type check; sending null
    // instead makes it the form's failure, where it can be explained.
    return Number.isFinite(parsed) ? parsed : null
  }

  const text = String(raw).trim()
  return text === '' ? null : text
}

/**
 * Form values → the `connection_config` object the API takes.
 *
 * ── Every declared field is ALWAYS present, blank ones as explicit null ────
 * This is the server's rule, not a preference, and it is the opposite of what
 * looks natural. `validate_connection_config` walks the connector type's schema
 * and rejects a payload that merely leaves an optional field out:
 *
 *     if not present:
 *         errors[key] = f"{label} must be included in the request, even if left blank."
 *
 * So an MQTT connection with no username fails validation unless it carries
 * `auth: {username: null, password: null}`. An earlier version of this function
 * omitted empty optionals — tidier to read in a log, and rejected by every
 * create and every update. The type checks then allow null for an optional field
 * and refuse it for a required one, which is why `missingRequired` runs first and
 * catches that case in the form.
 *
 * @param {Array<object>} fields The connector type's schema fields.
 * @param {Record<string, *>} values Keyed by `field.key`, dots and all.
 */
export function buildConnectionConfig(fields, values) {
  const config = {}
  for (const field of fields) {
    setPath(config, field.key, coerce(field, values[field.key]))
  }
  return config
}

/**
 * The same assembly, for a sensor's `extraction_config` and its
 * `waveform_metadata`.
 *
 * Aliases, deliberately, and not further implementations. There is ONE validator
 * server-side and all three payloads go through it: `validate_config` is called
 * with `connector_type.config_schema`, with `connector_type.extraction_schema`
 * and with `waveform_type.metadata_schema`, and every call is the same
 * `_field_errors` walk — same must-be-present rule, same present-but-null
 * allowance for optionals, same type checks, same select/options check, same
 * `re.fullmatch` on `regex`. Three copies of the coercion rules here would be
 * three things to keep in step with one validator, and the day any of them
 * diverged the symptom would be a 400 naming a field the form believes it sent
 * correctly.
 *
 * `waveform_metadata` is where the dotted-key handling in `setPath` stops being a
 * connection-credentials detail and becomes the common case: the schema declares
 * `range.min`, `range.max`, `alarm.lo`, `alarm.hi`, and the server reads them as
 * `{"range": {"min": …}}`. Every field in it is a `number`, so `coerce` is what
 * keeps a typed "12.5" from arriving as a string the validator rejects.
 *
 * Named separately only so each call site reads as what it is.
 */
export const buildExtractionConfig = buildConnectionConfig
export const buildWaveformMetadata = buildConnectionConfig

/**
 * Every required field that is still empty, keyed by field key.
 *
 * Only what the schema itself declares. The server has at least one rule the
 * schema does not express — `_test_opcua` refuses a security policy without a
 * security mode — and that is deliberately NOT reimplemented here: a cross-field
 * rule copied out of a service is a rule that drifts silently the day it
 * changes. The probe reports it, and the wizard shows what the probe said.
 */
export function missingRequired(fields, values) {
  const missing = {}
  for (const field of fields) {
    if (!field.required) continue
    const value = coerce(field, values[field.key])
    // `null` is the empty marker now, and a required checkbox means "must be
    // ticked" — which `false` fails.
    if (value === null || value === false) missing[field.key] = true
  }
  return missing
}

/**
 * Every field whose value is present but does not match the shape the schema
 * declares, keyed by field key.
 *
 * ── Why this is a copy the server also does, and why that is fine ─────────
 * Elsewhere this file refuses to reimplement server rules — see `missingRequired`
 * on OPC-UA's cross-field security rule. The difference is that `regex` is DATA
 * the server hands over per field, not logic transcribed out of a service: when
 * the pattern changes server-side the client gets the new one in the same
 * response. There is nothing here to drift.
 *
 * ── Anchored, because Python anchors ─────────────────────────────────────
 * `_field_errors` uses `re.fullmatch`, which requires the whole value to match.
 * JavaScript's `test` does not, so the pattern is wrapped — without it
 * `^spBv1\.0/…` would accept a topic with anything appended.
 *
 * A pattern JavaScript cannot compile is skipped rather than treated as a
 * failure: the two regex dialects are close but not identical, and refusing a
 * value the server would have accepted is worse than letting the server answer.
 *
 * Blank values are not checked. Required-and-blank is `missingRequired`'s job and
 * one field must not report two errors; optional-and-blank is legitimately empty.
 */
export function invalidFormat(fields, values) {
  const invalid = {}

  for (const field of fields) {
    if (!field.regex) continue

    const value = coerce(field, values[field.key])
    if (typeof value !== 'string' || value === '') continue

    let pattern
    try {
      pattern = new RegExp(`^(?:${field.regex})$`)
    } catch {
      continue
    }
    if (!pattern.test(value)) invalid[field.key] = true
  }

  return invalid
}

/**
 * The address a connector is about to dial, assembled from the form.
 *
 * Derived from the schema rather than hardcoded per connector: the first REQUIRED
 * TEXT field is the address in both seeded connectors — `host` for MQTT,
 * `endpoint` for OPC-UA — and a `port` field, where one exists, is appended.
 *
 * A heuristic, and safe as one: it only ever decides what caption to show, in the
 * wizard's test step and on the edit form's probe panel. If a future connector
 * orders its fields differently the label is less useful and nothing else
 * changes, because every request is built from `buildConnectionConfig` and never
 * from this.
 *
 * @returns {string|null} null when there is nothing truthful to show yet.
 */
export function endpointLabel(connector, values) {
  const addressField = connector?.fields.find((field) => field.required && field.type === 'text')
  if (!addressField) return null

  const host = String(values[addressField.key] ?? '').trim()
  if (!host) return null

  const port = connector.fields.some((field) => field.key === 'port')
    ? String(values.port ?? '').trim()
    : ''
  return port ? `${host}:${port}` : host
}

/* ══ REACHABILITY ══════════════════════════════════════════════════════ */

/**
 * Probe an endpoint before anyone commits to it.
 *
 * This is a real network attempt, not a validation: MQTT gets a full
 * CONNECT/CONNACK handshake and OPC-UA opens and closes a session, both with a
 * five-second timeout. So it can take a moment, and a failure is a fact about
 * the plant network rather than about the form.
 *
 * `{reachable, detail}` — `detail` carries the server's own diagnostic on
 * failure and is null on success. For an unknown protocol family the service
 * returns `reachable: true` without probing anything, which is worth knowing:
 * a third connector type reports reachable until someone writes its probe.
 *
 * ── `durationMs` is measured here, and named for what it actually is ──────
 * The elapsed time is the WHOLE round trip: this browser to our API, our API's
 * handshake with the broker, and back. It is not broker latency and must never
 * be labelled as one. It is still worth surfacing, because its magnitude is
 * diagnostic — a failure at 5 s is the probe's timeout expiring, a failure at
 * 50 ms is something actively refusing the connection, and those are different
 * problems with different fixes.
 *
 * `performance.now()` rather than `Date.now()`: it is monotonic, so a clock
 * adjustment mid-request cannot produce a negative duration.
 *
 * @param {{connectorTypeId: string, connectionConfig: object}} input
 * @returns {Promise<{reachable: boolean, detail: string|null, durationMs: number}>}
 */
export async function testConnection({ connectorTypeId, connectionConfig }) {
  const startedAt = performance.now()
  const result = await post(endpoints.dataFusion.connectionTest, {
    connector_type_id: connectorTypeId,
    connection_config: connectionConfig,
  })
  return {
    reachable: Boolean(result?.reachable),
    detail: result?.detail ?? null,
    durationMs: performance.now() - startedAt,
  }
}

/* ══ CONNECTIONS ═══════════════════════════════════════════════════════ */

/**
 * Wire → app. The collection read carries no config; the detail read carries a
 * masked one plus the connector type, so `config` being null distinguishes "not
 * fetched" from "fetched and empty".
 */
const toConnection = (row) => ({
  id: row.id,
  name: row.name,
  plantId: row.plant_id,
  connectorTypeId: row.connector_type_id,
  isActive: row.is_active,
  config: row.connection_config ?? null,
  // Only the detail read has it, and having it means an edit form renders
  // without a second request for the schema.
  connectorType: row.connector_type ? toConnectorType(row.connector_type) : null,
})

export async function fetchConnections(signal) {
  const data = await get(endpoints.dataFusion.connections, { signal })
  return { items: (data?.items ?? []).map(toConnection) }
}

/**
 * One connection, with its (masked) configuration and its connector type.
 *
 * A separate request from the list rather than a cache lookup, because the list
 * genuinely does not carry either — however tempting that shortcut looks.
 */
export async function fetchConnection(id, signal) {
  return toConnection(await get(endpoints.dataFusion.connection(id), { signal }))
}

/**
 * Update. A full replace of the three editable fields — the API has no partial
 * patch anywhere, and `plant_id` and `connector_type_id` are not updatable at
 * all, so a connection cannot move site or change protocol.
 *
 * The server validates the config against the connector type's schema and then
 * PROBES it before saving. So this call reaches the plant network and can take
 * seconds, and an unreachable config is rejected rather than stored — which is
 * also what makes the blanked password field safe rather than merely tidy.
 *
 * @param {{id: string, name: string, connectionConfig: object, isActive: boolean}} input
 */
export async function updateConnection({ id, name, connectionConfig, isActive }) {
  const row = await put(endpoints.dataFusion.connection(id), {
    name: name.trim(),
    connection_config: connectionConfig,
    is_active: isActive,
  })
  return toConnection(row)
}

/**
 * Soft delete. The row keeps its identity with `deleted_at` set and drops out of
 * the listing, so nothing that already referenced it breaks — and nothing
 * reaches into the sensors that read from it either. The confirmation says so
 * rather than implying a cascade.
 */
export async function deleteConnection(id) {
  await del(endpoints.dataFusion.connection(id))
  return { id, deleted: true }
}

/* ══ CREATE ════════════════════════════════════════════════════════════ */

/**
 * Create the connection. The last call in the wizard, and the only write.
 *
 * `plant_id` is the site. The API names that tier `plant` and this product calls
 * it a site everywhere a person reads it — the same two vocabularies mapped in
 * `features/hierarchy/api.js`, and the wire value is never translated.
 *
 * The server does NOT validate `connection_config` against the connector type's
 * schema on the way in (there is a standing TODO on that line in
 * `create_connection`), so the form's own validation is the only thing standing
 * between a half-filled config and a stored record. That is why step 2 will not
 * let you past an unreachable probe.
 *
 * @param {{
 *   name: string, plantId: string, connectorTypeId: string,
 *   connectionConfig: object, isActive: boolean,
 * }} input
 * @returns {Promise<{id: string, name: string, plantId: string, connectorTypeId: string, isActive: boolean}>}
 */
export async function createConnection({
  name,
  plantId,
  connectorTypeId,
  connectionConfig,
  isActive,
}) {
  const row = await post(endpoints.dataFusion.connections, {
    name: name.trim(),
    plant_id: plantId,
    connector_type_id: connectorTypeId,
    connection_config: connectionConfig,
    is_active: isActive,
  })
  return {
    id: row.id,
    name: row.name,
    plantId: row.plant_id,
    connectorTypeId: row.connector_type_id,
    isActive: row.is_active,
  }
}
