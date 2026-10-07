import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Field, TextArea } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useSaveSecurity, useSecurity } from '@/features/security/queries'
import { useSignOut } from '@/features/auth/mutations'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatRelative } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { useToast } from '@/providers/ToastProvider'
import { cn } from '@/lib/cn'

/**
 * Settings → Security & access.
 *
 * DEMO. See `DEMO-MODE.md` §8.18. The design's five cards, in its order:
 * Authentication, Password Policy, Session Management, IP Allowlist, API
 * Security.
 *
 * ── A policy that is only stored is still worth storing honestly ──────────
 * Nothing here enforces a minimum password length; there is no login to enforce
 * it at. What the page can do is hold the decision, report who it would affect,
 * and write it to the audit log — and it does all three. The design's own audit
 * table has a row reading `settings:security · MFA enforcement enabled`, so the
 * two screens were always meant to be joined. Save something here and it is on
 * that page before you get to it.
 *
 * ── Requiring MFA has a number attached ───────────────────────────────────
 * Three accounts in this directory have no second factor, so turning the
 * requirement on is a statement about three named people. The card says how many
 * and links to them, which is the part of that switch worth having.
 *
 * ── There is one session, and it is this browser ──────────────────────────
 * The design lists three with IP addresses and cities. A session is held by the
 * server that issued it and there is none here, so the only one this product can
 * honestly report is the page you are reading. Its device is read from the user
 * agent, which IS knowable; its address is not, so that column reads an em dash
 * — the same call the audit log makes. Revoking it signs you out, because that
 * is what revoking your own session means.
 */

