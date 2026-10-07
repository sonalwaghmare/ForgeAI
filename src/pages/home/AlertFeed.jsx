import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { SeverityBadge, StatusBadge, hueForSeverity } from '@/components/forge/StatusBadge'
import { EmptyState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useAlerts } from '@/features/alerts/queries'
import { useAssistant } from '@/shell/AppShell'
import { useScope } from '@/providers/ScopeProvider'
import { formatMeasure } from '@/lib/units'
import { formatTime } from '@/lib/format'

/**
 * The prototype's Active Alerts feed — DEMO.
 *
 * ── Why this is not `AlertCard` ────────────────────────────────────────────
 * `AlertCard` is the product's alert object and it is correct where it is used:
 * a full-width row on the Anomalies screen and on the public page, with room for
 * a stack of badges, a two-line description and its own detected column.
 *
 * The prototype's home feed is a different instrument. It lives in a 340px
 * column, holds five or six anomalies at once, and is meant to be scanned rather
 * than read — so it is a dense list inside one panel, with the badges on the
 * same line as the id and the facts compressed to a single meta row. Dropping
 * `AlertCard` into that column is what produced a card five badges tall with
 * every line wrapping.
 *
 * The two are not forked. They read the same record, and neither one's layout
 * constrains the other, which is exactly why this is a separate component rather
 * than a fourth variant flag on `AlertCard`.
 */
export function AlertFeed() {
  const { t } = useTranslation(['app', 'common'])
  const { params } = useScope()
  const { ground } = useAssistant()
  const alerts = useAlerts({ ...params, sort: 'severity' })

  const items = (alerts.data?.items ?? []).filter((alert) => alert.status !== 'resolved')

  return (
    <Panel flush className="flex min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <Eyebrow className="flex-1">{t('home.dashboard.activeAlerts')}</Eyebrow>
        <ForgeButton asChild size="sm">
          <Link to="/app/anomalies" aria-label={t('home.dashboard.openAlerts')}>
            <Icon name="right" size="xs" className="mirror-rtl" />
          </Link>
        </ForgeButton>
      </div>

      {alerts.isPending ? (
        <div className="p-4">
          <SkeletonRows count={4} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent shadow-none"
          icon="check"
          title={t('home.dashboard.noAlerts')}
          body={t('home.dashboard.noAlertsBody')}
        />
      ) : (
        /* Capped and scrolled rather than growing without limit. The prototype
           does the same: this column sits beside a page that already scrolls,
           and a feed that pushes the page taller with every anomaly makes the
           panels beside it unreachable. */
        <ul
          className="m-0 max-h-[35rem] list-none overflow-y-auto p-0"
          aria-label={t('home.dashboard.feedScroll')}
        >
          {items.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onSelect={ground} t={t} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function AlertRow({ alert, onSelect, t }) {
  const hue = hueForSeverity(alert.severity)

  return (
    <li className="border-b border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => onSelect(alert)}
        className="w-full px-3.5 py-2.5 text-start transition-colors hover:bg-sunken"
        // Authored logically so the leading edge mirrors under dir="rtl".
        style={
          hue
            ? {
                borderInlineStartWidth: 3,
                borderInlineStartStyle: 'solid',
                borderInlineStartColor: `var(--hue-${hue})`,
              }
            : undefined
        }
      >
        {/* Severity, id and time on one line — the three facts that decide
            whether this row is worth reading further. */}
        <span className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={alert.severity} dot />
          <Mono className="font-semibold text-on-forge">{alert.id}</Mono>
          <Num className="ms-auto text-micro font-normal text-ink-dim">
            {formatTime(alert.detectedAt)}
          </Num>
        </span>

        <span className="mt-1.5 block text-body-sm font-semibold text-ink">
          {t(`common:anomalyTypes.${alert.anomalyType}`)} · {alert.assetName}
        </span>

        <span className="mt-0.5 block text-micro font-normal text-ink-dim">
          {alert.sensor} ·{' '}
          {t('alerts.readingAgainst', {
            reading: formatMeasure(alert.reading),
            threshold: formatMeasure(alert.threshold),
          })}
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-micro font-normal text-ink-dim">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="gauge" size="xs" className="text-ink-mute" />
            <Num>{t('alerts.confShort', { score: alert.fusionScore })}</Num>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="users" size="xs" className="text-ink-mute" />
            {alert.assigneeId === null ? t('common:status.unassigned') : alert.assigneeId}
          </span>
          <StatusBadge status={alert.status} className="ms-auto" />
        </span>
      </button>
    </li>
  )
}
