/**
 * Facets the anomaly list will eventually count, and cannot yet.
 *
 * `GET /anomalies` embeds `counts.status`, built by walking `AnomalyStatus` —
 * five members, none of them `snoozed`, and no assignment field anywhere on the
 * record for `unassigned` to be derived from. So these two tiles have no server
 * behind them at all, unlike `escalated` and `resolved`, which the API counts and
 * the product had simply withdrawn from the interface.
 *
 * They are a fixture rather than two numbers in the page for the reason DEMO-MODE
 * §2.1 gives: when the API gains them, `features/anomalies/api.js` changes and the
 * screen does not. The likely landing is inside `counts.status` for a real
 * `snoozed` member and as a separate facet for assignment, so the mapper is where
 * that difference gets absorbed.
 *
 * The counts are the prototype's own. Nothing derives them from the rows on
 * screen, and nothing should: a figure computed from the visible page would be a
 * different lie — one that looks correct.
 */
export const ANOMALY_DEMO_FACETS = {
  facets: [
    { key: 'snoozed', count: 2 },
    { key: 'unassigned', count: 4 },
  ],
}
