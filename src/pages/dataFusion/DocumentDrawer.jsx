import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDrawer } from '@/components/forge/ForgeDrawer'
import { Icon } from '@/components/forge/Icon'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useFusionDoc, useVerifyDoc } from '@/features/dataFusion/documents'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'
import { DocThumb, LinkChips, ScopePill, VerifiedPill } from './DocumentsPage'

/**
 * One document, in four tabs.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── Metadata is read, not edited ──────────────────────────────────────────
 * The prototype's drawer puts nine text inputs and a Save button here — name,
 * revision, owner, effective date, expiry, language, source, tags. Every one of
 * those comes from the system that filed the document: SharePoint, the vendor
 * portal, the CAD vault. Offering them as inputs would make this screen a second
 * source of truth for facts it does not own, and the first thing to go wrong is
 * somebody correcting a revision here and the CAD vault overwriting it tonight.
 *
 * One field IS this reader's to set, and it is the one the prototype buries at
 * the bottom of a form: whether they have checked the revision. That is a
 * judgement made by a person looking at a document, and it is the only write on
 * the screen.
 *
 * ── "Reaches" is computed, not stored ─────────────────────────────────────
 * The inheritance runs the other way for this tab: instead of asking an asset
 * what applies to it, ask a document what it lands on. Same resolver, walked
 * over the estate. It is what makes the scope pill meaningful — "Site" is a word
 * until it is nine named machines.
 */

const TABS = ['metadata', 'reach', 'preview', 'usage']

