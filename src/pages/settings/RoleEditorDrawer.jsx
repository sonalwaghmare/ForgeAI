import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, TextArea } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDrawer } from '@/components/forge/ForgeDrawer'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { useSaveRole } from '@/features/people/queries'
import { useToast } from '@/providers/ToastProvider'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * Create or edit a custom role.
 *
 * DEMO. See `DEMO-MODE.md` §8.15.
 *
 * ── A system role opens here only as a copy ───────────────────────────────
 * Duplicating one is how you get an editable version, and the copy starts with
 * its grants so the common case — "the same as a technician, plus the audit
 * log" — is two clicks rather than thirty-nine.
 *
 * ── The count above the grid is what the role will actually reach ─────────
 * Not the number of ticks. Ticking `workOrders.approve` without
 * `workOrders.view` grants the right to approve a screen nobody can open, and
 * the header says so as it happens rather than leaving it to be discovered by
 * somebody who cannot find the module.
 */

const NO_TONE = '__none__'
const TONES = ['forge', 'ack', 'green', 'amber', 'violet', 'watch', 'dismissed', 'red']

export function RoleEditorDrawer({ request, catalogue, onClose, onSaved }) {
  if (!request) return null
  return (
    <Editor
      key={`${request.mode}-${request.role?.id ?? 'new'}`}
      request={request}
      catalogue={catalogue}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function Editor({ request, catalogue, onClose, onSaved }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const save = useSaveRole()

  const source = request.role ?? null
  const duplicating = request.mode === 'duplicate'
  const editing = request.mode === 'edit'

  const [name, setName] = useState(() =>
    duplicating
      ? t('settings.roles.copyOf', {
          name: source.system ? t(`common:roles.${source.id}`) : source.name,
        })
      : (source?.name ?? ''),
  )
  const [description, setDescription] = useState(() =>
    duplicating
      ? (source.system ? t(`settings.roles.descriptions.${source.id}`) : source.description) ?? ''
      : (source?.description ?? ''),
  )
  const [tone, setTone] = useState(source?.tone ?? NO_TONE)
  const [grant, setGrant] = useState(() => ({ ...(source?.grant ?? {}) }))

  const keys = catalogue.flatMap((module) => module.features.map((f) => `${module.id}.${f}`))
  const count = keys.filter((key) => grant[key]).length
  const reaches = catalogue.filter((module) => grant[`${module.id}.${module.gate}`]).length

  /* Ticks that do nothing because the module cannot be opened. Reported rather
     than silently corrected: a grid that switched `view` on for you would be a
     grid that does not do what it shows. */
  const orphaned = catalogue.filter(
    (module) =>
      !grant[`${module.id}.${module.gate}`] &&
      module.features.some((feature) => grant[`${module.id}.${feature}`]),
  ).length

  function toggle(key) {
    setGrant((current) => ({ ...current, [key]: !current[key] }))
  }

  function toggleModule(module) {
    const moduleKeys = module.features.map((f) => `${module.id}.${f}`)
    const allOn = moduleKeys.every((key) => grant[key])
    setGrant((current) => {
      const next = { ...current }
      for (const key of moduleKeys) next[key] = !allOn
      return next
    })
  }

  function preset(kind) {
    if (kind === 'none') return setGrant({})
    if (kind === 'all') return setGrant(Object.fromEntries(keys.map((key) => [key, true])))
    setGrant(
      Object.fromEntries(
        catalogue
          .filter((module) => module.id !== 'settings')
          .map((module) => [`${module.id}.${module.gate}`, true]),
      ),
    )
  }

  function submit() {
    save.mutate(
      {
        id: editing ? source.id : undefined,
        name: name.trim(),
        description: description.trim() || null,
        tone: tone === NO_TONE ? null : tone,
        grant,
      },
      {
        onSuccess: (role) => {
          toast(t(editing ? 'settings.roles.updated' : 'settings.roles.created'), 'ok')
          onSaved(role)
          onClose()
        },
      },
    )
  }

  return (
    <ForgeDrawer
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={
        editing
          ? t('settings.roles.editTitle', { name: source.name })
          : t('settings.roles.createTitle')
      }
      closeLabel={t('common:actions.close')}
      className="w-[min(38rem,100vw)]"
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <span className="flex-1" />
          <ForgeButton
            variant="primary"
            disabled={!name.trim() || save.isPending}
            onClick={submit}
          >
            {save.isPending
              ? t('settings.roles.saving')
              : editing
                ? t('common:actions.save')
                : t('settings.roles.create')}
          </ForgeButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          id="role-name"
          label={t('settings.roles.fields.name')}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextArea
          id="role-description"
          label={t('settings.roles.fields.description')}
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          hint={t('settings.roles.descriptionHint')}
        />

        <div>
          <Eyebrow className="mb-1.5">{t('settings.roles.fields.tone')}</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {[NO_TONE, ...TONES].map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={tone === entry}
                onClick={() => setTone(entry)}
                className={cn(
                  'rounded-pill border px-2.5 py-[3px] text-micro',
                  entry === NO_TONE
                    ? 'bg-sunken text-ink-dim'
                    : cn(TINT_CLASS[entry], ON_TINT_CLASS[entry]),
                  tone === entry ? 'border-forge' : 'border-transparent',
                )}
              >
                {entry === NO_TONE
                  ? t('settings.roles.noTone')
                  : t(`settings.roles.tones.${entry}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-5 border-t border-hairline px-5 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow className="me-1">{t('settings.roles.startFrom')}</Eyebrow>
            {['all', 'view', 'none'].map((kind) => (
              <ForgeButton key={kind} size="sm" onClick={() => preset(kind)}>
                {t(`settings.roles.presets.${kind}`)}
              </ForgeButton>
            ))}
            <Num className="ms-auto text-body-sm text-ink-dim">
              {count} / {keys.length}
            </Num>
          </div>

          {/* Says it as it happens rather than leaving it to be found by
              somebody who cannot open the module they were given rights on. */}
          {orphaned ? (
            <p className="mt-2.5 mb-0 rounded-sm border border-hairline stripe-amber bg-card px-3 py-2 text-micro font-normal text-on-amber">
              <Num>{t('settings.roles.orphaned', { count: orphaned })}</Num>
            </p>
          ) : (
            <p className="mt-2.5 mb-0 text-micro font-normal text-ink-mute">
              <Num>
                {t('settings.roles.willReach', { count: reaches, total: catalogue.length })}
              </Num>
            </p>
          )}
        </div>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {catalogue.map((module) => {
            const moduleKeys = module.features.map((f) => `${module.id}.${f}`)
            const on = moduleKeys.filter((key) => grant[key]).length
            const all = on === moduleKeys.length
            return (
              <li key={module.id} className="rounded-sm border border-hairline bg-card p-3">
                <div className="flex items-center gap-2.5">
                  <Icon
                    name={module.icon}
                    size="sm"
                    className={on ? 'text-on-forge' : 'text-ink-mute'}
                  />
                  <span className="flex-1 text-body-sm font-semibold text-ink">
                    {t(`screens.${module.id}`)}
                  </span>
                  <Num className="text-micro font-normal text-ink-dim">
                    {on} / {moduleKeys.length}
                  </Num>
                  <ForgeButton size="sm" onClick={() => toggleModule(module)}>
                    {t(all ? 'settings.roles.clear' : 'settings.roles.all')}
                  </ForgeButton>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5 ps-7">
                  {module.features.map((feature) => {
                    const key = `${module.id}.${feature}`
                    const granted = Boolean(grant[key])
                    const gate = feature === module.gate
                    return (
                      <button
                        key={feature}
                        type="button"
                        aria-pressed={granted}
                        onClick={() => toggle(key)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-pill border px-2.5 py-[3px] text-micro whitespace-nowrap transition-colors',
                          granted
                            ? cn(TINT_CLASS.green, ON_TINT_CLASS.green, 'border-transparent')
                            : 'border-hairline text-ink-dim hover:bg-sunken',
                        )}
                      >
                        <Icon name={granted ? 'check' : 'plus'} size="xs" />
                        {t(`settings.roles.features.${feature}`)}
                        {/* Marked, because it is the one that decides whether
                            any of the others can be exercised. */}
                        {gate ? (
                          <span className="text-ink-mute">{t('settings.roles.gateMark')}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </ForgeDrawer>
  )
}
