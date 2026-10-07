import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useImportAssets } from '@/features/lines/queries'
import {
  DUPLICATE_MODES,
  IMPORT_FIELDS,
  SAMPLE_FILE,
  autoMap,
  parseCsv,
  templateCsv,
  toRecord,
  validateAll,
} from '@/features/lines/import'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Bulk import — Upload → Map → Validate → Review.
 *
 * DEMO, but the wizard is not a slideshow. It parses a real dropped CSV, matches
 * its columns, validates every row against the lines that exist at this site,
 * and the final step actually creates the assets — they appear in the table, on
 * their line and in the floor map.
 *
 * The prototype simulates all four: clicking the dropzone "parses" a hardcoded
 * file whatever you dropped, validation runs over that same array, and Import
 * animates a bar and closes. Making it real is what lets somebody put their own
 * export through it, which is the only way anyone finds out whether the mapping
 * step is any good.
 *
 * ── Why a dialog rather than a page ───────────────────────────────────────
 * An import is a modal act in the plain sense: you are not doing anything else
 * to the asset list while you decide what to add to it, and the list underneath
 * is the thing being changed. It is `xl` because step 3 is a table and a table
 * in 540px is a table nobody reads before agreeing to it.
 */

const STEPS = ['upload', 'map', 'validate', 'review']

export function AssetImportWizard({ open, onClose, siteName, lines }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const importAssets = useImportAssets()
  const fileInput = useRef(null)

  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [duplicates, setDuplicates] = useState('update')
  const [dragging, setDragging] = useState(false)
  const [parseError, setParseError] = useState(false)

  const lineNames = useMemo(() => lines.map((line) => line.name), [lines])
  const context = useMemo(
    () => ({ lineNames, existingCodes: [] }),
    [lineNames],
  )

  const result = useMemo(
    () => (parsed ? validateAll(parsed.rows, mapping, context) : null),
    [parsed, mapping, context],
  )

  const accept = (name, text) => {
    const next = parseCsv(text)
    if (!next.rows.length) {
      setParseError(true)
      return
    }
    setParseError(false)
    setFile({ name, rows: next.rows.length, columns: next.columns.length })
    setParsed(next)
    setMapping(autoMap(next.columns))
  }

  const onFile = (chosen) => {
    if (!chosen) return
    const reader = new FileReader()
    reader.onload = () => accept(chosen.name, String(reader.result ?? ''))
    reader.readAsText(chosen)
  }

  const download = () => {
    const blob = new Blob([templateCsv(lineNames[0] ?? '')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'forge-assets-template.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const requiredMapped = IMPORT_FIELDS.filter((field) => field.required).every(
    (field) => mapping[field.key],
  )
  const importable = result ? result.validated.filter((entry) => entry.level !== 'error') : []

  const run = async () => {
    const rows = importable.map((entry) => toRecord(entry.row, mapping))
    const response = await importAssets.mutateAsync({ rows, duplicates })
    toast(
      t('assets.import.done', {
        created: response.created,
        updated: response.updated,
        skipped: response.skipped + (result.errors ?? 0),
      }),
      'ok',
    )
    reset()
    onClose()
  }

  const reset = () => {
    setStep(0)
    setFile(null)
    setParsed(null)
    setMapping({})
    setParseError(false)
  }

  const canAdvance =
    (step === 0 && Boolean(parsed)) || (step === 1 && requiredMapped) || step === 2

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          onClose()
        }
      }}
      size="xl"
      bodyClassName="max-h-[min(72vh,46rem)]"
      title={t('assets.import.title')}
      description={t('assets.import.subtitle', { site: siteName ?? '' })}
      footer={
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <ForgeButton
            onClick={() => {
              if (step === 0) {
                reset()
                onClose()
              } else setStep((value) => value - 1)
            }}
          >
            {step === 0 ? t('assets.import.cancel') : t('assets.import.back')}
          </ForgeButton>
          <span className="ms-auto" />
          {step < 3 ? (
            <ForgeButton
              variant="primary"
              disabled={!canAdvance}
              onClick={() => setStep((value) => value + 1)}
            >
              {t('assets.import.next')}
              <Icon name="right" size="xs" className="mirror-rtl" />
            </ForgeButton>
          ) : (
            <ForgeButton
              variant="primary"
              disabled={importable.length === 0 || importAssets.isPending}
              onClick={run}
            >
              {importAssets.isPending
                ? t('assets.import.running')
                : t('assets.import.run', { count: importable.length })}
            </ForgeButton>
          )}
        </div>
      }
    >
      <Steps step={step} t={t} />

      <div className="mt-5">
        {step === 0 ? (
          <UploadStep
            file={file}
            dragging={dragging}
            parseError={parseError}
            duplicates={duplicates}
            setDuplicates={setDuplicates}
            onDrag={setDragging}
            onDrop={onFile}
            onBrowse={() => fileInput.current?.click()}
            onSample={() => accept(SAMPLE_FILE.name, SAMPLE_FILE.text)}
            onDownload={download}
            t={t}
          />
        ) : null}

        {step === 1 ? (
          <MapStep parsed={parsed} mapping={mapping} setMapping={setMapping} t={t} />
        ) : null}

        {step === 2 ? <ValidateStep result={result} mapping={mapping} t={t} /> : null}

        {step === 3 ? (
          <ReviewStep
            file={file}
            result={result}
            duplicates={duplicates}
            importable={importable}
            t={t}
          />
        ) : null}
      </div>

      {/* Kept out of the layout: the visible affordance is the dropzone, and a
          native file input styled to look like one never quite behaves. */}
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </ForgeDialog>
  )
}

