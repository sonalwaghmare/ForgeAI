/**
 * One error shape for the whole app.
 *
 * Screens render `code` and a translated message; they never inspect an axios
 * error. Server text is deliberately not shown raw — it can leak internals,
 * and it is never translated.
 */

export const ERROR_CODES = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'notFound',
  CONFLICT: 'conflict',
  VALIDATION: 'validation',
  LOCKED: 'locked',
  RATE_LIMITED: 'rateLimited',
  SERVER: 'server',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
}

const BY_STATUS = {
  400: ERROR_CODES.VALIDATION,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  422: ERROR_CODES.VALIDATION,
  // Account lockout. Distinct from 401 because the recovery differs: waiting
  // helps, retyping the password does not.
  423: ERROR_CODES.LOCKED,
  429: ERROR_CODES.RATE_LIMITED,
}

export class ApiError extends Error {
  /**
   * @param {object} init
   * @param {string} init.code       One of ERROR_CODES — what the UI switches on.
   * @param {number} [init.status]   HTTP status, when there was a response.
   * @param {string} [init.detail]   Developer-facing detail. Logged, never rendered.
   * @param {object} [init.fields]   Field-level validation errors, keyed by field name.
   * @param {string} [init.requestId] Correlation id for support.
   */
  constructor({ code, status, detail, fields, requestId }) {
    super(detail || code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.detail = detail
    this.fields = fields
    this.requestId = requestId
  }

  /** i18n key for the message shown to a user. */
  get messageKey() {
    return `errors.${this.code}`
  }

  /** Retrying a 4xx just fails again; transport and 5xx faults are worth a retry. */
  get retryable() {
    return (
      this.code === ERROR_CODES.NETWORK ||
      this.code === ERROR_CODES.TIMEOUT ||
      this.code === ERROR_CODES.SERVER
    )
  }
}

/**
 * Field errors, from either of the two shapes the API actually returns.
 *
 *  1. The application envelope — `{status: 'error', reason: {short_code: '…'}}`.
 *     `reason` is already a field-keyed map, so it maps across directly.
 *
 *  2. FastAPI's own request validation — `{detail: [{loc, msg, type}, …]}`.
 *     This one is NOT enveloped: it is emitted by the framework before any
 *     application handler runs, so it has to be handled separately or a 422
 *     arrives with no field information at all.
 *
 * Keys are flattened to the last `loc` segment, which is the field name. The
 * `body`/`query` prefix describes where the value came from, and no form control
 * is named after it.
 */
function extractFields(body) {
  if (body?.reason && typeof body.reason === 'object' && !Array.isArray(body.reason)) {
    return body.reason
  }

  if (Array.isArray(body?.detail)) {
    const fields = {}
    for (const item of body.detail) {
      const name = Array.isArray(item?.loc) ? String(item.loc.at(-1)) : '_'
      // First message per field wins: a field with three complaints still only
      // has room for one line of text beneath it.
      fields[name] ??= item?.msg
    }
    return fields
  }

  return body?.fields
}

/** Normalise anything axios throws into an ApiError. */
export function toApiError(error) {
  if (error instanceof ApiError) return error

  if (error?.code === 'ERR_CANCELED') {
    return new ApiError({ code: ERROR_CODES.CANCELLED })
  }
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return new ApiError({ code: ERROR_CODES.TIMEOUT, detail: error.message })
  }

  const response = error?.response
  if (!response) {
    return new ApiError({ code: ERROR_CODES.NETWORK, detail: error?.message })
  }

  const body = response.data ?? {}
  // FastAPI's `detail` is an array for validation failures; String() on it would
  // produce "[object Object]" in the log and tell nobody anything.
  const detail = Array.isArray(body.detail) ? undefined : body.detail || body.message

  return new ApiError({
    code: BY_STATUS[response.status] ?? (response.status >= 500 ? ERROR_CODES.SERVER : ERROR_CODES.UNKNOWN),
    status: response.status,
    detail,
    fields: extractFields(body),
    requestId: response.headers?.['x-request-id'],
  })
}
