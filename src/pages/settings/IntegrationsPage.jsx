import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { StateBadge } from '@/components/forge/StatusBadge'
import { PAGE_SIZES, TablePagination } from '@/components/forge/TablePagination'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { useIntegrations, usePauseSource, useRemoveSource } from '@/features/integrations/queries'
import { useTestChannel } from '@/features/notifications/queries'
import { FUSION_SOURCE_SECTIONS, useTestSource } from '@/features/dataFusion/sources'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger, formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ChannelDialog } from '@/pages/notifications/ChannelDialog'
import { AddSourceWizard } from '@/pages/dataFusion/AddSourceWizard'
import { ConnectionDrawer } from '@/pages/dataFusion/ConnectionDrawer'

/**
 * Settings — Integrations.
 *
 * DEMO. See `DEMO-MODE.md` §8.20. The design's four connector groups, its
 * filter chips and its Data Pipeline Monitor.
 *
 * ── Configure opens Data Fusion's drawer, not a second one ────────────────
 * That is the load-bearing decision on this page. Every card here is a row that
 * already exists somewhere — a source in the Data Fusion registry or a delivery
 * channel from Notifications — and both already have an editor with the whole
 * contract behind it: the ingest profile, the config schema, the credential
 * fields that hold no value. Building a Configure form here would have meant a
 * second, thinner editor over the same record, and the thin one would have been
 * the one that quietly disagreed.
 *
 * So Configure on a connector opens `ConnectionDrawer`, Configure on a channel
 * opens `ChannelDialog`, and Add New Integration opens the connect wizard. This
 * page contributes the grouping, the filter and the monitor — the things the
 * design has that Data Fusion does not.
 *
 * ── The monitor's two actions are real, and one of them refuses ───────────
 * Pause stops ingest, and it stops it everywhere: the source reads Paused in its
 * family table and every pipeline reading it goes to Stalled, because a pipeline
 * cannot run off a connection that has stopped. Delete removes the source and
 * the pipelines that read it, and says how many before it does.
 *
 * Delete refuses on the three anchors. Their rows are rebuilt on every read from
 * the connector registry the public page prints, so deleting one would remove
 * nothing and it would be back on the next render. The row says that where the
 * button is, rather than offering a control that does nothing.
 */

/** Filter sentinel, and the design's first chip. */
const ALL = 'all'

/**
 * Status → hue, for both kinds of card.
 *
 * The same ladder `SourcesPage` uses, plus the rung this pass added. `paused`
 * earns no hue: a source somebody switched off is not a fault, and colouring it
 * would file it in the queue of things to chase. `notConfigured` earns none for
 * the reason it never has — a catalogue entry nobody filled in is not a state of
 * health.
 */
const STATUS_TONE = {
  connected: 'green',
  syncing: 'watch',
  degraded: 'amber',
  disconnected: 'red',
  paused: null,
  notConfigured: null,
}

