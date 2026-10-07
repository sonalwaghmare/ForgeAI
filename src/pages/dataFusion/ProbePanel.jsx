import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeMark, Icon } from '@/components/forge/Icon'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { endpointLabel } from '@/features/dataFusion/api'
import { cn } from '@/lib/cn'
import { formatMeasure } from '@/lib/units'

/**
 * The reachability probe and its verdict, shared by the Connect-source wizard and
 * the edit dialog.
 *
 * ── One verdict surface, whatever ran the probe ───────────────────────────
 * The server probes on create and on update as well as on the explicit test
 * endpoint, so "the endpoint did not answer" can arrive three ways. It appears in
 * one place regardless: a failed save renders here, not in a second red box
 * competing with this one. That is what `probe` is for — the caller derives it,
 * from a test mutation or from a rejected write, and this component does not care
 * which.
 *
 * @typedef {object} Probe
 * @property {'idle'|'testing'|'passed'|'failed'|'error'} state
 * @property {string|null} [detail]        The server's own diagnostic on failure.
 * @property {number|null} [durationMs]    Round trip, when one was measured.
 * @property {import('@/services/apiError').ApiError} [transportError]
 */

/**
 * The probe, and its verdict.
 *
 * ── The link is the content, not an ornament ──────────────────────────────
 * This used to be three lines of grey prose explaining what a connection test
 * is, above a button. Nobody reads a justification before clicking, and after
 * clicking it told you nothing — the pass and the idle state were the same
 * rectangle with different words in it.
 *
 * What replaced it is the thing itself: this platform, the endpoint, and the link
 * between them. Every part carries information. The left node is the Forge mark.
 * The right node is labelled with the address actually being dialled, read out of
 * the form above. The link's state IS the test's state. Nothing here is drawn to
 * fill space.
 *
 * ── Established / not established is solid / dashed ──────────────────────
 * One rule, and it does the heavy lifting: a solid link means the endpoint
 * answered, a dashed one means it did not. State is then encoded three times over
 * — line style, node fill plus glyph, and the sentence — so it survives
 * colour-blind mode without needing a `cb:` variant, and it survives print.
 *
 * ── The one number ────────────────────────────────────────────────────────
 * How long the check took, measured for real. Its magnitude is the diagnostic: a
 * failure at 5 s is the probe's timeout expiring, a failure at 50 ms is something
 * actively refusing. It is labelled as the round trip, never as broker latency —
 * it includes our own server. See `testConnection`.
 *
 * ── Three deliberate details ──────────────────────────────────────────────
 * **The server's `detail` is rendered verbatim.** Everywhere else in this product
 * server wording is replaced with translated copy; here it IS the value of the
 * step — "TLS handshake failed", "security_mode is required when security_policy
 * is set". "The test failed" would leave an engineer with nothing to act on.
 *
 * **A transport failure is not a failed test.** If the request never got an
 * answer, the endpoint was never probed, so the link goes back to unknown rather
 * than to broken — saying "unreachable" would blame the plant for our own error.
 *
 * **The button's prominence is the caller's call.** In the wizard the probe is the
 * only thing that can be done — the footer's Continue is disabled until it passes
 * — so it is primary there. On the edit form Save is the primary action and this
 * is secondary. `emphasis` says which, so the rule "exactly one live primary on
 * screen" holds in both.
 *
 * @param {object} props
 * @param {object} props.connector
 * @param {Record<string, *>} props.values
 * @param {Probe} props.probe
 * @param {() => void} props.onTest
 * @param {'primary'|'secondary'} [props.emphasis]
 * @param {boolean} [props.busy]   Something else is in flight; do not offer a probe.
 */
