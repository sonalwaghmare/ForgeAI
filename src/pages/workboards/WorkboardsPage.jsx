import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Field } from '@/components/forge/Field'
import { Icon } from '@/components/forge/Icon'
import { MetricCard } from '@/components/forge/MetricCard'
import { Panel } from '@/components/forge/Panel'
import { EmptyState } from '@/components/forge/States'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { BOARDS, BOARD_STATUSES, BOARD_STATUS_TONE, updatedAt } from './boards'

/**
 * Workboards.
 *
 * DEMO. See `DEMO-MODE.md` §8.1. The collaborative investigation canvases, as a
 * module of their own rather than only as a tab inside one anomaly.
 *
 * ── Why this exists separately from the anomaly tab ───────────────────────
 * A board outlives the anomaly that started it, and some boards never had one — the
 * weekly reliability standup is a rolling canvas with no alert behind it. The
 * anomaly tab answers "show me the board for THIS"; this answers "show me the
 * boards", which is a different question and the reason the design gives it a rail
 * item.
 *
 * ── Hardcoded, and marked BETA in the rail ────────────────────────────────
 * No endpoint stores a board. The list is literals from the design, nothing
 * persists, and the canvas does not yet drag — so the rail carries a Beta tag
 * rather than presenting this as finished work.
 *
 * ── The view and the filters live in the URL ──────────────────────────────
 * `?view=` and `?status=`. Same correction as Lines · Assets and Reports: a filtered
 * list somebody wants to send to a colleague has to have an address.
 */
export function WorkboardsPage() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const view = params.get('view') === 'cards' ? 'cards' : 'list'
  const status = BOARD_STATUSES.includes(params.get('status')) ? params.get('status') : 'all'
  const search = params.get('q') ?? ''

  const [creating, setCreating] = useState(false)

  useDocumentTitle(`${t('workboards.title')} · ${t('common:brand.name')}`)

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return BOARDS.filter(
      (board) =>
        (status === 'all' || board.status === status) &&
        (!needle ||
          [board.id, board.asset, board.line, ...board.tags, t(`workboards.board.${board.id}.name`)]
            .join(' ')
            .toLowerCase()
            .includes(needle)),
    )
  }, [status, search, t])

  const count = (value) => BOARDS.filter((board) => board.status === value).length

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('workboards.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">
            <Num>{t('workboards.subtitle', { count: BOARDS.length })}</Num>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={t('workboards.viewLabel')} className="flex items-center gap-0.5">
            {['list', 'cards'].map((entry) => (
              <button
                key={entry}
                type="button"
                aria-current={entry === view ? 'page' : undefined}
                onClick={() => setParam('view', entry === 'list' ? null : entry)}
                className={cn(
                  'rounded-sm px-3 py-1.5 text-body-sm transition-colors',
                  entry === view
                    ? 'bg-card font-semibold text-ink shadow-edge'
                    : 'text-ink-dim hover:text-ink',
                )}
              >
                {t(`workboards.view.${entry}`)}
              </button>
            ))}
          </nav>
          <ForgeButton variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size="xs" />
            {t('workboards.new')}
          </ForgeButton>
        </div>
      </header>

      <div className="mb-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))]">
        <MetricCard label={t('workboards.stats.total')} value={BOARDS.length} />
        <MetricCard label={t('workboards.status.active')} value={count('active')} tone="green" />
        <MetricCard label={t('workboards.status.draft')} value={count('draft')} tone="amber" />
        <MetricCard label={t('workboards.status.complete')} value={count('complete')} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex min-w-[min(100%,16rem)] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge sm:max-w-[22rem]">
          <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
          <span className="sr-only">{t('workboards.searchLabel')}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder={t('workboards.searchPlaceholder')}
            className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
          />
        </label>

        <ForgeSelect
          label={t('workboards.statusFilter')}
          labelInline
          size="sm"
          value={status}
          onValueChange={(value) => setParam('status', value)}
          options={[
            { value: 'all', label: t('workboards.anyStatus') },
            ...BOARD_STATUSES.map((value) => ({ value, label: t(`workboards.status.${value}`) })),
          ]}
        />

        {status !== 'all' || search ? (
          <ForgeButton
            size="sm"
            onClick={() => {
              setParams(new URLSearchParams(view === 'cards' ? { view } : {}), { replace: true })
            }}
          >
            {t('workboards.clear')}
          </ForgeButton>
        ) : null}

        <span className="ms-auto text-micro text-ink-mute">
          <Num>{t('workboards.showing', { shown: rows.length, total: BOARDS.length })}</Num>
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="board"
          title={t('workboards.empty')}
          body={t('workboards.emptyBody')}
          action={
            <ForgeButton variant="primary" onClick={() => setCreating(true)}>
              {t('workboards.new')}
            </ForgeButton>
          }
        />
      ) : view === 'list' ? (
        <BoardTable rows={rows} />
      ) : (
        <BoardGrid rows={rows} />
      )}

      <NewBoardDialog
        key={creating}
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={() => {
          setCreating(false)
          toast(t('workboards.toast.created'))
          // Straight onto the canvas — a board is a place to work, and stopping
          // at a list row after asking for a new one is a wasted step.
          navigate(`/app/workboards/${BOARDS[0].id}`)
        }}
      />
    </Page>
  )
}