export function DocumentDrawer({ id, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const [tab, setTab] = useState(TABS[0])

  const doc = useFusionDoc(id)
  const verify = useVerifyDoc()

  const record = doc.data

  return (
    <ForgeDrawer
      open={Boolean(id)}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
          setTab(TABS[0])
        }
      }}
      title={record?.name ?? t('dataFusion.docs.drawerTitle')}
      closeLabel={t('common:actions.close')}
      className="w-[min(34rem,100vw)]"
    >
      {doc.isPending ? (
        <SkeletonRows count={4} />
      ) : doc.isError ? (
        <ErrorState
          error={doc.error}
          title={t('dataFusion.docs.loadOneFailed')}
          onRetry={doc.refetch}
        />
      ) : (
        <>
          <div className="-mx-5 -mt-4 flex items-start gap-3 border-b border-hairline px-5 py-4">
            <DocThumb doc={record} />
            <div className="min-w-0 flex-1">
              <Mono className="text-micro text-ink-dim">
                {record.pages == null
                  ? `${record.id} · ${record.rev}`
                  : t('dataFusion.docs.drawerMeta', {
                      id: record.id,
                      rev: record.rev,
                      pages: record.pages,
                    })}
              </Mono>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <ScopePill scope={record.scope} />
                <VerifiedPill verified={record.verified} />
              </div>
            </div>
          </div>

          <div
            role="tablist"
            aria-label={t('dataFusion.docs.tabsLabel')}
            className="-mx-5 mb-4 flex gap-1 border-b border-hairline px-5"
          >
            {TABS.map((entry) => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={tab === entry}
                onClick={() => setTab(entry)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2.5 text-body-sm transition-colors',
                  tab === entry
                    ? 'border-forge font-semibold text-ink'
                    : 'border-transparent text-ink-dim hover:text-ink',
                )}
              >
                {t(`dataFusion.docs.tabs.${entry}`)}
              </button>
            ))}
          </div>

          <div>
            {tab === 'metadata' ? (
              <>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5">
                  <Field label={t('dataFusion.docs.fields.type')}>
                    {t(`lines.asset.tabPanes.documents.kind.${record.type}`)}
                  </Field>
                  <Field label={t('dataFusion.docs.fields.owner')}>{record.owner}</Field>
                  <Field label={t('dataFusion.docs.fields.effective')}>
                    <Num>{record.date}</Num>
                  </Field>
                  <Field label={t('dataFusion.docs.fields.expires')}>
                    {record.expires ? (
                      <Num
                        className={cn(
                          record.expiresInDays <= 180 && 'font-semibold text-on-amber',
                        )}
                      >
                        {t('dataFusion.docs.expiresOn', {
                          date: record.expires,
                          days: record.expiresInDays,
                        })}
                      </Num>
                    ) : (
                      <span className="text-ink-mute">—</span>
                    )}
                  </Field>
                  <Field label={t('dataFusion.docs.fields.size')}>
                    {/* An uploaded document has neither: no file is stored, so
                        nothing knows. The prototype sends a fixed 1.2 MB / 12
                        pages for every upload, which is the same wrong number on
                        every row somebody adds. */}
                    {record.sizeKb == null ? (
                      <span className="text-ink-mute">
                        {t('dataFusion.docs.noFileStored')}
                      </span>
                    ) : (
                      <Num>
                        {t('dataFusion.docs.sizeAndPages', {
                          size: formatInteger(record.sizeKb),
                          pages: record.pages,
                        })}
                      </Num>
                    )}
                  </Field>
                  <Field label={t('dataFusion.docs.fields.language')}>
                    {record.lang.toUpperCase()}
                  </Field>
                  <Field label={t('dataFusion.docs.fields.source')}>
                    {t(`dataFusion.docs.source.${record.source}`)}
                  </Field>
                  <Field label={t('dataFusion.docs.fields.tags')}>
                    <span className="flex flex-wrap gap-1.5">
                      {record.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-pill bg-sunken px-2 py-[2px] text-micro font-normal text-ink-dim"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </Field>
                </dl>

                {/* The one write. Offered only while it is untrue — a button
                    that reports a state rather than changing one is a button
                    somebody presses to find out it does nothing. */}
                {record.verified ? (
                  <p className="mt-5 mb-0 text-body-sm text-ink-dim">
                    {t('dataFusion.docs.alreadyVerified')}
                  </p>
                ) : (
                  <div className="mt-5">
                    <ForgeButton
                      variant="primary"
                      onClick={() => verify.mutate(record.id)}
                      disabled={verify.isPending}
                    >
                      {t('dataFusion.docs.verifyAction')}
                    </ForgeButton>
                    <p className="mt-2 mb-0 max-w-[46ch] text-micro font-normal text-ink-dim">
                      {t('dataFusion.docs.verifyHint')}
                    </p>
                  </div>
                )}

                {/* Said plainly rather than left to be discovered by clicking
                    into fields that turn out not to be fields. */}
                <p className="mt-5 mb-0 max-w-[46ch] border-t border-subtle pt-3.5 text-micro font-normal text-ink-dim">
                  {t('dataFusion.docs.readOnlyNote', {
                    source: t(`dataFusion.docs.source.${record.source}`),
                  })}
                </p>
              </>
            ) : null}

            {tab === 'reach' ? (
              <>
                <Eyebrow className="mb-1.5">{t('dataFusion.docs.linkedTo')}</Eyebrow>
                <LinkChips links={record.links} max={6} />

                <Eyebrow className="mt-5 mb-1.5">
                  <Num>
                    {t('dataFusion.docs.reachesCount', { count: record.reaches.length })}
                  </Num>
                </Eyebrow>
                <p className="mt-0 mb-2.5 max-w-[46ch] text-micro font-normal text-ink-dim">
                  {t('dataFusion.docs.reachesHint')}
                </p>
                {record.reaches.length ? (
                  <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                    {record.reaches.map((asset) => (
                      <li key={asset.id}>
                        <Link
                          to={`/app/assets/${asset.id}`}
                          className="inline-flex items-center gap-1.5 rounded-pill border border-hairline px-2.5 py-1 text-micro font-normal text-ink-dim transition-colors hover:border-forge/40 hover:text-ink"
                        >
                          <Icon name="factory" size="xs" className="text-ink-mute" />
                          {asset.name}
                          <Mono className="text-ink-mute">{asset.code}</Mono>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 text-body-sm text-ink-dim">
                    {t('dataFusion.docs.reachesNone')}
                  </p>
                )}
              </>
            ) : null}

            {tab === 'preview' ? (
              <>
                {/* A drawing gets the blueprint grid the design gives it; every
                    other type gets its own thumbnail large. Neither is a render
                    of anything, and the line underneath says so — the prototype
                    captions this "Page 1 of 412 · rendered preview", which
                    claims a render that did not happen. */}
                <div
                  className="flex h-64 items-center justify-center rounded-sm border border-hairline bg-sunken"
                  style={
                    isDrawing(record.type)
                      ? {
                          backgroundImage: `repeating-linear-gradient(0deg, var(--border-hairline) 0 1px, transparent 1px 16px), repeating-linear-gradient(90deg, var(--border-hairline) 0 1px, transparent 1px 16px)`,
                        }
                      : undefined
                  }
                >
                  <DocThumb doc={record} large />
                </div>
                <p className="mt-3 mb-0 max-w-[46ch] text-body-sm text-ink-dim">
                  {t('dataFusion.docs.previewUnavailable')}
                </p>
              </>
            ) : null}

            {tab === 'usage' ? (
              <>
                <Eyebrow className="mb-2.5">{t('dataFusion.docs.usageTitle')}</Eyebrow>
                <ul className="m-0 flex list-none flex-col p-0">
                  <UsageRow
                    icon="factory"
                    label={t('dataFusion.docs.usage.assets')}
                    value={t('dataFusion.docs.usage.assetsValue', {
                      count: record.usage.assets,
                    })}
                  />
                  <UsageRow
                    icon="bolt"
                    label={t('dataFusion.docs.usage.alerts')}
                    value={t('dataFusion.docs.usage.alertsValue', {
                      count: record.usage.openAlerts,
                    })}
                  />
                  <UsageRow
                    icon="wrench"
                    label={t('dataFusion.docs.usage.workOrders')}
                    value={t('dataFusion.docs.usage.workOrdersValue', {
                      count: record.usage.workOrders,
                    })}
                  />
                  <UsageRow
                    icon="layers"
                    label={t('dataFusion.docs.usage.graph')}
                    value={t('dataFusion.docs.usage.graphValue', {
                      count: record.usage.graphEdges,
                    })}
                  />
                </ul>
                <p className="mt-4 mb-0 max-w-[46ch] text-micro font-normal text-ink-dim">
                  {t('dataFusion.docs.usageNote')}
                </p>
              </>
            ) : null}
          </div>
        </>
      )}
    </ForgeDrawer>
  )
}

const isDrawing = (type) => type === 'drawing' || type === 'layout'

function Field({ label, children }) {
  return (
    <>
      <dt className="text-body-sm whitespace-nowrap text-ink-dim">{label}</dt>
      <dd className="m-0 min-w-0 text-body-sm text-ink">{children}</dd>
    </>
  )
}

/**
 * One line of the usage list.
 *
 * Four rows, all counted. The prototype has a fifth — "Cited in 14
 * investigations" — and there is no citation record anywhere in this app to
 * count, so it is not here. A row that would always read 14 is worse than a
 * missing row.
 */
function UsageRow({ icon, label, value }) {
  return (
    <li className="flex items-center gap-2.5 border-b border-subtle py-2.5 last:border-b-0">
      <Icon name={icon} size="sm" className="shrink-0 text-ink-mute" />
      <span className="min-w-0 flex-1 text-body-sm font-semibold text-ink">{label}</span>
      <Num className="shrink-0 text-body-sm text-ink-dim">{value}</Num>
    </li>
  )
}