export function ProbePanel({ connector, values, probe, onTest, emphasis = 'primary', busy = false }) {
  const { t } = useTranslation(['app', 'common'])

  const { state } = probe
  const address = endpointLabel(connector, values)
  const seconds = probe.durationMs != null ? probe.durationMs / 1000 : null
  const testing = state === 'testing'

  return (
    <div
      className={cn(
        'rounded-sm border bg-card',
        state === 'passed'
          ? 'border-hairline stripe-green'
          : state === 'failed'
            ? 'border-hairline stripe-red'
            : 'border-hairline',
      )}
    >
      <div className="px-4.5 pt-5 pb-4">
        <ConnectionLink state={state} address={address} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-subtle px-4.5 py-3">
        <p
          className="m-0 flex min-w-0 items-center gap-2 text-body-sm"
          // The verdict is the one thing here that has to reach a screen reader
          // the moment it changes; the diagram is labelled but not announced.
          role="status"
        >
          <span
            className={cn(
              'font-semibold',
              state === 'passed'
                ? 'text-on-green'
                : state === 'failed'
                  ? 'text-on-red'
                  : 'text-ink',
            )}
          >
            {t(`dataFusion.connect.verdict.${state}`)}
          </span>
          {seconds != null && (state === 'passed' || state === 'failed') ? (
            <>
              <span aria-hidden="true" className="text-ink-mute">
                ·
              </span>
              <Num className="text-ink-dim">
                {t('dataFusion.connect.roundTrip', {
                  duration: formatMeasure({ value: seconds, unit: 's' }, { digits: 2 }),
                })}
              </Num>
            </>
          ) : null}
        </p>

        <ForgeButton
          // Never primary once it has passed: at that point the thing to do is
          // continue or save, and two primaries compete.
          variant={emphasis === 'primary' && state !== 'passed' ? 'primary' : 'secondary'}
          onClick={onTest}
          disabled={testing || busy}
        >
          {testing
            ? t('dataFusion.connect.testingShort')
            : state === 'idle'
              ? t('dataFusion.connect.test')
              : t('dataFusion.connect.testAgain')}
        </ForgeButton>
      </div>

      {state === 'failed' && probe.detail ? (
        <div role="alert" className="border-t border-subtle px-4.5 py-3">
          <Eyebrow>{t('dataFusion.connect.reportedBySource')}</Eyebrow>
          <Mono className="mt-1.5 block break-words text-on-red">{probe.detail}</Mono>
        </div>
      ) : null}

      {state === 'error' && probe.transportError ? (
        <div role="alert" className="border-t border-subtle px-4.5 py-3">
          <p className="m-0 text-control text-on-red">{t('dataFusion.connect.testFailed')}</p>
          <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">
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

/**
 * Forge AI, the endpoint, and the link between them.
 *
 * The whole diagram is one `figure` with a translated caption, so assistive tech
 * gets the state in a sentence rather than trying to interpret three coloured
 * boxes. Everything inside it is `aria-hidden`.
 */
function ConnectionLink({ state, address }) {
  const { t } = useTranslation(['app', 'common'])

  const established = state === 'passed'
  const broken = state === 'failed'
  const probing = state === 'testing'

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        {t(`dataFusion.connect.linkCaption.${state}`)}
      </figcaption>

      <div aria-hidden="true" className="flex items-center gap-3">
        {/* Forge Orange throughout — the icon mark has one colour, per the brand
            lockup entry in DESIGN.md. The endpoint node carries the state. */}
        <Node>
          <ForgeMark className="size-[18px] text-forge" />
        </Node>

        <span
          className={cn(
            // 2px, matching the icon stroke weight, so the link reads as part of
            // the same drawing as the two nodes rather than as a divider that
            // happens to run between them. A hairline here looked like a rule.
            'relative h-0.5 min-w-8 flex-1 overflow-hidden rounded-full',
            // Solid means established. Dashed means it is not — whether that is
            // "not yet", "we do not know", or "refused" is carried by the colour
            // and by the words below.
            //
            // Every one of these is the DARKER ramp step, not the raw hue, and
            // that is measured rather than assumed: the link is a graphical
            // object carrying the panel's whole meaning, so it owes 3:1. Raw
            // `--hue-green` is a bright mint that comes in at 2.02:1 on the white
            // card — the "connected" state would have been the least visible
            // thing on screen. `--on-green` is 6.99:1. Same reason The Tint-Text
            // Rule exists: a semantic hue is a fill value, not automatically a
            // stroke value.
            //
            // Referenced as `--on-*` / `--ink-dim` because these are raw CSS
            // values: the `@theme inline` aliases do not exist at runtime
            // (DESIGN.md correction 17) and a gradient built on one renders
            // nothing at all.
            established
              ? 'origin-left bg-on-green motion-safe:animate-link rtl:origin-right'
              : broken
                ? 'bg-[repeating-linear-gradient(to_right,var(--on-red)_0_6px,transparent_6px_12px)]'
                : 'bg-[repeating-linear-gradient(to_right,var(--ink-dim)_0_5px,transparent_5px_11px)]',
          )}
        >
          {/* The signal in flight. Absolutely positioned and animated on a
              logical inset, so it travels toward the endpoint under RTL too. */}
          {probing ? (
            <span className="absolute inset-y-0 w-[30%] bg-forge motion-safe:animate-probe" />
          ) : null}
        </span>

        <Node
          tone={established ? 'green' : broken ? 'red' : null}
        >
          <Icon
            name={established ? 'check' : broken ? 'x' : 'plug'}
            size="sm"
            className={
              established ? 'text-on-green' : broken ? 'text-on-red' : 'text-ink-dim'
            }
          />
        </Node>
      </div>

      <div aria-hidden="true" className="mt-2 flex items-start justify-between gap-3">
        <span className="text-micro font-normal text-ink-dim">{t('common:brand.name')}</span>
        {/* The address actually being dialled, read out of the form above. Right
            up until something is typed there is nothing truthful to show, so it
            says so rather than inventing a placeholder host. */}
        {address ? (
          <Mono className="min-w-0 truncate text-end text-ink-dim">{address}</Mono>
        ) : (
          <span className="text-micro font-normal text-ink-dim">
            {t('dataFusion.connect.noAddress')}
          </span>
        )}
      </div>
    </figure>
  )
}

/** A node on the link. 32px, so the two ends read as equal weight. */
function Node({ tone, children }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border',
        tone === 'green'
          ? 'border-transparent tint-green'
          : tone === 'red'
            ? 'border-transparent tint-red'
            : 'border-hairline bg-sunken',
      )}
    >
      {children}
    </span>
  )
}

