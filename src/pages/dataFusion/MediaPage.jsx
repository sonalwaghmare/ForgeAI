import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useFusionMedia, useUploadMedia } from '@/features/dataFusion/media'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { LinkChips } from './DocumentsPage'

/**
 * Images & 3D Media.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── A grid, because these are looked at rather than read ──────────────────
 * Documents got a table: a register is scanned by column — which revision, who
 * owns it, when did it change. None of those questions apply to a photograph of
 * a bearing housing. What matters here is what it is of, so the tile is mostly
 * the thing itself, or would be.
 *
 * ── There is no "or would be" in the tile, and that is deliberate ─────────
 * No image files are stored in this build. Every tile therefore shows its type
 * on a tinted panel rather than a stock photograph of a factory, which would be
 * the one thing on this screen a reader could not tell was invented. The design
 * draws exactly the same thing — an icon on a gradient — so this is fidelity
 * rather than a compromise.
 *
 * ── All four chips are always shown ───────────────────────────────────────
 * Unlike the document strip, which hides a type nothing is filed under. Four is
 * short enough that a zero is information — "nobody has uploaded a thermal
 * capture" is worth knowing on a screen about what has been captured.
 */

const ALL = 'all'

export function MediaPage() {
  const { t } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('dataFusion.sections.media')} · ${t('common:brand.name')}`)

  const [type, setType] = useState(ALL)
  const [query, setQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [openId, setOpenId] = useState(null)

  const media = useFusionMedia({ type, q: query.trim() || undefined })

  const rows = media.data?.items ?? []
  const stats = media.data?.stats ?? { total: 0, sizeKb: 0 }
  const types = media.data?.types ?? []
  const open = rows.find((item) => item.id === openId) ?? null

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h1 className="m-0 text-headline">{t('dataFusion.sections.media')}</h1>
          <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
            <Num>{t('dataFusion.media.summary', { count: stats.total })}</Num>
          </p>
        </div>
        <ForgeButton variant="primary" onClick={() => setUploading(true)}>
          <Icon name="up" size="xs" />
          {t('dataFusion.media.upload.action')}
        </ForgeButton>
      </header>

      {media.isPending ? (
        <SkeletonRows count={4} />
      ) : media.isError ? (
        <ErrorState
          error={media.error}
          title={t('dataFusion.media.loadFailed')}
          onRetry={media.refetch}
        />
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <div
              role="group"
              aria-label={t('dataFusion.media.filterByType')}
              className="flex flex-wrap gap-2"
            >
              <Chip selected={type === ALL} onClick={() => setType(ALL)}>
                <Num>{t('dataFusion.media.allTypes', { count: stats.total })}</Num>
              </Chip>
              {types.map((entry) => (
                <Chip
                  key={entry.id}
                  selected={type === entry.id}
                  onClick={() => setType(entry.id)}
                >
                  <Icon
                    name={entry.icon}
                    size="xs"
                    className={cn(
                      'me-1.5',
                      type === entry.id ? undefined : ON_TINT_CLASS[entry.tone],
                    )}
                  />
                  <Num>
                    {t('dataFusion.media.typeChip', {
                      label: t(`dataFusion.media.type.${entry.id}`),
                      count: entry.count,
                    })}
                  </Num>
                </Chip>
              ))}
            </div>

            <div className="ms-auto flex min-w-[13rem] items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge max-sm:ms-0 max-sm:w-full">
              <Icon name="search" size="sm" className="text-ink-mute" />
              <label className="sr-only" htmlFor="media-search">
                {t('dataFusion.media.searchLabel')}
              </label>
              <input
                id="media-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('dataFusion.media.searchPlaceholder')}
                className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
              />
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon="search"
              title={t('dataFusion.media.noMatch')}
              body={t('dataFusion.media.noMatchBody')}
              action={
                type !== ALL || query.trim() ? (
                  <ForgeButton
                    onClick={() => {
                      setType(ALL)
                      setQuery('')
                    }}
                  >
                    {t('common:actions.clearFilters')}
                  </ForgeButton>
                ) : null
              }
            />
          ) : (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 p-0">
              {rows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(item.id)}
                    className="flex w-full flex-col overflow-hidden rounded-sm border border-hairline bg-card text-start shadow-edge transition-colors hover:border-forge/40"
                  >
                    <MediaPanel item={item} />
                    <span className="flex min-w-0 flex-col gap-1 p-3">
                      <TypePill item={item} />
                      <span className="text-body-sm font-semibold text-ink">{item.name}</span>
                      <Mono className="text-micro text-ink-dim">
                        <MediaMeta item={item} />
                      </Mono>
                      <span className="mt-1">
                        <LinkChips links={item.links} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <MediaDetailDialog item={open} onClose={() => setOpenId(null)} />
      <MediaUploadDialog
        open={uploading}
        onClose={() => setUploading(false)}
        types={types}
        targets={media.data?.targets}
      />
    </div>
  )
}

/**
 * The tile's picture area.
 *
 * Tinted to the media type rather than left grey: four kinds of capture on one
 * grid need telling apart at a glance, and the tint is the only thing on the
 * tile doing that job before you read the pill.
 */
function MediaPanel({ item, tall = false }) {
  return (
    <span
      className={cn(
        'flex items-center justify-center border-b border-subtle',
        tall ? 'h-56' : 'aspect-[4/3]',
        item.tone ? TINT_CLASS[item.tone] : 'bg-sunken',
      )}
    >
      <Icon
        name={item.icon}
        size="lg"
        className={item.tone ? ON_TINT_CLASS[item.tone] : 'text-ink-mute'}
      />
    </span>
  )
}

function TypePill({ item }) {
  const { t } = useTranslation('app')
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-pill px-2 py-[2px] text-micro font-semibold whitespace-nowrap',
        item.tone ? cn(TINT_CLASS[item.tone], ON_TINT_CLASS[item.tone]) : 'bg-sunken text-ink-dim',
      )}
    >
      {t(`dataFusion.media.type.${item.type}`)}
    </span>
  )
}

/** Size, date, owner — with the size dropped when nothing knows it. */
function MediaMeta({ item }) {
  const { t } = useTranslation('app')
  if (item.sizeKb == null) {
    return t('dataFusion.media.metaNoSize', { date: item.date, owner: item.owner })
  }
  return t('dataFusion.media.meta', {
    size:
      item.sizeKb >= 1024
        ? `${Math.round((item.sizeKb / 1024) * 10) / 10} MB`
        : `${formatInteger(item.sizeKb)} KB`,
    date: item.date,
    owner: item.owner,
  })
}

/**
 * One item, larger.
 *
 * A dialog rather than a drawer: a photograph is looked at, and a 24rem column
 * beside the grid it came from is the wrong shape for looking at something. It
 * carries no tabs because there is nothing to put in a second one — media has no
 * revision history and no usage record.
 */
function MediaDetailDialog({ item, onClose }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <ForgeDialog
      open={Boolean(item)}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="md"
      title={item?.name ?? t('dataFusion.media.detailTitle')}
      footer={
        <ForgeButton variant="primary" onClick={onClose}>
          {t('common:actions.close')}
        </ForgeButton>
      }
    >
      {item ? (
        <>
          <div className="overflow-hidden rounded-sm border border-hairline">
            <MediaPanel item={item} tall />
          </div>
          {/* Said once, plainly. The tile above is a type badge at size, not a
              render of anything — no image files are stored in this build. */}
          <p className="mt-2.5 mb-4 text-body-sm text-ink-dim">
            {t('dataFusion.media.noFileStored')}
          </p>

          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5">
            <Row label={t('dataFusion.media.fields.type')}>
              <TypePill item={item} />
            </Row>
            <Row label={t('dataFusion.media.fields.captured')}>
              <Num>{item.date}</Num>
            </Row>
            <Row label={t('dataFusion.media.fields.owner')}>{item.owner}</Row>
            <Row label={t('dataFusion.media.fields.linked')}>
              <LinkChips links={item.links} max={6} />
            </Row>
            {item.tags.length ? (
              <Row label={t('dataFusion.media.fields.tags')}>
                <span className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-pill bg-sunken px-2 py-[2px] text-micro font-normal text-ink-dim"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              </Row>
            ) : null}
            <Row label={t('dataFusion.media.fields.id')}>
              <Mono className="text-body-sm text-ink-dim">{item.id}</Mono>
            </Row>
          </dl>
        </>
      ) : null}
    </ForgeDialog>
  )
}

function Row({ label, children }) {
  return (
    <>
      <dt className="text-body-sm whitespace-nowrap text-ink-dim">{label}</dt>
      <dd className="m-0 min-w-0 text-body-sm text-ink">{children}</dd>
    </>
  )
}

/**
 * Upload media.
 *
 * One step, not four. The document wizard earns its steps — a type, a sharing
 * scope, a link tier and eight metadata fields is more than one screen can hold.
 * Media has a name, a kind, what it is of, and who took it, which fits.
 *
 * Linking is to assets only. A photograph is of a machine; a thermal capture is
 * of a housing on a machine. Neither is "of" a site in any sense that would make
 * it inherit down to every machine there, and offering the tiers the document
 * flow offers would invite exactly that.
 */
function MediaUploadDialog({ open, onClose, types, targets }) {
  const { t } = useTranslation(['app', 'common'])
  const upload = useUploadMedia()

  const [name, setName] = useState('')
  const [type, setType] = useState('photo')
  const [links, setLinks] = useState([])
  const [owner, setOwner] = useState('Karan Patel')
  const [tags, setTags] = useState('')

  function close() {
    onClose()
    setName('')
    setType('photo')
    setLinks([])
    setOwner('Karan Patel')
    setTags('')
    upload.reset()
  }

  const canSave = name.trim().length > 2 && links.length > 0

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      size="md"
      title={t('dataFusion.media.upload.title')}
      footer={
        <>
          <ForgeButton onClick={close}>{t('common:actions.cancel')}</ForgeButton>
          <span className="flex-1" />
          <ForgeButton
            variant="primary"
            disabled={!canSave || upload.isPending}
            onClick={() =>
              upload.mutate(
                {
                  name: name.trim(),
                  type,
                  links: links.map((id) => ({ k: 'asset', id })),
                  owner,
                  date: today(),
                  tags: tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                },
                { onSuccess: close },
              )
            }
          >
            {t('dataFusion.media.upload.submit')}
          </ForgeButton>
        </>
      }
    >
      <div className="flex flex-col items-center gap-1.5 rounded-sm border border-dashed border-hairline bg-sunken px-5 py-6 text-center">
        <Icon name="layers" size="lg" className="text-ink-mute" />
        <p className="m-0 mt-1 text-body-sm font-semibold text-ink">
          {t('dataFusion.media.upload.dropzone')}
        </p>
        <p className="m-0 text-micro font-normal text-ink-mute">
          {t('dataFusion.media.upload.dropzoneDemo')}
        </p>
      </div>

      <Field
        className="mt-4"
        label={t('dataFusion.media.upload.nameLabel')}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t('dataFusion.media.upload.namePlaceholder')}
      />

      <Eyebrow className="mt-4 mb-2">{t('dataFusion.media.upload.typeLabel')}</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {(types ?? []).map((entry) => (
          <Chip key={entry.id} selected={type === entry.id} onClick={() => setType(entry.id)}>
            <Icon
              name={entry.icon}
              size="xs"
              className={cn('me-1.5', type === entry.id ? undefined : ON_TINT_CLASS[entry.tone])}
            />
            {t(`dataFusion.media.type.${entry.id}`)}
          </Chip>
        ))}
      </div>

      <Eyebrow className="mt-4 mb-1.5">{t('dataFusion.media.upload.linkLabel')}</Eyebrow>
      <p className="mt-0 mb-2 max-w-[56ch] text-micro font-normal text-ink-dim">
        {t('dataFusion.media.upload.linkHint')}
      </p>
      <div className="flex flex-wrap gap-2">
        {(targets?.asset ?? []).map((option) => (
          <Chip
            key={option.id}
            selected={links.includes(option.id)}
            onClick={() =>
              setLinks((held) =>
                held.includes(option.id)
                  ? held.filter((one) => one !== option.id)
                  : [...held, option.id],
              )
            }
          >
            {option.name}
          </Chip>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
        <Field
          label={t('dataFusion.media.upload.ownerLabel')}
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
        />
        <Field
          label={t('dataFusion.media.upload.tagsLabel')}
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder={t('dataFusion.media.upload.tagsPlaceholder')}
          hint={t('dataFusion.media.upload.tagsHint')}
        />
      </div>

      {upload.isError ? (
        <p className="mt-3 mb-0 text-body-sm text-on-red">
          {t('dataFusion.media.upload.failed')}
        </p>
      ) : null}
    </ForgeDialog>
  )
}

/** Today, as the `yyyy-mm-dd` the registry stores. */
function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
