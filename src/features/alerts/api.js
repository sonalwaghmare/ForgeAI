import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Alert service. The only module that knows how an alert is fetched.
 *
 * @typedef {'critical'|'high'|'medium'|'low'} Severity
 * @typedef {'open'|'ack'|'escalated'|'resolved'} AlertStatus
 * @typedef {{value: number, unit: string|null}} Measure
 *
 * @typedef {object} Alert
 * @property {string} id              Machine-minted, ASCII, never translated.
 * @property {Severity} severity
 * @property {AlertStatus} status
 * @property {string|null} assigneeId
 * @property {string} siteId          Owns the unit of every measure below.
 * @property {string} assetId
 * @property {string} assetName
 * @property {string} component
 * @property {string} sensor
 * @property {string} sensorTag       OPC-UA node path.
 * @property {string} anomalyType     Key into common:anomalyTypes.
 * @property {Measure} reading
 * @property {Measure} threshold      Expressed in the site's own unit. Never converted.
 * @property {Measure} baseline
 * @property {string} detectedAt       ISO instant.
 * @property {number|null} etaHours    Hours to the trip threshold, when projectable.
 * @property {number} fusionScore      Cross-sensor agreement, 0–100.
 * @property {{name: string, score: number, unit: string|null}[]} detectors
 * @property {boolean} qualified       Passed the qualification gate.
 * @property {string} rule             Key into common:rules.
 * @property {number} cascadeSensors   Sibling sensors that agreed.
 */

/** @returns {Promise<{items: Alert[], total: number, page: number, pageSize: number}>} */
export function fetchAlerts(params, signal) {
  return get(endpoints.alerts.list, { params, signal })
}

/** @returns {Promise<Record<string, number>>} */
export function fetchAlertCounts(params, signal) {
  return get(endpoints.alerts.counts, { params, signal })
}

/** @returns {Promise<Alert>} */
export function fetchAlert(alertId, signal) {
  return get(endpoints.alerts.detail(alertId), { signal })
}

/**
 * The full reasoning trail for one alert.
 * `meta.ai` tags the request so the interceptor attaches the AI output locale.
 */
export function fetchAlertAnalysis(alertId, signal) {
  return get(endpoints.alerts.analysis(alertId), { signal, meta: { ai: true } })
}

export function acknowledgeAlert(alertId) {
  return post(endpoints.alerts.acknowledge(alertId))
}
