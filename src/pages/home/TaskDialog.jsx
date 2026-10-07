import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { SeverityBadge } from '@/components/forge/StatusBadge'
import { Mono } from '@/components/forge/primitives'
import { TASK_PRIORITIES, TASK_STATUSES } from '@/features/tasks/api'

/**
 * Create, assign and edit — one dialog, three modes.
 *
 * The prototype has three too, and they are the same form. The differences are
 * the title, whether Status is offered, and what the confirm button says; every
 * field is otherwise identical. Three components would be three places for the
 * asset list to drift apart.
 *
 * `mode` is `'create' | 'assign' | 'edit'`.
 *
 * ── Assign is not just create with a different label ───────────────────────
 * It defaults the assignee to somebody else rather than to you, and its confirm
 * button says it will notify them. That is the whole distinction the prototype
 * draws, and it is a real one: delegating is a different act from writing
 * yourself a note.
 */

/** Where the datetime-local control starts when nothing is set. Today at 18:00,
    which is the end of a working shift rather than an arbitrary midnight. */
function defaultDueAt() {
  const date = new Date()
  date.setHours(18, 0, 0, 0)
  // `toISOString` is UTC and `datetime-local` is not, so the offset has to come
  // off or the field opens on the wrong hour for everyone outside GMT.
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function TaskDialog({ open, mode, task, people, assets, self, pending, onClose, onSave }) {
  const { t } = useTranslation(['app', 'common'])

  const isEdit = mode === 'edit'
  const isAssign = mode === 'assign'

  const [title, setTitle] = useState(task?.title ?? '')
  const [assetId, setAssetId] = useState(task?.assetId ?? assets[0]?.id ?? '')
  const [priority, setPriority] = useState(task?.priority ?? 'medium')
  const [dueAt, setDueAt] = useState(task?.dueAt ?? defaultDueAt())
  const [assignee, setAssignee] = useState(
    task?.assignee ?? (isAssign ? (people.find((p) => p.id !== self)?.id ?? self) : self),
  )
  const [status, setStatus] = useState(task?.status ?? 'open')

  const valid = title.trim().length > 2 && Boolean(assetId)
  const assigneeName = people.find((person) => person.id === assignee)?.name ?? ''

  function submit() {
    if (!valid) return
    onSave({
      id: task?.id,
      title: title.trim(),
      assetId,
      assetName: assets.find((asset) => asset.id === assetId)?.name ?? '',
      priority,
      dueAt,
      assignee,
      status: isEdit ? status : 'open',
      // A task raised by hand records that it was, rather than pretending the
      // platform surfaced it.
      source: task?.source ?? { kind: isAssign ? 'delegated' : 'manual', ref: null },
      assigneeName,
    })
  }

  const titleKey = isEdit ? 'editTitle' : isAssign ? 'assignTitle' : 'createTitle'
  const descriptionKey = isEdit ? 'editDescription' : isAssign ? 'assignDescription' : 'createDescription'
  const confirmLabel = isEdit
    ? t('common:actions.save')
    : isAssign
      ? t('tasks.dialog.assignAndNotify')
      : t('tasks.dialog.create')

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t(`tasks.dialog.${titleKey}`)}
      description={t(`tasks.dialog.${descriptionKey}`)}
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <div className="flex-1" />
          <ForgeButton variant="primary" disabled={!valid || pending} onClick={submit}>
            {confirmLabel}
          </ForgeButton>
        </>
      }
    >
      {isEdit && task ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-body-sm text-ink-dim">
          <Mono>{task.id}</Mono>
          <SeverityBadge severity={task.priority} />
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        <Field
          label={t('tasks.dialog.titleField')}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('tasks.dialog.titlePlaceholder')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <ForgeSelect
            label={t('tasks.dialog.assetField')}
            value={assetId}
            onValueChange={setAssetId}
            options={assets.map((asset) => ({ value: asset.id, label: asset.name }))}
          />
          <ForgeSelect
            label={t('tasks.dialog.priorityField')}
            value={priority}
            onValueChange={setPriority}
            options={TASK_PRIORITIES.map((value) => ({
              value,
              label: t(`common:severity.${value}`),
            }))}
          />
          <Field
            type="datetime-local"
            label={t('tasks.dialog.dueField')}
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
          <ForgeSelect
            label={t('tasks.dialog.assigneeField')}
            value={assignee}
            onValueChange={setAssignee}
            options={people.map((person) => ({ value: person.id, label: person.name }))}
          />
          {isEdit ? (
            <ForgeSelect
              label={t('tasks.dialog.statusField')}
              value={status}
              onValueChange={setStatus}
              options={TASK_STATUSES.map((value) => ({
                value,
                label: t(`tasks.status.${value}`),
              }))}
            />
          ) : null}
        </div>

        {/* The prototype's cross-links: from a task to the thing it is about.
            Only on edit, because a task being written does not have a source
            yet. */}
        {isEdit && task ? (
          <div className="flex flex-wrap gap-2 border-t border-subtle pt-4">
            <ForgeButton asChild size="sm">
              <Link to="/app/assets">
                {t('tasks.dialog.viewAsset')}
                <Icon name="right" size="xs" className="mirror-rtl" />
              </Link>
            </ForgeButton>
            {task.source?.kind === 'workOrder' ? (
              <ForgeButton asChild size="sm">
                <Link to="/app/work-orders">
                  {t('tasks.dialog.openWorkOrder')}
                  <Icon name="right" size="xs" className="mirror-rtl" />
                </Link>
              </ForgeButton>
            ) : null}
            {task.source?.kind === 'anomaly' ? (
              <ForgeButton asChild size="sm">
                <Link to="/app/anomalies">
                  {t('tasks.dialog.openAnomaly')}
                  <Icon name="right" size="xs" className="mirror-rtl" />
                </Link>
              </ForgeButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </ForgeDialog>
  )
}
