import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Panel } from '@/components/forge/Panel'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow } from '@/components/forge/primitives'
import {
  fetchExport,
  useOrgSettings,
  useResetSettings,
  useSaveOrgSettings,
} from '@/features/org/settings'
import { useScope } from '@/providers/ScopeProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { SUPPORTED_LOCALES } from '@/i18n'
import { downloadJson } from '@/lib/csv'
import defaultLogo from '@/assets/pragmatyc_logo.png'

/**
 * Settings — General.
 *
 * DEMO. See `DEMO-MODE.md` §8.21. The design's four cards: Organization
 * Identity, Regional & Locale, Platform Defaults, Danger Zone — each with its
 * own Save, as the design has them.
 *
 * ── Three of these settings change the product, not a record ──────────────
 * The organisation name is `ORG.name`, which the top bar prints. The date
 * order, clock and time zone reach every formatter in the app through
 * `setOrgFormatting` — the override `lib/format.js` was written expecting. The
 * landing page is what `/app` resolves to. A settings screen whose fields go
 * into a store nothing reads is the most common way a form appears to work, and
 * on a page of eleven controls it would be eleven of them.
 *
 * ── Two are honest in place rather than removed ───────────────────────────
 * **Measurement units** is disabled and reads Per site. This product holds
 * units on the SITE, because 0.49 in/s at Findlay and 12.5 mm/s at Weißenthurm
 * are the same limit and `alerts.js` refuses to convert between them, calling a
 * single-unit display of that pair a safety defect. An org-wide switch would
 * either be ignored or would do exactly the thing that file exists to prevent.
 * The control stays where the design puts it, and the card lists what each site
 * is actually using.
 *
 * **Language** offers what the build ships, which is one. A select listing six
 * languages that resolve to missing keys is worse than a select with one.
 *
 * ── Session timeout is read, not copied ───────────────────────────────────
 * The design puts it on this page and on Security. Two controls over one value
 * is how a session ends up 1 hour on one screen and 8 on the other, so this one
 * prints the Security page's value and links there.
 *
 * ── The danger zone does two of its three things ──────────────────────────
 * Reset puts six settings modules back and says which before it does — and does
 * NOT clear the audit log, because a log you can clear from a settings page is
 * not an audit log. Export writes a real file assembled from the fixtures.
 * Delete Organization refuses: it would delete the account this session is
 * signed in as, there is no server to ask, and a button that appears to do it
 * is the single worst thing on a settings page to fake.
 */

export function GeneralPage() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const { setSiteId } = useScope()

  useDocumentTitle(`${t('settings.general.title')} · ${t('common:brand.name')}`)

  const org = useOrgSettings()
  const save = useSaveOrgSettings()

  const settings = org.data?.settings
  const options = org.data?.options

  function commit(values, onDone) {
    save.mutate(values, {
      onSuccess: (result) => {
        toast(
          result.changed?.length
            ? t('settings.general.saved')
            : t('settings.general.noChange'),
          result.changed?.length ? 'ok' : undefined,
        )
        onDone?.(values)
      },
      onError: () => toast(t('settings.general.saveFailed'), 'critical'),
    })
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-5">
        <h1 className="m-0 text-headline">{t('settings.general.title')}</h1>
        <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
          {t('settings.general.intro')}
        </p>
      </header>

      {org.isError ? (
        <ErrorState
          error={org.error}
          title={t('settings.general.loadFailed')}
          onRetry={() => org.refetch()}
        />
      ) : org.isPending ? (
        <SkeletonRows count={4} />
      ) : (
        <div className="flex flex-col gap-4">
          <IdentityCard settings={settings} options={options} pending={save.isPending} onSave={commit} />
          <RegionalCard
            settings={settings}
            options={options}
            siteUnits={org.data.siteUnits}
            pending={save.isPending}
            onSave={commit}
          />
          <DefaultsCard
            settings={settings}
            options={options}
            sessionTimeout={org.data.sessionTimeout}
            pending={save.isPending}
            onSave={(values) =>
              commit(values, (saved) => {
                /* The one platform default that can be applied now rather than
                   at the next sign-in: move the scope selector to it, so the
                   setting is visibly the thing it says it is. */
                if (saved.defaultSiteId) setSiteId(saved.defaultSiteId)
              })
            }
          />
          <DangerZone />
        </div>
      )}
    </div>
  )
}

/**
 * A card with its own Save, which is the design's arrangement and the right one:
 * these are four unrelated groups, and one Save over all of them would make
 * changing a time zone re-submit the organisation's name.
 *
 * The draft derives rather than syncing in an effect — the pattern the Security
 * page settled on, after this codebase got it wrong four times. `from` is the
 * settings object the draft was started against; when the server sends a new
 * one, the draft is stale by identity and empties itself.
 */