/**
 * A test mutation → a Probe.
 *
 * `isPending` is checked before `data` because TanStack keeps the previous result
 * during a re-run, so a second test would otherwise render its predecessor's
 * verdict for as long as the new one takes.
 *
 * @param {{isPending: boolean, data?: object, error?: object}} test
 * @returns {Probe}
 */
export function probeFromTest(test) {
  if (test.isPending) return { state: 'testing' }
  if (test.error) return { state: 'error', transportError: test.error }
  if (test.data?.reachable === true) {
    return { state: 'passed', durationMs: test.data.durationMs }
  }
  if (test.data?.reachable === false) {
    return { state: 'failed', detail: test.data.detail, durationMs: test.data.durationMs }
  }
  return { state: 'idle' }
}

/**
 * A rejected create or update → a Probe.
 *
 * Both of those endpoints run `_ensure_reachable` before they write, and when it
 * refuses they raise with `{"connection_config": <the probe's detail>}`. So a save
 * that failed for that reason carries the same information a test does, and it
 * belongs on the same surface rather than in a separate red box.
 *
 * Returns null when the error was something else — a rejected name, a 404, a
 * dropped request. Those are not statements about the endpoint.
 *
 * @param {import('@/services/apiError').ApiError} [error]
 * @returns {Probe|null}
 */
export function probeFromWriteError(error) {
  const detail = error?.fields?.connection_config
  return detail ? { state: 'failed', detail } : null
}
