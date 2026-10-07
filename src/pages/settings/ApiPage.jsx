import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { PAGE_SIZES, TablePagination } from '@/components/forge/TablePagination'
import { Mono, Num } from '@/components/forge/primitives'
import {
  fetchPostman,
  fetchSpec,
  useCreateKey,
  useDeleteWebhook,
  useDeveloperAccess,
  useRevokeKey,
  useRotateKey,
  useSaveWebhook,
  useTestWebhook,
} from '@/features/developer/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { downloadJson } from '@/lib/csv'
import { formatRelative } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { useToast } from '@/providers/ToastProvider'
import { cn } from '@/lib/cn'

/**
 * Settings → API & Webhooks.
 *
 * DEMO. See `DEMO-MODE.md` §8.19. The design's three panels in its order: API
 * Keys, Webhooks, and the REST API card with its orange leading edge.
 *
 * ── A key's value is shown once and stored nowhere ────────────────────────
 * Generating one returns the secret in that response and no other; the record
 * holds a prefix. The reveal dialog is the only place it exists, and closing it
 * is the last time anybody sees it. The design says this and is right to — it is
 * the one thing on this page where getting it wrong would be a real defect, so
 * a check searches every later response for the value it was given.
 *
 * ── Download Spec and Postman produce real files ──────────────────────────
 * Generated from `endpoints.js`, the one place this client may write a URL, so
 * the document describes the paths the product actually calls. Add a path there
 * and it appears in both without anybody maintaining a second list. What they do
 * NOT carry is request and response schemas: those belong to a service that has
 * not been written, and a specification that guessed them would be wrong in a
 * way nobody could see.
 *
 * ── Test shows the payload rather than sending it ─────────────────────────
 * Firing a real request would send plant data to a third-party endpoint from
 * this reader's browser on a button press, which a settings page should not do.
 * The design's version reports "Test event sent" without having sent one. This
 * shows the exact body that would be delivered, which is the half somebody opens
 * Test to find out and the half that is true.
 */

const KEY_STATUS_TONE = { active: 'green', revoked: null }

