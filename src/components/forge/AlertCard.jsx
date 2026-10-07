import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { STRIPE_CLASS } from '@/lib/tone'
import { formatHours, formatRelative } from '@/lib/format'
import { formatMeasure } from '@/lib/units'
import { Icon } from './Icon'
import { Eyebrow, Mono, VRule } from './primitives'
import { PlainBadge, SeverityBadge, StatusBadge, hueForSeverity } from './StatusBadge'

/**
 * One anomaly, as the product renders it.
 *
 * The severity stripe is earned: critical, high and medium carry a hue on the
 * leading edge; low does not, because a low-severity note is not the machine
 * raising its hand. That keeps a stack of these scannable — the eye finds the
 * three that matter without reading a word.
 *
 * @param {object} props
 * @param {import('@/features/alerts/api').Alert} props.alert
 * @param {boolean} [props.selected]
 * @param {(alert: object) => void} [props.onSelect]
 * @param {boolean} [props.compact] Drops the side column, for narrow columns.
 */
export function AlertCard({ alert, selected, onSelect, compact = false, className }) {
  const { t } = useTranslation(['app', 'common'])
  const stripe = hueForSeverity(alert.severity)
  const interactive = Boolean(onSelect)
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? () => onSelect(alert) : undefined}
      aria-current={interactive && selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-sm border border-hairline bg-card p-4 text-start shadow-edge',
        'transition-colors',
        interactive && 'hover:bg-sunken',
        selected && 'border-forge',
        stripe && STRIPE_CLASS[stripe],
        // Below the tablet breakpoint the row wraps rather than crushing the
        // reading and threshold together.
        'max-xl:flex-wrap',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="mb-2 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={alert.severity} dot />
          <StatusBadge status={alert.status} />
          {alert.assigneeId === null ? (
            <PlainBadge>{t('common:status.unassigned')}</PlainBadge>
          ) : null}
          {alert.hasAnalysis ? (
            <span className="inline-flex items-center gap-1.5 text-micro text-on-violet">
              <Icon name="ai" size="xs" className="text-violet" />
              {t('common:ai.analysed')}
            </span>
          ) : null}
        </span>

        <span className="block text-title">
          {t(`common:anomalyTypes.${alert.anomalyType}`)} · {alert.sensor}
        </span>

        <span className="mt-1 block text-body-sm text-ink-dim">
          {alert.lineName} · {alert.assetName} · {alert.component} ·{' '}
          {t('alerts.readingAgainst', {
            reading: formatMeasure(alert.reading),
            threshold: formatMeasure(alert.threshold),
          })}
        </span>

        {alert.etaHours != null || alert.cascadeSensors > 1 ? (
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro font-normal text-ink-dim">
            {alert.etaHours != null ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="thermo" size="xs" className="text-ink-mute" />
                {t('alerts.etaToTrip', { hours: formatHours(alert.etaHours) })}
              </span>
            ) : null}
            {alert.cascadeSensors > 1 ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="wave" size="xs" className="text-ink-mute" />
                {t('alerts.cascadeAgrees', { count: alert.cascadeSensors })}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>

      {!compact ? (
        <>
          <VRule className="h-11 max-xl:hidden" />
          <span className="min-w-[168px] shrink-0 max-xl:min-w-0">
            <Mono className="mb-1.5 block font-semibold text-on-forge">{alert.id}</Mono>
            <Eyebrow as="span" className="block">
              {t('alerts.detected')}
            </Eyebrow>
            <span className="num mt-1 block text-body-sm font-medium">
              {formatRelative(alert.detectedAt)}
            </span>
          </span>
        </>
      ) : null}
    </Tag>
  )
}
