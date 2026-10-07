import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Field, TextArea } from '@/components/forge/Field'
import { Panel } from '@/components/forge/Panel'
import { Eyebrow } from '@/components/forge/primitives'

/**
 * The inline New Entry composer.
 *
 * DEMO. See `DEMO-MODE.md` §8.6. Inline over the feed rather than a modal,
 * which is the design's own call and the right one: writing a note is the
 * cheapest thing on this screen and should not interrupt reading it.
 *
 * ── The byline is not editable, and says so ───────────────────────────────
 * The design's composer heads itself "New logbook entry · Arjun Mehta · Night
 * shift" with both values hardcoded — the first operator in the array and the
 * literal string "Night", whatever time it is. Here both come down with the
 * list: the author is who the server will stamp, and the shift is the one
 * running now. Neither is a field, because neither is the writer's to choose.
 *
 * ── The machine is a select over the plant ────────────────────────────────
 * Same call as the work-order form. The prototype offers a two-option select
 * headed "Select equipment" and discards the answer; a note filed against a
 * machine the hierarchy does not have is a note no investigation will ever
 * find, which defeats the only reason the log is indexed.
 *
 * ── Nothing is submitted twice ────────────────────────────────────────────
 * The parent remounts this on close via `key`, so the fields are empty next
 * time without an effect resetting them — the arrangement `WorkOrderFormDialog`
 * arrived at after the lint rule caught a setState inside an effect.
 */
export function LogbookComposer({ author, shift, assets, pending, onSubmit, onCancel }) {
  const { t } = useTranslation(['app', 'common'])
  const [text, setText] = useState('')
  const [assetId, setAssetId] = useState('')
  const [tags, setTags] = useState('')
  const [touched, setTouched] = useState(false)

  const ready = text.trim().length > 0 && assetId !== ''

  const submit = (event) => {
    event.preventDefault()
    setTouched(true)
    if (!ready) return
    onSubmit({ assetId, text: text.trim(), tags })
  }

  return (
    <Panel stripe="forge" className="mb-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <Eyebrow as="h2">{t('logbook.composer.title')}</Eyebrow>
          <p className="m-0 mt-1 text-body-sm text-ink-dim">
            {author
              ? shift
                ? t('logbook.composer.byline', {
                    name: author.name,
                    shift: t(`shifts.type.${shift.type}`),
                  })
                : t('logbook.composer.bylineNoShift', { name: author.name })
              : null}
          </p>
          <p className="m-0 mt-0.5 text-micro font-normal text-ink-mute">
            {t('logbook.composer.bylineHint')}
          </p>
        </div>

        <TextArea
          label={t('logbook.composer.text')}
          hint={t('logbook.composer.textHint')}
          placeholder={t('logbook.composer.textPlaceholder')}
          rows={4}
          required
          value={text}
          onChange={(event) => setText(event.target.value)}
          error={touched && !text.trim() ? t('logbook.composer.required') : undefined}
        />

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
          <ForgeSelect
            label={t('logbook.composer.asset')}
            required
            value={assetId}
            onValueChange={setAssetId}
            placeholder={t('logbook.composer.assetPlaceholder')}
            options={assets.map((asset) => ({ value: asset.id, label: asset.name }))}
            error={touched && !assetId ? t('logbook.composer.required') : undefined}
          />
          <Field
            label={t('logbook.composer.tags')}
            hint={t('logbook.composer.tagsHint')}
            placeholder={t('logbook.composer.tagsPlaceholder')}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <ForgeButton type="button" onClick={onCancel}>
            {t('logbook.composer.cancel')}
          </ForgeButton>
          <ForgeButton type="submit" variant="primary" disabled={!ready || pending}>
            {t('logbook.composer.submit')}
          </ForgeButton>
        </div>
      </form>
    </Panel>
  )
}
