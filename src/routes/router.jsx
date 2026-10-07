import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/shell/AppShell'
import { AnomaliesPage } from '@/pages/anomalies/AnomaliesPage'
import { AnomalyDetailPage } from '@/pages/anomalies/AnomalyDetailPage'
import { HomePage } from '@/pages/HomePage'
import {
  SettingsLayout,
  SettingsPlaceholder,
  ALL_SETTINGS_PAGES,
  isSettingsPageBuilt,
} from '@/pages/settings/SettingsLayout'
import { AssetClassesPage } from '@/pages/settings/AssetClassesPage'
import { UsersPage } from '@/pages/settings/UsersPage'
import { RolesPage } from '@/pages/settings/RolesPage'
import { AuditPage } from '@/pages/settings/AuditPage'
import { SecurityPage } from '@/pages/settings/SecurityPage'
import { ApiPage } from '@/pages/settings/ApiPage'
import { IntegrationsPage } from '@/pages/settings/IntegrationsPage'
import { GeneralPage } from '@/pages/settings/GeneralPage'
import { ModulesPage } from '@/pages/settings/ModulesPage'
import { BillingPage } from '@/pages/settings/BillingPage'
import { useOrgSettings } from '@/features/org/settings'
import { SitesHierarchyPage } from '@/pages/settings/SitesHierarchyPage'
import { DataFusionLayout, FusionSectionPlaceholder } from '@/pages/dataFusion/DataFusionLayout'
import { ConnectionSensorsPage } from '@/pages/dataFusion/ConnectionSensorsPage'
import { IotSensorsPage } from '@/pages/dataFusion/IotSensorsPage'
import { SensorFormPage } from '@/pages/dataFusion/SensorFormPage'
import { FusionOverviewPage } from '@/pages/dataFusion/FusionOverviewPage'
import { DocumentsPage } from '@/pages/dataFusion/DocumentsPage'
import { MediaPage } from '@/pages/dataFusion/MediaPage'
import { ContextPage } from '@/pages/dataFusion/ContextPage'
import { GraphPage } from '@/pages/dataFusion/GraphPage'
import { PipelinesPage } from '@/pages/dataFusion/PipelinesPage'
import { SourcesPage } from '@/pages/dataFusion/SourcesPage'
import { ALL_FUSION_SECTIONS, isSectionBuilt } from '@/pages/dataFusion/sections'
import { FUSION_SOURCE_SECTIONS } from '@/features/dataFusion/sources'
import { ModulePlaceholder, NotFoundPage } from '@/pages/ModulePlaceholder'
import { LoginPage } from '@/pages/LoginPage'
import { ShiftHandoversPage } from '@/pages/ShiftHandoversPage'
import { OeePage } from '@/pages/oee/OeePage'
import { SensorExplorerPage } from '@/pages/sensors/SensorExplorerPage'
import { WorkOrdersPage } from '@/pages/workOrders/WorkOrdersPage'
import { ShiftMasterPage } from '@/pages/shifts/ShiftMasterPage'
import { ShiftsPage } from '@/pages/shifts/ShiftsPage'
import { LogbookPage } from '@/pages/logbook/LogbookPage'
import { CopilotPage } from '@/pages/copilot/CopilotPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { WorkboardsPage } from '@/pages/workboards/WorkboardsPage'
import { BoardDetailPage } from '@/pages/workboards/BoardDetailPage'
import { ChartCatalogPage } from '@/pages/sensors/ChartCatalogPage'
import { WorkstationPage } from '@/pages/sensors/WorkstationPage'
import { LinesPage } from '@/pages/lines/LinesPage'
import { LineDetailPage } from '@/pages/lines/LineDetailPage'
import { AssetDetailPage } from '@/pages/lines/AssetDetailPage'
import { AssetsPage } from '@/pages/lines/AssetsPage'
import { RequireAuth } from '@/routes/RequireAuth'
import { config } from '@/services/config'
import { setUnauthorizedHandler } from '@/services/authToken'
import { ALL_NAV_ITEMS, isBuilt } from '@/shell/navigation'

/**
 * Routing.
 *
 * Every drill-down is a deep-linkable URL — the design prototype had no routing
 * at all, and this is the single largest structural change in the rebuild. An
 * operator has to be able to paste a link to an anomaly into a message.
 *
 * The public page is code-split: it shares almost nothing with the application
 * chassis, so a plant operator who never visits it should not download it.
 */
const LandingPage = lazy(() =>
  import('@/pages/LandingPage').then((module) => ({ default: module.LandingPage })),
)

