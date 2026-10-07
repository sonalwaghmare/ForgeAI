import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ErrorSummary, Field } from '@/components/forge/Field'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { BrandLockup } from '@/components/forge/BrandLockup'
import { Panel } from '@/components/forge/Panel'
import { useSignIn } from '@/features/auth/mutations'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ERROR_CODES } from '@/services/apiError'

/**
 * Sign in.
 *
 * Operate mode at its most literal: the visitor's success is getting in, and
 * nothing on this screen is allowed to slow that down. There is no marketing
 * panel, no imagery, no split hero — the form is the page.
 *
 * The composition is centred and single-column rather than the conventional
 * two-pane split for a specific reason: the left pane of a login split is
 * usually filled with tenant context, and this product must show NOTHING about
 * an organisation before the credential is verified. Displaying a site count or
 * resolving an account ID to a plant name would hand an attacker a way to
 * confirm which accounts exist. With that content correctly unavailable, the
 * pane would be decoration, so it is gone.
 *
 * Deliberately absent, each for its own reason:
 *  - **Remember me.** These terminals are shared. A control-room PC that keeps
 *    someone signed in is a control-room PC anyone can act as them from.
 *  - **Federated sign-in buttons.** No identity provider has been chosen, and a
 *    button implying otherwise is a capability claim the product cannot meet.
 *  - **A demo entrance.** Every route behind this screen requires a token, so a
 *    link past it would bounce straight back here.
 *
 * The three fields are what the API requires and no more: the account alias
 * selects the tenant, and the email identifies a person only within it — the
 * same address under two accounts is two different people, which is why the
 * alias cannot be inferred from the address.
 */

