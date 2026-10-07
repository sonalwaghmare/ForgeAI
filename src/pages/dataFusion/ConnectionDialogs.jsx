import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import {
  MASKED_VALUE,
  buildConnectionConfig,
  missingRequired,
} from '@/features/dataFusion/api'
import {
  useConnection,
  useConnectorTypes,
  useDeleteConnection,
  useTestConnection,
  useUpdateConnection,
} from '@/features/dataFusion/queries'
import { useHierarchyNodes } from '@/features/hierarchy/queries'
import { cn } from '@/lib/cn'
import { probeFromTest } from './ProbePanel'
import {
  ConfigureStep,
  ConnectorStep,
  DetailsStep,
  StepIndicator,
  TestStep,
  WIZARD_STEPS,
} from './wizardSteps'

/**
 * Editing a connection.
 *
 * ── Same wizard shape as Connect-source, on purpose ──────────────────────
 * The prototype's four-step rail is the same on both screens because the mental
 * model is the same: pick a connector, describe it, prove it answers, scope it.
 * Two of those decisions are frozen on edit — the connector is server-immutable
 * (`ConnectionUpdate` has no `connector_type_id`) and the site is too (no
 * `plant_id`) — so those steps are drawn LOCKED rather than dropped: the shape
 * of the flow reads the same, and the reason each control cannot be touched is
 * stated where the control would otherwise take input.
 *
 * ── Why the credential comes back blank ───────────────────────────────────
 * `GET /connections/{id}` masks `auth.password` as eight bullet characters, and
 * `PUT` replaces the whole configuration and then PROBES it before saving. Those
 * two facts together mean the mask cannot be round-tripped: sending it back would
 * have the server try to authenticate with `••••••••` and refuse the update.
 *
 * So the field is blanked and asked for again, with the reason stated. The
 * alternative — prefilling the mask and letting the save fail — is the same work
 * plus a wasted five-second probe plus a confusing error.
 *
 * A blank saved as blank clears the stored credential, which is a legitimate
 * thing to want and a terrible thing to do by accident. The hint says so.
 *
 * ── Test → save, same gate as create ─────────────────────────────────────
 * `_ensure_reachable` runs inside the update, so Save opens a real connection
 * and can take seconds — and a config that does not answer is rejected rather
 * than stored. The step-3 probe is the same real network attempt that create
 * uses, and Save on step 4 stays locked until the probe passes. Editing any
 * field on step 2 clears the verdict and re-locks the gate.
 *
 * ── What cannot be changed ───────────────────────────────────────────────
 * `ConnectionUpdate` accepts name, config and the active flag. `plant_id` and
 * `connector_type_id` are absent from it. See the locked-step notes in
 * `wizardSteps.jsx` for how they are still shown.
 */
export function EditConnectionDialog({ connection, onClose }) {
  const { t } = useTranslation(['app', 'common'])

  if (!connection) return null

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="lg"
      title={t('dataFusion.edit.title', { name: connection.name })}
      description={t('dataFusion.edit.intro')}
    >
      <EditLoader connectionId={connection.id} onClose={onClose} />
    </ForgeDialog>
  )
}

/**
 * Waits for everything the form needs before it renders, then hands it over once.
 *
 * ── Why the schema is resolved here and not inside the wizard ─────────────
 * The wizard's field state is built in a `useState` initialiser, which runs
 * exactly once. If it mounted before the schema was known it would initialise
 * empty and then never prefill — the connector's stored settings would silently
 * vanish from a form whose whole job is to send them back. So nothing renders
 * until every source has landed.
 *
 * ── Two sources for one schema, on purpose ───────────────────────────────
 * `GET /connections/{id}` nests `connector_type`, which is the better source: it
 * is the type this connection actually uses, in one request. But an older server
 * build does not send it, and a detail response that quietly lacks the field
 * produced exactly the failure this comment exists to prevent — an edit dialog
 * with a UUID where the connector name should be and no settings to edit at all.
 *
 * So the catalogue is the fallback. It is a separate endpoint the source table
 * has already loaded and cached, it is keyed by the same id, and it carries the
 * same `config_schema`.
 */
