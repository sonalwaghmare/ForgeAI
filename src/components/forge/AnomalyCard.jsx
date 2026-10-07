import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { STRIPE_CLASS } from '@/lib/tone'
import { anomalyPath } from '@/features/anomalies/api'
import { HierarchyTrail } from './HierarchyTrail'
import { formatRelative } from '@/lib/format'
import { Eyebrow, Num, Serial, VRule } from './primitives'
import { RcaBadge, SeverityBadge, StatusBadge, hueForSeverity } from './StatusBadge'

/**
 * One anomaly, as the product renders it.
 *
 * ── Sibling of AlertCard, not a fork of it ────────────────────────────────
 * Same anatomy, same stripe language, same side column: badges and title lead,
 * a hairline rule separates, the machine identifier and its timestamp close.
 * That row shape is the design's own and it is the one a reader already knows
 * from the home screen.
 *
 * A separate component because the DATA is separate. `AlertCard` renders a
 * fixture record with a reading, a threshold, an ETA and a cascade count;
 * `AnomalyListItem` has none of those, and the six fields it does have are all
 * here. Parameterising one card over two record shapes would mean a row full of
 * conditionals whose absent branches nobody could see were absent.
 *
 * ── The stripe is earned, and low severity does not earn it ───────────────
 * Critical, high and medium take a hue on the leading edge; low takes none,
 * because a low-severity note is not the machine raising its hand. That is what
 * keeps a stack of these scannable — the eye finds the ones that matter without
 * reading a word. Same rule `AlertCard` follows, from the same `hueForSeverity`.
 *
 * ── The whole card is one link ────────────────────────────────────────────
 * A `Link`, not a `div` with an `onClick` — so the target is in the status bar on
 * hover, middle-click and ⌘-click open a tab, and the row is reachable by keyboard
 * with a real focus ring. The prototype made every one of these a `<div onClick>`,
 * which PRODUCT.md names as its largest accessibility failure.
 *
 * One link wrapping the whole row rather than a link on the title: the entire card
 * is the target, and a nested interactive element inside a link is invalid markup
 * that screen readers announce twice. Which is also why the trail's segments are
 * plain text here — the prototype makes its line and asset separate links inside
 * the row, and they cannot be.
 *
 * @param {object} props
 * @param {{
 *   id: string, severity: string, status: string, serialNumber: string,
 *   title: string, hierarchy: object, createdAt: ?string,
 * }} props.anomaly
 * @param {boolean} [props.compact]
 *   Board columns. Drops the side rule and moves the identifier above the
 *   badges, because a 190px column cannot hold two columns of its own.
 */
export function AnomalyCard({ anomaly, compact = false, className }) {
  const { t } = useTranslation(['app', 'common'])

  const stripe = hueForSeverity(anomaly.severity)

  return (
    <Link
      to={anomalyPath(anomaly.id)}
      aria-label={t('anomalies.openAnomaly', { serial: anomaly.serialNumber })}
      className={cn(
        'flex items-center gap-3.5 rounded-sm border border-hairline bg-card p-4 shadow-edge',
        // Interactive, so it lifts — and only interactive things do. Border warms
        // toward the accent rather than the fill changing, which would fight the
        // severity edge for the same signal.
        'transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-forge/40 hover:shadow-lift',
        stripe && STRIPE_CLASS[stripe],
        // Below the tablet breakpoint the row wraps rather than crushing the
        // title and the identifier together.
        'max-xl:flex-wrap',
        compact && 'gap-0 p-3.5',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        {compact ? (
          <Serial
            as="div"
            value={anomaly.serialNumber}
            className="mb-1.5 font-semibold text-on-forge"
          />
        ) : null}

        {/* Three independent axes, always in this order: how bad, who has it,
            whether the machine has explained it. Fixed order matters more than it
            looks — a stack of fifty rows is scanned by position, and a badge that
            moves because a neighbour is absent has to be read instead. */}
        <span className="mb-2 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={anomaly.severity} dot />
          <StatusBadge status={anomaly.status} />
          <RcaBadge status={anomaly.rcaStatus} />
        </span>

        {/* `title` is the server's own sentence — "Vibration drift on VIB-X-01".
            Rendered as it arrived: it is the record's name, not a template this
            file assembles from parts, and concatenating around it would make it
            untranslatable. */}
        <span className={cn('block', compact ? 'text-body font-semibold' : 'text-title')}>
          {anomaly.title}
        </span>

        {/* The attachment level, each tier in the hue that names it. An anomaly
            raised at the plant is one green word; one raised at a machine runs
            green → cyan → ink, so the trail states how precisely it was located as
            well as where. */}
        <HierarchyTrail hierarchy={anomaly.hierarchy} className="mt-1" />

        {compact ? (
          <Num className="mt-2 block text-micro font-normal text-ink-dim">
            {formatRelative(anomaly.createdAt)}
          </Num>
        ) : null}
      </span>

      {!compact ? (
        <>
          <VRule className="h-11 max-xl:hidden" />
          <span className="min-w-[168px] shrink-0 max-xl:min-w-0">
            {/* Machine-minted, ASCII, never translated — and the string somebody
                quotes on a call, which is why it leads the column. */}
            <Serial
              as="div"
              value={anomaly.serialNumber}
              className="mb-1.5 font-semibold text-on-forge"
            />
            <Eyebrow as="span" className="block">
              {t('anomalies.columns.created')}
            </Eyebrow>
            <Num className="mt-1 block text-body-sm font-medium">
              {formatRelative(anomaly.createdAt)}
            </Num>
          </span>
        </>
      ) : null}
    </Link>
  )
}
