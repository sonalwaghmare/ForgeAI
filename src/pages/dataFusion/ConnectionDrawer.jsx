import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Field, TextArea } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDrawer } from '@/components/forge/ForgeDrawer'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import {
  useFusionSource,
  useSaveSourceConfig,
  useTestSource,
  useWritebackRule,
} from '@/features/dataFusion/sources'
import { formatInteger, formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { StatusPill } from './SourcesPage'

/**
 * One connection, in up to six tabs.
 *
 * DEMO. See `DEMO-MODE.md` §8.10, passes 2a and 2b.
 *
 * ── The endpoint is edited here and lives in the registry ─────────────────
 * Which is the property this screen exists to demonstrate. A `bind` field on the
 * schema reads the source rather than the schema, so the drawer prints the same
 * string the table does; saving writes it back, and because the status is derived
 * from the endpoint, clearing it moves the row to Not Configured while you watch.
 * Nothing on this screen holds a second copy of anything the registry owns.
 *
 * ── The contract comes from whichever half of the registry owns it ────────
 * For the three anchors it is the list `CONNECTORS` declares and the public
 * source-contract section prints. For everything else it is the family profile.
 * That is the same seam as the row itself, and it is why the drawer cannot claim
 * the historian supplies maintenance records while the landing page says it does
 * not.
 *
 * ── Test answers with what is true ────────────────────────────────────────
 * Not a spinner that always ends green. Testing the ABB gateway fails with the
 * TLS error its own row prints; testing Maximo reports that there is nothing to
 * test, because nobody has given it an endpoint. A test that always succeeded
 * would teach a reader to stop believing the status column.
 *
 * ── Why the fields are rendered here and not by `ConfigField` ─────────────
 * `ConfigField` renders the LIVE connector `config_schema`, whose labels are the
 * server's own strings passed through as data and whose types are the four that
 * resource declares. This schema is a fixture: its labels are keys, and it has
 * three controls that one has no notion of — a file reference, a multi-line
 * query, and a credential that never carries a value. Two schemas from two
 * sources with two labelling contracts; sharing one renderer would mean teaching
 * it which kind it was looking at.
 */

/**
 * The tabs, in the order the design has them.
 *
 * `mapping` is offered whatever it will contain, including nothing: a source that
 * binds no Forge object needs to say so, and hiding the tab would make "nothing
 * is bound here" indistinguishable from "this family does not bind". The
 * per-family extra tab appears only where the family has one — Write-back Rules
 * on a business system, ROI & Recipes on a camera. IoT's Device Registry is not
 * among them; that family is the live API.
 */
function tabsFor(record) {
  return [
    'connection',
    'contract',
    'mapping',
    ...(record?.writeback ? ['writeback'] : []),
    ...(record?.roi ? ['roi'] : []),
    'activity',
  ]
}

export function ConnectionDrawer({ id, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const [tab, setTab] = useState('connection')
  /* Only what the reader actually touched. Sending the whole form back would
     make every field look edited to the fixture and stamp a configuration-updated
     entry in the activity log for a drawer somebody merely opened. */
  const [edits, setEdits] = useState({})

  const source = useFusionSource(id)
  const save = useSaveSourceConfig(id)
  const test = useTestSource(id)

  const record = source.data
  const dirty = Object.keys(edits).length > 0
  const tabs = tabsFor(record)

  function close() {
    onClose()
    setTab('connection')
    setEdits({})
    save.reset()
    test.reset()
  }

  return (
    <ForgeDrawer
      open={Boolean(id)}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      title={record?.name ?? t('dataFusion.connection.drawerTitle')}
      closeLabel={t('common:actions.close')}
      className="w-[min(40rem,100vw)]"
      footer={
        tab === 'connection' && record ? (
          <>
            <ForgeButton
              variant="primary"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(edits, { onSuccess: () => setEdits({}) })}
            >
              {save.isPending
                ? t('dataFusion.connection.saving')
                : t('dataFusion.connection.save')}
            </ForgeButton>
            <ForgeButton disabled={test.isPending} onClick={() => test.mutate()}>
              {test.isPending
                ? t('dataFusion.connection.testing')
                : t('dataFusion.connection.test')}
            </ForgeButton>
            {/* No Delete. The prototype puts one here; removing a source would
                take the three anchors out of a registry two other screens read
                from, and there is no undo to offer beside it. */}
          </>
        ) : null
      }
    >
      {source.isPending ? (
        <SkeletonRows count={5} />
      ) : source.isError ? (
        <ErrorState
          error={source.error}
          title={t('dataFusion.connection.loadFailed')}
          onRetry={source.refetch}
        />
      ) : (
        <>
          <div className="-mx-5 -mt-4 flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-hairline px-5 py-4">
            <div className="min-w-0 flex-1">
              <Mono className="text-micro text-ink-dim">
                {record.endpoint
                  ? `${record.protocol} · ${record.endpoint}`
                  : record.protocol}
              </Mono>
              <p className="mt-1.5 mb-0 text-micro font-normal text-ink-dim">
                {record.siteName ?? t('dataFusion.sources.enterprise')}
              </p>
            </div>
            <StatusPill status={record.status} error={record.error} />
          </div>

          <div
            role="tablist"
            aria-label={t('dataFusion.connection.tabsLabel')}
            className="-mx-5 mb-4 flex gap-1 border-b border-hairline px-5"
          >
            {tabs.map((entry) => (
              <button
                key={entry}
                type="button"
                role="tab"
                aria-selected={tab === entry}
                onClick={() => setTab(entry)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2.5 text-body-sm transition-colors',
                  tab === entry
                    ? 'border-forge font-semibold text-ink'
                    : 'border-transparent text-ink-dim hover:text-ink',
                )}
              >
                {t(`dataFusion.connection.tabs.${entry}`)}
              </button>
            ))}
          </div>

          {tab === 'connection' ? (
            <ConnectionTab
              record={record}
              edits={edits}
              onEdit={(field, value) => setEdits((current) => ({ ...current, [field]: value }))}
              save={save}
              test={test}
            />
          ) : tab === 'contract' ? (
            <ContractTab record={record} />
          ) : tab === 'mapping' ? (
            <MappingTab record={record} />
          ) : tab === 'writeback' ? (
            <WritebackTab record={record} id={id} />
          ) : tab === 'roi' ? (
            <RoiTab record={record} />
          ) : (
            <ActivityTab record={record} />
          )}
        </>
      )}
    </ForgeDrawer>
  )
}

