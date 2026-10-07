import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { PAGE_SIZES, TablePagination } from '@/components/forge/TablePagination'
import { Mono, Num } from '@/components/forge/primitives'
import {
  DOC_LINK_KINDS,
  DOC_SCOPES,
  DOC_VIEWS,
  useFusionDocs,
} from '@/features/dataFusion/documents'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { DocumentDrawer } from './DocumentDrawer'
import { DocumentUploadDialog } from './DocumentUploadDialog'

/**
 * Documents & SOPs — the knowledge register.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── One register, two readers ─────────────────────────────────────────────
 * These are the same twelve records Asset Detail's Documents tab resolves
 * against. That tab used to author six of its own per asset, reusing ids this
 * registry also carries under different names and different owners — two lists
 * of one collection with nothing able to notice they disagreed. Verifying a
 * document here changes the flag there.
 *
 * ── Scope is the column that makes the list readable ──────────────────────
 * A safety data sheet applies to the whole company, a P&ID to one line, a
 * calibration certificate to one instrument. Without that column a register of
 * twelve documents reads as twelve files somebody uploaded, and the question it
 * exists to answer — which of these applies to the machine in front of me — has
 * no answer on the screen.
 */

const ALL = 'all'

export function DocumentsPage() {
  const { t } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('dataFusion.sections.documents')} · ${t('common:brand.name')}`)

  const [query, setQuery] = useState('')
  const [type, setType] = useState(ALL)
  const [scope, setScope] = useState(ALL)
  const [linked, setLinked] = useState(ALL)
  const [verified, setVerified] = useState(ALL)
  const [view, setView] = useState(DOC_VIEWS[0])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [openId, setOpenId] = useState(null)
  const [uploading, setUploading] = useState(false)

  const docs = useFusionDocs({
    q: query.trim() || undefined,
    type,
    scope,
    linked,
    verified,
  })

  const rows = docs.data?.items ?? []
  const stats = docs.data?.stats ?? { total: 0, unverified: 0, unlinked: 0 }
  const types = docs.data?.types ?? []

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const isNarrowed =
    query.trim().length > 0 ||
    type !== ALL ||
    scope !== ALL ||
    linked !== ALL ||
    verified !== ALL

  function clearFilters() {
    setQuery('')
    setType(ALL)
    setScope(ALL)
    setLinked(ALL)
    setVerified(ALL)
    setPage(1)
  }

  const narrow = (setter) => (next) => {
    setter(next)
    setPage(1)
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 text-headline">{t('dataFusion.sections.documents')}</h1>
          <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
            <Num>
              {t('dataFusion.docs.summary', {
                total: stats.total,
                unverified: stats.unverified,
              })}
            </Num>
          </p>
        </div>
        {/* Two densities of the same list. The list is the default because a
            register is read by column — which revision, who owns it, when did it
            change — and cards make every one of those a saccade. */}
        <div className="flex items-center gap-2.5">
          <div role="group" aria-label={t('dataFusion.docs.viewLabel')} className="flex gap-1.5">
            {DOC_VIEWS.map((option) => (
              <Chip key={option} selected={view === option} onClick={() => setView(option)}>
                {t(`dataFusion.docs.view.${option}`)}
              </Chip>
            ))}
          </div>
          <ForgeButton variant="primary" onClick={() => setUploading(true)}>
            <Icon name="up" size="xs" />
            {t('dataFusion.docs.upload.action')}
          </ForgeButton>
        </div>
      </header>

      {docs.isPending ? (
        <SkeletonRows count={6} />
      ) : docs.isError ? (
        <ErrorState
          error={docs.error}
          title={t('dataFusion.docs.loadFailed')}
          onRetry={docs.refetch}
        />
      ) : (
        <>
          {/* The type strip. Counts come from the whole register rather than the
              filtered slice, so a chip always says how many it would show. */}
          <div
            role="group"
            aria-label={t('dataFusion.docs.filterByType')}
            className="mb-3 flex flex-wrap gap-2"
          >
            <Chip selected={type === ALL} onClick={() => narrow(setType)(ALL)}>
              <Num>{t('dataFusion.docs.allTypes', { count: stats.total })}</Num>
            </Chip>
            {types.map((entry) => (
              <Chip
                key={entry.id}
                selected={type === entry.id}
                onClick={() => narrow(setType)(entry.id)}
              >
                <Icon
                  name={entry.icon}
                  size="xs"
                  className={cn(
                    'me-1.5',
                    type === entry.id ? undefined : (ON_TINT_CLASS[entry.tone] ?? 'text-ink-mute'),
                  )}
                />
                <Num>
                  {t('dataFusion.docs.typeChip', {
                    label: t(`lines.asset.tabPanes.documents.kind.${entry.id}`),
                    count: entry.count,
                  })}
                </Num>
              </Chip>
            ))}
          </div>

          <Panel flush className="mb-3.5 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <div className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge max-sm:w-full max-sm:flex-none">
                <Icon name="search" size="sm" className="text-ink-mute" />
                <label className="sr-only" htmlFor="doc-search">
                  {t('dataFusion.docs.searchLabel')}
                </label>
                <input
                  id="doc-search"
                  value={query}
                  onChange={(event) => narrow(setQuery)(event.target.value)}
                  placeholder={t('dataFusion.docs.searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>

              <ForgeSelect
                id="doc-scope"
                labelHidden
                size="sm"
                label={t('dataFusion.docs.filterByScope')}
                value={scope}
                onValueChange={narrow(setScope)}
                className="w-[11rem] shrink-0"
                options={[
                  { value: ALL, label: t('dataFusion.docs.allScopes') },
                  ...DOC_SCOPES.map((value) => ({
                    value,
                    label: t(`dataFusion.docs.scope.${value}`),
                  })),
                ]}
              />

              <ForgeSelect
                id="doc-linked"
                labelHidden
                size="sm"
                label={t('dataFusion.docs.filterByLink')}
                value={linked}
                onValueChange={narrow(setLinked)}
                className="w-[12rem] shrink-0"
                options={[
                  { value: ALL, label: t('dataFusion.docs.anyLink') },
                  ...DOC_LINK_KINDS.map((value) => ({
                    value,
                    label: t(`dataFusion.docs.linkKind.${value}`),
                  })),
                  /* Not the absence of a filter — an unlinked document is the
                     thing Contextualisation exists to fix, and somebody auditing
                     the library wants exactly that list. */
                  { value: 'none', label: t('dataFusion.docs.notLinked') },
                ]}
              />

              <ForgeSelect
                id="doc-verified"
                labelHidden
                size="sm"
                label={t('dataFusion.docs.filterByStatus')}
                value={verified}
                onValueChange={narrow(setVerified)}
                className="w-[11rem] shrink-0"
                options={[
                  { value: ALL, label: t('dataFusion.docs.anyStatus') },
                  { value: 'yes', label: t('dataFusion.docs.verified') },
                  { value: 'no', label: t('dataFusion.docs.unverified') },
                ]}
              />

              <p className="m-0 ms-auto text-body-sm text-ink-dim">
                <Num>
                  {t('dataFusion.docs.matchCount', {
                    shown: formatInteger(rows.length),
                    total: formatInteger(stats.total),
                  })}
                </Num>
              </p>
            </div>
          </Panel>

          {rows.length === 0 ? (
            <EmptyState
              icon="search"
              title={t('dataFusion.docs.noMatch')}
              body={t('dataFusion.docs.noMatchBody')}
              action={
                isNarrowed ? (
                  <ForgeButton onClick={clearFilters}>
                    {t('common:actions.clearFilters')}
                  </ForgeButton>
                ) : null
              }
            />
          ) : view === 'list' ? (
            <Panel flush className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t('dataFusion.docs.tableCaption')}</caption>
                  <thead>
                    <tr>
                      {['document', 'type', 'scope', 'linked', 'rev', 'updated', 'owner', 'status'].map(
                        (column) => (
                          <th
                            key={column}
                            scope="col"
                            className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                          >
                            {t(`dataFusion.docs.columns.${column}`)}
                          </th>
                        ),
                      )}
                      <th scope="col" className="bg-sunken px-3.5 py-2.5">
                        <span className="sr-only">{t('dataFusion.docs.columns.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((doc) => (
                      <tr key={doc.id} className="border-t border-subtle hover:bg-sunken">
                        <td className="px-3.5 py-2.5">
                          <span className="flex items-center gap-2.5">
                            <DocThumb doc={doc} />
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-body-sm font-semibold text-ink">
                                {doc.name}
                              </span>
                              <Mono className="text-micro text-ink-dim">
                                {doc.sizeKb == null
                                  ? doc.id
                                  : t('dataFusion.docs.meta', {
                                      id: doc.id,
                                      size: sizeOf(doc.sizeKb),
                                      pages: doc.pages,
                                    })}
                              </Mono>
                            </span>
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          {t(`lines.asset.tabPanes.documents.kind.${doc.type}`)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <ScopePill scope={doc.scope} />
                        </td>
                        <td className="px-3.5 py-2.5">
                          <LinkChips links={doc.links} />
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">{doc.rev}</td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          <Num>
                            <time dateTime={doc.date}>{doc.date}</time>
                          </Num>
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">{doc.owner}</td>
                        <td className="px-3.5 py-2.5">
                          <VerifiedPill verified={doc.verified} />
                        </td>
                        <td className="px-3.5 py-2.5 text-end">
                          <ForgeButton size="sm" onClick={() => setOpenId(doc.id)}>
                            {t('dataFusion.docs.manage')}
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
                label={t('dataFusion.docs.rowNoun')}
              />
            </Panel>
          ) : (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 p-0">
              {rows.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(doc.id)}
                    className="flex w-full flex-col overflow-hidden rounded-sm border border-hairline bg-card text-start shadow-edge transition-colors hover:border-forge/40"
                  >
                    <span className="flex aspect-[4/3] items-center justify-center border-b border-subtle bg-sunken">
                      <DocThumb doc={doc} large />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1 p-3">
                      <span className="text-body-sm font-semibold text-ink">{doc.name}</span>
                      <Mono className="text-micro text-ink-dim">
                        {doc.sizeKb == null
                          ? `${doc.rev} · ${doc.date}`
                          : t('dataFusion.docs.cardMeta', {
                              rev: doc.rev,
                              size: sizeOf(doc.sizeKb),
                              date: doc.date,
                            })}
                      </Mono>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <ScopePill scope={doc.scope} />
                        {!doc.verified ? <VerifiedPill verified={false} /> : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <DocumentDrawer id={openId} onClose={() => setOpenId(null)} />
      <DocumentUploadDialog
        open={uploading}
        onClose={() => setUploading(false)}
        types={docs.data?.allTypes}
        targets={docs.data?.targets}
      />
    </div>
  )
}

/** KB below a megabyte, MB above it. Nobody reads "8,602 KB". */
function sizeOf(kb) {
  return kb >= 1024 ? `${Math.round((kb / 1024) * 10) / 10} MB` : `${formatInteger(kb)} KB`
}

/**
 * The file-type thumbnail: the type's glyph over its extension.
 *
 * Both, not one. The glyph is scannable down a column and the extension is what
 * tells somebody whether they can open it on the machine they are standing at —
 * a DWG and a PDF are different problems on a plant floor.
 */
export function DocThumb({ doc, large = false }) {
  const tone = doc.tone
  return (
    <span
      className={cn(
        'flex shrink-0 flex-col items-center justify-center gap-1 rounded-xs border border-hairline',
        tone ? TINT_CLASS[tone] : 'bg-sunken',
        large ? 'h-16 w-[3.4rem]' : 'h-9 w-[1.9rem]',
      )}
    >
      <Icon
        name={doc.icon}
        size={large ? 'md' : 'xs'}
        className={tone ? ON_TINT_CLASS[tone] : 'text-ink-mute'}
      />
      <span
        className={cn(
          'font-semibold tracking-wide',
          large ? 'text-micro' : 'text-[0.5rem]',
          tone ? ON_TINT_CLASS[tone] : 'text-ink-mute',
        )}
      >
        {doc.ext}
      </span>
    </span>
  )
}

/** Hues for the four scope levels, widest neutral. */
const SCOPE_TONE = {
  instance: 'dismissed',
  line: 'ack',
  site: 'green',
  enterprise: null,
}

export function ScopePill({ scope }) {
  const { t } = useTranslation('app')
  const tone = SCOPE_TONE[scope]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-pill px-2.5 py-[3px] text-micro font-semibold whitespace-nowrap',
        tone ? cn(TINT_CLASS[tone], ON_TINT_CLASS[tone]) : 'bg-sunken text-ink-dim',
      )}
    >
      {t(`dataFusion.docs.scope.${scope}`)}
    </span>
  )
}

export function VerifiedPill({ verified }) {
  const { t } = useTranslation('app')
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-pill px-2.5 py-[3px] text-micro whitespace-nowrap',
        verified ? 'tint-green text-on-green' : 'tint-amber text-on-amber',
      )}
    >
      {t(verified ? 'dataFusion.docs.verified' : 'dataFusion.docs.unverified')}
    </span>
  )
}

/**
 * What a document is attached to.
 *
 * Two, then a count. A P&ID on one line has one chip; a manual covering both
 * bodymakers has two; nothing has more than three, and a row that grew to six
 * would push every column after it off the screen.
 */
export function LinkChips({ links, max = 2 }) {
  const { t } = useTranslation('app')
  if (!links.length) {
    return <span className="text-micro font-normal text-ink-mute italic">
      {t('dataFusion.docs.notLinked')}
    </span>
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {links.slice(0, max).map((link) => (
        <span
          key={`${link.kind}-${link.id}`}
          className="inline-flex items-center gap-1 rounded-pill bg-sunken px-2 py-[2px] text-micro font-normal whitespace-nowrap text-ink-dim"
        >
          <Icon name={LINK_ICON[link.kind]} size="xs" className="text-ink-mute" />
          {link.name}
        </span>
      ))}
      {links.length > max ? (
        <Num className="text-micro text-ink-mute">
          {t('dataFusion.docs.moreLinks', { count: links.length - max })}
        </Num>
      ) : null}
    </span>
  )
}

const LINK_ICON = { asset: 'factory', line: 'gauge', site: 'map' }
