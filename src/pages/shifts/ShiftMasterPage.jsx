import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { AiBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { ON_TINT_CLASS, STRIPE_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { ShiftPatternDrawer } from './ShiftPatternDrawer'
import {
  DOW_ORDER,
  INITIAL_PATTERNS,
  INITIAL_ROSTER,
  SHIFT_LINES,
  SHIFT_OPERATORS,
  SHIFT_SITES,
  blankPattern,
  crossesMidnight,
  overlappingPatterns,
  patternDuration,
  resolveCurrentPattern,
} from './shiftMasterData'

/**
 * Shift Master — patterns, rotations and crew.
 *
 * DEMO. The design puts this under Settings → Organization. It sits at
 * `/app/shifts/master` instead, because everything that reads a pattern is on
 * Shifts and a rota is not a preference: the Shifts header links straight to it
 * and back, which is the round trip somebody actually makes. Deep-linkable
 * either way, which the prototype's `useState` tab is not.
 *
 * ── What a pattern is for ─────────────────────────────────────────────────
 * The times defined here are what resolves an operator's login to a shift, and
 * that resolution pre-fills Log Event and Shift Handover. So the screen's real
 * subject is not the list — it is the three things that can go wrong with it:
 * two patterns claiming one minute, a pattern named for hours it does not run,
 * and a window with nobody rostered to it. Each has a notice, computed live.
 *
 * ── Editing persists for the session, and only for the session ────────────
 * State, not a fixture write. There is no pattern endpoint; pretending the save
 * reached one would be the more dishonest of the two options. The demo notice
 * at the foot says so.
 */
export function ShiftMasterPage() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  const [patterns, setPatterns] = useState(INITIAL_PATTERNS)
  const [roster, setRoster] = useState(INITIAL_ROSTER)
  const [site, setSite] = useState('all')
  const [editing, setEditing] = useState(null)

  useDocumentTitle(`${t('shifts.master.title')} · ${t('common:brand.name')}`)

  const shown = useMemo(
    () => patterns.filter((pattern) => site === 'all' || pattern.site === site),
    [patterns, site],
  )

  /* The pattern a login right now would resolve to. Real: it reads the clock
     against the live list, so turning a pattern off or moving its hours changes
     the sentence. The prototype prints the same one either way. */
  const current = resolveCurrentPattern(site === 'all' ? SHIFT_SITES[0].id : site, patterns)

  const save = (next) => {
    if (next.id) {
      setPatterns((current_) => current_.map((entry) => (entry.id === next.id ? next : entry)))
      toast(t('shifts.master.toast.updated', { name: next.name }))
    } else {
      const id = `sp-${next.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${patterns.length + 1}`
      setPatterns((current_) => [...current_, { ...next, id }])
      toast(t('shifts.master.toast.created', { name: next.name }))
    }
    setEditing(null)
  }

  const remove = (id) => {
    setPatterns((current_) => current_.filter((entry) => entry.id !== id))
    setRoster((current_) => current_.filter((entry) => entry.patternId !== id))
    setEditing(null)
    toast(t('shifts.master.toast.deleted'))
  }

  const toggleAssignment = (patternId, userId) =>
    setRoster((current_) =>
      current_.some((entry) => entry.patternId === patternId && entry.userId === userId)
        ? current_.filter((entry) => !(entry.patternId === patternId && entry.userId === userId))
        : [...current_, { patternId, userId, line: SHIFT_LINES[0] }],
    )

  const setLine = (patternId, userId, line) =>
    setRoster((current_) =>
      current_.map((entry) =>
        entry.patternId === patternId && entry.userId === userId ? { ...entry, line } : entry,
      ),
    )

  return (
    <Page>
      <div className="mb-4">
        <ForgeButton asChild>
          <Link to="/app/shifts">
            <Icon name="right" size="xs" className="rotate-180 rtl:rotate-0" />
            {t('shifts.title')}
          </Link>
        </ForgeButton>
      </div>

      <header className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('shifts.master.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">{t('shifts.master.subtitle')}</p>
        </div>
        <ForgeSelect
          label={t('shifts.master.field.site')}
          labelInline
          size="sm"
          value={site}
          onValueChange={setSite}
          options={[
            { value: 'all', label: t('shifts.master.allSites') },
            ...SHIFT_SITES.map((entry) => ({ value: entry.id, label: entry.label })),
          ]}
        />
        <ForgeButton variant="primary" onClick={() => setEditing(blankPattern(site))}>
          <Icon name="plus" size="xs" />
          {t('shifts.master.add')}
        </ForgeButton>
      </header>

      {/* Auto-detection. Violet because the sentence is Forge AI's resolution of
          a login to a shift, not a routine status line. */}
      <Panel stripe="violet" className="mb-4 flex flex-wrap items-center gap-3">
        <AiBadge label={t('shifts.master.detectionLabel')} />
        <p className="m-0 min-w-0 flex-1 text-body-sm text-ink-dim">
          {t('shifts.master.detection')}{' '}
          {current ? (
            <Num className="font-semibold text-ink">
              {t('shifts.master.detectionActive', {
                name: current.name,
                start: current.start,
                end: current.end,
              })}
            </Num>
          ) : (
            <span className="text-ink-mute">{t('shifts.master.detectionNone')}</span>
          )}
        </p>
      </Panel>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
        {shown.map((pattern) => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            patterns={patterns}
            roster={roster.filter((entry) => entry.patternId === pattern.id)}
            onEdit={() => setEditing(pattern)}
            onToggle={(userId) => toggleAssignment(pattern.id, userId)}
            onLine={(userId, line) => setLine(pattern.id, userId, line)}
          />
        ))}

        <button
          type="button"
          onClick={() => setEditing(blankPattern(site))}
          className="flex min-h-45 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-hairline p-4 text-center transition-colors hover:border-forge"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-sunken">
            <Icon name="plus" size="sm" className="text-ink-mute" />
          </span>
          <span className="text-body-sm font-semibold">{t('shifts.master.addTile')}</span>
          <span className="text-micro text-ink-mute">{t('shifts.master.addTileSub')}</span>
        </button>
      </div>

      <p className="mt-4 mb-0 text-body-sm text-ink-mute italic">{t('shifts.master.demoNotice')}</p>

      {editing ? (
        <ShiftPatternDrawer
          // Keyed so opening a second pattern remounts the form rather than
          // showing the first one's values under the second one's title.
          key={editing.id ?? 'new'}
          open
          pattern={editing}
          patterns={patterns}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      ) : null}
    </Page>
  )
}

/* ══ one pattern ═════════════════════════════════════════════════════════ */

function PatternCard({ pattern, patterns, roster, onEdit, onToggle, onLine }) {
  const { t } = useTranslation(['app', 'common'])
  const [picking, setPicking] = useState(false)

  const duration = patternDuration(pattern.start, pattern.end)
  const wraps = crossesMidnight(pattern.start, pattern.end)
  const conflicts = overlappingPatterns(pattern, patterns)
  const siteLabel = SHIFT_SITES.find((entry) => entry.id === pattern.site)?.label ?? pattern.site

  return (
    <Panel
      className={cn('flex flex-col gap-0', pattern.active ? STRIPE_CLASS[pattern.tone] : null)}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-micro font-semibold',
            TINT_CLASS[pattern.tone],
            ON_TINT_CLASS[pattern.tone],
          )}
        >
          <Icon name={pattern.icon} size="xs" />
          {pattern.name}
        </span>
        <span className="flex-1" />
        <StateBadge tone={pattern.active ? 'green' : null}>
          {t(pattern.active ? 'shifts.master.on' : 'shifts.master.off')}
        </StateBadge>
      </div>

      <Num className="text-metric-sm">
        {(pattern.start || '--:--') + ' – ' + (pattern.end || '--:--')}
      </Num>
      <Num className="mt-0.5 text-micro text-ink-dim">
        {t('shifts.master.cardMeta', {
          hours: duration.hours,
          minutes: duration.minutes,
          grace: pattern.grace,
        })}
        {wraps ? ` · ${t('shifts.master.wrapsShort')}` : ''}
      </Num>
      <span className="mt-0.5 text-micro text-ink-mute">{siteLabel}</span>

      <div className="mt-3 flex items-center gap-1.5">
        <Eyebrow as="span" className="me-1">
          {t('shifts.master.daysShort')}
        </Eyebrow>
        {DOW_ORDER.map((day) => {
          const on = pattern.days.includes(day)
          return (
            <span
              key={day}
              title={t(`shifts.master.dow.${day}`)}
              className={cn(
                'flex size-5 items-center justify-center rounded-xs border text-micro font-semibold',
                on
                  ? cn('border-transparent', TINT_CLASS[pattern.tone], ON_TINT_CLASS[pattern.tone])
                  : 'border-hairline text-ink-mute',
              )}
            >
              {t(`shifts.master.dow.${day}`).charAt(0)}
            </span>
          )
        })}
      </div>

      {conflicts.length ? (
        <p className="mt-2.5 mb-0 text-micro text-on-amber">
          {t('shifts.master.overlaps', { names: conflicts.map((c) => c.name).join(', ') })}
        </p>
      ) : null}

      {/* ── Crew ────────────────────────────────────────────────────────────
          The design defines this strip and then never renders it. It belongs
          on the card: a pattern with nobody on it is the third thing that goes
          wrong with a rota, and it is invisible from a list of times. */}
      <div className="relative mt-3 border-t border-hairline pt-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          <Eyebrow as="h3" className="m-0 flex-1">
            {t('shifts.master.crew', { total: roster.length })}
          </Eyebrow>
          <ForgeButton size="sm" variant="ghost" onClick={() => setPicking((open) => !open)}>
            {t('shifts.master.assign')}
          </ForgeButton>
        </div>

        {roster.length === 0 ? (
          <p className="m-0 text-micro text-ink-mute">{t('shifts.master.crewEmpty')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {roster.map((entry) => {
              const person = SHIFT_OPERATORS.find((candidate) => candidate.id === entry.userId)
              if (!person) return null
              return (
                <li key={entry.userId} className="flex items-center gap-2 py-1">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sunken text-micro font-semibold text-ink-dim">
                    {person.initials}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-micro">{person.name}</span>
                  <select
                    value={entry.line}
                    aria-label={t('shifts.master.lineFor', { name: person.name })}
                    onChange={(event) => onLine(entry.userId, event.target.value)}
                    className="max-w-28 border-0 bg-transparent text-micro text-ink-mute outline-none"
                  >
                    {SHIFT_LINES.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </select>
                  <IconButton
                    label={t('shifts.master.unassign', { name: person.name })}
                    onClick={() => onToggle(entry.userId)}
                  >
                    <Icon name="x" size="xs" />
                  </IconButton>
                </li>
              )
            })}
          </ul>
        )}

        {picking ? (
          <>
            <button
              type="button"
              aria-label={t('common:actions.close')}
              onClick={() => setPicking(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute end-0 top-full z-50 max-h-70 w-64 overflow-auto rounded-sm border border-hairline bg-card p-1.5 shadow-lift">
              {SHIFT_OPERATORS.map((person) => {
                const on = roster.some((entry) => entry.userId === person.id)
                return (
                  <button
                    key={person.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(person.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-start transition-colors hover:bg-sunken',
                      on && 'bg-sunken',
                    )}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken text-micro font-semibold text-ink-dim">
                      {person.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-semibold">
                        {person.name}
                      </span>
                      <span className="block truncate text-micro text-ink-mute">{person.role}</span>
                    </span>
                    {on ? <Icon name="check" size="xs" className="text-on-forge" /> : null}
                  </button>
                )
              })}
            </div>
          </>
        ) : null}
      </div>

      <ForgeButton className="mt-3 w-full justify-center" onClick={onEdit}>
        {t('common:actions.edit')}
      </ForgeButton>
    </Panel>
  )
}
