import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useImportPeople, usePeople, useTeams } from '@/features/people/queries'
import {
  PEOPLE_IMPORT_FIELDS,
  autoMapPeople,
  peopleTemplateCsv,
  toPersonRecord,
  validatePeople,
} from '@/features/people/import'
import { downloadCsv, parseCsv } from '@/lib/csv'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger } from '@/lib/format'
import { StepIndicator } from '@/pages/dataFusion/wizardSteps'
import { cn } from '@/lib/cn'

/**
 * Bulk import people — Upload → Map → Validate → Review.
 *
 * DEMO, and not a slideshow. It parses a real dropped CSV with the reader the
 * asset import uses, matches its columns, validates every row against the roles,
 * sites and teams that exist, and the last step creates the accounts. They appear
 * in the table, in the task assignee picker if their role does plant work, and in
 * the Import History tab.
 *
 * The prototype has five steps and simulates all of them: it reports 47 valid
 * rows, 3 warnings and 1 error whatever you drop, including nothing. Its fourth
 * step maps unrecognised roles onto real ones — which is a good idea and is not
 * built here, because a row whose role this platform does not have is an error
 * the file should be corrected for rather than a decision to take in a dialog
 * nobody will remember making.
 *
 * ── Errors block a row; warnings do not ───────────────────────────────────
 * The line is whether the platform can store something true. A row with no email
 * has no account to be. A row naming a site this estate does not have still
 * describes a person — they land without one, and the warning says so.
 *
 * ── An import run twice must not double the directory ─────────────────────
 * A row whose email already exists updates that person rather than creating a
 * second account, and the summary says which it did. It is why the endpoint is
 * `import` and not `create`: this is a reconciliation, and it answers with the
 * counts.
 */

const STEPS = ['upload', 'map', 'validate', 'review']

export function PeopleImportWizard({ open, onClose }) {
  // Not mounted until it opens, so state resets between uses.
  if (!open) return null
  return <Wizard onClose={onClose} />
}

