import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { DOC_SCOPES, useUploadDoc } from '@/features/dataFusion/documents'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * Upload a document, in four steps: File → Classify → Link objects → Metadata.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── Scope chooses the picker, rather than sitting beside it ───────────────
 * The prototype asks for a sharing scope on step 2 and then offers every kind of
 * link target on step 3, so it is possible to mark a document enterprise-wide
 * and attach it to one bodymaker — two fields describing one fact, free to
 * disagree. Here scope is not stored at all: it is READ from the links, and the
 * step 2 choice decides which tier step 3 lets you pick from. Choose Site and
 * you pick sites; choose Enterprise and there is nothing to pick, which is the
 * whole meaning of enterprise-wide.
 *
 * ── The wizard cannot mark its own upload verified ────────────────────────
 * There is no control for it and the server sets it false. Verification means
 * somebody checked the revision, and the person who just uploaded it has not.
 * The new row appears under the Unverified filter, which is correct rather than
 * unfinished.
 *
 * ── The dropzone accepts nothing, and says so ─────────────────────────────
 * No file is stored anywhere in this build. A dropzone that swallowed a real PDF
 * and then showed a register row with no file behind it would be worse than one
 * that is honest about being a placeholder.
 */

const STEPS = ['file', 'classify', 'link', 'metadata']

/** Which tier each scope links to. Enterprise links to nothing, by definition. */
const TIER_OF_SCOPE = { instance: 'asset', line: 'line', site: 'site', enterprise: null }

