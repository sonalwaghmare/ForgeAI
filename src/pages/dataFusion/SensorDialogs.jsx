import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Mono } from '@/components/forge/primitives'
import { useDeleteSensor } from '@/features/sensors/queries'
import { cn } from '@/lib/cn'

/**
 * Removing a sensor.
 *
 * The only sensor interaction that is still a dialog, and the one that should be:
 * a destructive confirmation is a single question with two answers, it must
 * interrupt, and it must not lose the list behind it. Onboarding and editing moved
 * to routes — see `SensorFormPage` for why a form does not belong in a 60vh box.
 *
 * The copy says what stops and what does not. The delete is soft, so the row keeps
 * its identity and drops out of the listing — and `delete_sensor` carries a
 * standing TODO to publish a config-update event that would take the tag out of
 * active ingestion, with no event bus in the backend to publish it to. So the
 * confirmation says the sensor stops being listed. It does not claim it stops
 * being read, because nothing here knows that.
 */
export function DeleteSensorDialog({ sensor, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const remove = useDeleteSensor()

  if (!sensor) return null

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => {
        if (!next && !remove.isPending) {
          remove.reset()
          onClose()
        }
      }}
      size="sm"
      title={t('dataFusion.sensors.removeDialog.title', { name: sensor.name })}
      footer={
        <>
          <ForgeButton
            variant="danger"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(sensor.id, {
                onSuccess: () => {
                  remove.reset()
                  onClose()
                },
              })
            }
          >
            {remove.isPending
              ? t('dataFusion.sensors.removeDialog.removing')
              : t('dataFusion.sensors.removeDialog.confirm')}
          </ForgeButton>
          <ForgeButton disabled={remove.isPending} onClick={onClose}>
            {t('common:actions.cancel')}
          </ForgeButton>
        </>
      }
    >
      {remove.error ? <WriteFailed error={remove.error} action="remove" /> : null}
      <p className={cn('m-0 text-body text-ink-dim', remove.error && 'mt-4')}>
        {t('dataFusion.sensors.removeDialog.body')}
      </p>
    </ForgeDialog>
  )
}

/**
 * A failed write, stated where it was attempted. Shared by the delete dialog and
 * the onboarding screen.
 *
 * Three cases are named rather than collapsed into "something went wrong", because
 * each has a different recovery:
 *
 * **404** — the parent or the connection is gone. Deletion is soft everywhere here
 * and nothing cascades, so a plant deleted in Settings leaves a form pointing at a
 * record the server will no longer resolve. Reloading is the fix, not retrying.
 *
 * **405** — `PUT /sensors/{id}` is not implemented yet. Saying so beats reporting a
 * generic failure the reader would try to fix by editing the form.
 *
 * Everything else falls back to the translated code. The server's own message text
 * is never rendered — only `messageKey` and `requestId`.
 */
export function WriteFailed({ error, action, className }) {
  const { t } = useTranslation(['app', 'common'])

  const reason =
    error.status === 405
      ? t('dataFusion.sensors.errors.notImplemented')
      : error.code === 'notFound'
        ? t('dataFusion.sensors.errors.parentGone')
        : t(`common:${error.messageKey}`)

  return (
    <div
      role="alert"
      className={cn('rounded-sm border border-hairline stripe-red bg-card p-3.5', className)}
    >
      <p className="m-0 text-control text-on-red">
        {t(`dataFusion.sensors.errors.${action}Failed`)}
      </p>
      <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">{reason}</p>
      {error.requestId ? (
        <Mono className="mt-2 block text-micro font-normal text-ink-dim">
          {t('common:errors.requestId', { id: error.requestId })}
        </Mono>
      ) : null}
    </div>
  )
}