function Wizard({ onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const fileInput = useRef(null)

  const people = usePeople()
  const teams = useTeams()
  const runImport = useImportPeople()

  const [step, setStep] = useState(0)
  const [filename, setFilename] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [dragging, setDragging] = useState(false)
  const [parseError, setParseError] = useState(false)

  const context = useMemo(
    () => ({
      roles: (people.data?.options?.roles ?? []).map((role) => role.toLowerCase()),
      siteNames: (people.data?.options?.sites ?? []).map((site) => site.label),
      teamNames: (teams.data?.items ?? []).map((team) => team.name),
      existingEmails: (people.data?.items ?? []).map((person) => person.email.toLowerCase()),
    }),
    [people.data, teams.data],
  )

  const result = useMemo(
    () => (parsed ? validatePeople(parsed.rows, mapping, context) : null),
    [parsed, mapping, context],
  )

  const importable = result?.validated.filter((entry) => entry.level !== 'error') ?? []

  function readFile(file) {
    if (!file) return
    setParseError(false)
    file
      .text()
      .then((text) => {
        const next = parseCsv(text)
        if (!next.columns.length || !next.rows.length) {
          setParseError(true)
          return
        }
        setFilename(file.name)
        setParsed(next)
        setMapping(autoMapPeople(next.columns))
        setStep(1)
      })
      .catch(() => setParseError(true))
  }

  function submit() {
    runImport.mutate(
      {
        filename: filename ?? 'import.csv',
        records: importable.map((entry) => toPersonRecord(entry.row, mapping)),
      },
      {
        onSuccess: (summary) => {
          toast(
            t('settings.imports.done', {
              created: summary.created,
              updated: summary.updated,
              skipped: summary.skipped,
            }),
            'ok',
          )
          onClose()
        },
      },
    )
  }

  const canContinue =
    step === 0
      ? Boolean(parsed)
      : step === 1
        ? PEOPLE_IMPORT_FIELDS.filter((field) => field.required).every((field) => mapping[field.key])
        : step === 2
          ? importable.length > 0
          : true

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      size="xl"
      title={t('settings.imports.title')}
      description={t('settings.imports.subtitle')}
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
            <ForgeButton variant="primary" disabled={runImport.isPending} onClick={submit}>
              <Num>
                {runImport.isPending
                  ? t('settings.imports.importing')
                  : t('settings.imports.commit', { count: importable.length })}
              </Num>
            </ForgeButton>
          )}
        </>
      }
    >
      <StepIndicator current={step} steps={STEPS} ns="settings.imports.steps" />

      {step === 0 ? (
        <div className="grid grid-cols-[1.4fr_1fr] gap-3.5 max-md:grid-cols-1">
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              readFile(event.dataTransfer.files?.[0])
            }}
            className={cn(
              'flex flex-col items-center justify-center rounded-md border-2 border-dashed px-5 py-10 text-center transition-colors',
              dragging ? 'border-forge tint-forge' : 'border-hairline bg-sunken',
            )}
          >
            <Icon name="doc" size="lg" className="mb-3 text-ink-mute" />
            <p className="m-0 text-body font-semibold text-ink">
              {t('settings.imports.dropHere')}
            </p>
            <ForgeButton className="mt-3" onClick={() => fileInput.current?.click()}>
              {t('settings.imports.browse')}
            </ForgeButton>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => readFile(event.target.files?.[0])}
            />
            <p className="mt-3 mb-0 text-micro font-normal text-ink-dim">
              {t('settings.imports.accepts')}
            </p>
            {parseError ? (
              <p className="mt-3 mb-0 text-body-sm text-on-red">
                {t('settings.imports.parseFailed')}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2.5">
            <Panel className="p-3.5">
              <p className="m-0 text-body-sm font-semibold text-ink">
                {t('settings.imports.templateTitle')}
              </p>
              <p className="mt-1 mb-3 text-body-sm text-ink-dim">
                {t('settings.imports.templateBody')}
              </p>
              <ForgeButton
                className="w-full"
                onClick={() => downloadCsv('meridian-users-template.csv', peopleTemplateCsv())}
              >
                {t('settings.imports.downloadTemplate')}
              </ForgeButton>
            </Panel>
            <Panel className="p-3.5">
              <p className="m-0 text-body-sm font-semibold text-ink">
                {t('settings.imports.columnsTitle')}
              </p>
              <ul className="mt-2 mb-0 flex list-none flex-col gap-1 p-0">
                {PEOPLE_IMPORT_FIELDS.map((field) => (
                  <li key={field.key} className="flex items-baseline gap-2">
                    <Mono className="text-micro text-ink">{field.key}</Mono>
                    <span className="text-micro font-normal text-ink-mute">
                      {t(
                        field.required
                          ? 'settings.imports.required'
                          : 'settings.imports.optional',
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      ) : step === 1 ? (
        <MapStep parsed={parsed} mapping={mapping} onChange={setMapping} />
      ) : step === 2 ? (
        <ValidateStep result={result} mapping={mapping} />
      ) : (
        <ReviewStep result={result} filename={filename} count={importable.length} />
      )}
    </ForgeDialog>
  )
}

/* ══ MAP ═════════════════════════════════════════════════════════════════ */

const SKIP = '__skip__'

/**
 * Which source column feeds each field.
 *
 * Guessed first, by normalised contains-matching, because real exports say "Work
 * Email" and "Access Level". Getting four of six right and asking about the other
 * two is the difference between a step somebody reads and one they click through.
 */
function MapStep({ parsed, mapping, onChange }) {
  const { t } = useTranslation('app')

  return (
    <div>
      <p className="mt-0 mb-3.5 text-body-sm text-ink-dim">
        <Num>{t('settings.imports.mapIntro', { count: parsed.rows.length })}</Num>
      </p>
      <Panel flush className="overflow-hidden">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t('settings.imports.mapCaption')}</caption>
          <thead>
            <tr>
              <th scope="col" className="eyebrow bg-sunken px-3.5 py-2.5 text-start">
                {t('settings.imports.systemField')}
              </th>
              <th scope="col" className="eyebrow bg-sunken px-3.5 py-2.5 text-start">
                {t('settings.imports.sourceColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {PEOPLE_IMPORT_FIELDS.map((field) => (
              <tr key={field.key} className="border-t border-subtle">
                <td className="px-3.5 py-2.5">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-body-sm font-semibold text-ink">
                      {t(`settings.imports.fields.${field.key}`)}
                    </span>
                    <span className="text-micro font-normal text-ink-mute">
                      {t(
                        field.required ? 'settings.imports.required' : 'settings.imports.optional',
                      )}
                    </span>
                  </span>
                </td>
                <td className="px-3.5 py-2.5">
                  <ForgeSelect
                    id={`map-${field.key}`}
                    labelHidden
                    size="sm"
                    label={t('settings.imports.mapLabel', {
                      field: t(`settings.imports.fields.${field.key}`),
                    })}
                    value={mapping[field.key] ?? SKIP}
                    onValueChange={(next) =>
                      onChange({ ...mapping, [field.key]: next === SKIP ? null : next })
                    }
                    options={[
                      { value: SKIP, label: t('settings.imports.skip') },
                      ...parsed.columns.map((column) => ({ value: column, label: column })),
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

/* ══ VALIDATE ════════════════════════════════════════════════════════════ */

const LEVEL_TONE = { ready: 'text-ink-dim', warn: 'text-on-amber', error: 'text-on-red' }

function ValidateStep({ result, mapping }) {
  const { t } = useTranslation('app')

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-3 gap-2.5">
        {[
          ['ready', result.ready],
          ['warnings', result.warnings],
          ['errors', result.errors],
        ].map(([key, value]) => (
          <div key={key} className="rounded-sm border border-hairline bg-card px-3.5 py-3">
            <Num
              className={cn(
                'block text-display-sm',
                key === 'errors' && value
                  ? 'text-on-red'
                  : key === 'warnings' && value
                    ? 'text-on-amber'
                    : 'text-ink',
              )}
            >
              {formatInteger(value)}
            </Num>
            <span className="eyebrow mt-1.5 block">{t(`settings.imports.${key}`)}</span>
          </div>
        ))}
      </div>

      <Panel flush className="max-h-[22rem] overflow-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t('settings.imports.validateCaption')}</caption>
          <thead>
            <tr>
              <th scope="col" className="eyebrow bg-sunken px-3.5 py-2 text-start">
                {t('settings.imports.row')}
              </th>
              <th scope="col" className="eyebrow bg-sunken px-3.5 py-2 text-start">
                {t('settings.imports.fields.name')}
              </th>
              <th scope="col" className="eyebrow bg-sunken px-3.5 py-2 text-start">
                {t('settings.imports.issues')}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.validated.map((entry) => (
              <tr key={entry.index} className="border-t border-subtle">
                <td className="px-3.5 py-2">
                  <Num className="text-body-sm text-ink-mute">{entry.index + 2}</Num>
                </td>
                <td className="px-3.5 py-2 text-body-sm text-ink">
                  {mapping.name ? entry.row[mapping.name] : '—'}
                </td>
                <td className={cn('px-3.5 py-2 text-body-sm', LEVEL_TONE[entry.level])}>
                  {entry.issues.length
                    ? entry.issues
                        .map((issue) =>
                          t(`settings.imports.issue.${issue.key}`, {
                            field: t(`settings.imports.fields.${issue.field}`),
                            value: issue.value ?? '',
                          }),
                        )
                        .join(' · ')
                    : t('settings.imports.ok')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

/* ══ REVIEW ══════════════════════════════════════════════════════════════ */

function ReviewStep({ result, filename, count }) {
  const { t } = useTranslation('app')

  return (
    <div>
      <Eyebrow className="mb-2">{t('settings.imports.readyTitle')}</Eyebrow>
      <dl className="m-0 rounded-sm border border-hairline bg-card px-3.5 py-1">
        {[
          ['file', filename],
          ['willImport', formatInteger(count)],
          ['willSkip', formatInteger(result.errors)],
        ].map(([key, value]) => (
          <div
            key={key}
            className="flex items-baseline justify-between border-b border-subtle py-2.5 last:border-0"
          >
            <dt className="text-body-sm text-ink-dim">{t(`settings.imports.${key}`)}</dt>
            <dd className="m-0">
              {key === 'file' ? (
                <Mono className="text-body-sm text-ink">{value}</Mono>
              ) : (
                <Num className="text-body-sm font-semibold text-ink">{value}</Num>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3.5 mb-0 max-w-[60ch] text-micro font-normal text-ink-dim">
        {t('settings.imports.reviewNote')}
      </p>
    </div>
  )
}
