import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Chip } from '@/components/forge/Chip'
import { Icon } from '@/components/forge/Icon'
import { Num } from '@/components/forge/primitives'
import { NOTIFY_CHANNEL_IDS, RULE_EDGES, RULE_SEVERITIES } from '@/features/notifications/api'

/**
 * New alert rule.
 *
 * DEMO. See `DEMO-MODE.md` §8.8.
 *
 * ── The threshold is shown, not asked for ─────────────────────────────────
 * This is the whole argument of the module in one dialog. The prototype's rule
 * form takes the condition as free text — `VIB > 40 mm/s` — so a rule can state
 * a limit no detector uses, and its own alert fixture trips at a different
 * number. Here the reader picks a SENSOR and the dialog shows the threshold
 * that rule will use, read from the plant's signal specification. There is
 * nothing to type and therefore nothing to get wrong.
 *
 * Both unit systems appear, because the plant has both and they are never
 * converted into one another.
 *
 * ── An unconnected channel can still be chosen ────────────────────────────
 * Deliberately. Routing to PagerDuty before PagerDuty is wired up is a normal
 * thing to do while setting a plant up; the rules table then says the rule is
 * undeliverable until somebody finishes the job. Blocking it here would just
 * mean the rule never gets written.
 */
/**
 * @param {object} [props.rule] An existing rule, when editing.
 *   Its KIND is locked: a rule that changed what it watches is a different rule
 *   and its id would be lying. The select is still shown, disabled, because
 *   hiding it would make the edit form a different form from the create one.
 */
export function RuleFormDialog({ open, kinds, pending, rule, onClose, onSubmit }) {
  const { t } = useTranslation(['app', 'common'])
  const editing = Boolean(rule)
  const [kind, setKind] = useState(rule?.kind ?? '')
  const [edge, setEdge] = useState(rule?.edge ?? 'above')
  const [severity, setSeverity] = useState(rule?.severity ?? 'high')
  const [routes, setRoutes] = useState(rule?.routes ?? ['teams'])

  const picked = kinds.find((entry) => entry.kind === kind) ?? null
  const ready = Boolean(kind) && routes.length > 0

  const toggleRoute = (id) =>
    setRoutes((held) => (held.includes(id) ? held.filter((x) => x !== id) : [...held, id]))

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t(editing ? 'notifications.form.editTitle' : 'notifications.form.title')}
      size="md"
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('notifications.form.cancel')}</ForgeButton>
          <ForgeButton
            variant="primary"
            disabled={!ready || pending}
            onClick={() => onSubmit({ kind, edge, severity, routes })}
          >
            {t(editing ? 'notifications.form.save' : 'notifications.form.submit')}
          </ForgeButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ForgeSelect
          label={t('notifications.form.kind')}
          hint={t('notifications.form.kindHint')}
          required
          value={kind}
          disabled={editing}
          onValueChange={setKind}
          placeholder={t('notifications.form.kindPlaceholder')}
          options={kinds.map((entry) => ({
            value: entry.kind,
            label: t('notifications.form.kindOption', {
              name: entry.name,
              count: entry.channels,
            }),
          }))}
        />

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))]">
          <ForgeSelect
            label={t('notifications.form.edge')}
            value={edge}
            onValueChange={setEdge}
            options={RULE_EDGES.map((value) => ({
              value,
              label: t(`notifications.rule.edge.${value}`),
            }))}
          />
          <ForgeSelect
            label={t('notifications.form.severity')}
            value={severity}
            onValueChange={setSeverity}
            options={RULE_SEVERITIES.map((value) => ({
              value,
              label: t(`common:severity.${value}`),
            }))}
          />
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1.5 p-0 text-control text-ink">
            {t('notifications.form.routes')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {NOTIFY_CHANNEL_IDS.map((id) => (
              <Chip key={id} selected={routes.includes(id)} onClick={() => toggleRoute(id)}>
                {t(`notifications.channel.${id}`)}
              </Chip>
            ))}
          </div>
          <p className="m-0 mt-1.5 text-micro font-normal text-ink-dim">
            {t('notifications.form.routesHint')}
          </p>
        </fieldset>

        {/* The point of the dialog. Not a field. */}
        <div className="rounded-sm bg-sunken px-3 py-2.5">
          <p className="m-0 flex flex-wrap items-center gap-2 text-body-sm">
            <Icon name="shield" size="xs" className="text-ink-mute" />
            <Num>
              {picked
                ? t('notifications.form.thresholdPreview', {
                    /* The edge decides which end of the band is the limit, so
                       the preview moves when the reader flips Above/Below —
                       which is the only way to see that the two are one
                       decision rather than two fields. */
                    values: (picked.bands ?? [])
                      .map(
                        (band) => `${edge === 'below' ? band.low : band.high} ${band.unit}`,
                      )
                      .join(' · '),
                  })
                : t('notifications.form.thresholdUnknown')}
            </Num>
          </p>
          {picked ? (
            <p className="m-0 mt-1 text-micro font-normal text-ink-dim">
              {t('notifications.form.thresholdNote')}
            </p>
          ) : null}
        </div>
      </div>
    </ForgeDialog>
  )
}