/* ── Connection ───────────────────────────────────────────────────────── */

function ConnectionTab({ record, edits, onEdit, save, test }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <div className="flex flex-col gap-4">
      {/* The reason it is down, said once at the top rather than left for the
          reader to infer from a status pill three inches above. */}
      {record.error ? (
        <p className="m-0 rounded-sm border border-hairline stripe-red bg-card px-3.5 py-3 text-body-sm text-on-red">
          {t(`dataFusion.sources.error.${record.error}`)}
        </p>
      ) : null}

      {test.data ? <TestResult result={test.data} /> : null}
      {save.isSuccess && !Object.keys(edits).length ? (
        <p className="m-0 rounded-sm border border-hairline tint-green px-3.5 py-3 text-body-sm text-on-green">
          <Num>{t('dataFusion.connection.saved', { count: save.data?.changed ?? 0 })}</Num>
        </p>
      ) : null}

      {record.config.map((field) => (
        <ConnectionField
          key={field.id}
          field={field}
          value={Object.hasOwn(edits, field.id) ? edits[field.id] : field.value}
          onChange={(next) => onEdit(field.id, next)}
        />
      ))}
    </div>
  )
}

/**
 * The result of a test, in the words of what actually happened.
 *
 * A failure names the reason using the same key the row does, so the drawer and
 * the table give one account of why this connection is not working.
 */
function TestResult({ result }) {
  const { t } = useTranslation('app')

  return (
    <p
      className={cn(
        'm-0 rounded-sm border border-hairline px-3.5 py-3 text-body-sm',
        result.ok ? 'tint-green text-on-green' : 'stripe-red bg-card text-on-red',
      )}
    >
      {result.ok ? (
        <Num>
          {t('dataFusion.connection.testOk', {
            count: formatInteger(result.objects),
            unit: t(`dataFusion.sources.unit.${result.unit}`),
          })}
        </Num>
      ) : (
        t('dataFusion.connection.testFailed', {
          reason: t(`dataFusion.sources.error.${result.reason}`),
        })
      )}
    </p>
  )
}

