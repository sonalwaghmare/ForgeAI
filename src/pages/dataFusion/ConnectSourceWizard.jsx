import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { buildConnectionConfig, missingRequired } from '@/features/dataFusion/api'
import {
  useConnectorTypes,
  useCreateConnection,
  useTestConnection,
} from '@/features/dataFusion/queries'
import { useHierarchyNodes } from '@/features/hierarchy/queries'
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
 * Connect source. The design prototype's four-step wizard, on live endpoints.
 *
 *   1  Connector      GET  /connections/connector-types
 *   2  Configuration  the connector type's own `config_schema.fields`
 *   3  Test           POST /connections/test  — a gate, not a formality
 *   4  Details        POST /connections       — the write
 *
 * ── Where this came from ──────────────────────────────────────────────────
 * The structure is `DFConnectWizard` in the Claude Design project
 * (`platform/screens-datafusion.jsx`): a 2-column connector catalogue that
 * advances on click, a generated configuration step led by Display name, a
 * full-panel test with an icon tile and a progress bar, and a closing step that
 * scopes the connection. Measurements, hierarchy, copy tone and footer wording
 * follow it. Colour and type come from this product's own system, so the dialog
 * belongs to the page it opens over and works in both themes.
 *
 * Two things in the prototype's fourth step are gone rather than drawn: an
 * auto-map rule, a default line, a sync schedule and a queue-unmatched toggle.
 * `ConnectionCreate` has no column for any of them, so each one would take a
 * decision and discard it. A form that silently drops what you tell it is worse
 * than a form that never asked. What remains is the payload: name, site, and
 * whether to start reading.
 *
 * ── Step 2 is generated, not written ──────────────────────────────────────
 * Nothing here knows what an MQTT broker needs. `config_schema.fields` names,
 * orders, types and marks-required every value, so the form is a loop over that
 * array — which means a connector type seeded server-side tomorrow gets a
 * correct form today. Writing MQTT's five fields and OPC-UA's five by hand works
 * exactly once.
 *
 * ── The probe is a real gate ──────────────────────────────────────────────
 * Continue stays locked on step 3 until the test comes back reachable: a genuine
 * network attempt, a full MQTT CONNECT/CONNACK or an OPC-UA session opened and
 * closed. So a pass means the plant network answered, not that the form looks
 * plausible.
 *
 * Editing any field afterwards clears the result and re-locks the gate. A green
 * tick earned by a hostname that has since been changed is worse than no tick:
 * it is the wrong answer, displayed confidently.
 *
 * The stored config is rebuilt by the same function the probe used, so what is
 * saved is what was tested rather than a second assembly that could drift from
 * it.
 *
 * ── Steps live in `wizardSteps.jsx` ──────────────────────────────────────
 * The four step components are shared with the edit dialog. See that module for
 * the read-only variants (locked connector, locked site) — the same shape, on a
 * screen where two of the payload's fields are immutable server-side.
 */

export function ConnectSourceWizard({ open, onClose }) {
  // Not mounted until it opens, so every piece of state inside resets between
  // uses and no catalogue request goes out for a dialog nobody opened.
  if (!open) return null
  return <Wizard onClose={onClose} />
}

