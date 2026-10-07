import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { AiBadge, PlainBadge, SeverityBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { formatDateTime, formatTime } from '@/lib/format'
import { SHIFT_TYPE_TONE } from '@/lib/tone'

/**
 * One entry in the feed.
 *
 * DEMO. See `DEMO-MODE.md` §8.6.
 *
 * ── The violet badge is earned ────────────────────────────────────────────
 * It says an investigation cited this note, and the chip below names the
 * anomaly it was cited in. They are one fact from the server, so the card
 * cannot claim to have been analysed and then point at nothing — which the
 * prototype's can, because `ai` and `anomaly` are two authored fields.
 *
 * ── Where the chip goes ───────────────────────────────────────────────────
 * To the MACHINE's alerts, not to `/app/anomalies/ALR-4471`. That module is the
 * real API and its ids are the backend's, so a fixture id in that path is a
 * 404 waiting to happen. Same call the shift detail panel already makes.
 */
export function LogbookEntry({ entry }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-micro font-semibold text-ink-dim">
          {entry.authorInitials ?? '—'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-body-sm font-semibold">{entry.authorName ?? '—'}</p>
          <p className="m-0 text-micro font-normal text-ink-dim">
            <Num>
              <Mono>{formatTime(entry.at)}</Mono> ·{' '}
              {formatDateTime(entry.date, { dateStyle: 'medium' })}
            </Num>
            {entry.authorRole ? <> · {entry.authorRole}</> : null}
          </p>
        </div>

        {entry.written ? <PlainBadge>{t('logbook.entry.written')}</PlainBadge> : null}

        {/* Violet only where Forge AI genuinely did something with the note.
            An entry on a machine with nothing wrong carries no badge, and that
            is the honest state rather than a gap in the design. */}
        {entry.cited ? (
          <span title={t('logbook.entry.citedTitle', { alert: entry.alert.id })}>
            <AiBadge label={t('logbook.entry.cited')} />
          </span>
        ) : null}

        {entry.shiftType ? (
          <StateBadge tone={SHIFT_TYPE_TONE[entry.shiftType]} dot={false}>
            {t(`shifts.type.${entry.shiftType}`)}
          </StateBadge>
        ) : null}
      </div>

      <p className="m-0 text-body leading-relaxed">{entry.text}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/app/assets/${entry.assetId}`}
          aria-label={t('logbook.entry.openAsset', { name: entry.assetName })}
          className="flex items-center gap-1.5 rounded-xs bg-sunken px-2 py-1 text-micro font-semibold text-ink-dim no-underline transition-colors hover:text-ink"
        >
          <Icon name="machine" size="xs" />
          {entry.assetName}
        </Link>

        {entry.tags.map((tag) => (
          <Mono key={tag} className="rounded-xs bg-sunken px-2 py-1 text-micro text-ink-dim">
            #{tag}
          </Mono>
        ))}

        {/* The design's "Ask about this". It was dropped in the Logbook pass
            for want of a destination; the Copilot screen now takes a seeded
            question in `?q=`, so it has one. The question names the machine,
            which is what an investigation into a note would start from. */}
        <Link
          to={`/app/copilot?mode=trouble&q=${encodeURIComponent(`What is wrong with ${entry.assetName}?`)}`}
          className="flex items-center gap-1.5 rounded-xs px-2 py-1 text-micro font-semibold text-on-violet no-underline transition-colors hover:bg-sunken"
        >
          <Icon name="ai" size="xs" />
          {t('logbook.entry.ask')}
        </Link>

        {entry.alert ? (
          <Link
            to={`/app/assets/${entry.alert.assetId}?view=detailed&tab=alerts`}
            aria-label={t('logbook.entry.openAlert')}
            className="ms-auto flex items-center gap-1.5 rounded-xs px-2 py-1 text-micro font-semibold text-on-forge no-underline transition-colors hover:bg-sunken"
          >
            <SeverityBadge severity={entry.alert.severity} />
            <Mono>{entry.alert.id}</Mono>
            <Icon name="right" size="xs" className="mirror-rtl" />
          </Link>
        ) : null}
      </div>
    </Panel>
  )
}
