import { config } from '@/services/config'
import { getAccessToken } from '@/services/authToken'
import { endpoints } from '@/services/endpoints'

/**
 * The copilot's turn stream.
 *
 * `fetch`, not `EventSource`, and the reason is structural rather than a
 * preference: `EventSource` only issues GET requests, and a turn carries a
 * question and a scope in its body. The token therefore travels in an
 * `Authorization` header like every other call, and the query-parameter path the
 * server also accepts is not needed here.
 *
 * Events are handed to the caller as they arrive. Buffering until `done` would
 * produce a dock that shows "looking at the anomaly…" only once the answer is
 * already on screen — and nothing about the finished conversation would reveal
 * it, which is precisely why it has to be got right at this layer.
 *
 * SSE frames can split across network chunks, so the buffer is only consumed up
 * to the last complete frame boundary. Parsing per chunk would drop the tail of
 * any event unlucky enough to straddle one.
 *
 * Line endings are normalised first. The server is sse_starlette and it writes
 * CRLF, so a parser that only looks for `\n\n` finds no boundary at all and
 * silently yields nothing — not an error, not a partial answer, just an empty
 * stream. That is exactly what happened here, and it survived being "verified"
 * by curling the endpoint, because curl is not this parser.
 */
export async function streamCopilotTurn({ message, scope, sessionId, signal, onEvent }) {
  const token = getAccessToken()
  const response = await fetch(`${config.apiBaseUrl}${endpoints.copilot.turns}`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Forge-AI-Locale': config.aiOutputLocale,
    },
    body: JSON.stringify({ session_id: sessionId ?? null, message, scope: scope ?? {} }),
  })

  if (!response.ok || !response.body) {
    // Shaped like the server's own error event so the caller has one path to
    // render, whether the failure happened here or upstream in the engine.
    onEvent({ event: 'error', code: 'unreachable', message: 'The copilot is unavailable right now.' })
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    // CRLF -> LF before anything looks for a boundary. The spec allows CRLF, LF
    // and CR as line terminators, and the server uses the one this parser did not.
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    const lastBreak = buffer.lastIndexOf('\n\n')
    if (lastBreak === -1) continue

    for (const frame of buffer.slice(0, lastBreak).split('\n\n')) {
      const parsed = parseFrame(frame)
      if (parsed) onEvent(parsed)
    }
    buffer = buffer.slice(lastBreak + 2)
  }
}

/**
 * One SSE frame into `{event, ...data}`.
 *
 * A frame whose data will not parse is dropped rather than thrown: one
 * malformed event should cost that event, not the rest of the answer.
 */
function parseFrame(frame) {
  let name = 'message'
  const dataLines = []

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return null

  try {
    return { event: name, ...JSON.parse(dataLines.join('\n')) }
  } catch {
    return null
  }
}
