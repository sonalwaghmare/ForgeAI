import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Chip, Segmented, SegmentedItem } from '@/components/forge/Chip'
import { Icon } from '@/components/forge/Icon'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { AiBadge } from '@/components/forge/StatusBadge'
import { Num } from '@/components/forge/primitives'
import { LOGBOOK_VIEWS } from '@/features/logbook/api'
import { useCreateLogEntry, useLogbook } from '@/features/logbook/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger } from '@/lib/format'
import { LogbookComposer } from './LogbookComposer'
import { LogbookEntry } from './LogbookEntry'
import { LogbookTimeline } from './LogbookTimeline'

/**
 * Logbook.
 *
 * DEMO. See `DEMO-MODE.md` §8.6. What the crew wrote down, which is the
 * evidence sensors cannot produce — and which Forge AI reads when it
 * investigates a machine.
 *
 * ── Everything that narrows the log is in the URL ─────────────────────────
 * `?view=timeline&q=bearing&asset=FDY-BM-03&shift=SH-…`. The prototype keeps
 * the view and the query in `useState`, so a note somebody wants a colleague to
 * read cannot be linked to. The `shift` param is the destination the Shifts
 * detail panel's Logbook button was missing.
 *
 * ── The search runs on the server ─────────────────────────────────────────
 * Because it does more than `includes()`: it expands the query over the terms a
 * plant uses for the same thing, and answers with which of them earned a match.
 * That is the honest version of the design's violet "semantic search" marker
 * sitting beside a substring test — see `searchEntries`. Debounced, because
 * every accepted keystroke is a request.
 */
