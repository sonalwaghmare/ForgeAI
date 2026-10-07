import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Field } from '@/components/forge/Field'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { SeverityBadge, StateBadge } from '@/components/forge/StatusBadge'
import { PAGE_SIZES, TablePagination } from '@/components/forge/TablePagination'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import {
  useAddEscalationLevel,
  useCreateRule,
  useNotifications,
  useRemoveRule,
  useSetPreference,
  useTestChannel,
  useToggleRule,
  useUpdateRule,
} from '@/features/notifications/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger, formatRelative } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { ChannelDialog } from './ChannelDialog'
import { RuleFormDialog } from './RuleFormDialog'

/**
 * Notifications & alert configuration.
 *
 * DEMO. See `DEMO-MODE.md` §8.8. The rules table, the channels they deliver
 * through and the escalation ladder — the design's three cards, in its order.
 *
 * ── Where the bell now goes ───────────────────────────────────────────────
 * The top bar's bell had no `onClick` at all. In the design it opens this
 * screen, which is a configuration page rather than an inbox — that is the
 * design's own wiring and it is defensible: the badge counts critical
 * anomalies, and this is the page that explains why they fired and who was
 * told. The anomaly list itself is one click away from every one of them.
 *
 * ── One screen, two entrances ─────────────────────────────────────────────
 * Settings → Notifications renders this page rather than a second copy of it.
 * The design has both a bell that opens notification configuration and a
 * Settings entry for it, and they are the same configuration — two screens over
 * one set of rules is how a rule ends up enabled on one and paused on the other.
 *
 * ── The preferences card is mine; everything above it is everybody's ──────
 * A rule decides who the platform tells. A digest decides what it sends me. Both
 * belong on this page and the card says which is which, because somebody
 * flipping a switch needs to know whether it affects them or the plant.
 *
 * ── The two figures worth a number ────────────────────────────────────────
 * Not four cards restating the table. `broken` is live rules routing somewhere
 * that is not connected — the one fault on this screen that loses data — and
 * `unrouted` is open anomalies no enabled rule covers. Both are joins across
 * the three lists, both move when a switch moves, and neither can be read off
 * any single row.
 */

