import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppSurface } from '@/providers/ThemeProvider'
import { useScope } from '@/providers/ScopeProvider'
import { useAlerts } from '@/features/alerts/queries'
import { useAnomalies } from '@/features/anomalies/queries'
import { dockPromptsFor } from '@/features/copilot/prompts'
import { useApplyOrgFormatting } from '@/features/org/settings'
import { config } from '@/services/config'
import { AssistantDock } from './AssistantDock'
import { NavRail } from './NavRail'
import { SeverityBanner } from './SeverityBanner'
import { TopBar } from './TopBar'

/**
 * The application chassis.
 *
 * A fixed full-height shell where the document never scrolls: 48px top bar,
 * then a band holding the 212px rail, the scrolling content region, and the
 * 360px assistant dock on the inline-end side. Only the content region and
 * individual panels scroll, so navigation and scope stay put while an operator
 * works down a list.
 */

const AssistantContext = createContext(null)

/**
 * Lets any screen ground the assistant on a record.
 *
 * `ground` still takes a fixture-backed alert for the demo surfaces that call it.
 * `groundAnomaly` is the real one: the copilot scopes a conversation by
 * `page_anomaly_id`, so the dock has to be told which anomaly the user is looking
 * at, not which alert.
 *
 * `investigate` is `groundAnomaly` plus an instruction. It opens the anomaly, opens
 * the dock on it and has the copilot start a root-cause analysis — one path from
 * every Investigate affordance in the app, so there is no second way to start an
 * analysis that behaves differently from the one the user can type.
 *
 * `quote` is not either of those. It attaches a highlighted passage to the dock's
 * composer and sends nothing — the selection says what the question is about, and
 * only the reader knows what the question is.
 */
export function useAssistant() {
  const context = useContext(AssistantContext)
  if (!context) throw new Error('useAssistant must be used inside AppShell')
  return context
}