function useDraft(settings, keys) {
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

/** Options built from a list of ids, each labelled from one place. */
const labelled = (t, prefix, ids = []) =>
  ids.map((id) => ({ value: id, label: t(`${prefix}.${id}`) }))

function SaveRow({ dirty, pending, onSave }) {
  const { t } = useTranslation(['app', 'common'])
  return (
    <div className="mt-1 flex items-center gap-3">
      <ForgeButton variant="primary" disabled={!dirty || pending} onClick={onSave}>
        {t('settings.general.save')}
      </ForgeButton>
      {dirty ? (
        <span className="text-micro font-normal text-ink-mute">
          {t('settings.general.unsaved')}
        </span>
      ) : null}
    </div>
  )
}

/* ══ IDENTITY ════════════════════════════════════════════════════════════ */

const IDENTITY_KEYS = ['name', 'displayName', 'industry', 'tagline', 'logo']

function IdentityCard({ settings, options, pending, onSave }) {
  const { t } = useTranslation(['app', 'common'])
  const draft = useDraft(settings, IDENTITY_KEYS)

  return (
    <Panel className="p-4">
      <Eyebrow as="h2" className="mb-3">
        {t('settings.general.identity.title')}
      </Eyebrow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex flex-col gap-3.5">
          <Field
            id="org-name"
            label={t('settings.general.identity.name')}
            hint={t('settings.general.identity.nameHint')}
            value={draft.value('name')}
            onChange={(event) => draft.set('name', event.target.value)}
          />
          <Field
            id="org-display-name"
            label={t('settings.general.identity.displayName')}
            hint={t('settings.general.identity.displayNameHint')}
            value={draft.value('displayName')}
            onChange={(event) => draft.set('displayName', event.target.value)}
          />
          <ForgeSelect
            id="org-industry"
            label={t('settings.general.identity.industry')}
            value={draft.value('industry')}
            onValueChange={(next) => draft.set('industry', next)}
            options={labelled(t, 'settings.general.industries', options.industries)}
          />
          <Field
            id="org-tagline"
            label={t('settings.general.identity.tagline')}
            value={draft.value('tagline') ?? ''}
            onChange={(event) => draft.set('tagline', event.target.value)}
          />
          <SaveRow dirty={draft.dirty} pending={pending} onSave={() => onSave(draft.payload)} />
        </div>

        <LogoField
          value={draft.value('logo')}
          onChange={(next) => draft.set('logo', next)}
        />
      </div>
    </Panel>
  )
}

/**
 * The organisation's mark, with a way to replace it.
 *
 * ── Where the default comes from ──────────────────────────────────────────
 * A bundled asset, imported so the bundler fingerprints it and it survives a
 * reload like any other part of the build. The fixture holds `null` for "the
 * default" rather than a path: a filename written into `mocks/` would be a
 * second place for this file's location to be wrong.
 *
 * ── What a replacement actually is ────────────────────────────────────────
 * A data URL read in the browser and held in the same session state every other
 * demo write uses. So it shows immediately, it survives moving between screens,
 * and it is gone on reload — which is the contract for every write in this
 * build, not a special weakness of this one. The hint says so rather than the
 * control refusing.
 *
 * ── Guards, because this one takes a file from outside ────────────────────
 * Images only, and small ones. The file never leaves the page — there is nothing
 * to send it to — but an unbounded read would put a 40MB base64 string into
 * memory and into every subsequent settings payload.
 */
const LOGO_MAX_BYTES = 512 * 1024

function LogoField({ value, onChange }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const picker = useRef(null)

  function pick(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast(t('settings.general.identity.logoNotImage'), 'critical')
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast(t('settings.general.identity.logoTooBig', { kb: LOGO_MAX_BYTES / 1024 }), 'critical')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result))
    reader.onerror = () => toast(t('settings.general.identity.logoFailed'), 'critical')
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-control text-ink">{t('settings.general.identity.logo')}</span>

      <div className="grid aspect-square place-items-center rounded-sm border border-hairline bg-sunken p-4">
        {/* `contain`, not `cover`: a logo cropped to fill a square is a logo with
            its edges cut off, and the whole point of the field is the mark. */}
        <img
          src={value || defaultLogo}
          alt={t('settings.general.identity.logoAlt')}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ForgeButton size="sm" onClick={() => picker.current?.click()}>
          {t('settings.general.identity.logoChange')}
        </ForgeButton>
        {/* Only once there is something to revert to. */}
        {value ? (
          <ForgeButton size="sm" variant="ghost" onClick={() => onChange(null)}>
            {t('settings.general.identity.logoReset')}
          </ForgeButton>
        ) : null}
      </div>

      <input
        ref={picker}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={t('settings.general.identity.logoChange')}
        onChange={(event) => {
          pick(event.target.files?.[0])
          // Cleared so choosing the same file twice fires again.
          event.target.value = ''
        }}
      />

      <p className="m-0 text-micro font-normal text-ink-mute">
        {t('settings.general.identity.logoHint')}
      </p>
    </div>
  )
}