export function NotificationsPage() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  useDocumentTitle(`${t('notifications.title')} · ${t('common:brand.name')}`)

  const [creating, setCreating] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [deletingRule, setDeletingRule] = useState(null)
  const [channelEdit, setChannelEdit] = useState(null)
  const [addingLevel, setAddingLevel] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const notifications = useNotifications()
  const toggle = useToggleRule()
  const create = useCreateRule()
  const update = useUpdateRule()
  const remove = useRemoveRule()

  const rules = notifications.data?.rules ?? []
  const channels = notifications.data?.channels ?? []
  const escalation = notifications.data?.escalation ?? []
  const preferences = notifications.data?.preferences ?? []
  const stats = notifications.data?.stats

  const ruleName = (rule) =>
    t('notifications.rule.name', {
      sensor: rule.thresholds[0]?.name ?? rule.kind,
      edge: t(`notifications.rule.edge.${rule.edge}`),
    })

  const pageCount = Math.max(1, Math.ceil(rules.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = rules.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <Page>
      <header className="mb-4">
        <h1 className="m-0 text-display text-balance">{t('notifications.title')}</h1>
        <p className="mt-2 mb-0 text-body text-ink-dim">{t('notifications.subtitle')}</p>
      </header>

      {notifications.isError ? (
        <ErrorState
          error={notifications.error}
          title={t('notifications.loadFailed')}
          onRetry={() => notifications.refetch()}
        />
      ) : notifications.isPending ? (
        <SkeletonRows count={5} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* The two joins, and only where they are not zero. A green "0
              undeliverable" is a badge celebrating the absence of a fault. Kept
              above the table rather than dropped to match the design: they are
              the only two figures on this screen that no single row can carry. */}
          {stats && (stats.broken > 0 || stats.unrouted > 0) ? (
            <div className="flex flex-col gap-2">
              {stats.broken > 0 ? (
                <Panel stripe="red" className="flex flex-wrap items-center gap-3">
                  <Icon name="bolt" size="sm" style={{ color: 'var(--on-red)' }} />
                  <p className="m-0 flex-1 text-body-sm">
                    <Num className="font-semibold">
                      {t('notifications.stats.broken')} · {formatInteger(stats.broken)}
                    </Num>
                    <span className="text-ink-dim"> — {t('notifications.brokenHint')}</span>
                  </p>
                </Panel>
              ) : null}
              {stats.unrouted > 0 ? (
                <Panel stripe="amber" className="flex flex-wrap items-center gap-3">
                  <Icon name="shield" size="sm" style={{ color: 'var(--on-amber)' }} />
                  <p className="m-0 flex-1 text-body-sm">
                    <Num className="font-semibold">
                      {t('notifications.stats.unrouted')} · {formatInteger(stats.unrouted)}
                    </Num>
                    <span className="text-ink-dim"> — {t('notifications.unroutedHint')}</span>
                  </p>
                </Panel>
              ) : null}
            </div>
          ) : null}

          {/* ── Alert rules ─────────────────────────────────────────────── */}
          <Panel flush className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3">
              <h2 className="m-0 flex-1 text-title">{t('notifications.rules.title')}</h2>
              <ForgeButton variant="primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size="xs" />
                {t('notifications.newRule')}
              </ForgeButton>
            </div>

            {rules.length === 0 ? (
              <EmptyState
                icon="bell"
                title={t('notifications.rules.empty')}
                body={t('notifications.rules.emptyBody')}
                className="border-0 bg-transparent shadow-none"
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-body-sm">
                    <caption className="sr-only">{t('notifications.rules.caption')}</caption>
                    <thead>
                      <tr>
                        {['rule', 'condition', 'scope', 'severity', 'routes', 'status'].map(
                          (column) => (
                            <th
                              key={column}
                              scope="col"
                              className="eyebrow bg-sunken px-4 py-2.5 text-start whitespace-nowrap"
                            >
                              {t(`notifications.column.${column}`)}
                            </th>
                          ),
                        )}
                        <th scope="col" className="eyebrow bg-sunken px-4 py-2.5 text-start">
                          {t('notifications.column.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((rule) => (
                        <tr
                          key={rule.id}
                          className={cn(
                            'border-t border-subtle',
                            rule.broken && 'stripe-red',
                            !rule.enabled && 'text-ink-dim',
                          )}
                        >
                          <td className="px-4 py-2.5">
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className={rule.enabled ? 'font-semibold text-ink' : undefined}>
                                  {ruleName(rule)}
                                </span>
                                {rule.broken ? (
                                  <StateBadge
                                    tone="red"
                                    dot={false}
                                    className="cursor-help"
                                    title={t('notifications.rule.brokenTitle', {
                                      channels: rule.misrouted
                                        .map((id) => t(`notifications.channel.${id}`))
                                        .join(', '),
                                      count: rule.misrouted.length,
                                    })}
                                  >
                                    {t('notifications.rule.broken')}
                                  </StateBadge>
                                ) : null}
                              </span>
                              {/* Folded under the name rather than given a
                                  column of its own: the design has no Fired
                                  column and the figure is still worth keeping,
                                  because a rule that has never fired in a plant
                                  this busy is a rule worth looking at. */}
                              <span className="flex flex-wrap items-center gap-2">
                                <Mono className="text-micro text-ink-mute">{rule.id}</Mono>
                                <Num className="text-micro font-normal text-ink-mute">
                                  {rule.fired
                                    ? t('notifications.rule.firedCount', {
                                        count: rule.fired,
                                        when: rule.lastFiredAt
                                          ? formatRelative(rule.lastFiredAt)
                                          : '',
                                      })
                                    : t('notifications.rule.firedNever')}
                                </Num>
                              </span>
                            </span>
                          </td>

                          {/* Both unit systems, never converted. */}
                          <td
                            className="px-4 py-2.5 whitespace-nowrap"
                            title={
                              rule.thresholds.length > 1 ? t('notifications.bothUnits') : undefined
                            }
                          >
                            <Mono className="text-micro">
                              <Num>
                                {rule.edge === 'below' ? '<' : '>'}{' '}
                                {rule.thresholds
                                  .map((entry) => `${entry.value} ${entry.unit}`)
                                  .join(' · ')}
                              </Num>
                            </Mono>
                          </td>

                          <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
                            <Num className="text-body-sm">
                              {t('notifications.rule.scope', {
                                assets: rule.assets,
                                channels: rule.watching,
                              })}
                            </Num>
                          </td>

                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <SeverityBadge severity={rule.severity} />
                          </td>

                          <td className="px-4 py-2.5">
                            <span className="flex flex-wrap gap-1">
                              {rule.routes.map((id) => (
                                <StateBadge
                                  key={id}
                                  tone={rule.misrouted.includes(id) ? 'red' : null}
                                  dot={false}
                                >
                                  {t(`notifications.channel.${id}`)}
                                </StateBadge>
                              ))}
                            </span>
                          </td>

                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-pill px-2.5 py-[3px] text-micro',
                                rule.enabled
                                  ? cn(TINT_CLASS.green, ON_TINT_CLASS.green)
                                  : 'bg-sunken text-ink-dim',
                              )}
                            >
                              {t(
                                rule.enabled
                                  ? 'notifications.rule.active'
                                  : 'notifications.rule.paused',
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="inline-flex gap-1.5">
                              <ForgeButton
                                size="sm"
                                disabled={toggle.isPending}
                                onClick={() =>
                                  toggle.mutate(
                                    { id: rule.id, enabled: !rule.enabled },
                                    {
                                      onSuccess: () =>
                                        toast(
                                          t(
                                            rule.enabled
                                              ? 'notifications.toast.disabled'
                                              : 'notifications.toast.enabled',
                                            { rule: ruleName(rule) },
                                          ),
                                        ),
                                      onError: () =>
                                        toast(t('notifications.toast.failed'), 'critical'),
                                    },
                                  )
                                }
                              >
                                {t(
                                  rule.enabled
                                    ? 'notifications.rule.pause'
                                    : 'notifications.rule.resume',
                                )}
                              </ForgeButton>
                              <ForgeButton size="sm" onClick={() => setEditingRule(rule)}>
                                {t('common:actions.edit')}
                              </ForgeButton>
                              <ForgeButton size="sm" onClick={() => setDeletingRule(rule)}>
                                {t('common:actions.delete')}
                              </ForgeButton>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <TablePagination
                  total={rules.length}
                  page={currentPage}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size)
                    setPage(1)
                  }}
                  label={t('notifications.rules.rowNoun')}
                />
              </>
            )}
          </Panel>

          {/* ── Channels ────────────────────────────────────────────────── */}
          <section>
            <Eyebrow as="h2" className="mb-2.5">
              {t('notifications.channels.title')}
            </Eyebrow>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onEdit={() => setChannelEdit(channel)}
                />
              ))}
            </div>
          </section>

          {/* ── Escalation ──────────────────────────────────────────────── */}
          <Panel className="p-4">
            <Eyebrow as="h2" className="mb-3">
              {t('notifications.escalation.title')}
            </Eyebrow>
            <ol className="m-0 flex list-none items-stretch gap-0 overflow-x-auto p-0 pb-1">
              {escalation.map((level, index) => (
                <li key={level.id} className="flex shrink-0 items-center">
                  <div className="min-w-[11rem] rounded-sm border border-hairline bg-sunken p-3.5">
                    <p
                      className={cn(
                        'm-0 text-body-sm font-semibold',
                        level.misrouted.length ? 'text-on-red' : 'text-on-forge',
                      )}
                    >
                      <Num>{t('notifications.escalation.level', { step: level.step })}</Num>
                    </p>
                    <p className="m-0 text-micro font-normal text-ink-dim">
                      <Num>
                        {level.afterMinutes === 0
                          ? t('notifications.escalation.immediate')
                          : t('notifications.escalation.after', { minutes: level.afterMinutes })}
                      </Num>
                    </p>
                    <p className="mt-1.5 mb-0 text-body-sm text-ink">{level.personName}</p>
                    <p className="m-0 text-micro font-normal text-ink-mute">
                      {t('notifications.escalation.via', {
                        channels: level.routes
                          .map((id) => t(`notifications.channel.${id}`))
                          .join(', '),
                      })}
                    </p>
                  </div>
                  {index < escalation.length - 1 ? (
                    <Icon
                      name="right"
                      size="sm"
                      aria-hidden="true"
                      className="mirror-rtl mx-2 shrink-0 text-ink-mute"
                    />
                  ) : null}
                </li>
              ))}
              <li className="flex shrink-0 items-center ps-3">
                <ForgeButton onClick={() => setAddingLevel(true)}>
                  <Icon name="plus" size="xs" />
                  {t('notifications.escalation.add')}
                </ForgeButton>
              </li>
            </ol>
            <p className="m-0 mt-3 text-micro font-normal text-ink-mute">
              {t('notifications.escalation.note')}
            </p>
          </Panel>

          <Preferences items={preferences} />
        </div>
      )}

      <RuleFormDialog
        key={`create-${rules.length}`}
        open={creating}
        kinds={notifications.data?.kinds ?? []}
        pending={create.isPending}
        onClose={() => setCreating(false)}
        onSubmit={(payload) =>
          create.mutate(payload, {
            onSuccess: () => {
              setCreating(false)
              toast(t('notifications.toast.created'))
            },
            onError: () => toast(t('notifications.toast.failed'), 'critical'),
          })
        }
      />

      {editingRule ? (
        <RuleFormDialog
          key={`edit-${editingRule.id}`}
          open
          rule={editingRule}
          kinds={notifications.data?.kinds ?? []}
          pending={update.isPending}
          onClose={() => setEditingRule(null)}
          onSubmit={(payload) =>
            update.mutate(
              { id: editingRule.id, ...payload },
              {
                onSuccess: () => {
                  setEditingRule(null)
                  toast(t('notifications.toast.updated'))
                },
                onError: () => toast(t('notifications.toast.failed'), 'critical'),
              },
            )
          }
        />
      ) : null}

      {deletingRule ? (
        <ForgeDialog
          open
          onOpenChange={(next) => !next && setDeletingRule(null)}
          size="sm"
          title={t('notifications.delete.title')}
          footer={
            <>
              <ForgeButton onClick={() => setDeletingRule(null)}>
                {t('common:actions.cancel')}
              </ForgeButton>
              <span className="flex-1" />
              <ForgeButton
                variant="primary"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(deletingRule.id, {
                    onSuccess: () => {
                      setDeletingRule(null)
                      toast(t('notifications.toast.deleted'))
                    },
                    onError: () => toast(t('notifications.toast.failed'), 'critical'),
                  })
                }
              >
                {t('common:actions.delete')}
              </ForgeButton>
            </>
          }
        >
          <p className="m-0 text-body-sm text-ink-dim">
            {t('notifications.delete.body', { rule: ruleName(deletingRule) })}
          </p>
        </ForgeDialog>
      ) : null}

      {channelEdit ? (
        <ChannelDialog channel={channelEdit} onClose={() => setChannelEdit(null)} />
      ) : null}

      {addingLevel ? (
        <EscalationDialog
          after={escalation[escalation.length - 1]?.afterMinutes ?? 0}
          onClose={() => setAddingLevel(false)}
        />
      ) : null}
    </Page>
  )
}

