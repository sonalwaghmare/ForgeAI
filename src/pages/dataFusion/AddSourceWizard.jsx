import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Mono, Num } from '@/components/forge/primitives'
import {
  useConnectorCatalogue,
  useCreateSource,
  useProbeConnector,
} from '@/features/dataFusion/sources'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ConnectionField } from './ConnectionDrawer'
import { StepIndicator } from './wizardSteps'

/**
 * Connect a source, in four steps.
 *
 * DEMO. See `DEMO-MODE.md` §8.10, pass 3. The four families this module invented;
 * IoT has its own wizard on live endpoints in `ConnectSourceWizard`, and the two
 * do not share a payload because they do not share a resource.
 *
 * ── What comes out is a row, not a toast ──────────────────────────────────
 * The source is appended to the registry every other screen reads, so it appears
 * in its family's table, counts in the overview, opens in the drawer, and — once
 * it publishes tags — turns up on the Contextualisation queue. A wizard whose
 * only effect is a confirmation message is a wizard nobody can check.
 *
 * ── And the row says Disconnected · never synced ──────────────────────────
 * Which is the truth about a connection made ten seconds ago. The prototype ends
 * with a green Connected pill, and every demo of it has to skip past the moment
 * where somebody asks how it synced before it existed. The rung pass 2a added to
 * the status ladder is what makes the honest answer available here.
 *
 * ── Step 1 fixes the protocol for good ────────────────────────────────────
 * Picking Rockwell FactoryTalk is picking ODBC. That is why the drawer offers no
 * way to change it afterwards, and why Databases & Cloud has no driver select:
 * `/v1/connections` states that `connector_type_id` is not updatable, and these
 * families obey the rule the live resource does.
 *
 * ── Step 2 asks for what a connection cannot exist without ────────────────
 * Three or four fields, not the thirteen the profile declares and not the
 * arbitrary first eight the prototype slices. The rest take their schema defaults
 * and are editable in the drawer the moment this closes — and the step says so,
 * rather than leaving somebody to find five values they never chose.
 *
 * ── Step 3 is a gate ──────────────────────────────────────────────────────
 * Continue stays locked until the probe answers. Changing the endpoint afterwards
 * clears the result and re-locks it: a tick earned by an address that has since
 * been edited is the wrong answer displayed confidently. Same rule the live
 * wizard applies, for the same reason.
 *
 * ── Step 4 decides how much there is ──────────────────────────────────────
 * The object count follows the scope rather than being carried over from step 3,
 * so the connection cannot report one figure while discovering and a different
 * one once it exists. A gateway is scoped to a line and reads that line's
 * machines, so its site derives from them the way every other source's does. An
 * enterprise system is scoped to nothing, because SAP is not at a plant.
 */

const STEPS = ['connector', 'configure', 'probe', 'scope']

export function AddSourceWizard({ open, section, category, onClose }) {
  // Not mounted until it opens, so state resets between uses and no catalogue
  // request goes out for a dialog nobody opened.
  if (!open) return null
  return <Wizard section={section} category={category} onClose={onClose} />
}