export function IntegrationsPage() {
  const { t } = useTranslation(['app', 'common'])

  useDocumentTitle(`${t('settings.integrations.title')} · ${t('common:brand.name')}`)

  const [filter, setFilter] = useState(ALL)
  const [configuring, setConfiguring] = useState(null)
  const [channelEdit, setChannelEdit] = useState(null)
  /* Two steps because the wizard needs a family before it has a catalogue to
     offer: picking Rockwell FactoryTalk is picking ODBC, and the connectors
     differ per family. `choosing` is that step; `adding` is the family it
     produced. Data Fusion's own entrance skips it — there the family is the
     table you are standing on. */
  const [choosing, setChoosing] = useState(false)
  const [adding, setAdding] = useState(null)

  const integrations = useIntegrations()
  const groups = integrations.data?.groups ?? []
  const monitor = integrations.data?.monitor ?? []

  const visible = filter === ALL ? groups : groups.filter((group) => group.id === filter)

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 text-headline">{t('settings.integrations.title')}</h1>
          <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
            {t('settings.integrations.intro')}
          </p>
        </div>
        {/* The design's "+ Add New Integration". It opens the connect wizard —
            the same one Data Fusion opens — so what it makes is a registry row
            that appears in both places. */}
        <ForgeButton variant="primary" onClick={() => setChoosing(true)}>
          <Icon name="plus" size="xs" />
          {t('settings.integrations.add')}
        </ForgeButton>
      </header>

      {integrations.isError ? (
        <ErrorState
          error={integrations.error}
          title={t('settings.integrations.loadFailed')}
          onRetry={() => integrations.refetch()}
        />
      ) : integrations.isPending ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          {/* The chips. Counted rather than labelled alone: "CMMS" and
              "CMMS · 2" are different amounts of help before you click. */}
          <div
            role="group"
            aria-label={t('settings.integrations.filterLabel')}
            className="mb-5 flex flex-wrap gap-1.5"
          >
            <Chip active={filter === ALL} onClick={() => setFilter(ALL)}>
              {t('settings.integrations.groups.all')}
            </Chip>
            {groups.map((group) => (
              <Chip
                key={group.id}
                active={filter === group.id}
                onClick={() => setFilter(group.id)}
              >
                {t(`settings.integrations.groups.${group.id}`)}
                <Num className="text-ink-mute">{formatInteger(group.items.length)}</Num>
              </Chip>
            ))}
          </div>

          <div className="flex flex-col gap-6">
            {visible.map((group) => (
              <section key={group.id}>
                <Eyebrow as="h2" className="mb-2.5">
                  {t(`settings.integrations.groups.${group.id}`)}
                </Eyebrow>
                <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
                  {group.items.map((card) => (
                    <IntegrationCard
                      key={`${card.kind}-${card.id}`}
                      card={card}
                      onConfigure={() =>
                        card.kind === 'source' ? setConfiguring(card.id) : setChannelEdit(card)
                      }
                    />
                  ))}
                </div>
              </section>
            ))}

            <PipelineMonitor rows={monitor} />
          </div>
        </>
      )}

      <ConnectionDrawer id={configuring} onClose={() => setConfiguring(null)} />

      {channelEdit ? (
        <ChannelDialog channel={channelEdit} onClose={() => setChannelEdit(null)} />
      ) : null}

      {choosing ? (
        <FamilyDialog
          onClose={() => setChoosing(false)}
          onPick={(family) => {
            setChoosing(false)
            setAdding(family)
          }}
        />
      ) : null}

      <AddSourceWizard
        open={Boolean(adding)}
        section={adding?.section}
        category={adding?.category}
        onClose={() => setAdding(null)}
      />
    </div>
  )
}

/**
 * Which family, before the wizard.
 *
 * The four the registry has, named by the section they live in, so the choice
 * made here is the same choice Data Fusion's rail offers — and what it creates
 * lands in that section's table. `FUSION_SOURCE_SECTIONS` is the list, imported
 * from the feature layer rather than restated, so a fifth family appears here
 * without anybody remembering to add it.
 */
