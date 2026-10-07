import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Eyebrow, Mono } from '@/components/forge/primitives'
import { WO_PRIORITIES } from '@/features/workOrders/api'

/**
 * Raise a work order, or edit one.
 *
 * DEMO. The design's fields — title, asset, priority, assignee, due, status,
 * source — minus the last two, and that removal is the point.
 *
 * **Status is not here.** The workflow owns it. A form that can set a new order
 * to Completed makes the six-column board decorative.
 *
 * **Source is not here either.** It is provenance: the AI badge means Forge AI
 * drafted the order, and a select would let anybody award themselves one. The
 * server stamps `human` on anything raised through this form and the dialog says
 * so, rather than silently dropping a field the design showed.
 *
 * **The asset is a select over the plant.** The prototype takes it as free text,
 * so "Comressor C-12" is a work order against nothing — and the board, the asset
 * page and the line rollups all quietly lose it.
 *
 * **The due date is a date.** The prototype's is a text box with the placeholder
 * "Jul 24", which stores a string that cannot be sorted, compared or gone
 * overdue.
 */
export function WorkOrderFormDialog({ open, order, prefill, assets, assignees, pending, onClose, onSubmit }) {
  const { t } = useTranslation(['app', 'common'])
  const editing = Boolean(order)

  /* The draft initialises once per opening. The PARENT gives this component a
     `key` that changes with the order it was opened on, so React remounts it
     and this runs again — rather than an effect that sets state during render,
     which is a cascading render and is what the lint rule is about. */
  const [form, setForm] = useState(() => initial(order, prefill))

  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))

  const valid = form.title.trim().length > 2 && Boolean(form.assetId)

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      size="md"
      title={editing ? t('workOrders.editTitle', { id: order.id }) : t('workOrders.newTitle')}
      footer={
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <ForgeButton
            variant="primary"
            disabled={!valid || pending}
            onClick={() =>
              onSubmit({
                ...form,
                dueInDays: daysFromToday(form.due),
                estimateHours: Number(form.estimateHours) || 1,
              })
            }
          >
            {editing ? t('workOrders.save') : t('workOrders.create')}
          </ForgeButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label={t('workOrders.form.title')}
          required
          value={form.title}
          onChange={(event) => set('title', event.target.value)}
          placeholder={t('workOrders.form.titlePlaceholder')}
        />

        <ForgeSelect
          label={t('workOrders.form.asset')}
          required
          value={form.assetId}
          onValueChange={(value) => set('assetId', value)}
          placeholder={t('workOrders.form.assetPlaceholder')}
          // Locked on edit: moving a work order to another machine is not an
          // edit, it is a different order. The same call `updateSensor` makes
          // about a sensor's parent.
          disabled={editing}
          hint={editing ? t('workOrders.form.assetLocked') : undefined}
          options={assets.map((asset) => ({ value: asset.id, label: `${asset.name} · ${asset.code}` }))}
        />

        <div>
          <Eyebrow className="mb-2">{t('workOrders.form.priority')}</Eyebrow>
          <div
            role="group"
            aria-label={t('workOrders.form.priority')}
            className="flex flex-wrap gap-1.5"
          >
            {WO_PRIORITIES.map((priority) => (
              <Chip
                key={priority}
                selected={form.priority === priority}
                onClick={() => set('priority', priority)}
              >
                {t(`workOrders.priority.${priority}`)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ForgeSelect
            label={t('workOrders.form.assignee')}
            value={form.assigneeId || 'none'}
            onValueChange={(value) => set('assigneeId', value === 'none' ? '' : value)}
            options={[
              { value: 'none', label: t('workOrders.unassigned') },
              ...assignees.map((person) => ({ value: person.id, label: person.name })),
            ]}
          />
          <Field
            label={t('workOrders.form.due')}
            type="date"
            value={form.due}
            onChange={(event) => set('due', event.target.value)}
          />
        </div>

        <Field
          label={t('workOrders.form.estimate')}
          type="number"
          min="0.5"
          step="0.5"
          value={form.estimateHours}
          onChange={(event) => set('estimateHours', event.target.value)}
          hint={t('workOrders.form.estimateHint')}
        />

        {/* Where the two dropped fields went, said out loud rather than left for
            somebody to notice. */}
        <p className="m-0 rounded-sm bg-sunken px-3.5 py-2.5 text-body-sm text-ink-dim">
          {editing
            ? t('workOrders.form.editNote', {
                state: t(`workOrders.state.${order.state}`),
              })
            : t('workOrders.form.createNote')}
        </p>

        {prefill?.alertId ? (
          <p className="m-0 flex flex-wrap items-center gap-2 text-body-sm text-ink-dim">
            {t('workOrders.form.fromAlert')} <Mono>{prefill.alertId}</Mono>
          </p>
        ) : null}
      </div>
    </ForgeDialog>
  )
}

/** Today plus n days, as the `yyyy-mm-dd` a date input wants. */
function isoDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

/** Whole days between today and the picked date. Negative is overdue. */
function daysFromToday(value) {
  if (!value) return 7
  const picked = new Date(`${value}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((picked.getTime() - today.getTime()) / 86_400_000)
}

function initial(order, prefill) {
  if (order) {
    return {
      title: order.titleText ?? '',
      assetId: order.assetId ?? '',
      priority: order.priority ?? 'medium',
      assigneeId: order.assigneeId ?? '',
      due: isoDate(order.dueInDays ?? 7),
      estimateHours: String(order.estimateHours ?? 1),
      alertId: order.alertId ?? null,
    }
  }
  return {
    title: prefill?.title ?? '',
    assetId: prefill?.assetId ?? '',
    priority: prefill?.priority ?? 'medium',
    assigneeId: '',
    due: isoDate(7),
    estimateHours: '1',
    alertId: prefill?.alertId ?? null,
  }
}