function Wizard({ section, category, onClose }) {
  const { t } = useTranslation(['app', 'common'])

  const [step, setStep] = useState(0)
  const [connector, setConnector] = useState(null)
  const [name, setName] = useState('')
  const [values, setValues] = useState({})
  const [lineId, setLineId] = useState(null)
  const [schedule, setSchedule] = useState(null)

  const catalogue = useConnectorCatalogue(category)
  const probe = useProbeConnector()
  const create = useCreateSource()

  const data = catalogue.data
  const endpointField = data?.fields.find((field) => field.bind === 'endpoint') ?? null
  const endpoint = endpointField ? (values[endpointField.id] ?? '') : ''

  const scopes = data?.scopes ?? []
  const scope = scopes.find((option) => option.id === lineId) ?? null
  const needsScope = Boolean(data?.scopesAssets)
  const objects = needsScope ? (scope?.objects ?? 0) : (data?.enterpriseObjects ?? null)

  function edit(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    /* Editing the endpoint invalidates a probe that was run against the old one.
       Every other field is part of the same connection, so the safe rule is to
       clear on any change rather than to reason about which ones the far end
       would have cared about. */
    probe.reset()
  }

  const canContinue =
    step === 0
      ? Boolean(connector)
      : step === 1
        ? Boolean(endpoint.trim())
        : step === 2
          ? probe.data?.ok === true
          : needsScope
            ? Boolean(lineId) && Boolean(schedule)
            : Boolean(schedule)

  function submit() {
    create.mutate(
      {
        category,
        connector: connector.name,
        protocol: connector.protocol,
        name: name.trim() || connector.name,
        endpoint: endpoint.trim(),
        lineId,
        schedule,
        values,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="lg"
      title={t('dataFusion.newSource.title', { family: t(`dataFusion.sections.${section}`) })}
      description={t('dataFusion.newSource.subtitle', {
        unit: t(`dataFusion.sources.unit.${data?.unit ?? 'tags'}`).toLowerCase(),
      })}
      footer={
        <>
          <ForgeButton onClick={step === 0 ? onClose : () => setStep((current) => current - 1)}>
            {step === 0 ? t('common:actions.cancel') : t('common:actions.back')}
          </ForgeButton>
          <span className="flex-1" />
          {step < STEPS.length - 1 ? (
            <ForgeButton
              variant="primary"
              disabled={!canContinue}
              onClick={() => setStep((current) => current + 1)}
            >
              {t('common:actions.continue')}
            </ForgeButton>
          ) : (
            <ForgeButton
              variant="primary"
              disabled={!canContinue || create.isPending}
              onClick={submit}
            >
              {create.isPending
                ? t('dataFusion.newSource.creating')
                : t('dataFusion.newSource.create')}
            </ForgeButton>
          )}
        </>
      }
    >
      {catalogue.isPending ? (
        <SkeletonRows count={4} />
      ) : catalogue.isError ? (
        <ErrorState
          error={catalogue.error}
          title={t('dataFusion.newSource.catalogueFailed')}
          onRetry={catalogue.refetch}
        />
      ) : (
        <>
          <StepIndicator current={step} steps={STEPS} ns="dataFusion.newSource.steps" />

          {step === 0 ? (
            <ConnectorStep
              connectors={data.connectors}
              selected={connector}
              onSelect={setConnector}
              onAdvance={() => setStep(1)}
            />
          ) : step === 1 ? (
            <ConfigureStep
              connector={connector}
              name={name}
              onName={setName}
              fields={data.fields}
              values={values}
              onEdit={edit}
            />
          ) : step === 2 ? (
            <ProbeStep
              probe={probe}
              endpoint={endpoint}
              onRun={() => probe.mutate({ category, endpoint })}
            />
          ) : (
            <ScopeStep
              needsScope={needsScope}
              scopes={scopes}
              lineId={lineId}
              onLine={setLineId}
              schedules={data.schedules}
              schedule={schedule}
              onSchedule={setSchedule}
              objects={objects}
              unit={data.unit}
            />
          )}

          {create.isError ? (
            <p className="mt-4 mb-0 rounded-sm border border-hairline stripe-red bg-card px-3.5 py-3 text-body-sm text-on-red">
              {t('dataFusion.newSource.createFailed')}
            </p>
          ) : null}
        </>
      )}
    </ForgeDialog>
  )
}

/* ══ STEP 1 — CONNECTOR ══════════════════════════════════════════════════ */

/**
 * The catalogue.
 *
 * Vendor product names, printed as they are: a proper noun does not translate,
 * and neither does the protocol beside it. Clicking advances, arrowing does not —
 * the same separation the live wizard makes, so a keyboard user can look through
 * the list without being carried out of it.
 */
function ConnectorStep({ connectors, selected, onSelect, onAdvance }) {
  const { t } = useTranslation('app')

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">{t('dataFusion.newSource.chooseConnector')}</legend>
      <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
        {connectors.map((entry) => {
          const checked = selected?.name === entry.name
          return (
            <label
              key={entry.name}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-sm border bg-card p-3.5 transition-colors',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-on-forge',
                checked
                  ? 'border-forge tint-forge'
                  : 'border-hairline hover:border-forge/40 hover:bg-sunken',
              )}
            >
              <input
                type="radio"
                name="fusion-connector"
                value={entry.name}
                checked={checked}
                onChange={() => onSelect(entry)}
                onClick={(event) => {
                  if (event.detail > 0) onAdvance()
                }}
                className="sr-only"
              />
              <Icon name="plug" size="sm" className="shrink-0 text-ink-mute" />
              <span className="min-w-0">
                <span className="block text-body-sm font-semibold text-ink" translate="no">
                  {entry.name}
                </span>
                <Mono className="block text-micro text-ink-dim">{entry.protocol}</Mono>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/* ══ STEP 2 — CONFIGURE ══════════════════════════════════════════════════ */

function ConfigureStep({ connector, name, onName, fields, values, onEdit }) {
  const { t } = useTranslation('app')

  return (
    <div className="flex flex-col gap-4">
      <Field
        id="fusion-new-name"
        label={t('dataFusion.newSource.displayName')}
        value={name}
        placeholder={connector.name}
        onChange={(event) => onName(event.target.value)}
        hint={t('dataFusion.newSource.displayNameHint')}
      />

      {/* The same renderer the drawer uses, over the same schema. Two forms over
          one schema is the point of having a schema. */}
      {fields.map((field) => (
        <ConnectionField
          key={field.id}
          field={field}
          value={values[field.id] ?? field.value}
          onChange={(next) => onEdit(field.id, next)}
        />
      ))}

      <p className="m-0 max-w-[60ch] text-micro font-normal text-ink-dim">
        {t('dataFusion.newSource.defaultsNote')}
      </p>
    </div>
  )
}

/* ══ STEP 3 — PROBE ══════════════════════════════════════════════════════ */

function ProbeStep({ probe, endpoint, onRun }) {
  const { t } = useTranslation('app')
  const result = probe.data

  return (
    <div>
      <p className="mt-0 mb-4 text-body-sm text-ink-dim">
        {t('dataFusion.newSource.probeAgainst')}{' '}
        <Mono className="text-body-sm text-ink">{endpoint}</Mono>
      </p>

      {!result ? (
        <div className="rounded-sm border border-hairline bg-sunken px-4 py-6 text-center">
          <p className="m-0 text-body-sm font-semibold text-ink">
            {probe.isPending
              ? t('dataFusion.newSource.probing')
              : t('dataFusion.newSource.probeReady')}
          </p>
          <p className="mt-1.5 mb-4 text-body-sm text-ink-dim">
            {t('dataFusion.newSource.probeReadyBody')}
          </p>
          <ForgeButton variant="primary" disabled={probe.isPending} onClick={onRun}>
            {t('dataFusion.newSource.probeRun')}
          </ForgeButton>
        </div>
      ) : result.ok ? (
        <>
          <p className="m-0 rounded-sm border border-hairline tint-green px-3.5 py-3 text-body-sm text-on-green">
            {t('dataFusion.newSource.probeOk')}
          </p>
          {/* A sample of the address space, not a total. How much this connection
              will carry is the next step's question, and answering it here is
              how the prototype ends up creating a source whose figure differs
              from the one it discovered. */}
          <p className="mt-4 mb-1.5 text-micro font-semibold text-ink-dim uppercase">
            {t('dataFusion.newSource.discovered')}
          </p>
          <ul className="m-0 flex list-none flex-col p-0">
            {result.objects.map((object) => (
              <li
                key={object.name}
                className="flex items-baseline gap-3 border-b border-subtle py-2 last:border-0"
              >
                <Mono className="min-w-0 flex-1 truncate text-body-sm text-ink">
                  {object.name}
                </Mono>
                <span className="shrink-0 text-micro font-normal text-ink-dim">
                  {t(`dataFusion.newSource.objectKind.${object.kind}`)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="m-0 rounded-sm border border-hairline stripe-red bg-card px-3.5 py-3 text-body-sm text-on-red">
          {t(`dataFusion.newSource.probeFailed.${result.reason}`)}
        </p>
      )}
    </div>
  )
}

/* ══ STEP 4 — SCOPE AND SCHEDULE ═════════════════════════════════════════ */

function ScopeStep({
  needsScope,
  scopes,
  lineId,
  onLine,
  schedules,
  schedule,
  onSchedule,
  objects,
  unit,
}) {
  const { t } = useTranslation('app')

  return (
    <div className="flex flex-col gap-4">
      {needsScope ? (
        <ForgeSelect
          id="fusion-new-scope"
          label={t('dataFusion.newSource.scopeLine')}
          hint={t('dataFusion.newSource.scopeLineHint')}
          value={lineId ?? ''}
          onValueChange={onLine}
          options={scopes.map((option) => ({
            value: option.id,
            label: `${option.name} · ${option.siteName}`,
          }))}
        />
      ) : (
        /* No line select for an enterprise system. SAP is not at a plant, and a
           control that made it look as though it could be is a control that
           produces a wrong answer whichever way it is set. */
        <p className="m-0 rounded-sm border border-hairline bg-sunken px-3.5 py-3 text-body-sm text-ink-dim">
          {t('dataFusion.newSource.scopeEnterprise')}
        </p>
      )}

      <ForgeSelect
        id="fusion-new-schedule"
        label={t('dataFusion.newSource.schedule')}
        hint={t('dataFusion.newSource.scheduleHint')}
        value={schedule ?? ''}
        onValueChange={onSchedule}
        options={schedules.map((value) => ({
          value,
          label: t(`dataFusion.pipelines.schedule.${value}`),
        }))}
      />

      {/* What this will actually create, before it is created. Every figure on it
          is the one the row will carry. */}
      {(!needsScope || lineId) && schedule ? (
        <dl className="m-0 grid grid-cols-2 gap-2.5">
          <div className="rounded-sm border border-hairline bg-card px-3.5 py-3">
            <dt className="eyebrow">{t(`dataFusion.sources.unit.${unit}`)}</dt>
            <dd className="m-0 mt-1">
              <Num className="text-title">{formatInteger(objects ?? 0)}</Num>
            </dd>
          </div>
          <div className="rounded-sm border border-hairline bg-card px-3.5 py-3">
            <dt className="eyebrow">{t('dataFusion.sources.columns.status')}</dt>
            <dd className="m-0 mt-1 text-title text-on-red">
              {t('dataFusion.sources.error.neverSynced')}
            </dd>
          </div>
        </dl>
      ) : null}

      <p className="m-0 max-w-[60ch] text-micro font-normal text-ink-dim">
        {t('dataFusion.newSource.neverSyncedNote')}
      </p>
    </div>
  )
}