/* ══ REGIONAL ════════════════════════════════════════════════════════════ */

const REGIONAL_KEYS = ['timeZone', 'dateFormat', 'timeFormat', 'language']

function RegionalCard({ settings, options, siteUnits, pending, onSave }) {
  const { t } = useTranslation(['app', 'common'])
  const draft = useDraft(settings, REGIONAL_KEYS)

  return (
    <Panel className="p-4">
      <Eyebrow as="h2" className="mb-1">
        {t('settings.general.regional.title')}
      </Eyebrow>
      <p className="mt-0 mb-3.5 text-body-sm text-ink-dim">
        {t('settings.general.regional.intro')}
      </p>

      <div className="grid gap-3.5 md:grid-cols-3">
        <ForgeSelect
          id="org-timezone"
          label={t('settings.general.regional.timeZone')}
          hint={t('settings.general.regional.timeZoneHint')}
          value={draft.value('timeZone')}
          onValueChange={(next) => draft.set('timeZone', next)}
          /* A time zone is an IANA identifier — a machine string, the same in
             every locale — so it is printed rather than translated. */
          options={options.timeZones.map((zone) => ({ value: zone, label: zone }))}
        />
        <ForgeSelect
          id="org-date-format"
          label={t('settings.general.regional.dateFormat')}
          value={draft.value('dateFormat')}
          onValueChange={(next) => draft.set('dateFormat', next)}
          options={labelled(t, 'settings.general.dateFormats', options.dateFormats)}
        />
        <ForgeSelect
          id="org-time-format"
          label={t('settings.general.regional.timeFormat')}
          value={draft.value('timeFormat')}
          onValueChange={(next) => draft.set('timeFormat', next)}
          options={labelled(t, 'settings.general.timeFormats', options.timeFormats)}
        />
        <ForgeSelect
          id="org-language"
          label={t('settings.general.regional.language')}
          hint={
            SUPPORTED_LOCALES.length === 1 ? t('settings.general.regional.languageOne') : undefined
          }
          value={draft.value('language')}
          onValueChange={(next) => draft.set('language', next)}
          options={labelled(t, 'settings.general.languages', SUPPORTED_LOCALES)}
        />
        {/* Disabled in place. The reason is below, and it names what is
            actually in force at each site rather than only refusing. */}
        <ForgeSelect
          id="org-units"
          label={t('settings.general.regional.units')}
          value="perSite"
          disabled
          options={[{ value: 'perSite', label: t('settings.general.regional.unitsPerSite') }]}
        />
      </div>

      <p className="mt-3 mb-0 text-micro font-normal text-ink-mute">
        {t('settings.general.regional.unitsReason', {
          sites: siteUnits
            .map((site) =>
              t('settings.general.regional.siteUnit', {
                site: site.name,
                units: t(`settings.general.unitSystems.${site.unitSystem}`),
              }),
            )
            .join(' · '),
        })}
      </p>

      <SaveRow dirty={draft.dirty} pending={pending} onSave={() => onSave(draft.payload)} />
    </Panel>
  )
}

/* ══ PLATFORM DEFAULTS ═══════════════════════════════════════════════════ */

const DEFAULT_KEYS = ['landingPage', 'defaultSiteId', 'dataRetention']

