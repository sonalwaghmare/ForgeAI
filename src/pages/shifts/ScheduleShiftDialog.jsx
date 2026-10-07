import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Eyebrow } from '@/components/forge/primitives'
import { useAssignShift } from '@/features/shifts/queries'
import { useToast } from '@/providers/ToastProvider'

/**
 * Assign a scheduled shift.
 *
 * DEMO. The design calls this "Schedule New Shift" and its Schedule button does
 * nothing.
 *
 * ── Why it assigns rather than creates ────────────────────────────────────
 * The roster is DERIVED — a plant runs three shifts a day whether or not
 * anybody has opened this screen, so the rows exist before the dialog does. What
 * is genuinely undecided is **who works one**, and that is the act this commits.
 * A "create shift" button on a fixed three-a-day rota would either duplicate a
 * row that already exists or invent a fourth shift in a day, and neither is a
 * thing a plant does.
 *
 * It writes: the roster gains the new operator, the crew table recounts, and the
 * change survives the session.
 *
 * ── Only a shift that has not run ─────────────────────────────────────────
 * Reassigning yesterday's night shift would be rewriting who was there. The
 * server rejects it and the date field will not go back past today.
 */
export function ScheduleShiftDialog({ open, operators, types, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const assign = useAssignShift()

  const [date, setDate] = useState(() => today())
  const [type, setType] = useState('morning')
  const [operatorId, setOperatorId] = useState('')

  const close = () => {
    setDate(today())
    setType('morning')
    setOperatorId('')
    onClose()
  }

  const submit = async () => {
    const shift = await assign.mutateAsync({ date, type, operatorId })
    toast(
      t('shifts.schedule.assigned', {
        name: shift.operatorName,
        shift: t(`shifts.type.${shift.type}`),
      }),
      'ok',
    )
    close()
  }

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      size="md"
      title={t('shifts.schedule.title')}
      footer={
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <ForgeButton onClick={close}>{t('common:actions.cancel')}</ForgeButton>
          <ForgeButton
            variant="primary"
            disabled={!operatorId || assign.isPending}
            onClick={submit}
          >
            {t('shifts.schedule.assign')}
          </ForgeButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('shifts.schedule.date')}
            type="date"
            // Today at the earliest: a shift already worked cannot be reassigned.
            min={today()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <ForgeSelect
            label={t('shifts.schedule.operator')}
            required
            value={operatorId}
            onValueChange={setOperatorId}
            placeholder={t('shifts.schedule.pickOperator')}
            options={operators.map((person) => ({ value: person.id, label: person.name }))}
          />
        </div>

        <div>
          <Eyebrow className="mb-2">{t('shifts.schedule.type')}</Eyebrow>
          <div
            role="group"
            aria-label={t('shifts.schedule.type')}
            className="flex flex-wrap gap-1.5"
          >
            {types.map((entry) => (
              <Chip key={entry} selected={type === entry} onClick={() => setType(entry)}>
                {t(`shifts.type.${entry}`)}
              </Chip>
            ))}
          </div>
        </div>

        {assign.isError ? (
          <p className="m-0 rounded-sm bg-sunken px-3.5 py-2.5 text-body-sm text-on-red">
            {t('shifts.schedule.rejected')}
          </p>
        ) : (
          <p className="m-0 rounded-sm bg-sunken px-3.5 py-2.5 text-body-sm text-ink-dim">
            {t('shifts.schedule.note')}
          </p>
        )}
      </div>
    </ForgeDialog>
  )
}

/** `yyyy-mm-dd` for today, local — `toISOString` would shift the day westward. */
function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