function Wizard({ onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const catalogue = useConnectorTypes()
  const test = useTestConnection()
  const create = useCreateConnection()
  // The site list. Live already, and `plant_id` is required by the payload, so
  // this is the one thing on the last step that cannot be typed.
  const hierarchy = useHierarchyNodes()

  const [stepIndex, setStepIndex] = useState(0)
  const [connectorTypeId, setConnectorTypeId] = useState(null)
  /** Keyed by `field.key`, dots and all. */
  const [values, setValues] = useState({})
  const [showConfigErrors, setShowConfigErrors] = useState(false)

  /* The record-level fields, which are the rest of the payload. Name sits on
     step 2 where the prototype puts it; site and the in-service flag close the
     wizard on step 4. */
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(null)
  const [plantId, setPlantId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [siteError, setSiteError] = useState(null)

  const types = useMemo(() => catalogue.data?.items ?? [], [catalogue.data])
  const connector = types.find((entry) => entry.id === connectorTypeId) ?? null

  const step = WIZARD_STEPS[stepIndex]
  const missing = connector ? missingRequired(connector.fields, values) : {}
  const passed = test.data?.reachable === true
  const created = create.data ?? null

  function selectConnector(id) {
    setConnectorTypeId(id)
    // A different connector means a different schema; keeping the old values
    // would carry an MQTT host into an OPC-UA endpoint field by key collision.
    setValues({})
    setShowConfigErrors(false)
    test.reset()
  }

  function setValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }))
    // The result described the configuration as it was, not as it now is.
    if (test.data || test.error) test.reset()
  }

  function editName(next) {
    setName(next)
    if (nameError) setNameError(null)
    if (create.error) create.reset()
    // The name is not part of `connection_config`, so a probe result survives an
    // edit to it — unlike every field below.
  }

  function runTest() {
    test.mutate({
      connectorTypeId: connector.id,
      connectionConfig: buildConnectionConfig(connector.fields, values),
    })
  }

  /**
   * Step 2 → step 3, gated on the form being complete.
   *
   * The prototype advances unconditionally and lets the test fail. That reads as
   * a network problem when it is really an empty field two screens back, so the
   * required-field check runs here instead — the one place the offending controls
   * are on screen to be pointed at.
   */
  function advanceFromConfigure() {
    setShowConfigErrors(true)
    const blankName = !name.trim()
    if (blankName) setNameError(t('dataFusion.connect.nameRequired'))
    if (blankName || Object.keys(missing).length) return
    setStepIndex(2)
  }

  function submit() {
    if (!plantId) {
      setSiteError(t('dataFusion.connect.siteRequired'))
      return
    }

    create.mutate({
      name,
      plantId,
      connectorTypeId: connector.id,
      // Rebuilt from the same function the probe used, so what is stored is what
      // was tested — not a second assembly that could diverge from it.
      connectionConfig: buildConnectionConfig(connector.fields, values),
      isActive,
    })
  }

  function back() {
    // A failure from step 4 has no business still being on screen once the
    // configuration behind it is being changed.
    create.reset()
    setStepIndex((index) => index - 1)
  }

  const canAdvance =
    step === 'connector' ? Boolean(connector) : step === 'test' ? passed : true

  return (
    <ForgeDialog
      open
      onOpenChange={(nextOpen) => {
        // Escape and the overlay are ignored while the create is in flight. The
        // request would carry on regardless, so closing here would create a
        // connection nobody is ever told about.
        if (!nextOpen && !create.isPending) onClose()
      }}
      size="lg"
      title={created ? t('dataFusion.connect.createdTitle') : t('dataFusion.connect.title')}
      description={created ? undefined : t('dataFusion.connect.intro')}
      footer={
        created ? (
          <ForgeButton variant="primary" onClick={onClose}>
            {t('common:actions.close')}
          </ForgeButton>
        ) : (
          <>
            <ForgeButton
              variant="primary"
              disabled={!canAdvance || create.isPending}
              onClick={
                step === 'details'
                  ? submit
                  : step === 'configure'
                    ? advanceFromConfigure
                    : () => setStepIndex((index) => index + 1)
              }
            >
              {step === 'details'
                ? create.isPending
                  ? t('dataFusion.connect.adding')
                  : t('dataFusion.connect.addSource')
                : t('dataFusion.connect.continue')}
            </ForgeButton>
            <ForgeButton disabled={create.isPending} onClick={stepIndex === 0 ? onClose : back}>
              {stepIndex === 0 ? t('common:actions.cancel') : t('dataFusion.connect.back')}
            </ForgeButton>
          </>
        )
      }
    >
      {created ? (
        <CreatedPanel connection={created} connector={connector} />
      ) : (
        <>
          <StepIndicator current={stepIndex} />

          {step === 'connector' ? (
            <ConnectorStep
              catalogue={catalogue}
              types={types}
              selectedId={connectorTypeId}
              onSelect={selectConnector}
              onAdvance={() => setStepIndex(1)}
            />
          ) : step === 'configure' ? (
            <ConfigureStep
              connector={connector}
              name={name}
              nameError={nameError}
              onNameChange={editName}
              values={values}
              missing={showConfigErrors ? missing : {}}
              onChange={setValue}
            />
          ) : step === 'test' ? (
            <TestStep
              connector={connector}
              values={values}
              probe={probeFromTest(test)}
              onTest={runTest}
            />
          ) : (
            <DetailsStep
              hierarchy={hierarchy}
              plantId={plantId}
              onPlantChange={(next) => {
                setPlantId(next)
                setSiteError(null)
                if (create.error) create.reset()
              }}
              isActive={isActive}
              onActiveChange={(next) => {
                setIsActive(next)
                if (create.error) create.reset()
              }}
              siteError={siteError}
              writeError={create.error}
            />
          )}
        </>
      )}
    </ForgeDialog>
  )
}

/* ══ CREATED ═══════════════════════════════════════════════════════════ */

/**
 * The connection exists.
 *
 * It confirms rather than closing straight away, and the reason is not decoration:
 * this write opened a real connection to the plant network to get here. A dialog
 * that vanishes after a five-second probe leaves you unsure whether it worked, and
 * the row it produced is one line in a table you were not looking at.
 */
function CreatedPanel({ connection, connector }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <div className="rounded-sm border border-hairline stripe-green bg-card p-4.5">
      <div className="flex items-start gap-3">
        <Icon name="check" size="lg" className="mt-0.5 shrink-0 text-on-green" />
        <div className="min-w-0">
          <p className="m-0 text-body font-semibold text-ink">{connection.name}</p>
          <p className="mt-1 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-ink-dim">
            {connector ? <span translate="no">{connector.name}</span> : null}
            <span aria-hidden="true">·</span>
            <span>
              {connection.isActive
                ? t('dataFusion.connect.createdActive')
                : t('dataFusion.connect.createdInactive')}
            </span>
          </p>
          <p className="mt-3 mb-0 text-body-sm text-ink-dim">
            {t('dataFusion.connect.createdInList')}
          </p>
        </div>
      </div>
    </div>
  )
}
