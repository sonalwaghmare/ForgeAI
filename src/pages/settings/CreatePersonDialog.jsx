import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Mono } from '@/components/forge/primitives'
import { useCreatePerson, usePeople, useTeams } from '@/features/people/queries'
import { useToast } from '@/providers/ToastProvider'

/**
 * Add one account.
 *
 * DEMO. See `DEMO-MODE.md` §8.14.
 *
 * ── Four fields, where the design has nine ────────────────────────────────
 * A name, a role, a plant and a team. The prototype also asks for a job title, a
 * department, a phone number, a default landing page, a status and whether MFA is
 * on. Every one of those is either the same fact as the role, or something the
 * account holder sets about themselves, or — in the case of status and MFA —
 * something that cannot be true on the first day: an account created with a
 * second factor already enrolled describes an enrolment that did not happen.
 *
 * ── The email address is shown and not typed ──────────────────────────────
 * It is derived from the name, the same way it is for everybody already in the
 * directory. Letting it be typed here would make it the one address in the
 * product that did not follow the convention, and the first thing that happens
 * then is two spellings of one person.
 *
 * ── No invitation is sent, and the dialog says so ─────────────────────────
 * Nothing here can send mail. The account is created enabled and never used,
 * which puts it straight into the two tiles that matter — and that is the honest
 * outcome rather than a row that appears having accepted an invitation nobody
 * received.
 */

/** Radix rejects an item whose value is the empty string; "not set" needs one. */
const NONE = '__none__'

export function CreatePersonDialog({ open, onClose }) {
  if (!open) return null
  return <Dialog onClose={onClose} />
}

function Dialog({ onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  const people = usePeople()
  const teams = useTeams()
  const create = useCreatePerson()

  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [siteId, setSiteId] = useState(NONE)
  const [teamId, setTeamId] = useState(NONE)

  const roleOptions = people.data?.options?.roles ?? []
  const siteOptions = people.data?.options?.sites ?? []
  const teamOptions = teams.data?.items ?? []

  const trimmed = name.trim()
  const preview = trimmed
    ? `${trimmed
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .trim()
        .split(/\s+/)
        .join('.')}@meridian.example`
    : null

  function submit() {
    create.mutate(
      {
        name: trimmed,
        role,
        siteId: siteId === NONE ? null : siteId,
        teamId: teamId === NONE ? null : teamId,
      },
      {
        onSuccess: (person) => {
          toast(t('settings.users.created', { name: person.name }), 'ok')
          onClose()
        },
      },
    )
  }

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="md"
      title={t('settings.users.createTitle')}
      description={t('settings.users.createSubtitle')}
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <span className="flex-1" />
          <ForgeButton
            variant="primary"
            disabled={!trimmed || !role || create.isPending}
            onClick={submit}
          >
            {create.isPending ? t('settings.users.creating') : t('settings.users.create')}
          </ForgeButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          id="new-person-name"
          label={t('settings.users.fields.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          hint={
            preview ? (
              <>
                {t('settings.users.emailDerived')} <Mono>{preview}</Mono>
              </>
            ) : (
              t('settings.users.emailDerivedEmpty')
            )
          }
        />

        <ForgeSelect
          id="new-person-role"
          label={t('settings.users.fields.role')}
          required
          value={role}
          onValueChange={setRole}
          options={roleOptions.map((value) => ({ value, label: t(`common:roles.${value}`) }))}
        />

        <ForgeSelect
          id="new-person-site"
          label={t('settings.users.fields.site')}
          hint={t('settings.users.siteHint')}
          value={siteId}
          onValueChange={setSiteId}
          options={[{ value: NONE, label: t('settings.users.noSite') }, ...siteOptions]}
        />

        <ForgeSelect
          id="new-person-team"
          label={t('settings.users.fields.team')}
          value={teamId}
          onValueChange={setTeamId}
          options={[
            { value: NONE, label: t('settings.users.noTeam') },
            ...teamOptions.map((team) => ({ value: team.id, label: team.name })),
          ]}
        />

        <p className="m-0 rounded-sm border border-hairline bg-sunken px-3.5 py-3 text-body-sm text-ink-dim">
          {t('settings.users.createNote')}
        </p>
      </div>
    </ForgeDialog>
  )
}