function DefaultsCard({ settings, options, sessionTimeout, pending, onSave }) {
  const { t } = useTranslation(['app', 'common'])
  const draft = useDraft(settings, DEFAULT_KEYS)

  return (
    <Panel className="p-4">
      <Eyebrow as="h2" className="mb-3">
        {t('settings.general.defaults.title')}
      </Eyebrow>

      <div className="grid gap-3.5 md:grid-cols-2">
        <ForgeSelect
          id="org-landing"
          label={t('settings.general.defaults.landingPage')}
          hint={t('settings.general.defaults.landingPageHint')}
          value={draft.value('landingPage')}
          onValueChange={(next) => draft.set('landingPage', next)}
          /* Named from the navigation rail's own labels, so a page cannot be
             offered here under a name it does not have there. */
          options={options.landingPages.map((page) => ({
            value: page.value,
            label: t(`screens.${page.value}`),
          }))}
        />
        <ForgeSelect
          id="org-default-site"
          label={t('settings.general.defaults.defaultSite')}
          hint={t('settings.general.defaults.defaultSiteHint')}
          value={draft.value('defaultSiteId')}
          onValueChange={(next) => draft.set('defaultSiteId', next)}
          options={options.sites}
        />

        {/* The Security page's value, printed rather than offered a second
            time. One setting, one control, and a way to get to it. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-control text-ink">
            {t('settings.general.defaults.sessionTimeout')}
          </span>
          <p className="m-0 flex h-[38px] items-center rounded-sm border border-hairline bg-sunken px-3 text-body-sm text-ink-dim">
            {t(`settings.security.sessions.timeouts.${sessionTimeout}`)}
          </p>
          <p className="m-0 text-micro font-normal text-ink-mute">
            {t('settings.general.defaults.sessionTimeoutOwner')}{' '}
            <Link to="/app/settings/security" className="text-on-forge underline">
              {t('settings.pages.security')}
            </Link>
          </p>
        </div>

        <ForgeSelect
          id="org-retention"
          label={t('settings.general.defaults.dataRetention')}
          hint={t('settings.general.defaults.dataRetentionHint')}
          value={draft.value('dataRetention')}
          onValueChange={(next) => draft.set('dataRetention', next)}
          options={labelled(t, 'settings.general.retention', options.dataRetention)}
        />
      </div>

      <SaveRow dirty={draft.dirty} pending={pending} onSave={() => onSave(draft.payload)} />
    </Panel>
  )
}

/* ══ DANGER ══════════════════════════════════════════════════════════════ */

function DangerZone() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const reset = useResetSettings()

  const [confirming, setConfirming] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function runExport() {
    setExporting(true)
    try {
      const data = await fetchExport()
      downloadJson(`forge-export-${data.exportedAt.slice(0, 10)}.json`, data)
      toast(t('settings.general.danger.exported'), 'ok')
    } catch {
      toast(t('settings.general.danger.exportFailed'), 'critical')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Panel stripe="red" className="p-4">
      <Eyebrow as="h2" className="mb-1 text-on-red">
        {t('settings.general.danger.title')}
      </Eyebrow>
      <p className="mt-0 mb-3.5 text-body-sm text-ink-dim">
        {t('settings.general.danger.intro')}
      </p>

      <ul className="m-0 flex list-none flex-col p-0">
        <DangerRow
          title={t('settings.general.danger.reset')}
          body={t('settings.general.danger.resetBody')}
          action={
            <ForgeButton
              className="text-on-red hover:text-on-red"
              disabled={reset.isPending}
              onClick={() => setConfirming(true)}
            >
              {t('settings.general.danger.resetAction')}
            </ForgeButton>
          }
        />
        <DangerRow
          title={t('settings.general.danger.export')}
          body={t('settings.general.danger.exportBody')}
          action={
            <ForgeButton disabled={exporting} onClick={runExport}>
              {t('settings.general.danger.exportAction')}
            </ForgeButton>
          }
        />
        {/* In place, disabled, with the reason. This is the one control on the
            page where pretending would be unforgivable: it names the account
            this session is signed in as. */}
        <DangerRow
          title={t('settings.general.danger.delete')}
          body={t('settings.general.danger.deleteUnavailable')}
          action={
            <ForgeButton variant="danger" disabled>
              {t('settings.general.danger.deleteAction')}
            </ForgeButton>
          }
        />
      </ul>

      {confirming ? (
        <ForgeDialog
          open
          onOpenChange={(next) => !next && setConfirming(false)}
          size="sm"
          title={t('settings.general.danger.resetTitle')}
          footer={
            <>
              <ForgeButton onClick={() => setConfirming(false)}>
                {t('common:actions.cancel')}
              </ForgeButton>
              <span className="flex-1" />
              <ForgeButton
                variant="danger"
                disabled={reset.isPending}
                onClick={() =>
                  reset.mutate(undefined, {
                    onSuccess: () => {
                      toast(t('settings.general.danger.resetDone'), 'ok')
                      setConfirming(false)
                    },
                    onError: () => toast(t('settings.general.danger.resetFailed'), 'critical'),
                  })
                }
              >
                {t('settings.general.danger.resetAction')}
              </ForgeButton>
            </>
          }
        >
          {/* What goes back, named. And what does not. */}
          <p className="mt-0 mb-2 text-body-sm text-ink-dim">
            {t('settings.general.danger.resetConfirm')}
          </p>
          <p className="m-0 text-body-sm text-ink-dim">
            {t('settings.general.danger.resetKeeps')}
          </p>
        </ForgeDialog>
      ) : null}
    </Panel>
  )
}

function DangerRow({ title, body, action }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-body-sm font-semibold text-ink">{title}</p>
        <p className="m-0 text-micro font-normal text-ink-mute">{body}</p>
      </div>
      {action}
    </li>
  )
}
