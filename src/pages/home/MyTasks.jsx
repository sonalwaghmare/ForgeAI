import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { SeverityBadge } from '@/components/forge/StatusBadge'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useTaskMutation, useTasks } from '@/features/tasks/queries'
import { useToast } from '@/providers/ToastProvider'
import { formatDateTime, formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'
import { TaskDialog } from './TaskDialog'

/**
 * My tasks — the shift's work list, from the prototype's My Dashboard.
 *
 * DEMO. Read and write: create, assign, edit, and tick off.
 *
 * ── Who "me" is ────────────────────────────────────────────────────────────
 * The filter is by person id, not by display name. Matching on a name works
 * until two people share a first initial, and the bug it produces — a task
 * quietly disappearing from someone's list — is invisible until they miss it.
 */

/** Which of the three filters a task belongs to. */
const FILTERS = {
  mine: (task, self) => task.assignee === self,
  open: (task) => task.status !== 'done',
  all: () => true,
}

const STATUS_TONE = { open: 'forge', inProgress: 'ack', done: 'green' }

export function MyTasks() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const tasks = useTasks()
  const mutation = useTaskMutation()

  const [filter, setFilter] = useState('mine')
  // `null` closed; otherwise `{ mode, task }`. One piece of state rather than an
  // open flag plus a mode plus a subject, which can disagree with each other.
  const [dialog, setDialog] = useState(null)

  // Memoised so the identity is stable between renders — the counts below
  // depend on it, and a fresh `[]` on every render would recompute them forever.
  const items = useMemo(() => tasks.data?.items ?? [], [tasks.data])
  const people = tasks.data?.people ?? []
  const assets = tasks.data?.assets ?? []
  const self = tasks.data?.self ?? null

  const counts = useMemo(
    () => ({
      mine: items.filter((task) => FILTERS.mine(task, self)).length,
      open: items.filter(FILTERS.open).length,
      all: items.length,
    }),
    [items, self],
  )

  const shown = items.filter((task) => FILTERS[filter](task, self))

  function save(task) {
    const person = people.find((entry) => entry.id === task.assignee)
    mutation.mutate(task, {
      onSuccess: () => {
        setDialog(null)
        toast(
          task.id
            ? t('tasks.toast.updated')
            : t('tasks.toast.created', { name: person?.name ?? '' }),
        )
      },
      onError: () => toast(t('tasks.toast.failed'), 'error'),
    })
  }

  function toggleDone(task) {
    const next = task.status === 'done' ? 'open' : 'done'
    mutation.mutate(
      { ...task, status: next },
      {
        onSuccess: () => toast(next === 'done' ? t('tasks.toast.done') : t('tasks.toast.reopened')),
        onError: () => toast(t('tasks.toast.failed'), 'error'),
      },
    )
  }

  return (
    <>
      <Panel flush>
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3">
          <Eyebrow>{t('tasks.title')}</Eyebrow>

          <div role="group" aria-label={t('tasks.filters.label')} className="flex flex-wrap gap-1.5">
            {['mine', 'open', 'all'].map((id) => (
              <Chip key={id} selected={filter === id} onClick={() => setFilter(id)}>
                {t(`tasks.filters.${id}`)}
                <Num className="text-ink-mute">{formatInteger(counts[id])}</Num>
              </Chip>
            ))}
          </div>

          <div className="flex-1" />

          <ForgeButton size="sm" onClick={() => setDialog({ mode: 'assign', task: null })}>
            <Icon name="users" size="xs" />
            {t('tasks.assign')}
          </ForgeButton>
          <ForgeButton
            size="sm"
            variant="primary"
            onClick={() => setDialog({ mode: 'create', task: null })}
          >
            <Icon name="plus" size="xs" />
            {t('tasks.new')}
          </ForgeButton>
          <ForgeButton asChild size="sm">
            <Link to="/app/work-orders" aria-label={t('tasks.openWorkOrders')}>
              <Icon name="right" size="xs" className="mirror-rtl" />
            </Link>
          </ForgeButton>
        </div>

        {tasks.isPending ? (
          <div className="p-4">
            <SkeletonRows count={4} />
          </div>
        ) : tasks.isError ? (
          <div className="p-4">
            <ErrorState
              error={tasks.error}
              title={t('tasks.loadFailed')}
              onRetry={() => tasks.refetch()}
            />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            // Already inside a Panel, so it drops its own card: two nested
            // hairlines read as a box in a box rather than as one empty state.
            className="border-0 bg-transparent shadow-none"
            icon="wrench"
            title={t('tasks.empty')}
            body={t('tasks.emptyBody')}
            action={
              <ForgeButton
                variant="primary"
                size="sm"
                onClick={() => setDialog({ mode: 'create', task: null })}
              >
                {t('tasks.new')}
              </ForgeButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {['task', 'priority', 'due', 'assignee', 'status'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className={cn(
                        'eyebrow border-b border-hairline px-4 py-2.5 text-start whitespace-nowrap',
                        // The task title takes every pixel the other five do not
                        // want. Without this the browser shares the width evenly
                        // and the two narrow end columns wrap their own labels.
                        column === 'task' && 'w-full',
                      )}
                    >
                      {t(`tasks.columns.${column}`)}
                    </th>
                  ))}
                  {/* The done control's column. Headed by a screen-reader-only
                      label rather than left blank: an unnamed column is a cell a
                      table reader cannot describe. */}
                  <th scope="col" className="border-b border-hairline px-4 py-2.5">
                    <span className="sr-only">{t('tasks.markDone')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((task) => {
                  const person = people.find((entry) => entry.id === task.assignee)
                  const tone = STATUS_TONE[task.status] ?? 'forge'
                  return (
                    <tr
                      key={task.id}
                      className="border-b border-subtle last:border-b-0 even:bg-row-alt"
                    >
                      <td className="px-4 py-2.5">
                        {/* The row's own control. A whole `<tr onClick>` is not
                            reachable by keyboard and announces nothing; the title
                            is the thing you would click anyway. */}
                        <button
                          type="button"
                          onClick={() => setDialog({ mode: 'edit', task })}
                          className={cn(
                            'text-start font-semibold text-ink hover:text-on-forge',
                            task.status === 'done' && 'line-through decoration-from-font',
                          )}
                        >
                          {task.title}
                        </button>
                        <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                          <Mono>{task.id}</Mono> · {task.assetName}
                          {task.source?.kind ? (
                            <> · {t(`tasks.source.${task.source.kind}`, { ref: task.source.ref })}</>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <SeverityBadge severity={task.priority} />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
                        <Num>{formatDateTime(task.dueAt)}</Num>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
                        {person?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {/* `whitespace-nowrap`: a two-word status wrapping inside
                            its own pill turns a badge into a paragraph. */}
                        <span
                          className="inline-flex items-center rounded-pill px-2.5 py-0.5 text-micro whitespace-nowrap"
                          style={{
                            color: `var(--on-${tone})`,
                            backgroundColor: `color-mix(in srgb, var(--hue-${tone}) calc(var(--tint) * 100%), transparent)`,
                          }}
                        >
                          {t(`tasks.status.${task.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-end">
                        <ForgeButton
                          size="sm"
                          className="whitespace-nowrap"
                          disabled={mutation.isPending}
                          // The visible label is one word; the accessible name
                          // says what it does to what, because a screen reader
                          // reaching this cell has left the row's title behind.
                          aria-label={
                            task.status === 'done' ? t('tasks.reopen') : t('tasks.markDone')
                          }
                          onClick={() => toggleDone(task)}
                        >
                          {task.status === 'done' ? null : <Icon name="check" size="xs" />}
                          {task.status === 'done' ? t('tasks.reopen') : t('tasks.done')}
                        </ForgeButton>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {dialog ? (
        <TaskDialog
          // Keyed so the form remounts with fresh state when the subject changes;
          // otherwise editing a second task would open on the first one's values.
          key={dialog.task?.id ?? dialog.mode}
          open
          mode={dialog.mode}
          task={dialog.task}
          people={people}
          assets={assets}
          self={self}
          pending={mutation.isPending}
          onClose={() => setDialog(null)}
          onSave={save}
        />
      ) : null}
    </>
  )
}