/**
 * The Executive Dashboard is code-split too, for a different reason: it is the
 * only screen that carries a world map, and `world-atlas`'s land geometry plus
 * `d3-geo` is ~95KB nobody on the anomaly list should download. Lazily loaded,
 * it costs nothing until somebody opens the board view.
 */
const ExecutivePage = lazy(() =>
  import('@/pages/executive/ExecutivePage').then((module) => ({ default: module.ExecutivePage })),
)

/**
 * Where `/app` goes.
 *
 * The organisation's default landing page, from Settings → General, and Home
 * when there is none — which is every case with the flag off, since the setting
 * only exists behind it. This is what makes that control a setting rather than a
 * stored string: it is read on the one navigation it governs.
 *
 * It renders nothing while the settings load rather than redirecting to Home and
 * then away again. A visible bounce through the wrong screen is worse than a
 * frame of blank, and this resolves from cache on every navigation after the
 * first.
 */
function LandingRedirect() {
  const org = useOrgSettings()
  if (config.demoMode && org.isPending) return null

  const landing = org.data?.settings?.landingPage
  const target = ALL_NAV_ITEMS.find((item) => item.id === landing)?.to ?? '/app/home'
  return <Navigate to={target} replace />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={null}>
        <LandingPage />
      </Suspense>
    ),
  },
  { path: '/login', element: <LoginPage /> },
  {
    /**
     * Everything under /app is private. The guard is a pathless parent so it
     * runs once for the whole subtree — a per-route guard is a list someone
     * eventually forgets to add to, and the omission looks like nothing at all.
     */
    element: <RequireAuth />,
    children: [
      {
        path: '/app',
        element: <AppShell />,
        children: [
          { index: true, element: <LandingRedirect /> },
          { path: 'home', element: <HomePage /> },
          /**
           * The handover archive. Registered only in demo mode — with the flag
           * off nothing links here and the screen has no endpoint, so the route
           * falls through to the 404 that is the truth about it.
           *
           * Not in the nav rail either way. A handover belongs to a shift, so
           * you reach the archive from the handover card and from Shifts, not
           * from a top-level item competing with Anomalies.
           */
          ...(config.demoMode
            ? [{ path: 'handovers', element: <ShiftHandoversPage /> }]
            : []),
          /**
           * The live resource, reading `GET /v1/anomalies`.
           *
           * `AlertsPage` held this route while the endpoint was fixture-only. It
           * is still in the tree because `features/alerts` feeds the home screen,
           * the public page and the assistant dock — but it is no longer reachable
           * by URL, and nothing new should be built on it.
           *
           * There is deliberately no `anomalies/:id` route. It used to render the
           * list at a detail URL, which is a link that looks like it worked; both
           * `GET` and `PATCH /anomalies/{id}` exist, so the detail screen is a
           * real next slice rather than a hypothetical, and it will own that path.
           */
          { path: 'anomalies', element: <AnomaliesPage /> },
          /**
           * One anomaly and its root-cause analysis. Two requests: the record,
           * and `GET .../rca` — which 404s until somebody asks for an analysis,
           * so "not investigated" is a state this screen renders rather than an
           * error it reports.
           */
          { path: 'anomalies/:anomalyId', element: <AnomalyDetailPage /> },
          {
            /**
             * Eleven source-family sections, one of them built. The index
             * redirects to that one rather than to a placeholder overview:
             * opening a module on a screen that says "not built yet" is worse
             * than opening it on the part that works.
             */
            path: 'data-fusion',
            element: <DataFusionLayout />,
            children: [
              /* With the flag on there is an Overview to land on, which is where
                 a module index belongs. Without it, the index still goes to the
                 one section that has a screen rather than to a placeholder:
                 opening a module on "not built yet" is worse than opening it on
                 the part that works. */
              {
                index: true,
                element: (
                  <Navigate
                    to={config.demoMode ? '/app/data-fusion/overview' : '/app/data-fusion/iot'}
                    replace
                  />
                ),
              },
              ...(config.demoMode
                ? [
                    { path: 'overview', element: <FusionOverviewPage /> },
                    { path: 'documents', element: <DocumentsPage /> },
                    { path: 'media', element: <MediaPage /> },
                    { path: 'context', element: <ContextPage /> },
                    { path: 'graph', element: <GraphPage /> },
                    { path: 'pipelines', element: <PipelinesPage /> },
                  ]
                : []),
              { path: 'iot', element: <IotSensorsPage /> },
              /**
               * One connection and the sensors read off it. Nested under `iot`
               * rather than added as a twelfth section, so the section rail keeps
               * "IoT & Sensors" lit while you are inside one source — sensors are
               * what a source family contains, not a source family of their own.
               *
               * Sibling of `iot` in the route table rather than a child of it,
               * because `IotSensorsPage` is a leaf with no `<Outlet/>`. Registered
               * ahead of the placeholder spread below: those map unbuilt section
               * ids, and a `:connectionId` segment must not be mistaken for one.
               */
              { path: 'iot/:connectionId', element: <ConnectionSensorsPage /> },
              /**
               * Onboarding and editing are screens, not dialogs. The form carries
               * eight fields — three generated — plus a placement cascade, which a
               * dialog's `min(60vh, 32rem)` body cannot hold without a scroll; and
               * a form you must scroll to finish reading is one you cannot check
               * before saving. One component serves both: `:sensorId` means edit.
               */
              { path: 'iot/:connectionId/sensors/new', element: <SensorFormPage /> },
              { path: 'iot/:connectionId/sensors/:sensorId', element: <SensorFormPage /> },
              /**
               * The four demo source families — OT, Vision, ERP/MES/CMMS,
               * Databases. One component serves all four and reads the family
               * off `:section`; what differs between them is the contract behind
               * the drawer, not the table.
               *
               * Registered ahead of the placeholder spread, and the spread now
               * filters on `isSectionBuilt` rather than `built`, so with the flag
               * off these four go back to the placeholder and the rail agrees.
               */
              ...(config.demoMode
                ? FUSION_SOURCE_SECTIONS.map((section) => ({
                    path: section,
                    /* The family arrives as a prop, not a route param: these are
                       four literal paths in the rail, and a `:section` segment
                       would also match `documents` and `graph` and send them to a
                       table with no data behind it. */
                    element: <SourcesPage section={section} />,
                  }))
                : []),
              ...ALL_FUSION_SECTIONS.filter((section) => !isSectionBuilt(section)).map(
                (section) => ({
                  path: section.id,
                  element: <FusionSectionPlaceholder />,
                }),
              ),
            ],
          },
          {
            path: 'settings',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to="/app/settings/hierarchy" replace /> },
              { path: 'asset-classes', element: <AssetClassesPage /> },
              { path: 'hierarchy', element: <SitesHierarchyPage /> },
              ...(config.demoMode
                ? [
                    { path: 'users', element: <UsersPage /> },
                    { path: 'roles', element: <RolesPage /> },
                    /* The SAME screen the bell opens, not a second copy of it.
                       Notification configuration is one set of rules; two pages
                       over it is how a rule ends up enabled on one and paused on
                       the other. */
                    { path: 'notifications', element: <NotificationsPage /> },
                    { path: 'audit', element: <AuditPage /> },
                    { path: 'security', element: <SecurityPage /> },
                    { path: 'api', element: <ApiPage /> },
                    /* Composed over the same registry Data Fusion reads. Its
                       Configure opens that module's drawer rather than a second
                       editor, and its monitor's Pause writes into that
                       registry — see the page's own note. */
                    { path: 'integrations', element: <IntegrationsPage /> },
                    { path: 'general', element: <GeneralPage /> },
                    /* The entitlement map the rail reads, with a switch on it. */
                    { path: 'modules', element: <ModulesPage /> },
                    { path: 'billing', element: <BillingPage /> },
                  ]
                : []),
              ...ALL_SETTINGS_PAGES.filter((page) => !isSettingsPageBuilt(page)).map((page) => ({
                path: page.id,
                element: <SettingsPlaceholder />,
              })),
            ],
          },
          /**
           * OEE & Production Performance. Every figure on it is authored, so it
           * exists only under the demo flag; without it the item falls into the
           * placeholder spread below, exactly as it did before. `isBuilt` is
           * what keeps those two statements from disagreeing.
           */
          ...(config.demoMode ? [{ path: 'oee', element: <OeePage /> }] : []),
          /**
           * Lines & Assets. Three routes, all demo-gated.
           *
           * `assets/lines/:lineId` is registered before `assets/:assetId` for
           * readability rather than necessity — react-router ranks a static
           * segment above a dynamic one, so `lines` could never be mistaken for
           * an asset id. Written in this order anyway, so nobody has to know
           * that to be sure.
           *
           * An asset is addressable by its id alone, with no line in the path.
           * Four other modules link here and none of them holds a line, and an
           * operator sending someone to a machine should not have to know which
           * line it sits on this month.
           */
          ...(config.demoMode
            ? [
                { path: 'assets', element: <LinesPage /> },
                { path: 'assets/all', element: <AssetsPage /> },
                { path: 'assets/lines/:lineId', element: <LineDetailPage /> },
                { path: 'assets/:assetId', element: <AssetDetailPage /> },
              ]
            : []),
          /**
           * Sensor Explorer. Demo-gated, and the whole of its state that is
           * worth sending to somebody — the scope and the span — lives in search
           * params on this one path rather than in segments. A channel is not a
           * route yet; it becomes one with the Timeseries Workstation.
           */
          /**
           * The Workstation is one screen reached two ways: `charts/:chartId`
           * for a saved chart, and `charts/adhoc?signals=…` for a selection
           * nobody saved — which is what a channel card links to. The literal
           * `charts` segment is declared before the parameterised one for
           * readability; react-router ranks static above dynamic regardless.
           */
          ...(config.demoMode
            ? [
                { path: 'sensors', element: <SensorExplorerPage /> },
                { path: 'sensors/charts', element: <ChartCatalogPage /> },
                { path: 'sensors/charts/:chartId', element: <WorkstationPage /> },
              ]
            : []),
          /**
           * Work Orders. One path — the board, the table, the open order and a
           * prefilled New WO all live in search params, so every state of this
           * screen can be sent to somebody. That is what lets the Workstation's
           * insight banner and the asset screens link straight into a form.
           */
          ...(config.demoMode ? [{ path: 'work-orders', element: <WorkOrdersPage /> }] : []),
          /**
           * Shifts. One path; the tab, the crew scope and the selected shift are
           * search params, so a rough shift can be sent to somebody and the
           * synopsis cards can jump to one by setting two params at once.
           */
          ...(config.demoMode ? [{ path: 'shifts', element: <ShiftsPage /> }] : []),
          /**
           * Shift Master. The design puts patterns under Settings →
           * Organization; they live under Shifts because everything that reads
           * a pattern is here, and a rota is not a preference. Its own path so
           * a pattern set can be linked to rather than described.
           */
          ...(config.demoMode ? [{ path: 'shifts/master', element: <ShiftMasterPage /> }] : []),
          /**
           * Logbook. One path; the view, the search, the machine and the shift
           * are all search params — which is what gives the shift detail
           * panel's Logbook button somewhere to point, and what lets a note be
           * sent to somebody rather than described to them.
           */
          ...(config.demoMode ? [{ path: 'logbook', element: <LogbookPage /> }] : []),
          /**
           * Notifications is reached from the BELL, not from the rail — which
           * is where the design puts it too. It is alert configuration rather
           * than an inbox, so it does not earn a permanent rail item beside the
           * modules that hold data.
           *
           * Analytics & Reports does get one; it was the only module in the
           * prototype's IA with no entry in `navigation.js` at all.
           */
          ...(config.demoMode
            ? [
                { path: 'notifications', element: <NotificationsPage /> },
                { path: 'reports', element: <ReportsPage /> },
                /* Workboards. The board is its own route, not a panel on the
                   index — a board is the thing people paste into a message. */
                { path: 'workboards', element: <WorkboardsPage /> },
                { path: 'workboards/:boardId', element: <BoardDetailPage /> },
                /**
                 * The Copilot screen. `?mode=` picks the agent mode and `?q=`
                 * seeds a question, which is what gives every "Ask Forge AI"
                 * affordance in the product somewhere to send a record.
                 */
                { path: 'copilot', element: <CopilotPage /> },
                {
                  path: 'executive',
                  element: (
                    <Suspense fallback={null}>
                      <ExecutivePage />
                    </Suspense>
                  ),
                },
              ]
            : []),
          ...ALL_NAV_ITEMS.filter((item) => !isBuilt(item) && item.id !== 'settings').map((item) => ({
            path: item.to.replace('/app/', ''),
            element: <ModulePlaceholder />,
          })),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

/**
 * When a session ends mid-use, land on the sign-in screen with a reason.
 *
 * Registered here rather than inside a component because the transport can fail
 * a request from anywhere, including code with no React context to navigate
 * from. `router.navigate` works outside the tree, which is the whole point.
 *
 * `reason=expired` is what turns the redirect into an explanation — without it
 * the app appears to have logged someone out for no stated cause.
 */
setUnauthorizedHandler(() => {
  const { pathname, search } = window.location
  // A 401 while already on the sign-in screen is an ordinary rejected
  // credential. Redirecting would wipe the typed email and the error message.
  if (pathname === '/login') return

  router.navigate(`/login?reason=expired`, {
    replace: true,
    state: { from: pathname + search },
  })
})