/**
 * One field of the demo config schema. See the note at the top of this file.
 *
 * Exported because the connect wizard renders the same schema: two forms over one
 * schema is the point of having a schema, and a second renderer would be a second
 * set of controls to keep in step with it.
 */
export function ConnectionField({ field, value, onChange }) {
  const { t } = useTranslation(['app', 'common'])
  const label = t(`dataFusion.connection.fields.${field.id}`)
  const id = `fusion-cfg-${field.id}`

  if (field.type === 'toggle') {
    return (
      <label className="flex cursor-pointer items-center gap-2.5 rounded-sm border border-hairline bg-card px-3.5 py-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="accent-forge"
        />
        <span className="text-control text-ink">{label}</span>
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <ForgeSelect
        id={id}
        label={label}
        value={String(value)}
        onValueChange={onChange}
        options={field.options.map((option) => ({
          value: option.value,
          // A term from the protocol's own specification is printed as it is.
          // `Basic256Sha256` is what goes on the wire, in every locale.
          label: option.translate
            ? t(`dataFusion.connection.options.${field.id}.${option.value}`)
            : option.value,
        }))}
      />
    )
  }

  if (field.type === 'textarea') {
    return (
      <TextArea
        id={id}
        label={label}
        rows={4}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        inputClassName={field.mono ? 'mono text-mono' : undefined}
      />
    )
  }

  if (field.type === 'file') {
    /* A reference, not an upload. Nothing in this demo reads a client
       certificate, and an input that accepted one would be asking a reader to
       hand over a key so it could be thrown away. */
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-control text-ink">{label}</span>
        <span className="flex items-center gap-2.5 rounded-sm border border-hairline bg-card px-3.5 py-3">
          <Icon name="doc" size="sm" className="text-ink-mute" />
          <Mono className="min-w-0 flex-1 truncate text-body-sm text-ink-dim">{field.value}</Mono>
        </span>
      </div>
    )
  }

  if (field.type === 'secret') {
    return <SecretField id={id} label={label} field={field} value={value} onChange={onChange} />
  }

  return (
    <Field
      id={id}
      label={label}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      // A host or a browse path is typed exactly; autocorrect and
      // auto-capitalisation on a tablet keyboard silently corrupt both.
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      inputClassName={field.mono ? 'mono text-mono' : undefined}
    />
  )
}

/**
 * A credential.
 *
 * Reports whether one is set and when it was last replaced, and accepts a new
 * one. It never receives the current value, because the transport never sends it
 * and the fixture never held it — the value handed in on save is used to stamp a
 * timestamp and then dropped. That is the arrangement the real endpoint will
 * want, and building the demo any other way would leave a form that has to be
 * redesigned the day it is wired up.
 */
function SecretField({ id, label, field, value, onChange }) {
  const { t, i18n } = useTranslation('app')

  return (
    <Field
      id={id}
      label={label}
      type="password"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="new-password"
      hint={
        field.set
          ? t('dataFusion.connection.secretRotated', {
              when: formatRelative(new Date(field.setAt), i18n.language),
            })
          : t('dataFusion.connection.secretHint')
      }
    />
  )
}

/* ── Data Contract ────────────────────────────────────────────────────── */