export function SecurityPage() {
  const { t } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('settings.security.title')} · ${t('common:brand.name')}`)

  const security = useSecurity()
  const data = security.data

  return (
    <div className="max-w-[68rem] px-8 py-6 max-xl:px-5.5">
      <header className="mb-5">
        <h1 className="m-0 text-headline">{t('settings.security.title')}</h1>
        <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
          {t('settings.security.intro')}
        </p>
      </header>

      {security.isPending ? (
        <SkeletonRows count={6} />
      ) : security.isError ? (
        <ErrorState
          error={security.error}
          title={t('settings.security.loadFailed')}
          onRetry={security.refetch}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Authentication data={data} />
          <PasswordPolicy data={data} />
          <Sessions data={data} />
          <IpAllowlist data={data} />
          <ApiSecurity data={data} />
        </div>
      )}
    </div>
  )
}

/* ══ SHARED CONTROLS ═════════════════════════════════════════════════════ */

/**
 * A labelled switch on its own row.
 *
 * The shape the design repeats fourteen times: name, optional description on a
 * second line, optional badge beside the name, switch on the far end. A real
 * `role="switch"` with an accessible name, because a coloured div is not a
 * control.
 */
function ToggleRow({ label, description, badge, checked, disabled, onChange, className }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-subtle py-3 last:border-0',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="m-0 flex flex-wrap items-center gap-2 text-body-sm font-semibold text-ink">
          {label}
          {badge}
        </p>
        {description ? (
          <p className="m-0 text-micro font-normal text-ink-dim">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors',
          checked ? 'bg-forge' : 'bg-hairline',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {/* `bg-white`, not `bg-card`. The knob is not a surface sitting on the
            page — it is a physical part of a control, read against a Forge
            Orange track. `bg-card` is opaque white in light and 6% white in
            dark, so in dark the knob all but disappeared into the track. Same
            call `ForgeButton` makes with `text-white` on a primary fill. */}
        <span
          aria-hidden="true"
          className="absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200"
          style={{ insetInlineStart: checked ? '19px' : '3px' }}
        />
      </button>
    </div>
  )
}

function CardTitle({ children }) {
  return <h2 className="m-0 mb-1 text-title">{children}</h2>
}

/**
 * A card whose fields are edited then saved together.
 *
 * The draft lives here rather than in each card, so Save is enabled only when
 * something has actually changed — a Save button that is always live invites the
 * reader to press it, and a policy change with nothing in it would still write
 * an audit entry saying somebody changed the policy.
 */
function useDraft(settings, keys) {
  /* The answer the draft was taken against is held WITH it, and a draft from a
     stale answer is read as empty. Derived rather than cleared in an effect —
     `set-state-in-effect` is right to refuse that, and it would also mean one
     render where the form still showed edits the save had already landed.

     React Query's structural sharing keeps `settings` referentially stable
     across a refetch that changed nothing, so this resets when the data
     actually changed and not merely when it was re-read. */
  const [draft, setDraft] = useState({ from: settings, values: {} })
  const values = draft.from === settings ? draft.values : {}

  const value = (key) => (Object.hasOwn(values, key) ? values[key] : settings[key])
  const set = (key, next) => setDraft({ from: settings, values: { ...values, [key]: next } })
  const dirty = keys.some((key) => Object.hasOwn(values, key) && values[key] !== settings[key])
  const payload = Object.fromEntries(
    keys.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]),
  )

  return { value, set, dirty, payload }
}

/* ══ AUTHENTICATION ══════════════════════════════════════════════════════ */

const SSO_KEYS = ['sso', 'ssoProvider', 'ssoEntityId', 'ssoUrl']

function Authentication({ data }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const save = useSaveSecurity()
  const settings = data.settings
  const { value, set, dirty, payload } = useDraft(settings, [...SSO_KEYS, 'requireMfa'])

  const commit = (values) =>
    save.mutate(values, { onSuccess: () => toast(t('settings.security.saved'), 'ok') })

  return (
    <Panel className="p-4">
      <CardTitle>{t('settings.security.auth.title')}</CardTitle>

      <ToggleRow
        label={t('settings.security.auth.sso')}
        description={t('settings.security.auth.ssoBody')}
        badge={
          <span
            className={cn(
              'rounded-pill px-2 py-[2px] text-micro',
              TINT_CLASS.amber,
              ON_TINT_CLASS.amber,
            )}
          >
            {t('settings.security.auth.enterprise')}
          </span>
        }
        checked={value('sso')}
        onChange={(next) => {
          set('sso', next)
          commit({ sso: next })
        }}
      />

      {value('sso') ? (
        <div className="grid grid-cols-2 gap-3.5 border-b border-subtle py-3.5 max-sm:grid-cols-1">
          <ForgeSelect
            id="sso-provider"
            label={t('settings.security.auth.provider')}
            value={value('ssoProvider')}
            onValueChange={(next) => set('ssoProvider', next)}
            options={data.options.ssoProviders.map((entry) => ({ value: entry, label: entry }))}
          />
          <Field
            id="sso-entity"
            label={t('settings.security.auth.entityId')}
            value={value('ssoEntityId')}
            onChange={(event) => set('ssoEntityId', event.target.value)}
            inputClassName="mono text-mono"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Field
            id="sso-url"
            label={t('settings.security.auth.ssoUrl')}
            value={value('ssoUrl')}
            onChange={(event) => set('ssoUrl', event.target.value)}
            inputClassName="mono text-mono"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {/* A reference, not an upload. Nothing here reads a certificate, and
              an input that accepted one would be asking for a key so it could
              be thrown away — the same call the connection drawer makes. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-control text-ink">
              {t('settings.security.auth.certificate')}
            </span>
            <span className="flex items-center gap-2.5 rounded-sm border border-hairline bg-sunken px-3.5 py-3">
              <Icon name="lock" size="sm" className="text-ink-mute" />
              <span className="text-micro font-normal text-ink-dim">
                {t('settings.security.auth.certificateNote')}
              </span>
            </span>
          </div>
          <div className="col-span-2 max-sm:col-span-1">
            <ForgeButton
              variant="primary"
              disabled={!dirty || save.isPending}
              onClick={() => commit(payload)}
            >
              {t('settings.security.auth.saveSso')}
            </ForgeButton>
          </div>
        </div>
      ) : null}

      <ToggleRow
        label={t('settings.security.auth.mfa')}
        description={t('settings.security.auth.mfaBody')}
        checked={value('requireMfa')}
        onChange={(next) => {
          set('requireMfa', next)
          commit({ requireMfa: next })
        }}
      />

      {/* The number that makes the switch above mean something. */}
      {value('requireMfa') && data.mfa.missing > 0 ? (
        <p className="m-0 mt-3 rounded-sm border border-hairline stripe-amber bg-card px-3.5 py-2.5 text-body-sm text-on-amber">
          <Num>
            {t('settings.security.auth.mfaGap', {
              count: data.mfa.missing,
              names: data.mfa.missingNames.join(', '),
            })}
          </Num>{' '}
          <Link
            to="/app/settings/users"
            className="font-semibold underline decoration-from-font"
          >
            {t('settings.security.auth.mfaGapLink')}
          </Link>
        </p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {data.mfa.methods.map((method) => (
          <span
            key={method.id}
            className="flex items-center gap-1.5 rounded-sm border border-hairline bg-card px-2.5 py-1.5 text-micro"
          >
            <Icon
              name={method.weak ? 'bolt' : 'check'}
              size="xs"
              className={method.weak ? 'text-on-amber' : 'text-on-green'}
            />
            {t(`settings.security.auth.methods.${method.id}`)}
          </span>
        ))}
        <span className="ms-auto">
          {/* Not offered as a live action. Forcing re-enrolment invalidates every
              second factor in the estate, and there is no enrolment flow behind
              it to complete — a button that broke everybody's sign-in and could
              not fix it is the one control on this page that must not be a
              demo. */}
          <ForgeButton disabled title={t('settings.security.auth.reenrolNote')}>
            {t('settings.security.auth.reenrol')}
          </ForgeButton>
        </span>
      </div>
    </Panel>
  )
}

/* ══ PASSWORD POLICY ═════════════════════════════════════════════════════ */

const POLICY_KEYS = [
  'minimumLength',
  'passwordExpiry',
  'requireUppercase',
  'requireNumbers',
  'requireSpecial',
  'preventReuse',
]

function PasswordPolicy({ data }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const save = useSaveSecurity()
  const settings = data.settings
  const { value, set, dirty, payload } = useDraft(settings, POLICY_KEYS)

  return (
    <Panel className="p-4">
      <CardTitle>{t('settings.security.password.title')}</CardTitle>

      <div className="mt-3 grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        <Field
          id="password-length"
          label={t('settings.security.password.minimumLength')}
          type="number"
          value={String(value('minimumLength'))}
          onChange={(event) => set('minimumLength', Number(event.target.value) || 0)}
        />
        <ForgeSelect
          id="password-expiry"
          label={t('settings.security.password.expiry')}
          value={value('passwordExpiry')}
          onValueChange={(next) => set('passwordExpiry', next)}
          options={data.options.passwordExpiry.map((entry) => ({
            value: entry,
            label: t(`settings.security.password.expiryOptions.${entry}`),
          }))}
        />
      </div>

      <div className="mt-2">
        {['requireUppercase', 'requireNumbers', 'requireSpecial', 'preventReuse'].map((key) => (
          <ToggleRow
            key={key}
            label={t(`settings.security.password.${key}`)}
            checked={value(key)}
            onChange={(next) => set(key, next)}
          />
        ))}
      </div>

      <ForgeButton
        variant="primary"
        className="mt-3.5"
        disabled={!dirty || save.isPending}
        onClick={() =>
          save.mutate(payload, { onSuccess: () => toast(t('settings.security.saved'), 'ok') })
        }
      >
        {t('settings.security.password.save')}
      </ForgeButton>

      <p className="mt-3 mb-0 max-w-[60ch] text-micro font-normal text-ink-mute">
        {t('settings.security.password.note')}
      </p>
    </Panel>
  )
}

/* ══ SESSIONS ════════════════════════════════════════════════════════════ */

function Sessions({ data }) {
  const { t, i18n } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const save = useSaveSecurity()
  const signOut = useSignOut()
  const settings = data.settings
  const { value, set } = useDraft(settings, ['sessionTimeout', 'concurrentSessions'])
  const [confirming, setConfirming] = useState(false)

  const commit = (values) =>
    save.mutate(values, { onSuccess: () => toast(t('settings.security.saved'), 'ok') })

  return (
    <Panel className="p-4">
      <CardTitle>{t('settings.security.sessions.title')}</CardTitle>

      <div className="mt-3 grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        <ForgeSelect
          id="session-timeout"
          label={t('settings.security.sessions.timeout')}
          value={value('sessionTimeout')}
          onValueChange={(next) => {
            set('sessionTimeout', next)
            commit({ sessionTimeout: next })
          }}
          options={data.options.sessionTimeouts.map((entry) => ({
            value: entry,
            label: t(`settings.security.sessions.timeouts.${entry}`),
          }))}
        />
        <ForgeSelect
          id="session-concurrent"
          label={t('settings.security.sessions.concurrent')}
          value={value('concurrentSessions')}
          onValueChange={(next) => {
            set('concurrentSessions', next)
            commit({ concurrentSessions: next })
          }}
          options={data.options.concurrentSessions.map((entry) => ({
            value: entry,
            label: t(`settings.security.sessions.concurrentOptions.${entry}`),
          }))}
        />
      </div>

      <Eyebrow className="mt-4 mb-2">{t('settings.security.sessions.active')}</Eyebrow>
      <div className="-mx-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t('settings.security.sessions.caption')}</caption>
          <thead>
            <tr>
              {['user', 'device', 'ip', 'location', 'lastActive'].map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="eyebrow bg-sunken px-4 py-2 text-start whitespace-nowrap"
                >
                  {t(`settings.security.sessions.columns.${column}`)}
                </th>
              ))}
              <th scope="col" className="bg-sunken px-4 py-2">
                <span className="sr-only">{t('settings.security.sessions.columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.sessions.map((session) => (
              <tr key={session.id} className="border-t border-subtle">
                <td className="px-4 py-2.5 text-body-sm font-semibold text-ink">
                  {session.personName}
                  {session.self ? (
                    <span className="ms-2 text-micro font-normal text-ink-mute">
                      {t('settings.security.sessions.thisBrowser')}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-body-sm text-ink-dim">
                  {session.device ?? <Dash />}
                </td>
                <td className="px-4 py-2.5">
                  {session.ip ? <Mono className="text-micro">{session.ip}</Mono> : <Dash />}
                </td>
                <td className="px-4 py-2.5 text-body-sm text-ink-dim">
                  {session.location ?? <Dash />}
                </td>
                <td className="px-4 py-2.5 text-body-sm text-ink-dim">
                  <time dateTime={session.lastActiveAt}>
                    {formatRelative(new Date(session.lastActiveAt), i18n.language)}
                  </time>
                </td>
                <td className="px-4 py-2.5 text-end">
                  <ForgeButton size="sm" onClick={() => setConfirming(true)}>
                    {t('settings.security.sessions.revoke')}
                  </ForgeButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ForgeButton className="mt-3.5" onClick={() => setConfirming(true)}>
        {t('settings.security.sessions.terminateAll')}
      </ForgeButton>

      <p className="mt-3 mb-0 max-w-[64ch] text-micro font-normal text-ink-mute">
        {t('settings.security.sessions.note')}
      </p>

      {confirming ? (
        <ForgeDialog
          open
          onOpenChange={(next) => !next && setConfirming(false)}
          size="sm"
          title={t('settings.security.sessions.confirmTitle')}
          footer={
            <>
              <ForgeButton onClick={() => setConfirming(false)}>
                {t('common:actions.cancel')}
              </ForgeButton>
              <span className="flex-1" />
              <ForgeButton variant="primary" onClick={() => signOut.mutate()}>
                {t('settings.security.sessions.confirmAction')}
              </ForgeButton>
            </>
          }
        >
          <p className="m-0 text-body-sm text-ink-dim">
            {t('settings.security.sessions.confirmBody')}
          </p>
        </ForgeDialog>
      ) : null}
    </Panel>
  )
}

/* ══ IP ALLOWLIST ════════════════════════════════════════════════════════ */

function IpAllowlist({ data }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const save = useSaveSecurity()
  const settings = data.settings
  const { value, set, dirty, payload } = useDraft(settings, ['ipAllowlist', 'ipAllowlistCidrs'])

  return (
    <Panel className="p-4">
      <CardTitle>{t('settings.security.ip.title')}</CardTitle>

      <ToggleRow
        label={t('settings.security.ip.enable')}
        checked={value('ipAllowlist')}
        onChange={(next) => {
          set('ipAllowlist', next)
          save.mutate(
            { ipAllowlist: next },
            { onSuccess: () => toast(t('settings.security.saved'), 'ok') },
          )
        }}
      />

      {value('ipAllowlist') ? (
        <div className="mt-3.5">
          <p className="m-0 mb-3 rounded-sm border border-hairline stripe-amber bg-card px-3.5 py-2.5 text-body-sm text-on-amber">
            {t('settings.security.ip.warning')}
          </p>
          <TextArea
            id="ip-cidrs"
            label={t('settings.security.ip.ranges')}
            rows={3}
            value={value('ipAllowlistCidrs')}
            onChange={(event) => set('ipAllowlistCidrs', event.target.value)}
            inputClassName="mono text-mono"
            spellCheck={false}
            hint={t('settings.security.ip.rangesHint')}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <ForgeButton
              variant="primary"
              disabled={!dirty || save.isPending}
              onClick={() =>
                save.mutate(payload, {
                  onSuccess: () => toast(t('settings.security.saved'), 'ok'),
                })
              }
            >
              {t('common:actions.save')}
            </ForgeButton>
            {/* The design offers "Add My Current IP". A page cannot know the
                address it reached the server from — only the server can tell it,
                and asking a third party would send this reader's address
                somewhere to find out. Shown, disabled, with the reason. */}
            <ForgeButton disabled title={t('settings.security.ip.addMineNote')}>
              {t('settings.security.ip.addMine')}
            </ForgeButton>
          </div>
        </div>
      ) : null}
    </Panel>
  )
}

/* ══ API SECURITY ════════════════════════════════════════════════════════ */

function ApiSecurity({ data }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const save = useSaveSecurity()
  const settings = data.settings
  const { value, set, dirty, payload } = useDraft(settings, ['rateLimit'])

  const commit = (values) =>
    save.mutate(values, { onSuccess: () => toast(t('settings.security.saved'), 'ok') })

  return (
    <Panel className="p-4">
      <CardTitle>{t('settings.security.api.title')}</CardTitle>

      {/* Locked, as the design has it — and genuinely so: the transport has no
          plaintext mode to turn on. */}
      <ToggleRow
        label={t('settings.security.api.https')}
        description={t('settings.security.api.httpsBody')}
        checked
        disabled
        onChange={() => {}}
      />
      <ToggleRow
        label={t('settings.security.api.rateLimiting')}
        checked={settings.rateLimiting}
        onChange={(next) => commit({ rateLimiting: next })}
      />

      {settings.rateLimiting ? (
        <div className="mt-3.5 flex flex-wrap items-end gap-2.5">
          <Field
            id="api-rate-limit"
            label={t('settings.security.api.rateLimit')}
            type="number"
            className="w-[16rem]"
            value={String(value('rateLimit'))}
            onChange={(event) => set('rateLimit', Number(event.target.value) || 0)}
          />
          <ForgeButton
            disabled={!dirty || save.isPending}
            onClick={() => commit(payload)}
          >
            {t('common:actions.save')}
          </ForgeButton>
        </div>
      ) : null}

      <div className="mt-2">
        <ToggleRow
          label={t('settings.security.api.logRequests')}
          checked={settings.logApiRequests}
          onChange={(next) => commit({ logApiRequests: next })}
        />
      </div>
    </Panel>
  )
}

function Dash() {
  return <span className="text-ink-mute">—</span>
}