function FamilyDialog({ onClose, onPick }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="sm"
      title={t('settings.integrations.family.title')}
      footer={<ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>}
    >
      <p className="mt-0 mb-3 text-body-sm text-ink-dim">
        {t('settings.integrations.family.intro')}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {FUSION_SOURCE_SECTIONS.map((section) => (
          <li key={section}>
            <button
              type="button"
              onClick={() => onPick({ section, category: CATEGORY_OF[section] })}
              className="flex w-full items-center gap-3 rounded-sm border border-hairline bg-card p-3 text-start transition-colors hover:border-forge"
            >
              <Icon name="plug" size="sm" className="shrink-0 text-ink-dim" />
              <span className="min-w-0">
                <span className="block text-body-sm font-semibold text-ink">
                  {t(`dataFusion.sections.${section}`)}
                </span>
                <span className="block text-micro font-normal text-ink-mute">
                  {t(`dataFusion.sectionIntros.${section}`)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </ForgeDialog>
  )
}

/** Section id → the category the transport knows it by. Data Fusion's own map. */
const CATEGORY_OF = { ot: 'ot', vision: 'vision', business: 'biz', stores: 'db' }

/** A filter chip. Pressed state is `aria-pressed`, not colour alone. */
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        /* The design's own corner, and not a pill: these are the same control
           step as every other button on the page, and rounding them all the way
           made them read as tags — something a row is labelled with — rather
           than as a filter you press. */
        'inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-body-sm transition-colors',
        active
          ? 'border-forge tint-forge font-semibold text-on-forge'
          : 'border-hairline text-ink-dim hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/* ══ CARDS ═══════════════════════════════════════════════════════════════ */

/**
 * One connector.
 *
 * Sources and channels are drawn by one component because the design draws them
 * as one card, and because the two things a reader does with either are the
 * same: see whether it is working, and go and fix it. What differs is the line
 * of context — a source reports when it last delivered, a channel reports where
 * it delivers — and that difference is the honest one.
 */
function IntegrationCard({ card, onConfigure }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  const testSource = useTestSource(card.kind === 'source' ? card.id : null)
  const testChannel = useTestChannel()
  const testing = testSource.isPending || testChannel.isPending

  const name = card.kind === 'source' ? card.name : t(`notifications.channel.${card.id}`)

  function runTest() {
    const onSuccess = (result) =>
      toast(
        result?.ok
          ? t('settings.integrations.testOk', { name })
          : t('settings.integrations.testFailed', {
              name,
              reason: t(`settings.integrations.testReason.${result?.reason ?? 'unknown'}`, {
                defaultValue: t('settings.integrations.testReason.unknown'),
              }),
            }),
        result?.ok ? 'ok' : 'critical',
      )

    if (card.kind === 'source') testSource.mutate(undefined, { onSuccess })
    else testChannel.mutate(card.id, { onSuccess })
  }

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-sm border border-hairline bg-sunken"
        >
          <Icon name="plug" size="sm" className="text-ink-dim" />
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-body-sm font-semibold text-ink">{name}</p>
          <p className="m-0 text-micro font-normal text-ink-mute">
            {t(`settings.integrations.groups.${card.group}`)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <StateBadge tone={STATUS_TONE[card.status] ?? null}>
          {t(`dataFusion.sources.status.${card.status}`)}
        </StateBadge>
        {/* The design's right-hand slot. One question of every card — a source
            says when it last delivered, a channel says where it delivers — and
            an em dash where there is no answer rather than a plausible one. */}
        <span className="min-w-0 truncate text-micro font-normal text-ink-mute">
          {card.kind === 'source' ? (
            card.lastSyncAt ? (
              <Num>{formatRelative(card.lastSyncAt)}</Num>
            ) : (
              '—'
            )
          ) : (
            (card.target ?? '—')
          )}
        </span>
      </div>

      {card.kind === 'source' && card.status === 'connected' && card.tags ? (
        <p className="m-0 text-micro font-normal text-ink-dim">
          <Num>
            {t(`settings.integrations.carrying.${card.unit}`, {
              count: card.tags,
              formatted: formatInteger(card.tags),
            })}
          </Num>
        </p>
      ) : card.kind === 'channel' && card.rules ? (
        <p className="m-0 text-micro font-normal text-ink-dim">
          <Num>
            {t('settings.integrations.carryingRules', {
              live: card.liveRules,
              total: card.rules,
            })}
          </Num>
        </p>
      ) : null}

      <div className="mt-auto flex items-center gap-3">
        <ForgeButton size="sm" className="flex-1" onClick={onConfigure}>
          {t('settings.integrations.configure')}
        </ForgeButton>
        {/* Only where there is something to test. */}
        {card.testable ? (
          <ForgeButton variant="ghost" size="sm" disabled={testing} onClick={runTest}>
            {t('settings.integrations.test')}
          </ForgeButton>
        ) : null}
      </div>
    </Panel>
  )
}

/* ══ THE MONITOR ═════════════════════════════════════════════════════════ */

/**
 * The streaming sources, with what is arriving through them.
 *
 * Every column is arithmetic on the registry. `records/min` is the tag count at
 * the one publishing interval this product assumes anywhere — a sample per tag
 * every twenty seconds — rather than a second number typed beside the first, and
 * it is zero on a source that is not delivering. A throughput column that stays
 * populated while the status column reads Disconnected is the column that
 * teaches people to ignore both.
 */
function PipelineMonitor({ rows }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [deleting, setDeleting] = useState(null)

  const pause = usePauseSource()
  const remove = useRemoveSource()

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <Panel className="p-4">
      <Eyebrow as="h2" className="mb-3">
        {t('settings.integrations.monitor.title')}
      </Eyebrow>

      {rows.length === 0 ? (
        <EmptyState
          title={t('settings.integrations.monitor.empty')}
          body={t('settings.integrations.monitor.emptyBody')}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-body-sm">
              <caption className="sr-only">{t('settings.integrations.monitor.caption')}</caption>
              <thead>
                <tr className="border-b border-hairline text-start">
                  <th scope="col" className="py-2 pe-3 text-start font-semibold text-ink-dim">
                    {t('settings.integrations.monitor.columns.source')}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-end font-semibold text-ink-dim">
                    {t('settings.integrations.monitor.columns.tags')}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-end font-semibold text-ink-dim">
                    {t('settings.integrations.monitor.columns.lag')}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-semibold text-ink-dim">
                    {t('settings.integrations.monitor.columns.lastSync')}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-end font-semibold text-ink-dim">
                    {t('settings.integrations.monitor.columns.records')}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-semibold text-ink-dim">
                    {t('settings.integrations.monitor.columns.status')}
                  </th>
                  <th scope="col" className="py-2 text-end font-semibold text-ink-dim">
                    {t('settings.integrations.monitor.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-b border-hairline last:border-b-0">
                    <th scope="row" className="py-2.5 pe-3 text-start font-semibold text-ink">
                      {row.name}
                    </th>
                    <td className="py-2.5 pe-3 text-end tabular-nums text-ink">
                      <Num>{formatInteger(row.tags ?? 0)}</Num>
                    </td>
                    <td className="py-2.5 pe-3 text-end tabular-nums text-ink-dim">
                      {row.lagSeconds == null ? (
                        '—'
                      ) : (
                        <Num>{t('settings.integrations.monitor.seconds', { value: row.lagSeconds })}</Num>
                      )}
                    </td>
                    <td className="py-2.5 pe-3 text-ink-dim">
                      {row.lastSyncAt ? <Num>{formatRelative(row.lastSyncAt)}</Num> : '—'}
                    </td>
                    <td className="py-2.5 pe-3 text-end tabular-nums text-ink">
                      <Num>{formatInteger(row.recordsPerMinute ?? 0)}</Num>
                    </td>
                    <td className="py-2.5 pe-3">
                      <StateBadge tone={STATUS_TONE[row.status] ?? null}>
                        {t(`dataFusion.sources.status.${row.status}`)}
                      </StateBadge>
                    </td>
                    <td className="py-2.5 text-end whitespace-nowrap">
                      <ForgeButton
                        variant="ghost"
                        size="sm"
                        disabled={pause.isPending}
                        onClick={() =>
                          pause.mutate(
                            { id: row.id, paused: !row.paused },
                            {
                              onSuccess: (result) =>
                                toast(
                                  result?.ok === false
                                    ? t('settings.integrations.monitor.pauseRefused', {
                                        name: row.name,
                                      })
                                    : t(
                                        row.paused
                                          ? 'settings.integrations.monitor.resumed'
                                          : 'settings.integrations.monitor.paused',
                                        { name: row.name },
                                      ),
                                  result?.ok === false ? 'critical' : 'ok',
                                ),
                            },
                          )
                        }
                      >
                        {t(
                          row.paused
                            ? 'settings.integrations.monitor.resume'
                            : 'settings.integrations.monitor.pause',
                        )}
                      </ForgeButton>
                      <ForgeButton
                        variant="ghost"
                        size="sm"
                        className="text-on-red hover:text-on-red"
                        disabled={!row.removable}
                        title={
                          row.removable
                            ? undefined
                            : t('settings.integrations.monitor.anchoredReason')
                        }
                        onClick={() => setDeleting(row)}
                      >
                        {t('common:actions.delete')}
                      </ForgeButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={rows.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            label={t('settings.integrations.monitor.rowNoun')}
          />

          {/* An em dash in Lag means nothing measured it, not zero latency. The
              three anchors cannot be deleted and the note says why once, rather
              than on three disabled buttons. */}
          <p className="mt-3 mb-0 text-micro font-normal text-ink-mute">
            {t('settings.integrations.monitor.note')}
          </p>
        </>
      )}

      {deleting ? (
        <ForgeDialog
          open
          onOpenChange={(next) => !next && setDeleting(null)}
          size="sm"
          title={t('settings.integrations.monitor.deleteTitle', { name: deleting.name })}
          footer={
            <>
              <ForgeButton onClick={() => setDeleting(null)}>
                {t('common:actions.cancel')}
              </ForgeButton>
              <span className="flex-1" />
              <ForgeButton
                variant="danger"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(deleting.id, {
                    onSuccess: (result) => {
                      toast(
                        result?.ok
                          ? t('settings.integrations.monitor.deleted', { name: deleting.name })
                          : t('settings.integrations.monitor.deleteRefused', {
                              name: deleting.name,
                            }),
                        result?.ok ? 'ok' : 'critical',
                      )
                      setDeleting(null)
                    },
                  })
                }
              >
                {t('common:actions.delete')}
              </ForgeButton>
            </>
          }
        >
          {/* What goes with it, counted, before rather than after. */}
          <p className="m-0 text-body-sm text-ink-dim">
            <Num>
              {t('settings.integrations.monitor.deleteBody', { count: deleting.pipelines })}
            </Num>
          </p>
        </ForgeDialog>
      ) : null}
    </Panel>
  )
}