function BoardTable({ rows }) {
  const { t } = useTranslation(['app', 'common'])
  return (
    <Panel flush className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          <thead>
            <tr className="border-b border-hairline">
              <Th className="w-full">{t('workboards.column.board')}</Th>
              <Th>{t('workboards.column.linked')}</Th>
              <Th>{t('workboards.column.asset')}</Th>
              <Th>{t('workboards.column.elements')}</Th>
              <Th>{t('workboards.column.people')}</Th>
              <Th>{t('workboards.column.updated')}</Th>
              <Th>{t('workboards.column.status')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((board) => (
              <tr key={board.id} className="border-b border-hairline last:border-0 hover:bg-sunken">
                <td className="px-4 py-2.5">
                  {/* A real link, so the row can be opened in a new tab and its
                      address copied — which is most of what a board is for. */}
                  <Link
                    to={`/app/workboards/${board.id}`}
                    className="flex items-center gap-2.5 font-semibold text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-xs border border-hairline bg-sunken"
                    >
                      <Icon name="board" size="xs" className="text-on-forge" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">
                        {t(`workboards.board.${board.id}.name`)}
                      </span>
                      <Mono className="block text-micro font-normal text-ink-mute">{board.id}</Mono>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {board.linked ? (
                    <Mono className="text-micro font-semibold text-on-forge">{board.linked}</Mono>
                  ) : (
                    <span className="text-ink-mute">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="block">{board.asset}</span>
                  <span className="block text-micro text-ink-mute">{board.line}</span>
                </td>
                <td className="px-3 py-2.5">
                  <Num>{board.elements}</Num>
                </td>
                <td className="px-3 py-2.5">
                  <Collaborators people={board.collaborators} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                  <Num>{formatRelative(updatedAt(board))}</Num>
                </td>
                <td className="px-3 py-2.5">
                  <StateBadge tone={BOARD_STATUS_TONE[board.status]}>
                    {t(`workboards.status.${board.status}`)}
                  </StateBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function BoardGrid({ rows }) {
  const { t } = useTranslation(['app', 'common'])
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">
      {rows.map((board) => (
        <Panel key={board.id} flush interactive className="overflow-hidden">
          <Link to={`/app/workboards/${board.id}`} className="block">
            {/* A thumbnail of the surface: the dotted grid and three card
                silhouettes. Enough to say "canvas" at a glance without
                pretending to render the board's actual contents. */}
            <span
              aria-hidden="true"
              className="relative block h-24 border-b border-hairline bg-sunken"
              style={{
                backgroundImage:
                  'radial-gradient(circle, var(--border-hairline) 1px, transparent 1px)',
                backgroundSize: '14px 14px',
              }}
            >
              <span className="absolute start-[8%] top-3 block h-8 w-[22%] rounded-xs border border-hairline bg-card" />
              <span className="absolute start-[38%] top-5 block h-10 w-[26%] rounded-xs border border-hairline bg-card" />
              <span className="absolute start-[14%] bottom-3 block h-6 w-[18%] rounded-xs border border-amber/40 tint-amber" />
              <span className="absolute end-2.5 top-2.5">
                <StateBadge tone={BOARD_STATUS_TONE[board.status]}>
                  {t(`workboards.status.${board.status}`)}
                </StateBadge>
              </span>
            </span>

            <span className="block p-3.5">
              <span className="block text-body font-semibold">
                {t(`workboards.board.${board.id}.name`)}
              </span>
              <span className="mt-1 line-clamp-2 block text-micro font-normal text-ink-dim">
                {t(`workboards.board.${board.id}.desc`)}
              </span>
              <span className="mt-2.5 flex flex-wrap gap-1.5">
                {board.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-pill bg-sunken px-2 py-0.5 text-micro font-normal text-ink-dim"
                  >
                    {t(`workboards.tag.${tag}`, { defaultValue: tag })}
                  </span>
                ))}
              </span>
              <span className="mt-3 flex items-center gap-2 border-t border-hairline pt-2.5">
                <Collaborators people={board.collaborators} />
                <span className="text-micro text-ink-mute">
                  <Num>{t('workboards.elements', { count: board.elements })}</Num>
                </span>
                <span className="ms-auto text-micro text-ink-mute">
                  <Num>{formatRelative(updatedAt(board))}</Num>
                </span>
              </span>
            </span>
          </Link>
        </Panel>
      ))}
    </div>
  )
}

/** Overlapping initials. Three, then a count — a row of eight is a smear. */
function Collaborators({ people }) {
  const { t } = useTranslation(['app', 'common'])
  const shown = people.slice(0, 3)
  const rest = people.length - shown.length
  return (
    <span
      className="flex items-center"
      aria-label={t('workboards.collaborators', { count: people.length })}
    >
      {shown.map((initials, index) => (
        <span
          key={initials}
          aria-hidden="true"
          className={cn(
            'flex size-6 items-center justify-center rounded-full border border-card bg-sunken text-[8px] font-bold text-ink-dim',
            index > 0 && '-ms-1.5',
          )}
        >
          {initials}
        </span>
      ))}
      {rest > 0 ? (
        <span
          aria-hidden="true"
          className="-ms-1.5 flex size-6 items-center justify-center rounded-full border border-card bg-sunken text-[8px] font-bold text-ink-mute"
        >
          +{rest}
        </span>
      ) : null}
    </span>
  )
}

function NewBoardDialog({ open, onClose, onCreate }) {
  const { t } = useTranslation(['app', 'common'])
  const [name, setName] = useState('')
  const [asset, setAsset] = useState('BM-03')

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('workboards.dialog.title')}
      size="md"
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <ForgeButton variant="primary" disabled={!name.trim()} onClick={onCreate}>
            {t('workboards.dialog.create')}
          </ForgeButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t('workboards.dialog.name')}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('workboards.dialog.namePlaceholder')}
        />
        <ForgeSelect
          label={t('workboards.dialog.asset')}
          value={asset}
          onValueChange={setAsset}
          options={[
            { value: 'BM-03', label: 'Bodymaker BM-03' },
            { value: 'C-12', label: 'Compressor C-12' },
            { value: 'WS-01', label: 'Washer WS-01' },
            { value: 'multiple', label: t('workboards.dialog.multiple') },
          ]}
        />
        <p className="m-0 flex gap-2 rounded-sm border border-dashed border-violet/40 px-3 py-2.5 text-body-sm text-ink-dim">
          <Icon name="ai" size="sm" className="mt-0.5 shrink-0 text-violet" />
          {t('workboards.dialog.aiHint')}
        </p>
      </div>
    </ForgeDialog>
  )
}

function Th({ className, children }) {
  return (
    <th
      scope="col"
      className={`bg-sunken px-3 py-2.5 text-start text-micro font-semibold tracking-wide whitespace-nowrap text-ink-dim uppercase first:ps-4 ${className ?? ''}`}
    >
      {children}
    </th>
  )
}