export function AppShell() {
  const { t } = useTranslation('common')
  const { params } = useScope()
  /* The organisation's date order, clock and time zone, pushed into the
     formatters every screen uses. Here because it must be in force before the
     first table renders, and once rather than per page. */
  useApplyOrgFormatting()
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [dockOpen, setDockOpen] = useState(false)
  const [groundedAlert, setGroundedAlert] = useState(null)
  const [groundedAnomaly, setGroundedAnomaly] = useState(null)
  const [investigation, setInvestigation] = useState(null)
  const [quoted, setQuoted] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  useAppSurface(true)

  /**
   * The severity banner, and where its contents come from.
   *
   * Still `VITE_DEMO_MODE` only. A red strip across the top of every screen naming
   * a machine is the most load-bearing claim in the product, and whether it belongs
   * in the shipping shell at all is a product decision nobody has made — so the
   * flag that gates it is unchanged. What changed is what fills it.
   *
   * **Live.** With the backend reachable it holds the three most severe OPEN
   * anomalies **that nobody has investigated** — `rca_status=pending`, which the
   * server derives as "no analysis row, or one parked at pending". That filter is
   * what makes the band a queue rather than a list: investigating an anomaly puts
   * an analysis on it, and the next fetch no longer returns it. Real records, with
   * a real id behind each one, which is what makes `Investigate` here mean
   * something. Only the fields an anomaly actually carries are rendered; there is
   * no hours-to-trip figure and no sibling-sensor count, because the endpoint
   * reports neither.
   *
   * **Fixture.** With no backend it falls back to `useAlerts` — the prototype's
   * authored band, staged arrivals and all. Every reading and hours-to-trip figure
   * there is written by hand, and its `Investigate` has no record to open.
   *
   * Three, not one, in both cases: the prototype stages their arrival and rotates
   * between them, and that sequence is the point — a plant interrupts you, it does
   * not hand you a list. See `SeverityBanner`.
   *
   * ── The live band polls, and it polls from here ────────────────────────────
   * `useAnomalies` refetches every `ANOMALY_POLL_INTERVAL_MS` while it is mounted,
   * and this call is in the shell — so the band is re-read on every screen under
   * `/app`, not only on the anomalies list. That is the whole point of a band: the
   * thing that cannot wait for you to navigate to it has to reach you where you
   * already are.
   *
   * It costs one request every two seconds for the whole session rather than one
   * per screen, because the shell does not remount between routes — the `Outlet`
   * below it does. Backgrounding the tab stops it; focus resumes it.
   */
  const bannerIsLive = config.authMode === 'live'

  const { data: liveAnomalies } = useAnomalies(
    {
      status: 'open',
      rcaStatus: 'pending',
      sortBy: 'severity',
      sortDir: 'desc',
      page: 1,
      pageSize: 3,
    },
    // `enabled` on both, rather than left running: a poll nobody renders is a
    // request nobody can see.
    { enabled: config.demoMode && bannerIsLive },
  )

  const { data: bannerAlerts } = useAlerts(
    { ...params, status: 'open', sort: 'severity', pageSize: 3 },
    { enabled: config.demoMode && !bannerIsLive },
  )

  /**
   * One shape for the band, from either source.
   *
   * `anomalyId` is what separates them. An item that has one can be opened and
   * investigated for real; an item without one is a picture of an alert, and its
   * Investigate keeps the prototype's behaviour of opening the dock and no more.
   */
  const bannerItems = useMemo(() => {
    if (bannerIsLive) {
      return (liveAnomalies?.items ?? []).map((anomaly) => ({
        id: anomaly.serialNumber,
        anomalyId: anomaly.id,
        severity: anomaly.severity,
        // The detector writes the title as "{sensor}: {what happened}", which is
        // already the sentence this band wants. Composing one from parts here would
        // be a second, worse phrasing of the same fact.
        headline: anomaly.title,
        // Plain strings on the wire, not nodes — `hierarchy: {plant, line, machine}`
        // carries names and no ids, which is also why the band cannot link to a line.
        assetName: anomaly.hierarchy.machine,
        lineName: anomaly.hierarchy.line,
        detectedAt: anomaly.createdAt,
      }))
    }
    return bannerAlerts?.items ?? []
  }, [bannerIsLive, liveAnomalies, bannerAlerts])

  const ground = useCallback((alert) => {
    setGroundedAlert(alert)
    setDockOpen(true)
  }, [])

  /**
   * Grounded without opening the dock. A screen says what the conversation would
   * be about; the user decides whether to have it. Opening it on navigation would
   * take 360px from the data on every anomaly anyone glances at.
   */
  const groundAnomaly = useCallback((anomaly) => setGroundedAnomaly(anomaly), [])

  /**
   * Open an anomaly and have the copilot investigate it.
   *
   * A token rather than a flag, so investigating the same anomaly a second time —
   * having read the first analysis — is a second request rather than a no-op. The
   * dock consumes it once; see `AssistantDock`.
   *
   * The navigation is conditional. `navigate` to the path you are already on pushes
   * a second history entry for the same screen, so investigating from the anomaly's
   * own page would put Back one press further from where the user came in.
   */
  const investigate = useCallback(
    (anomaly) => {
      if (!anomaly?.id) return
      setGroundedAnomaly(anomaly)
      setDockOpen(true)
      setInvestigation({ anomalyId: anomaly.id, token: crypto.randomUUID() })
      const target = `/app/anomalies/${anomaly.id}`
      if (location.pathname !== target) navigate(target)
    },
    [navigate, location.pathname],
  )

  /**
   * Open the dock with a passage attached to its composer.
   *
   * Deliberately NOT `investigate`-shaped. That one sends a question the moment it
   * fires, which is right for a control labelled Investigate — there is exactly
   * one thing it means. A highlighted clause is the opposite: the selection says
   * what the question is ABOUT and only the reader knows what the question is. So
   * this stages a citation and stops, and the turn is sent when they send it.
   *
   * A token for the same reason `investigation` carries one, and it does more work
   * here than it used to. This slot holds one pending quote and re-stamps it, while
   * the dock now KEEPS every passage it has been handed — so the token is the only
   * thing that separates "a new passage arrived" from "the same one, redelivered by
   * a re-render". The dock consumes each exactly once and appends; without the
   * token it would append the same card on every render.
   *
   * The token also doubles as each card's React key. Two identical selections are
   * two separate quotes and have to be removable separately, which keying on the
   * text would not allow.
   */
  const quote = useCallback((anomaly, text) => {
    if (!anomaly?.id || !text) return
    setGroundedAnomaly(anomaly)
    setDockOpen(true)
    setQuoted({ anomalyId: anomaly.id, token: crypto.randomUUID(), text })
  }, [])

  /** The band carries its own item shape; the copilot needs the anomaly behind it. */
  const investigateBannerItem = useCallback(
    (item) => {
      if (!item?.anomalyId) return
      investigate({
        id: item.anomalyId,
        serialNumber: item.id,
        assetName: item.assetName,
      })
    },
    [investigate],
  )

  /* What the dock offers to ask, for the screen underneath it. Resolved here
     because the shell is what knows both the route and the dock; see
     `features/copilot/prompts`. */
  const prompts = useMemo(() => dockPromptsFor(location.pathname), [location.pathname])

  const assistant = useMemo(
    () => ({
      alert: groundedAlert,
      anomaly: groundedAnomaly,
      ground,
      groundAnomaly,
      investigate,
      quote,
      open: () => setDockOpen(true),
      close: () => setDockOpen(false),
      isOpen: dockOpen,
    }),
    [groundedAlert, groundedAnomaly, ground, groundAnomaly, investigate, quote, dockOpen],
  )

  return (
    <AssistantContext.Provider value={assistant}>
      <a
        href="#content"
        className="sr-only-focusable absolute z-50 m-2 rounded-sm bg-card px-3 py-2 text-control shadow-lift"
      >
        {t('nav.skipToContent')}
      </a>

      <div className="flex h-screen flex-col">
        <TopBar
          railCollapsed={railCollapsed}
          onToggleRail={() => setRailCollapsed((current) => !current)}
          onOpenAssistant={() => setDockOpen(true)}
        />

        <div className="flex min-h-0 flex-1">
          <NavRail collapsed={railCollapsed} />

          <main className="flex min-w-0 flex-1 flex-col">
            {config.demoMode ? (
              <SeverityBanner
                alerts={bannerItems}
                staged={!bannerIsLive}
                onInvestigate={bannerIsLive ? investigateBannerItem : ground}
              />
            ) : null}
            <div id="content" className="min-h-0 flex-1 overflow-y-auto [&>*]:min-h-full">
              <Outlet />
            </div>
          </main>

          <AssistantDock
            open={dockOpen}
            anomaly={groundedAnomaly}
            prompts={prompts}
            investigation={investigation}
            quoted={quoted}
            onClose={() => setDockOpen(false)}
          />
        </div>
      </div>
    </AssistantContext.Provider>
  )
}

/**
 * Page frame inside the content region. The 1700px cap matters: several screens
 * are 12-column tables that would otherwise stretch to unreadable line lengths
 * on an ultrawide control-room display.
 */
export function Page({ className, children }) {
  return <div className={`max-w-[1700px] px-8 pt-5.5 pb-10 max-xl:px-5.5 ${className ?? ''}`}>{children}</div>
}