function ContractTab({ record }) {
  const { t, i18n } = useTranslation(['app', 'common'])

  const facts = [
    ['objectType', t(`dataFusion.sources.unit.${record.unit}`)],
    ['mapped', record.tags ? formatInteger(record.tags) : '—'],
    [
      'latency',
      record.latencyMs == null
        ? '—'
        : t('dataFusion.sources.latency', { seconds: (record.latencyMs / 1000).toFixed(2) }),
    ],
    [
      'lastSync',
      record.lastSyncAt ? formatRelative(new Date(record.lastSyncAt), i18n.language) : '—',
    ],
  ]

  return (
    <div>
      <Eyebrow className="mb-2">{t('dataFusion.connection.provides')}</Eyebrow>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {record.contract.provides.map((kind) => (
          <li key={kind} className="rounded-sm tint-green px-2 py-1 text-micro text-on-green">
            {t(`common:dataKinds.${kind}`)}
          </li>
        ))}
      </ul>

      {/* The half the design leaves out and this product leads with. Stating the
          gap is how a reader knows what the platform is inferring rather than
          what it was told. */}
      <Eyebrow className="mt-5 mb-2">{t('dataFusion.connection.doesNotProvide')}</Eyebrow>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {record.contract.doesNotProvide.map((kind) => (
          <li
            key={kind}
            className="rounded-sm bg-sunken px-2 py-1 text-micro font-normal text-ink-dim line-through decoration-ink-mute"
          >
            {t(`common:dataKinds.${kind}`)}
          </li>
        ))}
      </ul>

      <p className="mt-3.5 mb-0 max-w-[52ch] text-micro font-normal text-ink-dim">
        {record.contract.fromAnchor
          ? t('dataFusion.connection.contractAnchored')
          : t('dataFusion.connection.contractFamily')}
      </p>

      <dl className="mt-5 mb-0 grid grid-cols-2 gap-2.5">
        {facts.map(([key, printed]) => (
          <div key={key} className="rounded-sm border border-hairline bg-card px-3.5 py-3">
            <dt className="eyebrow">{t(`dataFusion.connection.facts.${key}`)}</dt>
            <dd className="m-0 mt-1">
              <Num className="text-title">{printed}</Num>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ── Activity ─────────────────────────────────────────────────────────── */

const ACTIVITY_TONE = {
  syncFailed: 'text-on-red',
  syncCompleted: 'text-ink',
  syncStarted: 'text-ink',
  configUpdated: 'text-ink',
  connectionTested: 'text-ink',
}

function ActivityTab({ record }) {
  const { t, i18n } = useTranslation(['app', 'common'])

  if (!record.activity.length) {
    return (
      <EmptyState
        icon="plug"
        title={t('dataFusion.connection.activityEmpty')}
        body={t('dataFusion.connection.activityEmptyBody')}
      />
    )
  }

  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {record.activity.map((entry, index) => (
        <li
          key={`${entry.kind}-${entry.at}-${index}`}
          className="flex gap-3.5 border-b border-subtle py-2.5 last:border-0"
        >
          <time
            dateTime={entry.at}
            className="w-[6.5rem] shrink-0 text-micro font-normal text-ink-dim tabular-nums"
          >
            {formatRelative(new Date(entry.at), i18n.language)}
          </time>
          <div className="min-w-0 flex-1">
            <p className={cn('m-0 text-body-sm', ACTIVITY_TONE[entry.kind])}>
              {t(`dataFusion.connection.activity.${entry.kind}`)}
            </p>
            <ActivityDetail entry={entry} />
          </div>
        </li>
      ))}
    </ol>
  )
}

function ActivityDetail({ entry }) {
  const { t } = useTranslation('app')

  if (entry.kind === 'syncCompleted') {
    return (
      <Num className="text-micro font-normal text-ink-dim">
        {t('dataFusion.connection.activityCount', {
          count: formatInteger(entry.count ?? 0),
          unit: t(`dataFusion.sources.unit.${entry.unit}`),
        })}
      </Num>
    )
  }
  if (entry.kind === 'syncFailed' && entry.reason) {
    return (
      <p className="m-0 text-micro font-normal text-ink-dim">
        {t(`dataFusion.sources.error.${entry.reason}`)}
      </p>
    )
  }
  if (entry.kind === 'configUpdated') {
    return (
      <Num className="text-micro font-normal text-ink-dim">
        {t('dataFusion.connection.activityChanged', { count: entry.changed })}
      </Num>
    )
  }
  if (entry.kind === 'connectionTested') {
    return (
      <p className="m-0 text-micro font-normal text-ink-dim">
        {t(
          entry.ok
            ? 'dataFusion.connection.activityTestOk'
            : 'dataFusion.connection.activityTestFailed',
        )}
      </p>
    )
  }
  return null
}

/* ── Mapping ──────────────────────────────────────────────────────────── */

/**
 * What this connection is bound to.
 *
 * One table for four families. The columns come from the response rather than
 * from a switch here, because what differs between a historian and an ERP is the
 * columns and nothing else — the row is an id, a link and a list of cells in all
 * four cases.
 *
 * The count above it is the sentence the screen exists to make: N bound, M
 * waiting. Those two are halves of one population, so the waiting figure is a
 * link to the queue holding them rather than a number to look at.
 */
function MappingTab({ record }) {
  const { t } = useTranslation(['app', 'common'])
  const mapping = record.mapping

  if (!mapping) return null

  return (
    <div>
      <p className="mt-0 mb-3.5 text-body-sm text-ink-dim">
        <Num>{t('dataFusion.mapping.summary', { bound: mapping.bound })}</Num>
        {mapping.unbound > 0 ? (
          <>
            {' · '}
            <Link
              to="/app/data-fusion/context"
              className="font-semibold text-on-forge underline decoration-from-font"
            >
              <Num>{t('dataFusion.mapping.unbound', { count: mapping.unbound })}</Num>
            </Link>
          </>
        ) : null}
      </p>

      {mapping.blocked ? (
        <EmptyState
          icon="plug"
          title={t(`dataFusion.mapping.blocked.${mapping.blocked}`)}
          body={t(`dataFusion.mapping.blockedBody.${mapping.blocked}`)}
        />
      ) : null}

      {mapping.rows.length ? (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              {t('dataFusion.mapping.tableCaption', { source: record.name })}
            </caption>
            <thead>
              <tr>
                {mapping.columns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className="eyebrow bg-sunken px-3.5 py-2 text-start whitespace-nowrap"
                  >
                    {t(`dataFusion.mapping.columns.${column.id}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapping.rows.map((row) => (
                <tr key={row.id} className="border-t border-subtle hover:bg-sunken">
                  {mapping.columns.map((column, index) => (
                    <td key={column.id} className="px-3.5 py-2 align-top">
                      {/* The link is on the first cell only. A row of five links
                          to one place is five tab stops to reach the next row. */}
                      {index === 0 ? (
                        <Link
                          to={row.href}
                          className="text-body-sm text-ink transition-colors hover:text-on-forge"
                        >
                          <Cell cell={row.cells[index]} mono={column.mono} />
                        </Link>
                      ) : (
                        <Cell cell={row.cells[index]} mono={column.mono} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Said out loud rather than filtered away. A connector that offers more
          than this deployment consumes is worth knowing before somebody spends a
          morning looking for the spare parts. */}
      {mapping.unconsumed.length ? (
        <div className="mt-4 border-t border-subtle pt-3.5">
          <Eyebrow className="mb-1.5">{t('dataFusion.mapping.unconsumed')}</Eyebrow>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {mapping.unconsumed.map((entry) => (
              <li
                key={entry}
                className="rounded-pill bg-sunken px-2.5 py-[3px] text-micro font-normal text-ink-dim"
              >
                {t(`common:dataKinds.${entry}`)}
              </li>
            ))}
          </ul>
          <p className="mt-2 mb-0 max-w-[52ch] text-micro font-normal text-ink-dim">
            {t('dataFusion.mapping.unconsumedBody')}
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** A literal, a data kind, or a delivery target. The fixture decides which. */
function Cell({ cell, mono }) {
  const { t } = useTranslation(['app', 'common'])

  const printed = cell?.kindKey
    ? t(`common:dataKinds.${cell.kindKey}`)
    : cell?.targetKey
      ? t(`dataFusion.pipelines.target.${cell.targetKey}`)
      : cell?.text

  if (printed == null) return <span className="text-ink-mute">—</span>
  return mono ? (
    <Mono className="text-body-sm">{printed}</Mono>
  ) : (
    <span className="text-body-sm text-ink-dim">{printed}</span>
  )
}

/* ── Write-back rules · business systems ──────────────────────────────── */

/**
 * What Forge pushes back into the system of record.
 *
 * Every rule is off when the connection is read-only, and that is read from the
 * Sync direction select on the Connection tab rather than stated again here — so
 * the two tabs cannot describe two different connections. The prototype draws six
 * live toggles beside a connection whose own form says Read-only.
 */
function WritebackTab({ record, id }) {
  const { t } = useTranslation(['app', 'common'])
  const rule = useWritebackRule(id)
  const writeback = record.writeback

  return (
    <div>
      <p className="mt-0 mb-3.5 max-w-[52ch] text-body-sm text-ink-dim">
        {t(
          writeback.enabled
            ? 'dataFusion.writeback.intro'
            : 'dataFusion.writeback.readOnly',
        )}
      </p>

      <ul className="m-0 flex list-none flex-col p-0">
        {writeback.rules.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-3.5 border-b border-subtle py-3 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="m-0 text-body-sm font-semibold text-ink">
                {t(`dataFusion.writeback.rules.${entry.id}`)}
              </p>
              {/* The Forge object it would create, linked. A write-back rule
                  naming something this product does not have is not a rule. */}
              {entry.href ? (
                <Link
                  to={entry.href}
                  className="text-micro font-normal text-ink-dim transition-colors hover:text-on-forge"
                >
                  {t(`dataFusion.pipelines.target.${entry.object}`)}
                </Link>
              ) : null}
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2">
              <span className="sr-only">{t(`dataFusion.writeback.rules.${entry.id}`)}</span>
              <input
                type="checkbox"
                className="accent-forge"
                checked={writeback.enabled && entry.enabled}
                disabled={!writeback.enabled || rule.isPending}
                onChange={(event) =>
                  rule.mutate({ ruleId: entry.id, enabled: event.target.checked })
                }
              />
            </label>
          </li>
        ))}
      </ul>

      {writeback.unavailable ? (
        <p className="mt-3.5 mb-0 max-w-[52ch] text-micro font-normal text-ink-dim">
          <Num>{t('dataFusion.writeback.unavailable', { count: writeback.unavailable })}</Num>
        </p>
      ) : null}
    </div>
  )
}

/* ── ROI and recipes · vision ─────────────────────────────────────────── */

/**
 * The inspection regions and the recipes that read them.
 *
 * Which recipe is running is not a badge somebody set: it is the Inspection
 * program the Connection tab has selected. Change the select, save, and the
 * active row moves.
 */
function RoiTab({ record }) {
  const { t } = useTranslation('app')
  const roi = record.roi

  return (
    <div>
      <Eyebrow className="mb-2">{t('dataFusion.roi.regions')}</Eyebrow>
      {/* A schematic of a frame, not a photograph. Labelled as a figure rather
          than left as decoration a screen reader has to skip. */}
      <figure
        className="m-0 rounded-sm border border-hairline bg-sunken"
        style={{ aspectRatio: '16 / 9' }}
      >
        <svg viewBox="0 0 100 56" className="block h-full w-full" role="img"
          aria-label={t('dataFusion.roi.diagramLabel', { count: roi.regions.length })}>
          {roi.regions.map((region) => (
            <g key={region.id}>
              <rect
                x={region.x}
                y={(region.y / 100) * 56}
                width={region.w}
                height={(region.h / 100) * 56}
                fill="none"
                stroke="var(--hue-forge)"
                strokeWidth="0.5"
                rx="1"
              />
              <text
                x={region.x}
                y={(region.y / 100) * 56 - 1.5}
                fill="var(--hue-forge)"
                fontSize="2.6"
              >
                {t(`dataFusion.roi.region.${region.id}`)}
              </text>
            </g>
          ))}
        </svg>
      </figure>

      <Eyebrow className="mt-5 mb-2">{t('dataFusion.roi.recipes')}</Eyebrow>
      <ul className="m-0 flex list-none flex-col p-0">
        {roi.recipes.map((recipe) => (
          <li
            key={recipe.id}
            className="flex items-center gap-3.5 border-b border-subtle py-2.5 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <Mono className="text-body-sm text-ink">{recipe.id}</Mono>
              <p className="m-0 text-micro font-normal text-ink-dim">
                <Num>{t('dataFusion.roi.threshold', { value: recipe.threshold.toFixed(2) })}</Num>
              </p>
            </div>
            <span
              className={cn(
                'rounded-pill px-2.5 py-[3px] text-micro whitespace-nowrap',
                recipe.active ? 'tint-green text-on-green' : 'bg-sunken text-ink-dim',
              )}
            >
              {t(recipe.active ? 'dataFusion.roi.running' : 'dataFusion.roi.loaded')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