export function LogbookPage() {
  const { t } = useTranslation(['app', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()

  const view = LOGBOOK_VIEWS.includes(searchParams.get('view'))
    ? searchParams.get('view')
    : 'feed'
  const assetId = searchParams.get('asset') ?? 'all'
  const shiftId = searchParams.get('shift') ?? null
  const cited = searchParams.get('cited') === '1'
  const query = searchParams.get('q') ?? ''

  /* The input is local and the URL is the write target, debounced. Driving the
     field straight off the search param would put a history entry on every
     keystroke and a request behind each one. */
  const [text, setText] = useState(query)
  const [composing, setComposing] = useState(false)

  useDocumentTitle(`${t('logbook.title')} · ${t('common:brand.name')}`)

  useEffect(() => {
    if (text === query) return
    const timer = setTimeout(() => {
      setSearchParams(
        (previous) => {
          const url = new URLSearchParams(previous)
          if (text.trim()) url.set('q', text)
          else url.delete('q')
          return url
        },
        // Replace, not push: typing eight characters should not cost eight
        // presses of the back button to undo.
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [text, query, setSearchParams])

  const params = useMemo(
    () => ({
      q: query || undefined,
      assetId: assetId !== 'all' ? assetId : undefined,
      shiftId: shiftId ?? undefined,
      cited: cited ? 'true' : undefined,
    }),
    [query, assetId, shiftId, cited],
  )

  const logbook = useLogbook(params)
  const create = useCreateLogEntry()

  const entries = logbook.data?.items ?? []
  const expanded = logbook.data?.expanded ?? []

  const setParam = (key, value) =>
    setSearchParams((previous) => {
      const url = new URLSearchParams(previous)
      if (value) url.set(key, value)
      else url.delete(key)
      return url
    })

  const narrowed = Boolean(query) || assetId !== 'all' || shiftId || cited

  const clear = () => {
    setText('')
    setSearchParams((previous) => {
      const url = new URLSearchParams(previous)
      for (const key of ['q', 'asset', 'shift', 'cited']) url.delete(key)
      return url
    })
  }

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('logbook.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">{t('logbook.subtitle')}</p>
        </div>

        <Segmented label={t('logbook.viewLabel')}>
          {LOGBOOK_VIEWS.map((entry) => (
            <SegmentedItem
              key={entry}
              selected={view === entry}
              label={t(`logbook.view.${entry}`)}
              onClick={() => setParam('view', entry === 'feed' ? null : entry)}
              className="w-auto px-3 text-body-sm font-semibold"
            >
              {t(`logbook.view.${entry}`)}
            </SegmentedItem>
          ))}
        </Segmented>

        <ForgeButton
          variant="primary"
          onClick={() => setComposing(true)}
          disabled={composing || logbook.isPending}
        >
          <Icon name="plus" size="xs" />
          {t('logbook.newEntry')}
        </ForgeButton>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge sm:max-w-[20rem]">
          <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
          <span className="sr-only">{t('logbook.search')}</span>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('logbook.searchPlaceholder')}
            className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
          />
        </label>

        <ForgeSelect
          label={t('logbook.assetFilter')}
          labelInline
          size="sm"
          value={assetId}
          onValueChange={(value) => setParam('asset', value === 'all' ? null : value)}
          options={[
            { value: 'all', label: t('logbook.anyAsset') },
            ...(logbook.data?.assets ?? []).map((asset) => ({
              value: asset.id,
              label: t('logbook.assetOption', { name: asset.name, count: asset.entries }),
            })),
          ]}
        />

        <Chip selected={cited} onClick={() => setParam('cited', cited ? null : '1')}>
          <Icon name="ai" size="xs" />
          {t('logbook.citedOnly')}
        </Chip>

        {/* Only when the expansion actually earned a match. The design shows its
            marker whenever the box is not empty, which claims credit on every
            query including the ones that found nothing. */}
        {expanded.length ? (
          <span title={t('logbook.expandedHint')}>
            <AiBadge label={t('logbook.expanded', { terms: expanded.join(', ') })} />
          </span>
        ) : null}

        {narrowed ? (
          <ForgeButton variant="ghost" size="sm" onClick={clear}>
            {t('logbook.clear')}
          </ForgeButton>
        ) : null}

        <span className="ms-auto text-body-sm text-ink-dim">
          <Num>
            {t('logbook.countOf', {
              shown: formatInteger(logbook.data?.total ?? 0),
              total: formatInteger(logbook.data?.grandTotal ?? 0),
            })}
          </Num>
        </span>
      </div>

      {shiftId ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-body-sm text-ink-dim">
          <Icon name="cal" size="xs" className="text-ink-mute" />
          {t('logbook.shiftFilter')}
          <ForgeButton variant="ghost" size="sm" onClick={() => setParam('shift', null)}>
            {t('logbook.shiftFilterClear')}
          </ForgeButton>
        </p>
      ) : null}

      {composing ? (
        <LogbookComposer
          /* Remounted per opening, so the fields start empty without an effect
             resetting them — the arrangement the lint rule forced on
             `WorkOrderFormDialog`. */
          key={logbook.data?.grandTotal ?? 0}
          author={logbook.data?.author ?? null}
          shift={logbook.data?.shift ?? null}
          assets={logbook.data?.plant ?? []}
          pending={create.isPending}
          onCancel={() => setComposing(false)}
          onSubmit={(payload) =>
            create.mutate(payload, {
              onSuccess: () => {
                setComposing(false)
                toast(t('logbook.toast.saved'))
              },
              onError: () => toast(t('logbook.toast.failed'), 'error'),
            })
          }
        />
      ) : null}

      {logbook.isError ? (
        <ErrorState
          error={logbook.error}
          title={t('logbook.loadFailed')}
          onRetry={() => logbook.refetch()}
        />
      ) : logbook.isPending ? (
        <SkeletonRows count={4} />
      ) : (
        <>
          {/* No KPI strip. The design has none here, and the four figures it
              would carry are all one glance away: the count is in the toolbar,
              the machines are the filter's own options, and "cited" is a chip
              that narrows to them rather than a number beside them. Shifts has
              a strip because a shift has measurements; a logbook has entries. */}
          {entries.length === 0 ? (
            <EmptyState
              icon="doc"
              title={narrowed ? t('logbook.emptySearchTitle') : t('logbook.emptyTitle')}
              body={narrowed ? t('logbook.emptySearchBody') : t('logbook.emptyBody')}
              action={
                narrowed ? (
                  <ForgeButton onClick={clear}>{t('logbook.clear')}</ForgeButton>
                ) : (
                  <ForgeButton variant="primary" onClick={() => setComposing(true)}>
                    {t('logbook.newEntry')}
                  </ForgeButton>
                )
              }
            />
          ) : view === 'timeline' ? (
            <LogbookTimeline entries={entries} />
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <LogbookEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </>
      )}
    </Page>
  )
}