/* ══ CHANNELS ════════════════════════════════════════════════════════════ */

/**
 * One delivery channel.
 *
 * A configured channel offers Test and Edit; an unconfigured one offers only
 * Configure, because there is nothing to test. The design draws Test beside a
 * card reading "Not configured", which is a button that can only fail.
 */
function ChannelCard({ channel, onEdit }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const test = useTestChannel()
  const connected = channel.state === 'connected'

  return (
    <Panel className="flex flex-col gap-2.5 p-3.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-full', connected ? 'bg-green' : 'bg-hairline')}
        />
        <p className="m-0 flex-1 text-body-sm font-semibold text-ink">
          {t(`notifications.channel.${channel.id}`)}
        </p>
        <Num className="text-micro font-normal text-ink-mute">
          {channel.rules
            ? t('notifications.channels.carrying', {
                live: channel.liveRules,
                total: channel.rules,
              })
            : t('notifications.channels.carryingNone')}
        </Num>
      </div>

      {/* The target is data — an address, a channel name — so it is not
          translated. What replaces it when there is none IS furniture. */}
      <p className="m-0 truncate text-micro font-normal text-ink-dim">
        {channel.target ?? t('notifications.channels.notConfiguredBody')}
      </p>

      <div className="flex gap-2">
        {connected ? (
          <>
            <ForgeButton
              size="sm"
              className="flex-1"
              disabled={test.isPending}
              onClick={() =>
                test.mutate(channel.id, {
                  onSuccess: (result) =>
                    toast(
                      result.ok
                        ? t('notifications.channels.testOk', { target: result.target })
                        : t('notifications.channels.testFailed'),
                      result.ok ? 'ok' : 'critical',
                    ),
                })
              }
            >
              {t('notifications.channels.test')}
            </ForgeButton>
            <ForgeButton size="sm" className="flex-1" onClick={onEdit}>
              {t('common:actions.edit')}
            </ForgeButton>
          </>
        ) : (
          <ForgeButton variant="primary" size="sm" className="flex-1" onClick={onEdit}>
            {t('notifications.channels.configure')}
          </ForgeButton>
        )}
      </div>
    </Panel>
  )
}

