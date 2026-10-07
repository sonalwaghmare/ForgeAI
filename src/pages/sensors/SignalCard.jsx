import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { SignalTrace } from '@/components/forge/SignalTrace'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { formatMeasure } from '@/lib/units'

/**
 * One measured channel, as a card with its trace.
 *
 * DEMO. See `DEMO-MODE.md` §8.4.
 *
 * ── The number and the chart are the same fact ────────────────────────────
 * The prototype prints an authored `s.value` beside a separately generated
 * `s.series`, so the figure in the corner is not on the chart under it. Here the
 * handler forces the trace's last point to the reading, in every window, so the
 * headline IS the right-hand end of the line. The reading itself comes from the
 * open alert where there is one, which is why this card and the anomaly list
 * cannot report two values for one instrument.
 *
 * ── The trace takes the channel's colour, not always red ──────────────────
 * `SignalTrace` defaults to red because its two original callers are each one
 * sensor going wrong. Forty-five red traces would mean nothing. See its `tone`
 * prop.
 */

/** Sensor kind → glyph. Same mapping the asset list uses for its sensor icons. */
const KIND_ICON = {
  vibration: 'wave',
  acoustic: 'wave',
  temperature: 'thermo',
  pressure: 'gauge',
  current: 'bolt',
  flow: 'gauge',
  conductivity: 'plug',
  vision: 'eye',
}

const STATE_TONE = { violation: 'red', warning: 'amber', ok: 'green' }

export function SignalCard({ channel }) {
  const { t } = useTranslation(['app', 'common'])
  const navigate = useNavigate()
  const tone = STATE_TONE[channel.state] ?? 'green'
  const [low, high] = channel.band ?? [null, null]

  /* Opening the Workstation with this one channel selected. `adhoc` is a chart
     nobody saved, so the whole selection travels in the URL and Save is a POST
     from there. */
  const to = `/app/sensors/charts/adhoc?signals=${encodeURIComponent(channel.id)}&window=${channel.window}`

  /* Which edge the dashed rule sits on: the one this reading is heading for. A
     coolant flow that has fallen to zero is not approaching its upper limit, and
     drawing the rule up there would say it is fine. */
  const threshold = low != null && channel.value < low ? low : (high ?? channel.value)

  /* Where the anomaly region opens — the first point in the last two fifths that
     leaves the band. Computed from the trace rather than passed as a constant,
     so the shading starts where the line actually goes wrong. */
  const anomalyFrom = (() => {
    if (low == null || channel.state === 'ok') return null
    const from = Math.floor(channel.values.length * 0.6)
    for (let index = from; index < channel.values.length; index += 1) {
      if (channel.values[index] < low || channel.values[index] > high) return index
    }
    return null
  })()

  return (
    /* Earned, not decorative: the edge marks a channel actually outside its
       limits at critical or high. A wall of forty-five striped cards would mark
       nothing. See DESIGN.md on the leading edge.

       The card navigates on click, as the design has it. The channel NAME below
       is also a real anchor, so the card is reachable by keyboard, openable in a
       new tab and announced with a destination — none of which a bare
       `onClick` handler on a div gives you. The click is ignored when it landed
       on a link, so the two never fire together. */
    <Panel
      interactive
      onClick={(event) => {
        if (event.target.closest('a')) return
        navigate(to)
      }}
      className="flex cursor-pointer flex-col gap-3"
      stripe={channel.state === 'violation' ? 'red' : null}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-xs border"
          style={{
            borderColor: `color-mix(in srgb, var(--hue-${tone}) 35%, transparent)`,
            backgroundColor: `color-mix(in srgb, var(--hue-${tone}) calc(var(--tint) * 100%), transparent)`,
          }}
        >
          <Icon
            name={KIND_ICON[channel.kind] ?? 'chart'}
            size="sm"
            style={{ color: `var(--on-${tone})` }}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-body-sm font-semibold">
            <Link to={to} className="text-ink no-underline hover:underline">
              {channel.name}
            </Link>
            {channel.component ? (
              <span className="font-normal text-ink-dim"> · {channel.component}</span>
            ) : null}
          </p>
          <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-1.5 text-micro font-normal text-ink-dim">
            <span>{channel.assetName}</span>
            <span>·</span>
            <Mono>{channel.assetCode}</Mono>
            <span>·</span>
            <span>{channel.lineName}</span>
          </p>
        </div>

        <div className="shrink-0 text-end">
          <Num
            className="block text-title font-semibold"
            style={channel.state === 'ok' ? undefined : { color: `var(--on-${tone})` }}
          >
            {formatMeasure({ value: channel.value, unit: channel.unit })}
          </Num>
          <StateBadge tone={channel.state === 'ok' ? 'green' : tone}>
            {t(`sensors.state.${channel.state}`)}
          </StateBadge>
        </div>
      </div>

      <SignalTrace
        values={channel.values}
        threshold={threshold}
        normalBand={channel.band}
        anomalyFrom={anomalyFrom}
        unit={channel.unit}
        tone={tone}
        label={`${channel.assetName} · ${channel.name}`}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro font-normal text-ink-dim">
        <Mono className="truncate">{channel.tag}</Mono>
        <span className="ms-auto whitespace-nowrap">
          <Num>
            {t('sensors.card.band', {
              low: formatMeasure({ value: low, unit: channel.unit }),
              high: formatMeasure({ value: high, unit: channel.unit }),
            })}
          </Num>
        </span>
        {channel.alertId ? (
          <Mono className="whitespace-nowrap" style={{ color: `var(--on-${tone})` }}>
            {channel.alertId}
          </Mono>
        ) : null}
      </div>

      <span className="inline-flex items-center gap-1.5 self-start text-micro font-semibold text-on-forge">
        {t('sensors.card.openWorkstation')}
        <Icon name="right" size="xs" className="mirror-rtl" />
      </span>
    </Panel>
  )
}