function EditLoader({ connectionId, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const detail = useConnection(connectionId)
  const catalogue = useConnectorTypes()
  const hierarchy = useHierarchyNodes()

  // The hierarchy is in the gate too, even though it only supplies a display
  // name: without it the locked site select would render a UUID and then swap to
  // a name a moment later, which reads as the value having changed. `isPending`
  // goes false on failure as well, so a failed hierarchy falls through to the id
  // rather than holding the dialog on a skeleton forever.
  if (detail.isPending || catalogue.isPending || hierarchy.isPending) {
    return <SkeletonRows count={3} />
  }
  if (detail.isError) {
    return (
      <ErrorState
        error={detail.error}
        title={t('dataFusion.edit.loadFailed')}
        onRetry={detail.refetch}
      />
    )
  }

  const connection = detail.data
  const catalogueTypes = catalogue.data?.items ?? []
  const connectorType =
    connection.connectorType ??
    catalogueTypes.find((type) => type.id === connection.connectorTypeId) ??
    null

  return (
    <EditWizard
      connection={connection}
      connectorType={connectorType}
      catalogue={catalogue}
      catalogueTypes={catalogueTypes}
      hierarchy={hierarchy}
      onClose={onClose}
    />
  )
}

/**
 * The four-step wizard, on the update endpoint.
 *
 * ── Prefill from the stored config, dropping the masked bullets on the way in ─
 * `readPath` walks the connection's nested config by the schema's dotted keys.
 * A field that came back as the mask is initialised blank, because sending the
 * mask back would try to authenticate as `••••••••` and be refused. `wasMasked`
 * remembers which fields those were, so the credential-blanked hint appears on
 * exactly those and nowhere else.
 */
function EditWizard({
  connection,
  connectorType,
  catalogue,
  catalogueTypes,
  hierarchy,
  onClose,
}) {
  const { t } = useTranslation(['app', 'common'])
  const test = useTestConnection()
  const update = useUpdateConnection()

  const [stepIndex, setStepIndex] = useState(0)
  const [showConfigErrors, setShowConfigErrors] = useState(false)

  const fields = useMemo(() => connectorType?.fields ?? [], [connectorType])

  const [values, setValues] = useState(() => {
    const initial = {}
    for (const field of fields) {
      const stored = readPath(connection.config, field.key)
      initial[field.key] =
        stored === MASKED_VALUE
          ? ''
          : field.type === 'checkbox'
            ? Boolean(stored)
            : (stored ?? '')
    }
    return initial
  })
  const [name, setName] = useState(connection.name)
  const [nameError, setNameError] = useState(null)
  const [isActive, setIsActive] = useState(connection.isActive)

  /** Which fields came back masked, so the hint appears on exactly those. */
  const wasMasked = useMemo(
    () =>
      new Set(
        fields
          .filter((field) => readPath(connection.config, field.key) === MASKED_VALUE)
          .map((field) => field.key),
      ),
    [fields, connection.config],
  )

  const step = WIZARD_STEPS[stepIndex]
  const missing = connectorType ? missingRequired(fields, values) : {}
  const passed = test.data?.reachable === true

  function setValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }))
    // The result described the configuration as it was, not as it now is.
    if (test.data || test.error) test.reset()
    if (update.error) update.reset()
  }

  function editName(next) {
    setName(next)
    if (nameError) setNameError(null)
    if (update.error) update.reset()
    // Name is not part of `connection_config`, so a probe result survives an
    // edit to it — unlike every field below.
  }

  function runTest() {
    test.mutate({
      connectorTypeId: connection.connectorTypeId,
      connectionConfig: buildConnectionConfig(fields, values),
    })
  }

  /**
   * Step 2 → step 3, gated on the form being complete.
   *
   * Same gate the create wizard uses. A required field left blank reads as a
   * network problem on step 3; catching it here points the reader at the
   * missing control while it is on screen.
   */
  function advanceFromConfigure() {
    setShowConfigErrors(true)
    const blankName = !name.trim()
    if (blankName) setNameError(t('dataFusion.edit.nameRequired'))
    if (blankName || Object.keys(missing).length) return
    setStepIndex(2)
  }

  function submit() {
    update.mutate(
      {
        id: connection.id,
        name,
        // Rebuilt from the same function the probe used, so what is stored is
        // what was tested rather than a second assembly that could drift.
        connectionConfig: buildConnectionConfig(fields, values),
        isActive,
      },
      { onSuccess: onClose },
    )
  }

  function back() {
    // A failure from step 4 has no business still being on screen once the
    // configuration behind it is being changed.
    update.reset()
    setStepIndex((index) => index - 1)
  }

  // Same gate as create. On step 1 the connector is locked but still selected,
  // so canAdvance is Boolean(connectorType) — the fallback for a broken response
  // is null, in which case there is nothing to edit and Continue has to stay
  // locked.
  const canAdvance =
    step === 'connector' ? Boolean(connectorType) : step === 'test' ? passed : true

  return (
    <>
      <StepIndicator current={stepIndex} />

      {step === 'connector' ? (
        <ConnectorStep
          catalogue={catalogue}
          types={catalogueTypes}
          selectedId={connection.connectorTypeId}
          onSelect={() => {}}
          onAdvance={() => {}}
          locked
        />
      ) : step === 'configure' ? (
        <ConfigureStep
          connector={connectorType}
          name={name}
          nameError={nameError}
          onNameChange={editName}
          values={values}
          missing={showConfigErrors ? missing : {}}
          wasMasked={wasMasked}
          onChange={setValue}
          serverFields={update.error?.fields ?? {}}
        />
      ) : step === 'test' ? (
        <TestStep
          connector={connectorType}
          values={values}
          probe={probeFromTest(test)}
          onTest={runTest}
        />
      ) : (
        <DetailsStep
          hierarchy={hierarchy}
          plantId={connection.plantId}
          onPlantChange={() => {}}
          isActive={isActive}
          onActiveChange={(next) => {
            setIsActive(next)
            if (update.error) update.reset()
          }}
          writeError={update.error}
          siteLocked
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <ForgeButton
          variant="primary"
          disabled={!canAdvance || update.isPending}
          onClick={
            step === 'details'
              ? submit
              : step === 'configure'
                ? advanceFromConfigure
                : () => setStepIndex((index) => index + 1)
          }
        >
          {step === 'details'
            ? update.isPending
              ? t('dataFusion.edit.saving')
              : t('dataFusion.edit.save')
            : t('dataFusion.connect.continue')}
        </ForgeButton>
        <ForgeButton disabled={update.isPending} onClick={stepIndex === 0 ? onClose : back}>
          {stepIndex === 0 ? t('common:actions.cancel') : t('dataFusion.connect.back')}
        </ForgeButton>
      </div>
    </>
  )
}

/* ══ DELETE ════════════════════════════════════════════════════════════ */

/**
 * Removing a connection.
 *
 * The copy says what stops and what does not. The delete is soft, so the row
 * keeps its identity and drops out of the listing — and it does NOT reach into the
 * sensors that read from this connection. They keep a `data_source_connection_id`
 * pointing at a record no listing returns, which is worth saying rather than
 * implying a cascade that does not happen.
 */
export function DeleteConnectionDialog({ connection, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const remove = useDeleteConnection()

  if (!connection) return null

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
      title={t('dataFusion.remove.title', { name: connection.name })}
      footer={
        <>
          <ForgeButton
            variant="danger"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(connection.id, {
                onSuccess: () => {
                  remove.reset()
                  onClose()
                },
              })
            }
          >
            {remove.isPending ? t('dataFusion.remove.removing') : t('dataFusion.remove.confirm')}
          </ForgeButton>
          <ForgeButton disabled={remove.isPending} onClick={onClose}>
            {t('common:actions.cancel')}
          </ForgeButton>
        </>
      }
    >
      {remove.error ? (
        <WriteFailed error={remove.error} title={t('dataFusion.remove.failed')} />
      ) : null}
      <p className={cn('m-0 text-body text-ink-dim', remove.error && 'mt-4')}>
        {t('dataFusion.remove.body')}
      </p>
    </ForgeDialog>
  )
}

/* ══ SHARED ════════════════════════════════════════════════════════════ */

/**
 * A failed write, stated inside the dialog that attempted it. A dialog that closes
 * on failure, or sits there looking idle, is how a record that was never changed
 * gets reported as one that vanished.
 */
function WriteFailed({ error, title }) {
  const { t } = useTranslation(['app', 'common'])
  return (
    <div role="alert" className="rounded-sm border border-hairline stripe-red bg-card p-3.5">
      <p className="m-0 text-control text-on-red">{title}</p>
      <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">{t(`common:${error.messageKey}`)}</p>
      {error.requestId ? (
        <p className="mono mt-2 mb-0 text-micro font-normal text-ink-dim">
          {t('common:errors.requestId', { id: error.requestId })}
        </p>
      ) : null}
    </div>
  )
}

/** Reads a dotted schema key out of the stored config, which is nested. */
function readPath(config, key) {
  if (!config) return undefined
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), config)
}