export function DocumentUploadDialog({ open, onClose, types, targets }) {
  const { t } = useTranslation(['app', 'common'])
  const upload = useUploadDoc()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [ocr, setOcr] = useState(true)
  const [type, setType] = useState('manual')
  const [scope, setScope] = useState('instance')
  const [links, setLinks] = useState([])
  const [rev, setRev] = useState('v1.0')
  const [owner, setOwner] = useState('Dana Okafor')
  const [date, setDate] = useState(today())
  const [tags, setTags] = useState('')
  const [expires, setExpires] = useState('')

  const tier = TIER_OF_SCOPE[scope]
  const options = tier ? (targets?.[tier] ?? []) : []

  function reset() {
    setStep(0)
    setName('')
    setOcr(true)
    setType('manual')
    setScope('instance')
    setLinks([])
    setRev('v1.0')
    setOwner('Dana Okafor')
    setDate(today())
    setTags('')
    setExpires('')
    upload.reset()
  }

  function close() {
    onClose()
    reset()
  }

  /* Each step names its own precondition. A Continue button that is enabled and
     then complains is one press wasted; disabled with the reason above it is
     the arrangement the import wizard already uses. */
  const canContinue =
    step === 0
      ? name.trim().length > 2
      : step === 2
        ? scope === 'enterprise' || links.length > 0
        : true

  function submit() {
    upload.mutate(
      {
        name: name.trim(),
        type,
        links: links.map((id) => ({ k: tier, id })),
        rev: rev.trim(),
        owner,
        date,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        expires: expires || undefined,
        ocr,
      },
      { onSuccess: close },
    )
  }

  const toggle = (id) =>
    setLinks((held) => (held.includes(id) ? held.filter((one) => one !== id) : [...held, id]))

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      size="lg"
      title={t('dataFusion.docs.upload.title')}
      footer={
        <>
          <ForgeButton onClick={step === 0 ? close : () => setStep(step - 1)}>
            {t(step === 0 ? 'common:actions.cancel' : 'common:actions.back')}
          </ForgeButton>
          <span className="flex-1" />
          {step < STEPS.length - 1 ? (
            <ForgeButton
              variant="primary"
              disabled={!canContinue}
              onClick={() => setStep(step + 1)}
            >
              {t('common:actions.continue')}
              <Icon name="right" size="xs" className="rtl:rotate-180" />
            </ForgeButton>
          ) : (
            <ForgeButton variant="primary" disabled={upload.isPending} onClick={submit}>
              {t('dataFusion.docs.upload.submit')}
            </ForgeButton>
          )}
        </>
      }
    >
      <Steps step={step} t={t} />

      {step === 0 ? (
        <div className="mt-5">
          {/* Not an input. Nothing here stores a file, and a dropzone that
              accepted one would produce a register row with nothing behind it. */}
          <div className="flex flex-col items-center gap-1.5 rounded-sm border border-dashed border-hairline bg-sunken px-5 py-8 text-center">
            <Icon name="doc" size="lg" className="text-ink-mute" />
            <p className="m-0 mt-1 text-body font-semibold text-ink">
              {t('dataFusion.docs.upload.dropzone')}
            </p>
            <p className="m-0 text-body-sm text-ink-dim">
              {t('dataFusion.docs.upload.dropzoneHint')}
            </p>
            <p className="m-0 mt-1.5 text-micro font-normal text-ink-mute">
              {t('dataFusion.docs.upload.dropzoneDemo')}
            </p>
          </div>

          <Field
            className="mt-4"
            label={t('dataFusion.docs.upload.nameLabel')}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('dataFusion.docs.upload.namePlaceholder')}
          />

          <label className="mt-4 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={ocr}
              onChange={(event) => setOcr(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-forge"
            />
            <span className="min-w-0">
              <span className="block text-body-sm text-ink">
                {t('dataFusion.docs.upload.ocrLabel')}
              </span>
              <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                {t('dataFusion.docs.upload.ocrHint')}
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-5">
          <Eyebrow className="mb-2">{t('dataFusion.docs.upload.typeLabel')}</Eyebrow>
          <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            {(types ?? []).map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={type === entry.id}
                onClick={() => setType(entry.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-sm border px-3 py-2.5 text-start transition-colors',
                  type === entry.id
                    ? 'border-forge tint-forge font-semibold text-ink'
                    : 'border-hairline bg-card text-ink-dim hover:border-forge/40',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-xs',
                    entry.tone ? TINT_CLASS[entry.tone] : 'bg-sunken',
                  )}
                >
                  <Icon
                    name={entry.icon}
                    size="xs"
                    className={entry.tone ? ON_TINT_CLASS[entry.tone] : 'text-ink-mute'}
                  />
                </span>
                <span className="min-w-0 text-body-sm">
                  {t(`lines.asset.tabPanes.documents.kind.${entry.id}`)}
                </span>
              </button>
            ))}
          </div>

          <Eyebrow className="mt-5 mb-2">{t('dataFusion.docs.upload.scopeLabel')}</Eyebrow>
          <div className="flex flex-col gap-1.5">
            {DOC_SCOPES.map((entry) => (
              <label
                key={entry}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-sm border px-3 py-2.5 transition-colors',
                  scope === entry
                    ? 'border-forge tint-forge'
                    : 'border-hairline bg-card hover:border-forge/40',
                )}
              >
                <input
                  type="radio"
                  name="doc-scope"
                  checked={scope === entry}
                  onChange={() => {
                    setScope(entry)
                    // The picker changes tier, so anything already chosen points
                    // at the wrong kind of thing.
                    setLinks([])
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-forge"
                />
                <span className="min-w-0">
                  <span className="block text-body-sm font-semibold text-ink">
                    {t(`dataFusion.docs.scope.${entry}`)}
                  </span>
                  <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                    {t(`dataFusion.docs.upload.scopeHint.${entry}`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-5">
          {tier ? (
            <>
              <Eyebrow className="mb-1.5">
                {t(`dataFusion.docs.upload.pick.${scope}`)}
              </Eyebrow>
              <p className="mt-0 mb-3 max-w-[60ch] text-body-sm text-ink-dim">
                {t('dataFusion.docs.upload.pickHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <Chip
                    key={option.id}
                    selected={links.includes(option.id)}
                    onClick={() => toggle(option.id)}
                  >
                    {option.name}
                  </Chip>
                ))}
              </div>
              {links.length === 0 ? (
                <p className="mt-3 mb-0 text-body-sm text-on-amber">
                  {t('dataFusion.docs.upload.pickRequired')}
                </p>
              ) : (
                <p className="mt-3 mb-0 text-body-sm text-ink-dim">
                  <Num>{t('dataFusion.docs.upload.picked', { count: links.length })}</Num>
                </p>
              )}
            </>
          ) : (
            <div className="rounded-sm border border-hairline bg-sunken px-4 py-5">
              <p className="m-0 text-body-sm text-ink">
                {t('dataFusion.docs.upload.enterpriseTitle')}
              </p>
              <p className="mt-1.5 mb-0 max-w-[60ch] text-body-sm text-ink-dim">
                {t('dataFusion.docs.upload.enterpriseBody')}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
          <Field
            label={t('dataFusion.docs.upload.revLabel')}
            value={rev}
            onChange={(event) => setRev(event.target.value)}
          />
          <Field
            label={t('dataFusion.docs.upload.ownerLabel')}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />
          <Field
            label={t('dataFusion.docs.upload.dateLabel')}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Field
            label={t('dataFusion.docs.upload.expiresLabel')}
            type="date"
            value={expires}
            onChange={(event) => setExpires(event.target.value)}
            hint={t('dataFusion.docs.upload.expiresHint')}
          />
          <Field
            className="col-span-2 max-sm:col-span-1"
            label={t('dataFusion.docs.upload.tagsLabel')}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder={t('dataFusion.docs.upload.tagsPlaceholder')}
            hint={t('dataFusion.docs.upload.tagsHint')}
          />

          <p className="col-span-2 m-0 max-w-[60ch] border-t border-subtle pt-3 text-micro font-normal text-ink-dim max-sm:col-span-1">
            {t('dataFusion.docs.upload.verifiedNote')}
          </p>

          {upload.isError ? (
            <p className="col-span-2 m-0 text-body-sm text-on-red max-sm:col-span-1">
              {t('dataFusion.docs.upload.failed')}
            </p>
          ) : null}
        </div>
      ) : null}
    </ForgeDialog>
  )
}

/** Today, as the `yyyy-mm-dd` a date input wants. */
function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** The same step indicator the bulk-import wizard uses. */
function Steps({ step, t }) {
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-2 p-0">
      {STEPS.map((entry, index) => {
        const done = index < step
        const current = index === step
        return (
          <li key={entry} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-bold',
                current && 'bg-forge text-white',
                !done && !current && 'border border-hairline bg-card text-ink-mute',
              )}
              style={done ? { background: 'var(--hue-green)', color: 'var(--print-white)' } : undefined}
            >
              {done ? <Icon name="check" size="xs" /> : <Num>{index + 1}</Num>}
            </span>
            <span
              className={cn('text-body-sm', current ? 'font-semibold text-ink' : 'text-ink-dim')}
              aria-current={current ? 'step' : undefined}
            >
              {t(`dataFusion.docs.upload.steps.${entry}`)}
            </span>
            {index < STEPS.length - 1 ? (
              <span aria-hidden="true" className="mx-1 h-px w-6 bg-hairline" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
