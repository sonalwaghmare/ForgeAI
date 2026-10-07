import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDrawer } from '@/components/forge/ForgeDrawer'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'
import {
  DOW_ORDER,
  GRACE_OPTIONS,
  PATTERN_ICONS,
  PATTERN_PRESETS,
  PATTERN_TONES,
  SHIFT_SITES,
  SITE_TIME_ZONE,
  crossesMidnight,
  overlappingPatterns,
  patternDuration,
} from './shiftMasterData'

/**
 * Add or edit one shift pattern.
 *
 * DEMO. Four sections, as the design has them: Identity, Timing, Days
 * Applicable, Scope & Detection — then the conflict notice and the validation
 * notice above a Delete / Cancel / Save footer.
 *
 * ── A drawer, not a dialog ────────────────────────────────────────────────
 * The design draws it as a 520px panel over the pattern grid, and the reason it
 * is right is that the overlap warning is about the OTHER cards: you edit a
 * window while looking at the ones it might collide with. `ForgeDrawer` is the
 * repo's object for exactly that and brings the focus trap with it.
 *
 * ── The warnings are computed, not decorative ─────────────────────────────
 * The overlap notice re-runs against the live pattern list on every keystroke,
 * so it appears and clears as the times move. The preset-mismatch notice fires
 * when a pattern named "Night" is given hours that are not the Night preset's —
 * a name that lies about its window is the failure this screen exists to stop.
 */