const ACCOUNT_ALIAS_PATTERN = /^[A-Za-z0-9-]{3,50}$/
const ACCOUNT_ALIAS_STORAGE = 'forge.accountAlias'
/**
 * Deliberately permissive. The API is the authority on whether an address is
 * deliverable; this only catches the typo of omitting the @ entirely, so nobody
 * is refused by the client over an address their organisation actually uses.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  useDocumentTitle(t('meta.title'), t('meta.description'))
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const signIn = useSignIn()

  /**
   * Where to go once signed in.
   *
   * The guard records the URL that was refused, so a deep link survives the
   * detour through this screen. It falls back to the home screen, and any value
   * that is not an in-app path is discarded — an unvalidated `from` is an open
   * redirect, and a login screen is exactly where one gets exploited.
   */
  const requested = location.state?.from
  const destination = typeof requested === 'string' && requested.startsWith('/app') ? requested : '/app/home'

  /** Set when the transport gave up on a session mid-use, rather than at sign-in. */
  const sessionExpired = searchParams.get('reason') === 'expired'

  /**
   * The account alias is remembered; the email and password never are. An
   * organisation's short code is not a secret, and retyping it at every shift
   * change on a shared terminal is friction with no security value.
   */
  const [accountAlias, setAccountAlias] = useState(() => {
    try {
      return window.localStorage.getItem(ACCOUNT_ALIAS_STORAGE) ?? ''
    } catch {
      return ''
    }
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const summaryRef = useRef(null)

  function validate() {
    const next = {}
    if (!accountAlias.trim()) next.accountAlias = t('fields.accountAlias.required')
    else if (!ACCOUNT_ALIAS_PATTERN.test(accountAlias.trim())) {
      next.accountAlias = t('fields.accountAlias.format')
    }
    if (!email.trim()) next.email = t('fields.email.required')
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = t('fields.email.format')
    if (!password) next.password = t('fields.password.required')
    return next
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    signIn.reset()

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    try {
      // Stored exactly as typed. The API matches the alias case-sensitively, so
      // normalising the case here would break every subsequent sign-in.
      window.localStorage.setItem(ACCOUNT_ALIAS_STORAGE, accountAlias.trim())
    } catch {
      /* Private browsing. Signing in still works. */
    }

    signIn.mutate(
      { accountAlias, email, password },
      {
        onSuccess: () => {
          // Clear the password from state the moment it is no longer needed.
          setPassword('')
          navigate(destination, { replace: true })
        },
      },
    )
  }

  // Move focus to the summary when a submit fails, so a keyboard or
  // screen-reader user learns that something happened.
  useEffect(() => {
    if (submitted && Object.keys(errors).length) summaryRef.current?.focus()
  }, [submitted, errors])

  /**
   * One message for a rejected credential, whatever the reason.
   *
   * The API is careful here — a wrong account alias, an unknown email and a wrong
   * password all return the same 401 — and this mirrors it. Distinguishing them
   * would let an attacker confirm which accounts and addresses exist.
   *
   * `validation` appears when the API rejects the request shape rather than the
   * credential, which after client validation means an address it considers
   * malformed. It needs its own message: "check your details" sends someone
   * hunting through a password that was never the problem.
   */
  const serverError = signIn.isError
    ? signIn.error?.code === ERROR_CODES.LOCKED
      ? t('errors.locked')
      : signIn.error?.code === ERROR_CODES.UNAUTHORIZED
        ? t('errors.rejected')
        : signIn.error?.code === ERROR_CODES.VALIDATION
          ? t('errors.invalidRequest')
          : signIn.error?.code === ERROR_CODES.NETWORK || signIn.error?.code === ERROR_CODES.TIMEOUT
            ? t('errors.unavailable')
            : t('common:errors.unknown')
    : null

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="border-b border-hairline bg-card">
        <div className="mx-auto flex min-h-14 w-full max-w-[1240px] items-center px-14 py-2 max-xl:px-8 max-lg:px-5">
          <Link to="/" className="flex items-center">
            <BrandLockup size="md" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-5 py-14 max-lg:py-8">
        <div className="w-full max-w-[27rem]">
          <h1 className="m-0 text-display text-ink">{t('signIn.heading')}</h1>
          <p className="mt-3 text-body leading-[1.6] text-ink-dim">{t('signIn.intro')}</p>

          <Panel className="mt-7 p-6 max-lg:p-4.5">
            {/* noValidate: the browser's own bubbles cannot be styled, are not
                translated by our layer, and pre-empt the summary below. */}
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4.5">
              {submitted && Object.keys(errors).length ? (
                <ErrorSummary
                  ref={summaryRef}
                  id="signin-errors"
                  title={t('errors.summaryTitle', { count: Object.keys(errors).length })}
                  errors={errors}
                  className="-mb-1"
                />
              ) : null}

              {/* A session that ended on its own, not a rejected credential.
                  Suppressed once a sign-in has been attempted, since by then the
                  outcome of that attempt is the more useful message. */}
              {sessionExpired && !signIn.isError ? (
                <p
                  role="status"
                  className="m-0 rounded-sm border border-hairline stripe-amber bg-card p-3.5 text-body-sm text-on-amber"
                >
                  {t('errors.sessionExpired')}
                </p>
              ) : null}

              {serverError ? (
                <p
                  role="alert"
                  className="m-0 rounded-sm border border-hairline stripe-red bg-card p-3.5 text-body-sm text-on-red"
                >
                  {serverError}
                </p>
              ) : null}

              <Field
                id="accountAlias"
                label={t('fields.accountAlias.label')}
                hint={t('fields.accountAlias.hint')}
                error={errors.accountAlias}
                required
                value={accountAlias}
                onChange={(event) => setAccountAlias(event.target.value)}
                // `organization` is the correct token for a tenant code, and it
                // keeps password managers from filling it with a username.
                autoComplete="organization"
                // Neither auto-capitalised nor displayed upper-case: the API
                // compares this string exactly, so a cosmetic transform here
                // would silently send a value that can never match.
                autoCapitalize="none"
                spellCheck={false}
                inputClassName="mono"
              />

              <Field
                id="email"
                label={t('fields.email.label')}
                hint={t('fields.email.hint')}
                placeholder={t('fields.email.placeholder')}
                error={errors.email}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                // The API accepts an email address and nothing else, so the field
                // says so: type="email" gets the right on-screen keyboard, and
                // inputMode keeps that true where the type alone is ignored.
                type="email"
                inputMode="email"
              />

              <Field
                id="password"
                label={t('fields.password.label')}
                error={errors.password}
                required
                type={revealed ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyUp={(event) => setCapsLock(event.getModifierState?.('CapsLock') ?? false)}
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                trailing={
                  <IconButton
                    bare
                    // A reveal toggle is not a security hole — it is what lets
                    // someone in gloves, at arm's length, under roof-light glare
                    // type a long password correctly on the first attempt.
                    label={revealed ? t('fields.password.hide') : t('fields.password.show')}
                    pressed={revealed}
                    onClick={() => setRevealed((current) => !current)}
                    className="size-9 border-0 bg-transparent hover:bg-sunken"
                  >
                    <Icon name="eye" size="sm" />
                  </IconButton>
                }
              />

              {capsLock ? (
                <p role="status" className="-mt-2.5 flex items-center gap-1.5 text-body-sm text-on-amber">
                  <Icon name="bolt" size="xs" className="shrink-0" />
                  {t('fields.password.capsLock')}
                </p>
              ) : null}

              <ForgeButton
                type="submit"
                variant="primary"
                size="lg"
                disabled={signIn.isPending}
                className="mt-1 w-full"
              >
                {signIn.isPending ? t('signIn.submitting') : t('signIn.submit')}
              </ForgeButton>

              {/* Inert until a reset flow exists. Omitting it entirely would be
                  worse: a login screen with no recovery path reads as broken. */}
              <button
                type="button"
                className="self-center text-body-sm text-on-forge underline decoration-from-font"
              >
                {t('signIn.forgot')}
              </button>
            </form>
          </Panel>

          {/* No "look around without an account" link. Every route behind this
              screen now requires a token, so an unauthenticated visitor would be
              bounced straight back here — an invitation the product cannot
              honour reads as a broken link. */}

          <p className="mt-6 flex items-start justify-center gap-2 text-micro font-normal text-ink-dim">
            <Icon name="shield" size="xs" className="mt-0.5 shrink-0 text-ink-mute" />
            {t('security.note')}
          </p>
        </div>
      </main>
    </div>
  )
}
