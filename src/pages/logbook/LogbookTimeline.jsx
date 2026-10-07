import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Panel } from '@/components/forge/Panel'
import { SeverityBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { formatDateTime, formatTime } from '@/lib/format'
import { SHIFT_TYPE_TONE } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * The same entries, read as a run of time.
 *
 * DEMO. See `DEMO-MODE.md` §8.6.
 *
 * ── Why it is a second view and not a second screen ───────────────────────
 * The feed answers "what has the crew been writing"; this answers "what
 * happened on Tuesday night". Same rows, same order, same filters — only the
 * density and the day breaks differ, which is why the toggle sits in the URL
 * and nothing refetches when it moves.
 *
 * ── The day headings ──────────────────────────────────────────────────────
 * The prototype's timeline prints the date on every row, so a night with four
 * notes repeats it four times and the reader has to compare strings to see the
 * run. Grouping by day says the same thing once.
 *
 * The dot takes the SHIFT's colour, from the map the roster's own dots use.
 */
export function LogbookTimeline({ entries }) {
  const { t } = useTranslation(['app', 'common'])

  /* Grouped in render order rather than sorted into a map first: the rows
     arrive newest-first from the server and must stay that way, and a plain
     object would reorder date keys that look like numbers. */
  const days = []
  for (const entry of entries) {
    const last = days[days.length - 1]
    if (last && last.date === entry.date) last.entries.push(entry)
    else days.push({ date: entry.date, entries: [entry] })
  }

  return (
    <Panel className="flex flex-col gap-5">
      {days.map((day) => (
        <section key={day.date}>
          <Eyebrow as="h2" className="mb-2.5">
            <Num>{formatDateTime(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}</Num>
          </Eyebrow>

          <ol className="relative m-0 list-none p-0 ps-4">
            {/* The rule. `start-[3px]` and not `left` — logical properties
                only, so it runs down the other edge under RTL. */}
            <span
              aria-hidden="true"
              className="absolute start-[3px] top-1.5 bottom-1.5 w-px bg-hairline"
            />

            {day.entries.map((entry) => (
              <li key={entry.id} className="relative pb-4 last:pb-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-1.5 size-[9px] rounded-full ring-2 ring-card',
                    // No shift means the note fell outside the roster's reach.
                    // Grey, rather than borrowing one of the three colours.
                    !entry.shiftType && 'bg-ink-mute',
                  )}
                  style={{
                    insetInlineStart: '-13px',
                    backgroundColor: entry.shiftType
                      ? `var(--hue-${SHIFT_TYPE_TONE[entry.shiftType]})`
                      : undefined,
                  }}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Mono className="text-body-sm font-semibold">
                    <Num>{formatTime(entry.at)}</Num>
                  </Mono>
                  <span className="text-micro font-normal text-ink-dim">
                    {entry.authorName} · {entry.assetName}
                  </span>
                  {entry.alert ? (
                    <Link
                      to={`/app/assets/${entry.alert.assetId}?view=detailed&tab=alerts`}
                      aria-label={t('logbook.entry.openAlert')}
                      className="flex items-center gap-1.5 no-underline"
                    >
                      <SeverityBadge severity={entry.alert.severity} />
                      <Mono className="text-micro text-on-forge">{entry.alert.id}</Mono>
                    </Link>
                  ) : null}
                </div>

                <p className="m-0 mt-0.5 text-body-sm text-ink-dim">{entry.text}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Panel>
  )
}
