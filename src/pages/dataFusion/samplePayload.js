/**
 * A decoded Sparkplug payload, for the JSONPath builder to browse.
 *
 * ── Why this is a constant and not a request ──────────────────────────────
 * `value_path` and `timestamp_path` are queries into the payload as it exists
 * AFTER the wire format has been decoded server-side — a Sparkplug Protobuf message
 * becomes a plain dict before any JSONPath runs against it. So a builder needs that
 * decoded shape to click through, and the only endpoint that could supply it does
 * not exist: `resolve_extraction_config` lives in `app/services/extraction_service.py`,
 * is unit-tested, and is exposed by no route. There is no live ingestion pipeline
 * behind it either — nothing in the backend subscribes to a topic.
 *
 * `SENSOR_EXTRACTION.md` sanctions exactly this stand-in: "until it does, the builder
 * can be seeded from a hardcoded example matching this shape."
 *
 * ── Which is why the builder also takes a pasted payload ──────────────────
 * This one is a shape, not a fact about anybody's broker. A real deployment's
 * decoded message will carry different metric names and may nest differently, and a
 * path built against this example would then resolve to nothing. So the builder
 * offers this as the starting point and accepts a pasted payload as an equal
 * source — see JsonPathBuilder. When a sample-payload endpoint lands it becomes a
 * third source and the builder itself does not change.
 *
 * ── The shape ────────────────────────────────────────────────────────────
 * `metrics` is an array because one Sparkplug message carries several metrics
 * together — Temperature and Pressure in the same NDATA — which is the entire reason
 * a sensor needs a path rather than just a topic. `properties` is nested inside each
 * metric so the builder is exercised against descending INTO a matched element,
 * not only reading a scalar off it.
 *
 * Not translated, not localised, `translate="no"` wherever it renders: this is a
 * machine payload.
 */
export const SAMPLE_PAYLOAD = {
  topic: 'spBv1.0/1/NDATA/Plant1',
  metrics: [
    {
      name: 'Temperature',
      alias: 0,
      value: 42.5,
      timestamp: 1786091250330,
      properties: { unit: 'C', quality: 'good' },
    },
    {
      name: 'Pressure',
      alias: 1,
      value: 101.3,
      timestamp: 1786091250330,
      properties: { unit: 'kPa', quality: 'good' },
    },
  ],
}

/** Pretty-printed, for the paste box's initial content and the "reset" affordance. */
export const SAMPLE_PAYLOAD_TEXT = JSON.stringify(SAMPLE_PAYLOAD, null, 2)
