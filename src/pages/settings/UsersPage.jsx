import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Mono, Num } from '@/components/forge/primitives'
import {
  PERSON_FACETS,
  TEAM_TYPES,
  usePeople,
  usePeopleImports,
  useSetPersonStatus,
  useTeams,
} from '@/features/people/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { downloadCsv, toCsv } from '@/lib/csv'
import { formatInteger, formatRelative } from '@/lib/format'
import { ON_TINT_CLASS, STRIPE_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { CreatePersonDialog } from './CreatePersonDialog'
import { PeopleImportWizard } from './PeopleImportWizard'

/**
 * Settings → Users & Teams.
 *
 * DEMO. See `DEMO-MODE.md` §8.14.
 *
 * ── This is the first screen that shows a person ──────────────────────────
 * Five modules already name them — shift crews, task assignees, handover
 * authors, logbook entries, document owners — and until now every one of those
 * names was a string with nothing behind it. It did not add a registry; it
 * collapsed the three that existed.
 *
 * ── Three tabs, because they are three collections ────────────────────────
 * People, the groups they are in, and the record of bulk changes made to both.
 * The design's shape exactly, and each one is a real list here rather than the
 * empty state the prototype leaves the third as.
 *
 * ── The columns are derived from what people actually did ─────────────────
 * The design writes `last: "2m ago"`, `sites: "2 sites"` and `members: 2` into
 * its rows. Here the first is the end of somebody's most recent finished shift,
 * the second is their own plant plus wherever their open work is, and the third
 * is a count of the people carrying that team's id. "Never" is a real answer and
 * the useful one: an enabled account nobody has used is what an access review is
 * looking for, and a made-up date would hide it.
 */

const TABS = ['users', 'teams', 'history']
const TAB_ICON = { users: 'users', teams: 'factory', history: 'cal' }

const ALL = 'all'

export function UsersPage() {
  const { t } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('settings.users.title')} · ${t('common:brand.name')}`)

  const [tab, setTab] = useState(TABS[0])

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-4">
        <h1 className="m-0 text-headline">{t('settings.users.title')}</h1>
        <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
          {t('settings.users.intro')}
        </p>
      </header>

      <div
        role="tablist"
        aria-label={t('settings.users.tabsLabel')}
        className="mb-5 flex gap-1 border-b border-hairline"
      >
        {TABS.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={tab === entry}
            onClick={() => setTab(entry)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-body-sm transition-colors',
              tab === entry
                ? 'border-forge font-semibold text-ink'
                : 'border-transparent text-ink-dim hover:text-ink',
            )}
          >
            <Icon name={TAB_ICON[entry]} size="sm" />
            {t(`settings.users.tabs.${entry}`)}
          </button>
        ))}
      </div>

      {tab === 'users' ? <UsersTab /> : tab === 'teams' ? <TeamsTab /> : <ImportHistoryTab />}
    </div>
  )
}

/* ══ USERS ═══════════════════════════════════════════════════════════════ */

/** Facets that are a status, and facets that are a property. They filter differently. */
const STATUS_FACETS = new Set(['active', 'inactive', 'locked'])

const STATUS_TONE = { active: 'green', inactive: null, locked: 'red' }

const FACET_TONE = {
  total: null,
  active: 'green',
  inactive: null,
  locked: 'red',
  mfaOn: 'green',
  mfaOff: 'amber',
  neverSignedIn: 'amber',
}

/** The chip row, which is the status ladder and nothing else. */
const STATUS_CHIPS = ['all', 'active', 'inactive', 'locked']

function UsersTab() {
  const { t, i18n } = useTranslation(['app', 'common'])

  const [facet, setFacet] = useState('total')
  const [role, setRole] = useState(ALL)
  const [site, setSite] = useState(ALL)
  const [query, setQuery] = useState('')
  const [moreFilters, setMoreFilters] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)

  const people = usePeople({
    status: STATUS_FACETS.has(facet) ? facet : ALL,
    facet: STATUS_FACETS.has(facet) ? undefined : facet,
    role,
    siteId: site,
    q: query.trim() || undefined,
  })
  const setStatus = useSetPersonStatus()

  const rows = people.data?.items ?? []
  const stats = people.data?.stats ?? {}
  const roleOptions = people.data?.options?.roles ?? []
  const siteOptions = people.data?.options?.sites ?? []

  const narrowed = facet !== 'total' || role !== ALL || site !== ALL || query.trim().length > 0
  const chosen = rows.filter((person) => selected.has(person.id))

  function clearFilters() {
    setFacet('total')
    setRole(ALL)
    setSite(ALL)
    setQuery('')
  }

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* Exports what is on the screen, not the whole directory. A filtered table and
     an export that ignored the filter would be two answers to one question, and
     the reader would find out only after opening the file. */
  function exportCsv() {
    downloadCsv(
      'meridian-users.csv',
      toCsv(
        ['name', 'email', 'role', 'status', 'mfa', 'sites', 'team', 'lastActive'],
        rows.map((person) => [
          person.name,
          person.email,
          person.role,
          person.status,
          person.mfa ? 'yes' : 'no',
          person.siteNames.join(' | '),
          person.teamName ?? '',
          person.lastActiveAt ?? '',
        ]),
      ),
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
        <h2 className="m-0 text-title">{t('settings.users.management')}</h2>
        <div className="flex flex-wrap gap-2">
          <ForgeButton onClick={() => setImporting(true)}>
            <Icon name="up" size="xs" />
            {t('settings.users.import')}
          </ForgeButton>
          {/* Real: it writes the rows the table is showing. */}
          <ForgeButton disabled={!rows.length} onClick={exportCsv}>
            <Icon name="down" size="xs" />
            {t('settings.users.export')}
          </ForgeButton>
          <ForgeButton variant="primary" onClick={() => setCreating(true)}>
            {t('settings.users.create')}
          </ForgeButton>
        </div>
      </div>

      {people.isPending ? (
        <SkeletonRows count={5} />
      ) : people.isError ? (
        <ErrorState
          error={people.error}
          title={t('settings.users.loadFailed')}
          onRetry={people.refetch}
        />
      ) : (
        <>
          {/* Every tile is a filter, and every one counts something the table can
              then show. A tile that cannot be clicked is a decoration. */}
          <div className="mb-3.5 grid grid-cols-7 gap-2.5 max-2xl:grid-cols-4 max-lg:grid-cols-2">
            {PERSON_FACETS.map((entry) => {
              const on = facet === entry
              const tone = FACET_TONE[entry]
              return (
                <button
                  key={entry}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFacet(entry)}
                  className={cn(
                    'rounded-sm border bg-card px-3.5 py-3 text-start transition-colors',
                    on ? 'border-forge tint-forge' : 'border-hairline hover:bg-sunken',
                  )}
                >
                  <Num
                    className={cn(
                      'block text-display-sm',
                      tone && stats[entry] ? ON_TINT_CLASS[tone] : 'text-ink',
                    )}
                  >
                    {formatInteger(stats[entry] ?? 0)}
                  </Num>
                  <span className="eyebrow mt-1.5 block">
                    {t(`settings.users.facets.${entry}`)}
                  </span>
                  <span className="mt-0.5 block text-micro font-normal text-ink-mute">
                    {t(`settings.users.facetHints.${entry}`)}
                  </span>
                </button>
              )
            })}
          </div>

          <Panel flush className="mb-3.5 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              {STATUS_CHIPS.map((entry) => {
                const value = entry === 'all' ? 'total' : entry
                const on = facet === value
                return (
                  <button
                    key={entry}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFacet(value)}
                    className={cn(
                      'rounded-pill border px-3 py-1 text-body-sm transition-colors',
                      on
                        ? 'border-forge tint-forge font-semibold text-on-forge'
                        : 'border-hairline text-ink-dim hover:bg-sunken',
                    )}
                  >
                    <Num>
                      {t('settings.users.chip', {
                        label: t(`settings.users.facets.${value}`),
                        count: stats[value] ?? 0,
                      })}
                    </Num>
                  </button>
                )
              })}

              <ForgeSelect
                id="people-role"
                labelHidden
                size="sm"
                label={t('settings.users.filterByRole')}
                value={role}
                onValueChange={setRole}
                className="w-[13rem] shrink-0"
                options={[
                  { value: ALL, label: t('settings.users.allRoles') },
                  ...roleOptions.map((value) => ({ value, label: t(`common:roles.${value}`) })),
                ]}
              />

              {/* A disclosure, not a dead chip. The prototype's "More filters"
                  does nothing; this one reveals the filter that did not fit. */}
              <ForgeButton
                size="sm"
                aria-expanded={moreFilters}
                onClick={() => setMoreFilters((open) => !open)}
              >
                {t('settings.users.moreFilters')}
                <Icon name={moreFilters ? 'up' : 'down'} size="xs" />
              </ForgeButton>

              <div className="ms-auto flex min-w-[13rem] items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge">
                <Icon name="search" size="sm" className="text-ink-mute" />
                <label className="sr-only" htmlFor="people-search">
                  {t('settings.users.searchLabel')}
                </label>
                <input
                  id="people-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('settings.users.searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>

              <p className="m-0 text-body-sm whitespace-nowrap text-ink-dim">
                <Num>
                  {t('settings.users.matchCount', {
                    shown: formatInteger(rows.length),
                    total: formatInteger(stats.total ?? 0),
                  })}
                </Num>
              </p>
            </div>

            {moreFilters ? (
              <div className="mt-2.5 border-t border-subtle pt-2.5">
                <ForgeSelect
                  id="people-site"
                  size="sm"
                  label={t('settings.users.filterBySite')}
                  value={site}
                  onValueChange={setSite}
                  className="w-[16rem]"
                  options={[{ value: ALL, label: t('settings.users.allSites') }, ...siteOptions]}
                />
              </div>
            ) : null}
          </Panel>

          {/* The checkbox column earns itself: a selection with nothing to do to
              it is a control that wastes a column. */}
          {chosen.length ? (
            <Panel flush className="mb-2.5 flex flex-wrap items-center gap-3 px-3.5 py-2.5">
              <p className="m-0 text-body-sm font-semibold text-ink">
                <Num>{t('settings.users.selected', { count: chosen.length })}</Num>
              </p>
              <ForgeButton
                size="sm"
                disabled={setStatus.isPending}
                onClick={() => {
                  for (const person of chosen) {
                    setStatus.mutate({ id: person.id, status: 'inactive' })
                  }
                  setSelected(new Set())
                }}
              >
                {t('settings.users.deactivate')}
              </ForgeButton>
              <ForgeButton size="sm" onClick={() => setSelected(new Set())}>
                {t('settings.users.clearSelection')}
              </ForgeButton>
            </Panel>
          ) : null}

          {rows.length ? (
            <Panel flush className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t('settings.users.tableCaption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="bg-sunken px-3.5 py-2.5">
                        <span className="sr-only">{t('settings.users.columns.select')}</span>
                      </th>
                      {[
                        'person',
                        'role',
                        'status',
                        'mfa',
                        'sites',
                        'team',
                        'lastActive',
                      ].map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                        >
                          {t(`settings.users.columns.${column}`)}
                        </th>
                      ))}
                      <th scope="col" className="bg-sunken px-3.5 py-2.5">
                        <span className="sr-only">{t('settings.users.columns.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((person) => (
                      <tr
                        key={person.id}
                        className={cn(
                          'border-t border-subtle hover:bg-sunken',
                          // The earned leading edge: only on an account somebody
                          // has to do something about.
                          person.status === 'locked' && STRIPE_CLASS.red,
                          person.status === 'active' && !person.mfa && STRIPE_CLASS.amber,
                        )}
                      >
                        <td className="px-3.5 py-2.5">
                          <label className="flex cursor-pointer items-center">
                            <span className="sr-only">
                              {t('settings.users.selectOne', { name: person.name })}
                            </span>
                            <input
                              type="checkbox"
                              className="accent-forge"
                              checked={selected.has(person.id)}
                              onChange={() => toggle(person.id)}
                            />
                          </label>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="flex items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-sunken text-label font-bold text-ink-dim"
                            >
                              {person.initials}
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <span className="text-body-sm font-semibold text-ink" translate="no">
                                {person.name}
                              </span>
                              <Mono className="text-micro text-ink-dim">{person.email}</Mono>
                            </span>
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm whitespace-nowrap text-ink-dim">
                          {t(`common:roles.${person.role}`)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <StatusPill status={person.status} />
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={cn(
                              'text-body-sm',
                              person.mfa ? 'text-ink-dim' : 'font-semibold text-on-amber',
                            )}
                          >
                            {t(person.mfa ? 'settings.users.mfaOn' : 'settings.users.mfaOff')}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-body-sm text-ink-dim">
                              {t(`settings.users.scope.${person.scope}`)}
                            </span>
                            {person.siteNames.length ? (
                              <span className="text-micro font-normal text-ink-mute">
                                {person.siteNames.join(' · ')}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          {person.teamName ?? <span className="text-ink-mute">—</span>}
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm whitespace-nowrap text-ink-dim">
                          {person.lastActiveAt ? (
                            <time dateTime={person.lastActiveAt}>
                              {formatRelative(new Date(person.lastActiveAt), i18n.language)}
                            </time>
                          ) : (
                            <span className="text-on-amber">{t('settings.users.never')}</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-end">
                          <RowMenu
                            person={person}
                            pending={setStatus.isPending}
                            onSet={(status) => setStatus.mutate({ id: person.id, status })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : (
            <EmptyState
              icon="users"
              title={t('settings.users.noMatch')}
              body={t('settings.users.noMatchBody')}
              action={
                narrowed ? (
                  <ForgeButton onClick={clearFilters}>
                    {t('common:actions.clearFilters')}
                  </ForgeButton>
                ) : null
              }
            />
          )}
        </>
      )}

      <CreatePersonDialog open={creating} onClose={() => setCreating(false)} />
      <PeopleImportWizard open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}

/**
 * What can be done to this account, from the state it is in.
 *
 * Three states and therefore not three items on every row: an active account can
 * be suspended or locked, and a suspended or locked one can only be let back in.
 * Offering "Activate" beside an already-active account is offering a control that
 * does nothing.
 *
 * No Delete. The prototype has one; deleting somebody who owns tasks, shifts and
 * handovers would orphan every one of those records, with no undo to put beside
 * it. Deactivating is the reversible act that achieves what it is reached for.
 */
function RowMenu({ person, pending, onSet }) {
  const { t } = useTranslation('app')

  const items =
    person.status === 'active'
      ? [
          ['inactive', t('settings.users.deactivate')],
          ['locked', t('settings.users.lock')],
        ]
      : [['active', t('settings.users.activate')]]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton bare label={t('settings.users.rowMenu', { name: person.name })}>
          <Icon name="list" size="sm" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(([status, label]) => (
          <DropdownMenuItem key={status} disabled={pending} onSelect={() => onSet(status)}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StatusPill({ status }) {
  const { t } = useTranslation('app')
  const tone = STATUS_TONE[status]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-pill px-2.5 py-[3px] text-micro whitespace-nowrap',
        tone ? cn(TINT_CLASS[tone], ON_TINT_CLASS[tone]) : 'bg-sunken text-ink-dim',
      )}
    >
      {t(`settings.users.status.${status}`)}
    </span>
  )
}

/* ══ TEAMS ═══════════════════════════════════════════════════════════════ */

const TEAM_STATUS_TONE = { active: 'green', dormant: null }

/**
 * Groups, and what their membership implies.
 *
 * Everything but the name, the type and the channel is derived from who is in
 * the team: the member count, the sites, whether the lead is still one of them,
 * and whether the team is active at all. The design authors all four beside each
 * other, so a team can report two members and list three.
 */
function TeamsTab() {
  const { t } = useTranslation(['app', 'common'])

  const [status, setStatus] = useState(ALL)
  const [type, setType] = useState(ALL)
  const [query, setQuery] = useState('')

  const teams = useTeams({ status, type, q: query.trim() || undefined })

  const rows = teams.data?.items ?? []
  const stats = teams.data?.stats ?? {}

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
        <div className="min-w-0">
          <h2 className="m-0 text-title">{t('settings.teams.management')}</h2>
          <p className="mt-1 mb-0 text-body-sm text-ink-dim">{t('settings.teams.intro')}</p>
        </div>
        {/* No Create team. A team is a set of people carrying its id, so making
            an empty one produces a row that reports nothing and cannot be
            joined from here — membership is a property of the person. */}
      </div>

      {teams.isPending ? (
        <SkeletonRows count={4} />
      ) : teams.isError ? (
        <ErrorState
          error={teams.error}
          title={t('settings.teams.loadFailed')}
          onRetry={teams.refetch}
        />
      ) : (
        <>
          <div className="mb-3.5 grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
            {['total', 'active', 'dormant', 'enterprise'].map((entry) => (
              <div key={entry} className="rounded-sm border border-hairline bg-card px-3.5 py-3">
                <Num
                  className={cn(
                    'block text-display-sm',
                    entry === 'active' && stats[entry] ? 'text-on-green' : 'text-ink',
                  )}
                >
                  {formatInteger(stats[entry] ?? 0)}
                </Num>
                <span className="eyebrow mt-1.5 block">{t(`settings.teams.facets.${entry}`)}</span>
                <span className="mt-0.5 block text-micro font-normal text-ink-mute">
                  {t(`settings.teams.facetHints.${entry}`)}
                </span>
              </div>
            ))}
          </div>

          <Panel flush className="mb-3.5 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <ForgeSelect
                id="teams-status"
                labelHidden
                size="sm"
                label={t('settings.teams.filterByStatus')}
                value={status}
                onValueChange={setStatus}
                className="w-[12rem] shrink-0"
                options={[
                  { value: ALL, label: t('settings.teams.allStatuses') },
                  { value: 'active', label: t('settings.teams.status.active') },
                  { value: 'dormant', label: t('settings.teams.status.dormant') },
                ]}
              />
              <ForgeSelect
                id="teams-type"
                labelHidden
                size="sm"
                label={t('settings.teams.filterByType')}
                value={type}
                onValueChange={setType}
                className="w-[13rem] shrink-0"
                options={[
                  { value: ALL, label: t('settings.teams.allTypes') },
                  ...TEAM_TYPES.map((value) => ({
                    value,
                    label: t(`settings.teams.types.${value}`),
                  })),
                ]}
              />
              <div className="ms-auto flex min-w-[13rem] items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge">
                <Icon name="search" size="sm" className="text-ink-mute" />
                <label className="sr-only" htmlFor="teams-search">
                  {t('settings.teams.searchLabel')}
                </label>
                <input
                  id="teams-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('settings.teams.searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>
              <p className="m-0 text-body-sm whitespace-nowrap text-ink-dim">
                <Num>
                  {t('settings.users.matchCount', {
                    shown: formatInteger(rows.length),
                    total: formatInteger(stats.total ?? 0),
                  })}
                </Num>
              </p>
            </div>
          </Panel>

          {rows.length ? (
            <Panel flush className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t('settings.teams.tableCaption')}</caption>
                  <thead>
                    <tr>
                      {['team', 'type', 'status', 'lead', 'members', 'sites', 'landing'].map(
                        (column) => (
                          <th
                            key={column}
                            scope="col"
                            className={cn(
                              'eyebrow bg-sunken px-3.5 py-2.5 whitespace-nowrap',
                              column === 'members' ? 'text-end' : 'text-start',
                            )}
                          >
                            {t(`settings.teams.columns.${column}`)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((team) => (
                      <tr
                        key={team.id}
                        className={cn(
                          'border-t border-subtle hover:bg-sunken',
                          team.status === 'dormant' && STRIPE_CLASS.amber,
                        )}
                      >
                        <td className="px-3.5 py-2.5">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-body-sm font-semibold text-ink">{team.name}</span>
                            <Mono className="text-micro text-ink-dim">{team.channel}</Mono>
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm whitespace-nowrap text-ink-dim">
                          {t(`settings.teams.types.${team.type}`)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={cn(
                              'inline-flex w-fit items-center rounded-pill px-2.5 py-[3px] text-micro whitespace-nowrap',
                              TEAM_STATUS_TONE[team.status]
                                ? cn(
                                    TINT_CLASS[TEAM_STATUS_TONE[team.status]],
                                    ON_TINT_CLASS[TEAM_STATUS_TONE[team.status]],
                                  )
                                : 'bg-sunken text-ink-dim',
                            )}
                          >
                            {t(`settings.teams.status.${team.status}`)}
                          </span>
                        </td>
                        {/* A lead who has left the team is not a lead. The design
                            lets a team name one who is not a member. */}
                        <td className="px-3.5 py-2.5 text-body-sm whitespace-nowrap text-ink-dim">
                          {team.leadName ?? (
                            <span className="text-on-amber">{t('settings.teams.noLead')}</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-end">
                          <Num className="text-body-sm">{formatInteger(team.memberCount)}</Num>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-body-sm text-ink-dim">
                              {t(`settings.users.scope.${team.scope}`)}
                            </span>
                            {team.siteNames.length ? (
                              <span className="text-micro font-normal text-ink-mute">
                                {team.siteNames.join(' · ')}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        {/* A default page nobody can open is not a default page. */}
                        <td className="px-3.5 py-2.5">
                          <Link
                            to={team.landing}
                            className="text-body-sm text-ink-dim transition-colors hover:text-on-forge"
                          >
                            {t(`settings.teams.landing.${team.landingKey}`)}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : (
            <EmptyState
              icon="users"
              title={t('settings.teams.noMatch')}
              body={t('settings.teams.noMatchBody')}
            />
          )}
        </>
      )}
    </div>
  )
}

/* ══ IMPORT HISTORY ══════════════════════════════════════════════════════ */

/**
 * What bulk imports have been run.
 *
 * Empty to begin with — as the design's is, permanently, because nothing in the
 * prototype ever writes to it. Here the wizard on the Users tab appends a row, so
 * the tab is the record of something that happened.
 */
function ImportHistoryTab() {
  const { t, i18n } = useTranslation(['app', 'common'])
  const imports = usePeopleImports()

  const rows = imports.data?.items ?? []

  if (imports.isPending) return <SkeletonRows count={3} />
  if (imports.isError) {
    return (
      <ErrorState
        error={imports.error}
        title={t('settings.imports.loadFailed')}
        onRetry={imports.refetch}
      />
    )
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon="cal"
        title={t('settings.imports.empty')}
        body={t('settings.imports.emptyBody')}
      />
    )
  }

  return (
    <Panel flush className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t('settings.imports.tableCaption')}</caption>
          <thead>
            <tr>
              {['file', 'when', 'by', 'rows', 'created', 'updated', 'skipped'].map((column) => (
                <th
                  key={column}
                  scope="col"
                  className={cn(
                    'eyebrow bg-sunken px-3.5 py-2.5 whitespace-nowrap',
                    ['rows', 'created', 'updated', 'skipped'].includes(column)
                      ? 'text-end'
                      : 'text-start',
                  )}
                >
                  {t(`settings.imports.columns.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} className="border-t border-subtle">
                <td className="px-3.5 py-2.5">
                  <Mono className="text-body-sm text-ink">{entry.filename}</Mono>
                </td>
                <td className="px-3.5 py-2.5 text-body-sm whitespace-nowrap text-ink-dim">
                  <time dateTime={entry.at}>
                    {formatRelative(new Date(entry.at), i18n.language)}
                  </time>
                </td>
                <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">{entry.byName}</td>
                {['rows', 'created', 'updated', 'skipped'].map((key) => (
                  <td key={key} className="px-3.5 py-2.5 text-end">
                    <Num
                      className={cn(
                        'text-body-sm',
                        key === 'skipped' && entry[key] ? 'font-semibold text-on-amber' : 'text-ink-dim',
                      )}
                    >
                      {formatInteger(entry[key])}
                    </Num>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