export function ShiftPatternDrawer({ open, pattern, patterns, onClose, onSave, onDelete }) {
  const { t } = useTranslation(['app', 'common'])
  const [form, setForm] = useState(pattern)

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const isNew = !form.id
  const duration = patternDuration(form.start || '00:00', form.end || '00:00')
  const wraps = Boolean(form.start && form.end && crossesMidnight(form.start, form.end))
  const conflicts = form.start && form.end ? overlappingPatterns(form, patterns) : []

  /* "Night" that does not run the Night hours. The preset is the plant's own
     vocabulary, so a pattern that borrows the word and not the window is how a
     login gets attributed to a shift nobody worked. */
  const preset = PATTERN_PRESETS.find(
    (entry) => entry.name.toLowerCase() === (form.name || '').trim().toLowerCase(),
  )
  const mismatch = Boolean(preset && form.start && preset.start !== form.start)

  const error = !form.name.trim()
    ? t('shifts.master.error.name')
    : !form.start || !form.end
      ? t('shifts.master.error.times')
      : form.start === form.end
        ? t('shifts.master.error.identical')
        : !form.days.length
          ? t('shifts.master.error.days')
          : null

  return (
    <ForgeDrawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      className="w-[min(33rem,100vw)]"
      title={isNew ? t('shifts.master.drawer.addTitle') : t('shifts.master.drawer.editTitle')}
      closeLabel={t('common:actions.close')}
      footer={
        <>
          {isNew ? null : (
            <ForgeButton variant="danger" onClick={() => onDelete(form.id)}>
              {t('common:actions.delete')}
            </ForgeButton>
          )}
          <div className="flex-1" />
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <ForgeButton variant="primary" disabled={Boolean(error)} onClick={() => onSave(form)}>
            {t('shifts.master.drawer.save')}
          </ForgeButton>
        </>
      }
    >
      <p className="mt-0 mb-4 text-body-sm text-ink-dim">{t('shifts.master.drawer.lead')}</p>

      <Section icon="cal" title={t('shifts.master.identity')} sub={t('shifts.master.identitySub')}>
        <Eyebrow as="p" className="mb-2">
          {t('shifts.master.presets')}
        </Eyebrow>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PATTERN_PRESETS.map((entry) => (
            <Chip
              key={entry.name}
              selected={form.name === entry.name}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  name: entry.name,
                  icon: entry.icon,
                  tone: entry.tone,
                  start: entry.start,
                  end: entry.end,
                }))
              }
            >
              <Icon name={entry.icon} size="xs" />
              {entry.name}
            </Chip>
          ))}
        </div>

        <Field
          label={t('shifts.master.field.name')}
          required
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          placeholder={t('shifts.master.field.namePlaceholder')}
        />

        <Eyebrow as="p" className="mt-4 mb-2">
          {t('shifts.master.field.icon')}
        </Eyebrow>
        <div className="flex flex-wrap gap-1.5">
          {PATTERN_ICONS.map((name) => (
            <Chip key={name} selected={form.icon === name} onClick={() => set('icon', name)}>
              <Icon name={name} size="xs" />
              <span className="sr-only">{t(`shifts.master.icon.${name}`)}</span>
            </Chip>
          ))}
        </div>

        <Eyebrow as="p" className="mt-4 mb-2">
          {t('shifts.master.field.tone')}
        </Eyebrow>
        <div className="flex flex-wrap gap-1.5">
          {PATTERN_TONES.map((tone) => (
            <button
              key={tone}
              type="button"
              aria-pressed={form.tone === tone}
              aria-label={t(`shifts.master.tone.${tone}`)}
              onClick={() => set('tone', tone)}
              className={cn(
                'flex size-7 items-center justify-center rounded-xs border transition-colors',
                TINT_CLASS[tone],
                form.tone === tone ? 'border-ink' : 'border-hairline',
              )}
            >
              {form.tone === tone ? (
                <Icon name="check" size="xs" className={ON_TINT_CLASS[tone]} />
              ) : null}
            </button>
          ))}
        </div>

        {mismatch ? (
          <p className="mt-3 mb-0 text-body-sm text-on-amber">
            {t('shifts.master.mismatch', {
              name: form.name,
              start: preset.start,
              end: preset.end,
            })}
          </p>
        ) : null}
      </Section>

      <Section icon="gauge" title={t('shifts.master.timing')} sub={t('shifts.master.timingSub')}>
        <div className="grid grid-cols-2 gap-3">
          <Field
            type="time"
            label={t('shifts.master.field.start')}
            required
            value={form.start}
            onChange={(event) => set('start', event.target.value)}
          />
          <Field
            type="time"
            label={t('shifts.master.field.end')}
            required
            value={form.end}
            onChange={(event) => set('end', event.target.value)}
          />
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-sm border border-hairline bg-sunken px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <Eyebrow as="p" className="mb-1">
              {t('shifts.master.duration')}
            </Eyebrow>
            <Num className="text-metric-sm">
              {form.start && form.end
                ? t('shifts.master.durationValue', {
                    hours: duration.hours,
                    minutes: duration.minutes,
                  })
                : '—'}
            </Num>
          </div>
          <Num className="text-body-sm text-ink-dim">
            {(form.start || '--:--') + ' → ' + (form.end || '--:--')}
          </Num>
        </div>

        {wraps ? (
          <p className="mt-3 mb-0 text-body-sm text-ink-dim">{t('shifts.master.wraps')}</p>
        ) : null}
      </Section>

      <Section icon="cal" title={t('shifts.master.days')} sub={t('shifts.master.daysSub')}>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          <Chip onClick={() => set('days', [...DOW_ORDER])}>{t('shifts.master.dayAll')}</Chip>
          <Chip onClick={() => set('days', [1, 2, 3, 4, 5])}>
            {t('shifts.master.dayWeekdays')}
          </Chip>
          <Chip onClick={() => set('days', [])}>{t('shifts.master.dayClear')}</Chip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DOW_ORDER.map((day) => (
            <Chip
              key={day}
              selected={form.days.includes(day)}
              onClick={() =>
                set(
                  'days',
                  form.days.includes(day)
                    ? form.days.filter((entry) => entry !== day)
                    : [...form.days, day],
                )
              }
              className="min-w-11 justify-center"
            >
              {t(`shifts.master.dow.${day}`)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section icon="factory" title={t('shifts.master.scope')} sub={t('shifts.master.scopeSub')}>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <ForgeSelect
            label={t('shifts.master.field.site')}
            value={form.site}
            onValueChange={(value) => set('site', value)}
            options={SHIFT_SITES.map((site) => ({ value: site.id, label: site.label }))}
          />
          <Field
            label={t('shifts.master.field.timeZone')}
            readOnly
            value={SITE_TIME_ZONE[form.site] ?? '—'}
          />
          <ForgeSelect
            label={t('shifts.master.field.grace')}
            value={String(form.grace)}
            onValueChange={(value) => set('grace', Number(value))}
            options={GRACE_OPTIONS.map((value) => ({
              value: String(value),
              label: t('shifts.master.graceValue', { minutes: value }),
            }))}
          />
          <div>
            <Eyebrow as="p" className="mb-2">
              {t('shifts.master.field.status')}
            </Eyebrow>
            <label className="flex cursor-pointer items-center gap-2 text-body-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => set('active', event.target.checked)}
                className="size-4 accent-[var(--hue-forge)]"
              />
              {t('shifts.master.statusActive')}
            </label>
          </div>
        </div>
        <p className="mt-2.5 mb-0 text-micro text-ink-mute">{t('shifts.master.graceHint')}</p>
      </Section>

      {conflicts.length ? (
        <p className="mb-3 rounded-sm border border-hairline tint-amber px-3.5 py-2.5 text-body-sm text-on-amber">
          {t('shifts.master.conflict', {
            names: conflicts
              .map((entry) => `${entry.name} (${entry.start}–${entry.end})`)
              .join(', '),
          })}
        </p>
      ) : null}

      {error ? (
        <p className="m-0 rounded-sm border border-hairline tint-red px-3.5 py-2.5 text-body-sm text-on-red">
          {error}
        </p>
      ) : null}
    </ForgeDrawer>
  )
}

function Section({ icon, title, sub, children }) {
  return (
    <section className="mb-4 rounded-sm border border-hairline bg-card p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-xs bg-sunken">
          <Icon name={icon} size="xs" className="text-ink-mute" />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-body-sm font-semibold text-ink">{title}</h3>
          <p className="m-0 text-micro text-ink-mute">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
