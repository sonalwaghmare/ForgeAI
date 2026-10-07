import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { DOCUMENT_KINDS, DOCUMENT_SCOPES } from '@/features/lines/api'
import { useUploadAssetDocument } from '@/features/lines/queries'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Attach a document to an asset.
 *
 * DEMO, and it commits: the register behind the modal gains the row. The
 * prototype's version closes and forgets, which makes the scope question — the
 * most interesting control on the form — impossible to see the effect of.
 *
 * ── Why scope is four cards and not a select ──────────────────────────────
 * Choosing "Enterprise-wide" attaches a document to every asset in the
 * organisation. That is the one decision on this form somebody can get wrong at
 * scale, and a collapsed select shows one option at a time and hides the other
 * three. Four cards put the consequence of each in front of the reader, and each
 * one says in plain words what it will do.
 */
export function DocumentUploadDialog({ open, onClose, asset }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const upload = useUploadAssetDocument(asset.id)
  const fileInput = useRef(null)

  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('manual')
  const [scope, setScope] = useState('asset')
  const [revision, setRevision] = useState('v1.0')
  const [owner, setOwner] = useState(asset.ownerName ?? '')
  const [tags, setTags] = useState('')

  const reset = () => {
    setFile(null)
    setName('')
    setKind('manual')
    setScope('asset')
    setRevision('v1.0')
    setOwner(asset.ownerName ?? '')
    setTags('')
  }

  const close = () => {
    reset()
    onClose()
  }

  const chooseFile = (chosen) => {
    if (!chosen) return
    setFile({ name: chosen.name, sizeKb: Math.max(1, Math.round(chosen.size / 1024)) })
    // The filename is the best guess at the title and is almost always close.
    // Pre-filling it is not presumptuous when the field stays editable.
    if (!name) setName(chosen.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
  }

  const where = {
    asset: asset.name,
    model: `${asset.vendor} ${asset.model}`,
    site: asset.siteName,
    enterprise: asset.path?.[0]?.name ?? '',
  }[scope]

  const submit = async () => {
    await upload.mutateAsync({
      name: name.trim(),
      kind,
      via: scope,
      rev: revision.trim() || 'v1.0',
      owner: owner.trim(),
      sizeKb: file?.sizeKb ?? 0,
      pages: 1,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
    toast(t('lines.asset.tabPanes.documents.uploaded', { name: name.trim(), asset: where }), 'ok')
    close()
  }

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      size="lg"
      bodyClassName="max-h-[min(72vh,44rem)]"
      title={t('lines.asset.tabPanes.documents.uploadTitle', { asset: asset.code })}
      footer={
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <ForgeButton onClick={close}>{t('common:actions.cancel')}</ForgeButton>
          <ForgeButton
            variant="primary"
            disabled={!name.trim() || upload.isPending}
            onClick={submit}
          >
            {t('lines.asset.tabPanes.documents.submit')}
          </ForgeButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            chooseFile(event.dataTransfer.files?.[0])
          }}
          className={cn(
            'flex flex-col items-center gap-2 rounded-sm border-2 border-dashed px-6 py-8 text-center transition-colors',
            file ? 'bg-sunken' : 'border-hairline bg-sunken hover:border-forge',
          )}
          style={file ? { borderColor: 'color-mix(in srgb, var(--hue-green) 50%, transparent)' } : undefined}
        >
          <Icon
            name={file ? 'check' : 'up'}
            size="lg"
            className={file ? undefined : 'text-ink-mute'}
            style={file ? { color: 'var(--on-green)' } : undefined}
          />
          {file ? (
            <Num className="text-body font-semibold">
              {t('lines.asset.tabPanes.documents.chosen', {
                name: file.name,
                size: t('lines.asset.tabPanes.documents.size', { kb: formatInteger(file.sizeKb) }),
              })}
            </Num>
          ) : (
            <span className="text-body font-semibold">
              {t('lines.asset.tabPanes.documents.dropzone')}
            </span>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />

        <Field
          label={t('lines.asset.tabPanes.documents.nameLabel')}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('lines.asset.tabPanes.documents.namePlaceholder')}
        />

        <div>
          <Eyebrow className="mb-2">{t('lines.asset.tabPanes.documents.typeLabel')}</Eyebrow>
          <div
            role="group"
            aria-label={t('lines.asset.tabPanes.documents.typeLabel')}
            className="flex flex-wrap gap-1.5"
          >
            {DOCUMENT_KINDS.map((entry) => (
              <Chip key={entry} selected={kind === entry} onClick={() => setKind(entry)}>
                {t(`lines.asset.tabPanes.documents.kind.${entry}`)}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow className="mb-2">{t('lines.asset.tabPanes.documents.scopeLabel')}</Eyebrow>
          <div
            role="radiogroup"
            aria-label={t('lines.asset.tabPanes.documents.scopeLabel')}
            className="flex flex-col gap-2"
          >
            {DOCUMENT_SCOPES.map((entry) => {
              const selected = scope === entry
              return (
                <label
                  key={entry}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-sm border px-3.5 py-3 transition-colors',
                    selected ? 'border-forge/50 bg-sunken' : 'border-hairline bg-card hover:border-forge/40',
                  )}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={selected}
                    onChange={() => setScope(entry)}
                    className="mt-0.5 accent-forge"
                  />
                  <span className="min-w-0">
                    <span className={cn('block text-body-sm', selected && 'font-semibold')}>
                      {t(`lines.asset.tabPanes.documents.scope.${entry}`)}
                    </span>
                    {/* What it will actually do, named. "Enterprise-wide" is an
                        abstraction until it says every asset in the organisation. */}
                    <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                      {t(`lines.asset.tabPanes.documents.scopeHint.${entry}`, {
                        asset: asset.name,
                        model: `${asset.vendor} ${asset.model}`,
                        site: asset.siteName,
                      })}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('lines.asset.tabPanes.documents.revisionLabel')}
            value={revision}
            onChange={(event) => setRevision(event.target.value)}
          />
          <Field
            label={t('lines.asset.tabPanes.documents.ownerLabel')}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />
        </div>

        <Field
          label={t('lines.asset.tabPanes.documents.tagsLabel')}
          hint={t('lines.asset.tabPanes.documents.tagsHint')}
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder={t('lines.asset.tabPanes.documents.tagsPlaceholder')}
        />

        <p className="m-0 rounded-sm bg-sunken px-3.5 py-2.5 text-body-sm text-ink-dim">
          {t('lines.asset.tabPanes.documents.willAppear', { where })}
        </p>
      </div>
    </ForgeDialog>
  )
}
