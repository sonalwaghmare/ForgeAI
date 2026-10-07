import { useTranslation } from 'react-i18next'
import { Num } from '@/components/forge/primitives'
import { formatDecimal, formatSigned } from '@/lib/format'

/**
 * The loss waterfall — five rows, each a label, a bar and a figure.
 *
 * The prototype's shape exactly. What differs is that the numbers arrive
 * computed from the three factors rather than typed in beside them, so the
 * three losses always sum to the gap between planned and actual. See the
 * mock handler for the cascade.
 *
 * ── Why a bar and not a true stepped waterfall ────────────────────────────
 * A stepped waterfall — each bar floating at the level the one before it left —
 * is the more literal drawing and is worse here. At this size the quality loss
 * is under a point, so its floating segment would be a two-pixel mark suspended
 * in the middle of the card with nothing to measure it against. Bars from a
 * common baseline are comparable to each other at a glance, which is the actual
 * question: which loss is the big one.
 *
 * Bars have a visible floor. Quality loss is 0.75 points against a 100-point
 * scale, and a bar that rounds to nothing reads as a rendering fault rather than
 * as a small number.
 */
export function LossWaterfall({ rows }) {
  const { t } = useTranslation('app')

  return (
    <div>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 py-[7px]">
            <span className="min-w-0 flex-1 truncate text-body-sm text-ink-dim">
              {t(`oee.waterfall.${row.key}`)}
            </span>

            <span
              aria-hidden="true"
              className="h-[18px] w-[min(11.25rem,40%)] shrink-0 overflow-hidden rounded-xs bg-sunken"
            >
              <span
                className="block h-full rounded-xs"
                style={{
                  width: `${Math.max(1.5, row.span)}%`,
                  background: row.tone ? `var(--hue-${row.tone})` : 'var(--border-hairline)',
                }}
              />
            </span>

            <Num
              className="w-14 shrink-0 text-end text-body-sm font-semibold"
              style={row.tone ? { color: `var(--on-${row.tone})` } : undefined}
            >
              {/* A loss is signed, because the sign is the whole point. A level —
                  the first row and the last — is not a change and carries none. */}
              {row.value < 0 ? formatSigned(row.value) : formatDecimal(row.value)}
            </Num>
          </li>
        ))}
      </ul>

      <p className="mt-3 mb-0 text-micro font-normal text-ink-dim">{t('oee.waterfall.caption')}</p>
    </div>
  )
}