export function ApiPage() {
  const { t, i18n } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('settings.api.title')} · ${t('common:brand.name')}`)
  const { toast } = useToast()

  const access = useDeveloperAccess()
  const rotate = useRotateKey()
  const revoke = useRevokeKey()

  const [generating, setGenerating] = useState(false)
  const [revealed, setRevealed] = useState(null)
  const [editingHook, setEditingHook] = useState(null)
  const [testing, setTesting] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const keys = access.data?.keys ?? []
  const webhooks = access.data?.webhooks ?? []
  const events = access.data?.events ?? []

  const pageCount = Math.max(1, Math.ceil(keys.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleKeys = keys.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  async function download(kind) {
    const body = kind === 'spec' ? await fetchSpec() : await fetchPostman()
    downloadJson(
      kind === 'spec' ? 'forge-ai-openapi.json' : 'forge-ai.postman_collection.json',
      body,
    )
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-5">
        <h1 className="m-0 text-headline">{t('settings.api.title')}</h1>
        <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
          {t('settings.api.intro')}
        </p>
      </header>

      {access.isPending ? (
        <SkeletonRows count={6} />
      ) : access.isError ? (
        <ErrorState
          error={access.error}
          title={t('settings.api.loadFailed')}
          onRetry={access.refetch}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* ── API keys ─────────────────────────────────────────────── */}
          <Panel flush className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3">
              <h2 className="m-0 flex-1 text-title">{t('settings.api.keys.title')}</h2>
              <ForgeButton variant="primary" onClick={() => setGenerating(true)}>
                {t('settings.api.keys.generate')}
              </ForgeButton>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <caption className="sr-only">{t('settings.api.keys.caption')}</caption>
                <thead>
                  <tr>
                    {['name', 'prefix', 'scopes', 'created', 'lastUsed', 'status', 'actions'].map(
                      (column) => (
                        <th
                          key={column}
                          scope="col"
                          className="eyebrow bg-sunken px-4 py-2.5 text-start whitespace-nowrap"
                        >
                          {t(`settings.api.keys.columns.${column}`)}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleKeys.map((key) => (
                    <tr
                      key={key.id}
                      className={cn(
                        'border-t border-subtle',
                        key.status === 'revoked' && 'text-ink-dim',
                      )}
                    >
                      <td className="px-4 py-2.5 text-body-sm font-semibold text-ink">
                        {key.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <Mono className="text-micro whitespace-nowrap">{key.prefix}</Mono>
                      </td>
                      <td className="px-4 py-2.5">
                        <Mono className="text-micro text-ink-dim">{key.scopes.join(', ')}</Mono>
                      </td>
                      <td className="px-4 py-2.5 text-body-sm whitespace-nowrap text-ink-dim">
                        {new Date(key.createdAt).toLocaleDateString(i18n.language, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-body-sm whitespace-nowrap text-ink-dim">
                        {key.lastUsedAt ? (
                          <time dateTime={key.lastUsedAt}>
                            {formatRelative(new Date(key.lastUsedAt), i18n.language)}
                          </time>
                        ) : (
                          t('settings.api.keys.never')
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          status={key.status}
                          label={t(`settings.api.keys.status.${key.status}`)}
                        />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {key.status === 'active' ? (
                          <span className="inline-flex gap-1.5">
                            <ForgeButton
                              size="sm"
                              disabled={rotate.isPending}
                              onClick={() =>
                                rotate.mutate(key.id, {
                                  onSuccess: (result) => setRevealed(result),
                                })
                              }
                            >
                              {t('settings.api.keys.rotate')}
                            </ForgeButton>
                            <ForgeButton
                              size="sm"
                              disabled={revoke.isPending}
                              onClick={() =>
                                revoke.mutate(key.id, {
                                  onSuccess: () => toast(t('settings.api.keys.revoked'), 'ok'),
                                })
                              }
                            >
                              {t('settings.api.keys.revoke')}
                            </ForgeButton>
                          </span>
                        ) : (
                          <span className="text-micro font-normal text-ink-mute">
                            {t('settings.api.keys.revokedNote')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              total={keys.length}
              page={currentPage}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              label={t('settings.api.keys.rowNoun')}
            />
          </Panel>

          {/* ── Webhooks ─────────────────────────────────────────────── */}
          <Panel flush className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3">
              <h2 className="m-0 flex-1 text-title">{t('settings.api.hooks.title')}</h2>
              <ForgeButton onClick={() => setEditingHook({})}>
                {t('settings.api.hooks.add')}
              </ForgeButton>
            </div>

            {webhooks.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t('settings.api.hooks.caption')}</caption>
                  <thead>
                    <tr>
                      {['name', 'endpoint', 'events', 'lastTriggered', 'status', 'actions'].map(
                        (column) => (
                          <th
                            key={column}
                            scope="col"
                            className="eyebrow bg-sunken px-4 py-2.5 text-start whitespace-nowrap"
                          >
                            {t(`settings.api.hooks.columns.${column}`)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {webhooks.map((hook) => (
                      <tr key={hook.id} className="border-t border-subtle">
                        <td className="px-4 py-2.5 text-body-sm font-semibold text-ink">
                          {hook.name}
                        </td>
                        <td className="px-4 py-2.5">
                          <Mono className="text-micro text-ink-dim">{hook.url}</Mono>
                        </td>
                        <td className="px-4 py-2.5">
                          <Mono className="text-micro text-ink-dim">{hook.events.join(', ')}</Mono>
                        </td>
                        <td className="px-4 py-2.5 text-body-sm whitespace-nowrap text-ink-dim">
                          {hook.lastTriggeredAt ? (
                            <time dateTime={hook.lastTriggeredAt}>
                              {formatRelative(new Date(hook.lastTriggeredAt), i18n.language)}
                            </time>
                          ) : (
                            t('settings.api.keys.never')
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill
                            status="active"
                            label={t('settings.api.hooks.status.active')}
                          />
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <WebhookActions
                            hook={hook}
                            onTest={setTesting}
                            onEdit={() => setEditingHook(hook)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon="plug"
                title={t('settings.api.hooks.empty')}
                body={t('settings.api.hooks.emptyBody')}
                className="border-0 bg-transparent shadow-none"
              />
            )}

            {/* Every event this platform actually raises, and the module that
                raises it. The design lists two the product has no concept of. */}
            <p className="m-0 border-t border-hairline px-4 py-2.5 text-micro font-normal text-ink-mute">
              {t('settings.api.hooks.eventList')}{' '}
              <Mono>{events.map((event) => event.id).join(' · ')}</Mono>
            </p>
          </Panel>

          {/* ── The specification ────────────────────────────────────── */}
          <Panel stripe="forge" className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-sunken"
            >
              <Icon name="bolt" size="sm" className="text-on-forge" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-body font-semibold text-ink">{t('settings.api.spec.title')}</p>
              <p className="m-0 text-body-sm text-ink-dim">
                <Num>
                  {t('settings.api.spec.body', { paths: access.data?.spec?.paths ?? 0 })}
                </Num>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Nowhere to go: there is no documentation site. Shown disabled
                  with the reason rather than pointed at a 404. */}
              <ForgeButton disabled title={t('settings.api.spec.docsNote')}>
                {t('settings.api.spec.docs')}
              </ForgeButton>
              <ForgeButton onClick={() => download('spec')}>
                {t('settings.api.spec.download')}
              </ForgeButton>
              <ForgeButton onClick={() => download('postman')}>
                {t('settings.api.spec.postman')}
              </ForgeButton>
            </div>
          </Panel>

          <p className="m-0 max-w-[72ch] text-micro font-normal text-ink-mute">
            {t('settings.api.spec.note')}
          </p>
        </div>
      )}

      {generating ? (
        <GenerateKeyDialog
          scopes={access.data?.scopes ?? []}
          expiry={access.data?.expiry ?? []}
          onClose={() => setGenerating(false)}
          onCreated={(key) => {
            setGenerating(false)
            setRevealed(key)
          }}
        />
      ) : null}

      {revealed ? <RevealDialog result={revealed} onClose={() => setRevealed(null)} /> : null}

      {editingHook ? (
        <WebhookDialog
          hook={editingHook.id ? editingHook : null}
          events={events}
          onClose={() => setEditingHook(null)}
        />
      ) : null}

      {testing ? <TestDialog result={testing} onClose={() => setTesting(null)} /> : null}
    </div>
  )
}

function StatusPill({ status, label }) {
  const tone = KEY_STATUS_TONE[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-[3px] text-micro whitespace-nowrap',
        tone ? cn(TINT_CLASS[tone], ON_TINT_CLASS[tone]) : 'bg-sunken text-ink-dim',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', tone === 'green' ? 'bg-green' : 'bg-ink-mute')}
      />
      {label}
    </span>
  )
}

function WebhookActions({ hook, onTest, onEdit }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const remove = useDeleteWebhook()
  const test = useTestWebhook()

  return (
    <span className="inline-flex gap-1.5">
      {/* Fired here and handed to the dialog, rather than the dialog firing it
          as it mounts — a request started during render is a request that runs
          twice under StrictMode and once more on every re-render. */}
      <ForgeButton
        size="sm"
        disabled={test.isPending}
        onClick={() => test.mutate(hook.id, { onSuccess: onTest })}
      >
        {t('settings.api.hooks.test')}
      </ForgeButton>
      <ForgeButton size="sm" onClick={onEdit}>
        {t('common:actions.edit')}
      </ForgeButton>
      <ForgeButton
        size="sm"
        disabled={remove.isPending}
        onClick={() =>
          remove.mutate(hook.id, { onSuccess: () => toast(t('settings.api.hooks.deleted'), 'ok') })
        }
      >
        {t('common:actions.delete')}
      </ForgeButton>
    </span>
  )
}

/* ══ GENERATE ════════════════════════════════════════════════════════════ */

function GenerateKeyDialog({ scopes, expiry, onClose, onCreated }) {
  const { t } = useTranslation(['app', 'common'])
  const create = useCreateKey()

  const [name, setName] = useState('')
  const [expires, setExpires] = useState(expiry[1] ?? expiry[0])
  const [chosen, setChosen] = useState(['read:all'])

  const toggle = (id) =>
    setChosen((held) => (held.includes(id) ? held.filter((x) => x !== id) : [...held, id]))

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="md"
      title={t('settings.api.keys.generateTitle')}
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <span className="flex-1" />
          <ForgeButton
            variant="primary"
            disabled={!name.trim() || !chosen.length || create.isPending}
            onClick={() =>
              create.mutate(
                { name: name.trim(), scopes: chosen, expiry: expires },
                { onSuccess: onCreated },
              )
            }
          >
            {t('settings.api.keys.generate')}
          </ForgeButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          id="key-name"
          label={t('settings.api.keys.name')}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          hint={t('settings.api.keys.nameHint')}
        />
        <ForgeSelect
          id="key-expiry"
          label={t('settings.api.keys.expiry')}
          value={expires}
          onValueChange={setExpires}
          options={expiry.map((value) => ({
            value,
            label: t(`settings.api.keys.expiryOptions.${value}`),
          }))}
        />
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-control text-ink">{t('settings.api.keys.scopes')}</legend>
          <p className="mt-1 mb-2 text-body-sm text-ink-dim">{t('settings.api.keys.scopesHint')}</p>
          <div className="flex max-h-[16rem] flex-wrap gap-1.5 overflow-y-auto">
            {scopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                aria-pressed={chosen.includes(scope.id)}
                onClick={() => toggle(scope.id)}
                className={cn(
                  'rounded-pill border px-2.5 py-1 text-micro transition-colors',
                  chosen.includes(scope.id)
                    ? cn(TINT_CLASS.forge, ON_TINT_CLASS.forge, 'border-transparent')
                    : 'border-hairline text-ink-dim hover:bg-sunken',
                )}
              >
                <Mono>{scope.id}</Mono>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </ForgeDialog>
  )
}

/**
 * The one place the value exists.
 *
 * No "copy and I will show it again". Closing this is the last time it is
 * readable, which is what the sentence above it says and what the fixture makes
 * true rather than merely promises.
 */
function RevealDialog({ result, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="md"
      title={t('settings.api.keys.revealTitle')}
      footer={
        <>
          <span className="flex-1" />
          <ForgeButton variant="primary" onClick={onClose}>
            {t('settings.api.keys.revealDone')}
          </ForgeButton>
        </>
      }
    >
      <p className="m-0 mb-3.5 rounded-sm border border-hairline stripe-amber bg-card px-3.5 py-3 text-body-sm text-on-amber">
        {t('settings.api.keys.revealWarning')}
      </p>
      <div className="flex items-center gap-2.5 rounded-sm border border-hairline bg-sunken px-3.5 py-3">
        <Mono className="min-w-0 flex-1 break-all text-body-sm text-ink">{result.secret}</Mono>
        <ForgeButton
          size="sm"
          onClick={() => {
            navigator.clipboard?.writeText(result.secret)
            toast(t('settings.api.keys.copied'), 'ok')
          }}
        >
          {t('settings.api.keys.copy')}
        </ForgeButton>
      </div>
      <p className="mt-3 mb-0 text-micro font-normal text-ink-mute">
        <Mono>{result.name}</Mono> · <Mono>{result.scopes.join(', ')}</Mono>
      </p>
    </ForgeDialog>
  )
}

/* ══ WEBHOOKS ════════════════════════════════════════════════════════════ */

function WebhookDialog({ hook, events, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const save = useSaveWebhook()

  const [name, setName] = useState(hook?.name ?? '')
  const [url, setUrl] = useState(hook?.url ?? 'https://')
  const [chosen, setChosen] = useState(hook?.events ?? [])

  const https = url.startsWith('https://') && url.length > 'https://'.length
  const ready = name.trim() && https && chosen.length > 0

  const toggle = (id) =>
    setChosen((held) => (held.includes(id) ? held.filter((x) => x !== id) : [...held, id]))

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="md"
      title={t(hook ? 'settings.api.hooks.editTitle' : 'settings.api.hooks.addTitle')}
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <span className="flex-1" />
          <ForgeButton
            variant="primary"
            disabled={!ready || save.isPending}
            onClick={() =>
              save.mutate(
                { id: hook?.id, name: name.trim(), url, events: chosen },
                {
                  onSuccess: () => {
                    toast(t('settings.api.hooks.saved'), 'ok')
                    onClose()
                  },
                },
              )
            }
          >
            {t('common:actions.save')}
          </ForgeButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          id="hook-name"
          label={t('settings.api.hooks.name')}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          id="hook-url"
          label={t('settings.api.hooks.endpoint')}
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          inputClassName="mono text-mono"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          /* HTTPS only, and refused rather than warned about: a webhook carries
             plant data to a third party, and the API Security card states this
             rule as one that cannot be turned off. */
          error={url.length > 8 && !https ? t('settings.api.hooks.httpsOnly') : undefined}
          hint={t('settings.api.hooks.endpointHint')}
        />
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-control text-ink">{t('settings.api.hooks.events')}</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                aria-pressed={chosen.includes(event.id)}
                onClick={() => toggle(event.id)}
                className={cn(
                  'rounded-pill border px-2.5 py-1 text-micro transition-colors',
                  chosen.includes(event.id)
                    ? cn(TINT_CLASS.forge, ON_TINT_CLASS.forge, 'border-transparent')
                    : 'border-hairline text-ink-dim hover:bg-sunken',
                )}
              >
                <Mono>{event.id}</Mono>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </ForgeDialog>
  )
}

/**
 * What a delivery would contain.
 *
 * Not a delivery. See the note at the top of this file.
 */
function TestDialog({ result, onClose }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="md"
      title={t('settings.api.hooks.testTitle', { event: result.event })}
      footer={
        <>
          <span className="flex-1" />
          <ForgeButton variant="primary" onClick={onClose}>
            {t('common:actions.close')}
          </ForgeButton>
        </>
      }
    >
      <p className="m-0 mb-3 text-body-sm text-ink-dim">{t('settings.api.hooks.testBody')}</p>
      <p className="m-0 mb-2 text-micro font-normal text-ink-mute">
        POST <Mono className="text-ink-dim">{result.url}</Mono>
      </p>
      <pre className="m-0 overflow-x-auto rounded-sm border border-hairline bg-sunken px-3.5 py-3 text-micro text-ink-dim">
        <Mono>{JSON.stringify(result.payload, null, 2)}</Mono>
      </pre>
    </ForgeDialog>
  )
}