/**
 * Where you are.
 *
 * An ordered list, because that is what it is — and the completed steps say so
 * with a tick rather than only a colour, which is the difference between a
 * progress indicator and a row of dots.
 */
function Steps({ step, t }) {
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-2 p-0">
      {STEPS.map((entry, index) => {
        const done = index < step
        const current = index === step
        return (
          <li key={entry} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-bold',
                done && 'bg-green text-white',
                current && 'bg-forge text-white',
                !done && !current && 'border border-hairline bg-card text-ink-mute',
              )}
              style={done ? { background: 'var(--hue-green)' } : undefined}
            >
              {done ? <Icon name="check" size="xs" /> : <Num>{index + 1}</Num>}
            </span>
            <span
              className={cn('text-body-sm', current ? 'font-semibold text-ink' : 'text-ink-dim')}
              aria-current={current ? 'step' : undefined}
            >
              {t(`assets.import.steps.${entry}`)}
            </span>
            {index < STEPS.length - 1 ? (
              <span aria-hidden="true" className="mx-1 h-px w-6 bg-hairline" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function UploadStep({
  file,
  dragging,
  parseError,
  duplicates,
  setDuplicates,
  onDrag,
  onDrop,
  onBrowse,
  onSample,
  onDownload,
  t,
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* A button, not a div with a click handler: dropping is the pointer
          affordance and browsing is the keyboard one, and they have to be the
          same control or the keyboard path is a second-class citizen. */}
      <button
        type="button"
        onClick={onBrowse}
        onDragOver={(event) => {
          event.preventDefault()
          onDrag(true)
        }}
        onDragLeave={() => onDrag(false)}
        onDrop={(event) => {
          event.preventDefault()
          onDrag(false)
          onDrop(event.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex flex-col items-center rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-forge tint-forge' : file ? 'border-green/50 bg-sunken' : 'border-hairline bg-sunken',
        )}
        style={file && !dragging ? { borderColor: 'color-mix(in srgb, var(--hue-green) 50%, transparent)' } : undefined}
      >
        <span className="mb-3 flex size-12 items-center justify-center rounded-md border border-hairline bg-card">
          <Icon
            name={file ? 'check' : 'up'}
            size="lg"
            className={file ? undefined : 'text-on-forge'}
            style={file ? { color: 'var(--on-green)' } : undefined}
          />
        </span>
        {file ? (
          <>
            <span className="text-body font-semibold">{file.name}</span>
            <Num className="mt-1 text-body-sm text-ink-dim">
              {t('assets.import.parsed', { rows: file.rows, columns: file.columns })}
            </Num>
          </>
        ) : (
          <>
            <span className="text-body font-semibold">{t('assets.import.drop')}</span>
            <span className="mt-1 text-body-sm text-ink-dim">{t('assets.import.dropHint')}</span>
          </>
        )}
      </button>

      {parseError ? (
        <p className="m-0 rounded-sm border border-hairline stripe-red bg-card px-3.5 py-2.5 text-body-sm text-on-red">
          {t('assets.import.parseFailed')}
        </p>
      ) : null}

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(16rem,100%),1fr))]">
        <Panel>
          <Eyebrow className="mb-2 block">{t('assets.import.templateTitle')}</Eyebrow>
          <p className="m-0 text-body-sm text-ink-dim">{t('assets.import.templateBody')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ForgeButton onClick={onDownload}>
              <Icon name="down" size="xs" />
              {t('assets.import.templateDownload')}
            </ForgeButton>
            <ForgeButton onClick={onSample}>{t('assets.import.useSample')}</ForgeButton>
          </div>
        </Panel>

        <Panel>
          <Eyebrow className="mb-2 block">{t('assets.import.optionsTitle')}</Eyebrow>
          <div role="radiogroup" aria-label={t('assets.import.optionsTitle')} className="flex flex-col gap-2">
            {DUPLICATE_MODES.map((mode) => (
              <label key={mode} className="flex items-start gap-2.5 text-body-sm">
                <input
                  type="radio"
                  name="duplicates"
                  checked={duplicates === mode}
                  onChange={() => setDuplicates(mode)}
                  className="mt-0.5 accent-forge"
                />
                <span className="text-ink-dim">{t(`assets.import.duplicates.${mode}`)}</span>
              </label>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function MapStep({ parsed, mapping, setMapping, t }) {
  const mapped = IMPORT_FIELDS.filter((field) => mapping[field.key])

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 max-w-[68ch] text-body-sm text-ink-dim">{t('assets.import.mapIntro')}</p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {IMPORT_FIELDS.map((field) => (
          <li
            key={field.key}
            className="flex flex-wrap items-center gap-3 rounded-sm border border-hairline bg-sunken px-3.5 py-2.5"
          >
            <span className="w-[11rem] shrink-0">
              <span className="block text-body-sm font-semibold">
                {t(`assets.import.field.${field.key}`)}
                {field.required ? <span className="ms-1 text-on-red">*</span> : null}
              </span>
              <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                {t(`assets.import.fieldHint.${field.key}`)}
              </span>
            </span>

            <ForgeSelect
              className="min-w-[13rem] flex-1"
              label={t('assets.import.mapField', { field: t(`assets.import.field.${field.key}`) })}
              labelInline
              size="sm"
              value={mapping[field.key] ?? ''}
              onValueChange={(value) =>
                setMapping((current) => ({ ...current, [field.key]: value || null }))
              }
              options={[
                { value: '', label: t('assets.import.notMapped') },
                ...parsed.columns.map((column) => ({ value: column, label: column })),
              ]}
            />

            <StateBadge
              tone={mapping[field.key] ? 'green' : field.required ? 'amber' : null}
              dot={false}
            >
              {mapping[field.key]
                ? t('assets.import.steps.map')
                : field.required
                  ? t('assets.import.required')
                  : t('assets.import.notMapped')}
            </StateBadge>
          </li>
        ))}
      </ul>

      <div>
        <Eyebrow className="mb-2 block">{t('assets.import.preview')}</Eyebrow>
        <Panel flush>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {mapped.map((field) => (
                    <th
                      key={field.key}
                      scope="col"
                      className="eyebrow border-b border-hairline px-3.5 py-2 text-start whitespace-nowrap"
                    >
                      {t(`assets.import.field.${field.key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 3).map((row, index) => (
                  <tr key={index} className="border-b border-subtle last:border-b-0">
                    {mapped.map((field) => (
                      <td key={field.key} className="px-3.5 py-2 text-ink-dim">
                        {row[mapping[field.key]] || <span className="text-ink-mute">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}

const LEVEL_TONE = { ready: 'green', warn: 'amber', error: 'red' }

function ValidateStep({ result, mapping, t }) {
  const value = (row, key) => (mapping[key] ? row[mapping[key]] : '')

  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(8rem,1fr))]">
        {[
          ['ready', result.ready, 'green'],
          ['warnings', result.warnings, 'amber'],
          ['errors', result.errors, 'red'],
        ].map(([key, count, tone]) => (
          <div key={key} className="rounded-sm border border-hairline bg-card px-3.5 py-3 text-center">
            <dd className="m-0">
              <Num className="text-metric-sm leading-none" style={{ color: `var(--on-${tone})` }}>
                {formatInteger(count)}
              </Num>
            </dd>
            <dt className="mt-1.5 text-micro font-normal text-ink-dim">
              {t(`assets.import.counts.${key}`)}
            </dt>
          </div>
        ))}
      </dl>

      <Panel flush>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="bg-sunken">
                {['row', 'code', 'name', 'line', 'status', 'issues'].map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="eyebrow border-b border-hairline px-3.5 py-2 text-start whitespace-nowrap"
                  >
                    {t(`assets.import.rowColumns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.validated.map((entry) => (
                <tr
                  key={entry.index}
                  className="border-b border-subtle last:border-b-0"
                  // The leading edge is earned here: it marks the row's verdict,
                  // which is the only thing the reader is scanning this table for.
                  style={{
                    borderInlineStartWidth: 3,
                    borderInlineStartStyle: 'solid',
                    borderInlineStartColor: `var(--hue-${LEVEL_TONE[entry.level]})`,
                  }}
                >
                  <td className="px-3.5 py-2 text-ink-mute">
                    <Num>{entry.index + 1}</Num>
                  </td>
                  <td className="px-3.5 py-2">
                    {value(entry.row, 'code') ? (
                      <Mono>{value(entry.row, 'code')}</Mono>
                    ) : (
                      <span className="text-on-red">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2 text-ink-dim">{value(entry.row, 'name')}</td>
                  <td className="px-3.5 py-2 text-ink-dim">{value(entry.row, 'line')}</td>
                  <td className="px-3.5 py-2">
                    <StateBadge tone={LEVEL_TONE[entry.level]} dot={false}>
                      {t(`assets.import.status.${entry.level}`)}
                    </StateBadge>
                  </td>
                  <td className="px-3.5 py-2">
                    {entry.issues.length ? (
                      <ul className="m-0 list-none p-0">
                        {entry.issues.map((issue, index) => (
                          <li
                            key={index}
                            className="text-micro font-normal"
                            style={{ color: `var(--on-${issue.level === 'error' ? 'red' : 'amber'})` }}
                          >
                            {t(`assets.import.issue.${issue.key}`, {
                              field: t(`assets.import.field.${issue.field}`),
                              value: issue.value,
                            })}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-ink-mute">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {result.errors ? (
        <p className="m-0 rounded-sm border border-hairline stripe-amber bg-card px-3.5 py-2.5 text-body-sm text-ink-dim">
          <Num>{t('assets.import.errorsNote', { count: result.errors })}</Num>
        </p>
      ) : null}
    </div>
  )
}

function ReviewStep({ file, result, duplicates, importable, t }) {
  const updating = importable.filter((entry) =>
    entry.issues.some((issue) => issue.key === 'duplicate'),
  ).length
  const creating = importable.length - updating

  const rows = [
    ['file', file?.name],
    ['create', formatInteger(creating)],
    ['update', formatInteger(duplicates === 'skip' ? 0 : updating)],
    ['skip', formatInteger(result.errors + (duplicates === 'skip' ? updating : 0))],
    ['duplicates', t(`assets.import.duplicates.${duplicates}`)],
  ]

  if (!importable.length) {
    return (
      <p className="m-0 rounded-sm border border-hairline stripe-red bg-card px-3.5 py-3 text-body-sm text-ink-dim">
        {t('assets.import.nothing')}
      </p>
    )
  }

  return (
    <Panel className="mx-auto max-w-[34rem]">
      <Eyebrow className="mb-3 block">{t('assets.import.summary')}</Eyebrow>
      <dl className="m-0">
        {rows.map(([key, value]) => (
          <div key={key} className="flex gap-3 border-b border-subtle py-2.5 last:border-b-0">
            <dt className="min-w-0 flex-1 text-body-sm text-ink-dim">
              {t(`assets.import.summaryRow.${key}`)}
            </dt>
            <dd className="m-0 text-end text-body-sm font-semibold">
              <Num>{value}</Num>
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