/* ══ ESCALATION ══════════════════════════════════════════════════════════ */

/**
 * Add a rung.
 *
 * It goes on the end and must be later than the one before it: a ladder is
 * ordered by time, and a level that fires before the level above it is not an
 * escalation. The minimum is enforced rather than explained afterwards.
 */
function EscalationDialog({ after, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const add = useAddEscalationLevel()

  const [personId, setPersonId] = useState('')
  const [minutes, setMinutes] = useState(String(after + 30))
  const [routes, setRoutes] = useState(['teams'])

  const notifications = useNotifications()
  const people = notifications.data?.escalation ?? []
  const channels = notifications.data?.channels ?? []

  const value = Number(minutes)
  const ready = Boolean(personId) && Number.isFinite(value) && value > after && routes.length > 0

  const toggleRoute = (id) =>
    setRoutes((held) => (held.includes(id) ? held.filter((x) => x !== id) : [...held, id]))

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="sm"
      title={t('notifications.escalation.addTitle')}
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <span className="flex-1" />
          <ForgeButton
            variant="primary"
            disabled={!ready || add.isPending}
            onClick={() =>
              add.mutate(
                { personId, afterMinutes: value, routes },
                {
                  onSuccess: () => {
                    toast(t('notifications.escalation.added'), 'ok')
                    onClose()
                  },
                },
              )
            }
          >
            {t('common:actions.create')}
          </ForgeButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ForgeSelect
          id="escalation-person"
          label={t('notifications.escalation.who')}
          required
          value={personId}
          onValueChange={setPersonId}
          options={people.map((level) => ({ value: level.personId, label: level.personName }))}
        />
        <Field
          id="escalation-minutes"
          label={t('notifications.escalation.minutes')}
          hint={<Num>{t('notifications.escalation.minutesHint', { after })}</Num>}
          type="number"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-control text-ink">
            {t('notifications.escalation.channels')}
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                aria-pressed={routes.includes(channel.id)}
                onClick={() => toggleRoute(channel.id)}
                className={cn(
                  'rounded-pill border px-2.5 py-1 text-micro transition-colors',
                  routes.includes(channel.id)
                    ? cn(TINT_CLASS.forge, ON_TINT_CLASS.forge, 'border-transparent')
                    : 'border-hairline text-ink-dim hover:bg-sunken',
                )}
              >
                {t(`notifications.channel.${channel.id}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </ForgeDialog>
  )
}

/* ══ PREFERENCES ═════════════════════════════════════════════════════════ */

/**
 * What this reader wants sent to them.
 *
 * Browser push is shown and cannot be enabled: nothing here has asked the
 * browser for notification permission, and a switch reporting "on" while the
 * browser had never been asked would be the only false claim on the screen. It
 * says why rather than being left out, because its absence would read as an
 * omission rather than a decision.
 */
function Preferences({ items }) {
  const { t } = useTranslation(['app', 'common'])
  const setPreference = useSetPreference()

  if (!items.length) return null

  return (
    <Panel className="p-4">
      <h2 className="m-0 text-title">{t('notifications.preferences.title')}</h2>
      <p className="mt-1 mb-3 max-w-[52ch] text-body-sm text-ink-dim">
        {t('notifications.preferences.body')}
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((preference) => (
          <li
            key={preference.id}
            className="flex items-center gap-3 border-b border-subtle py-3 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="m-0 text-body-sm font-semibold text-ink">
                {t(`notifications.preferences.items.${preference.id}`)}
              </p>
              <p className="m-0 text-micro font-normal text-ink-dim">
                {preference.unavailable
                  ? t('notifications.preferences.unavailable')
                  : preference.at
                    ? t('notifications.preferences.at', { time: preference.at })
                    : t(`notifications.preferences.hints.${preference.id}`)}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preference.on}
              aria-label={t(`notifications.preferences.items.${preference.id}`)}
              disabled={preference.unavailable || setPreference.isPending}
              onClick={() => setPreference.mutate({ id: preference.id, on: !preference.on })}
              className={cn(
                'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors',
                preference.on ? 'bg-forge' : 'bg-hairline',
                preference.unavailable && 'cursor-not-allowed opacity-50',
              )}
            >
              {/* `bg-white`, not `bg-card`. The knob is not a surface sitting on the
                  page — it is a physical part of a control, read against a Forge
                  Orange track. `bg-card` is opaque white in light and 6% white in
                  dark, so in dark the knob all but disappeared into the track. Same
                  call `ForgeButton` makes with `text-white` on a primary fill. */}
              <span
                aria-hidden="true"
                className="absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200"
                style={{ insetInlineStart: preference.on ? '19px' : '3px' }}
              />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
