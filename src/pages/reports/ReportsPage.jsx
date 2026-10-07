import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { useGenerateReport, useReportLibrary, useReports } from '@/features/reports/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { cn } from '@/lib/cn'
import { MyReportsTable } from './MyReportsTable'
import { ReportBuilder } from './ReportBuilder'
import { ReportLibrary } from './ReportLibrary'
import { ScheduleTable } from './ScheduleTable'

const VIEWS = ['library', 'mine', 'scheduled']

/**
 * Analytics & Reports.
 *
 * DEMO. See `DEMO-MODE.md` §8.9.
 *
 * ── What changed ──────────────────────────────────────────────────────────
 * The module used to be one shelf of generated cards. The design turned it into
 * a catalogue: thirty-four standard reports filed by subject and by the role
 * that reads them, a four-step builder that assembles one, the shelf of what
 * has been generated, and the standing delivery schedule. Three views and a
 * builder, where there was a grid and a dialog.
 *
 * ── The view and the open template live in the URL ────────────────────────
 * `?view=` and `?report=`, not `useState`. The prototype holds both in
 * component state, which means the scheduled tab has no address, a half-
 * configured report cannot be sent to a colleague, and Back leaves the module
 * rather than closing the builder. This is the same correction `ModuleTabs`
 * makes for Lines · Assets, and it costs two search params.
 *
 * ── Two queries, deliberately unlike each other ───────────────────────────
 * The catalogue is a specification — thirty-four templates and the taxonomy
 * that files them — so it is fetched once and never revalidated. The shelf is
 * state with a clock behind it, so it polls while anything is building and
 * stops the moment nothing is. Collapsing them into one endpoint would mean
 * re-sending the catalogue every five seconds to watch a progress bar.
 */
export function ReportsPage() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const view = VIEWS.includes(params.get('view')) ? params.get('view') : 'library'
  const openId = params.get('report')

  const library = useReportLibrary()
  const reports = useReports()
  const generate = useGenerateReport()

  useDocumentTitle(`${t('reports.title')} · ${t('common:brand.name')}`)

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value == null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const templates = library.data?.templates ?? []
  const template = openId ? templates.find((entry) => entry.id === openId) : null
  const items = reports.data?.items ?? []

  const askAi = () => toast(t('reports.toast.aiOpened'))

  /* ── The builder, when a template is open ──────────────────────────────
     Rendered instead of the tabs rather than over them: it is a different task
     with its own back affordance, and a modal at this size is a page wearing a
     disguise. */
  if (template && library.data) {
    return (
      <Page>
        <ReportBuilder
          key={template.id}
          template={template}
          library={library.data}
          pending={generate.isPending}
          onBack={() => setParam('report', null)}
          onAskAi={askAi}
          onGenerate={(payload) =>
            generate.mutate(payload, {
              onSuccess: () => {
                // Straight to the shelf, because that is where the thing they
                // just started actually is, and it is already moving.
                const next = new URLSearchParams(params)
                next.delete('report')
                next.set('view', 'mine')
                setParams(next, { replace: true })
                toast(t('reports.toast.started'))
              },
              onError: () => toast(t('reports.toast.failed'), 'error'),
            })
          }
        />
      </Page>
    )
  }

  const stats = library.data?.stats

  return (
    <Page>
      {/* ── The module bar ────────────────────────────────────────────────
          Title left, the three views and the two actions right, all on one
          line — the design's arrangement. The views are a pill group rather
          than a rule of underlined tabs because they sit inline beside two
          buttons here; an underline in that row would read as a fourth
          control with a different grammar. */}
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('reports.title')}</h1>
          <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">
            {t('reports.subtitle', { count: stats?.templates ?? templates.length })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={t('reports.viewLabel')} className="flex items-center gap-0.5">
            {VIEWS.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-current={entry === view ? 'page' : undefined}
                onClick={() => setParam('view', entry)}
                className={cn(
                  'rounded-sm px-3 py-1.5 text-body-sm transition-colors',
                  entry === view
                    ? 'bg-card font-semibold text-ink shadow-edge'
                    : 'text-ink-dim hover:text-ink',
                )}
              >
                {t(`reports.view.${entry}`)}
              </button>
            ))}
          </nav>

          {/* The one violet control on this screen. Outlined rather than
              filled: what it starts is a conversation about a document, not
              the document — the filled `ai` variant is reserved for the
              buttons that actually set the machine writing. */}
          <ForgeButton
            className="border-violet/40 text-on-violet hover:border-violet"
            onClick={askAi}
          >
            <Icon name="ai" size="xs" className="text-violet" />
            {t('reports.buildWithAi')}
          </ForgeButton>

          <ForgeButton
            variant="primary"
            disabled={!templates.length}
            onClick={() => setParam('report', templates[0]?.id)}
          >
            <Icon name="plus" size="xs" />
            {t('reports.generateReport')}
          </ForgeButton>
        </div>
      </header>

      {view === 'library' ? (
        library.isError ? (
          <ErrorState
            error={library.error}
            title={t('reports.loadFailed')}
            onRetry={() => library.refetch()}
          />
        ) : library.isPending ? (
          <SkeletonRows count={6} />
        ) : (
          <ReportLibrary library={library.data} onOpen={(entry) => setParam('report', entry.id)} />
        )
      ) : null}

      {view === 'mine' ? (
        reports.isError ? (
          <ErrorState
            error={reports.error}
            title={t('reports.loadFailed')}
            onRetry={() => reports.refetch()}
          />
        ) : reports.isPending ? (
          <SkeletonRows count={4} />
        ) : (
          <MyReportsTable
            reports={items}
            onBrowse={() => setParam('view', 'library')}
            onDownload={() => toast(t('reports.toast.exported'))}
          />
        )
      ) : null}

      {view === 'scheduled' ? (
        library.isError ? (
          <ErrorState
            error={library.error}
            title={t('reports.loadFailed')}
            onRetry={() => library.refetch()}
          />
        ) : library.isPending ? (
          <SkeletonRows count={4} />
        ) : (
          <ScheduleTable
            schedules={library.data.schedules}
            onNew={() => toast(t('reports.toast.scheduled'))}
          />
        )
      ) : null}
    </Page>
  )
}
