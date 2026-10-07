import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AiInsight, EvidenceTable } from "@/components/forge/AiSurface";
import { AlertCard } from "@/components/forge/AlertCard";
import { ChatThread } from "@/components/forge/ChatThread";
import { Chip } from "@/components/forge/Chip";
import { ForgeButton } from "@/components/forge/ForgeButton";
import { Icon } from "@/components/forge/Icon";
import { BrandLockup } from "@/components/forge/BrandLockup";
import { Panel } from "@/components/forge/Panel";
import { SignalTrace } from "@/components/forge/SignalTrace";
import { AiBadge, PlainBadge } from "@/components/forge/StatusBadge";
import { SkeletonRows } from "@/components/forge/States";
import { Dot, Eyebrow, Mono, Num } from "@/components/forge/primitives";
import { useAlertAnalysis, useAlerts } from "@/features/alerts/queries";
import { useCopilotThread } from "@/features/copilot/queries";
import { useOrg, useTopline, useWorkOrders } from "@/features/operations/queries";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { formatDecimal, formatHours, formatInteger, formatRelative } from "@/lib/format";
import { formatMeasure } from "@/lib/units";
import { STATE_TONE } from "@/lib/tone";
import { cn } from "@/lib/cn";
import { get } from "@/services/http";
import { endpoints } from "@/services/endpoints";
import { queryKeys } from "@/services/queryClient";
import { hasSession } from "@/services/authToken";

/**
 * The public page.
 *
 * Every demonstration on it is the product's own component reading the product's
 * own query layer — the alert cards, the signal trace, the evidence tables, the
 * assistant thread and the drafted work order are the real things, not pictures
 * of them. That is why the page cannot drift out of sync with the application,
 * and it is the strongest available proof for an audience that has been sold
 * screenshots before.
 *
 * Craft bar: serious data and infrastructure products — dense, evidence-led,
 * technical. Two consequences worth naming because they are easy to undo by
 * accident:
 *
 *  - No eyebrows above the marketing section headings. DESIGN.md permits an
 *    eyebrow only when it names something the heading does not, and on a
 *    persuasion surface a label above a heading is the oldest tell there is.
 *    They survive only inside product components, where they label a kind of
 *    thing.
 *  - The assistant section runs in the dark theme, set by a `data-theme`
 *    attribute on the section itself. That is not a decorative inversion: the
 *    conversation shown happens at 02:41, the dark theme is the control room,
 *    and the tokens flip wholesale because they were authored to.
 */

const FLAGSHIP = "ALR-4471";

/** Resolved once at import, so render stays pure. */
const CURRENT_YEAR = new Date().getFullYear();

export function LandingPage() {
  const { t } = useTranslation(["marketing", "app", "common"]);
  useDocumentTitle(t("meta.title"), t("meta.description"));

  // Read once per render. `hasSession` only checks the presence of a cookie
  // and does not decode or trust anything about it, which is fine for choosing
  // between two links — the API still gets the final say.
  const signedIn = hasSession();

  const alerts = useAlerts({ sort: "severity" });
  const analysis = useAlertAnalysis(FLAGSHIP);
  const thread = useCopilotThread();
  const workOrders = useWorkOrders();
  const org = useOrg();
  const topline = useTopline();

  const items = alerts.data?.items ?? [];
  const flagship = items.find((alert) => alert.id === FLAGSHIP);
  const bearingPair = items.filter((alert) => alert.sensor === "Vibration RMS" && alert.status !== "resolved");
  const draftedOrder = workOrders.data?.items?.find((order) => order.authoredBy === "ai");

  return (
    <div className="min-h-screen bg-page">
      <SiteHeader />

      <main id="content">
        {/* ══ HERO ═══════════════════════════════════════════════════════ */}
        <section className="border-b border-hairline">
          <Shell className="pt-16 pb-14 max-lg:pt-10 max-lg:pb-10">
            <h1 className="m-0 max-w-[20ch] text-balance text-[clamp(2.25rem,5.2vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.025em]">
              {t("hero.headline")}
            </h1>

            <p className="mt-7 max-w-[70ch] text-[clamp(1rem,1.4vw,1.125rem)] leading-[1.6] text-ink-dim">{t("hero.standfirst")}</p>

            {/* One action, not two. The accountless demo entrance is gone —
                every application route requires a token — so a second button
                offering a way in without one would lead straight back here.

                The button asks about the session so a signed-in visitor who
                lands here — hit the URL, followed a link, cleared history —
                is offered the dashboard rather than a sign-in that would take
                them to a screen that then redirects them straight back. */}
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ForgeButton asChild variant="primary" size="lg">
                <Link to={signedIn ? "/app/home" : "/login"}>
                  {signedIn ? t("hero.dashboard") : t("hero.primary")}
                  <Icon name="right" size="sm" className="mirror-rtl" />
                </Link>
              </ForgeButton>
              {signedIn ? null : (
                <span className="text-micro font-normal text-ink-dim">{t("hero.access")}</span>
              )}
            </div>
          </Shell>

          {/* The first viewport's anchor: the product running, at scale. */}
          <Shell className="pb-16 max-lg:pb-10">
            {analysis.isPending || !flagship ? (
              <SkeletonRows count={3} />
            ) : (
              <ProductFrame flagship={flagship} analysis={analysis.data} topline={topline.data} />
            )}
          </Shell>
        </section>

        {/* ══ DETECTION ══════════════════════════════════════════════════ */}
        <Section id="detection" className="bg-sunken">
          <Heading id="detection-heading">{t("detection.heading")}</Heading>
          <Lede>{t("detection.body")}</Lede>

          {analysis.isPending || !flagship ? (
            <SkeletonRows count={2} />
          ) : (
            <div className="mt-10 grid gap-4 [grid-template-columns:minmax(0,1fr)_minmax(260px,320px)] max-xl:grid-cols-1">
              <Panel className="p-5">
                <SignalTrace
                  draw
                  values={analysis.data.trace}
                  threshold={analysis.data.traceThreshold}
                  normalBand={analysis.data.traceNormalBand}
                  anomalyFrom={analysis.data.traceAnomalyFrom}
                  unit={analysis.data.traceUnit}
                  label={flagship.assetName}
                />
              </Panel>

              <div className="flex flex-col gap-4">
                <Panel>
                  <Eyebrow className="mb-3">{t("detection.detectorsHeading")}</Eyebrow>
                  <dl className="m-0 flex flex-col gap-2">
                    {flagship.detectors.map((detector) => (
                      <div key={detector.name} className="flex items-baseline justify-between gap-3 border-b border-subtle pb-1.5">
                        <dt className="text-body-sm text-ink-dim">{t(`common:detectors.${detector.name}`)}</dt>
                        <dd className="mono m-0 text-body-sm font-semibold">
                          {formatDecimal(detector.score, 2)}
                          {detector.unit ?? ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Panel>

                <Panel stripe="green">
                  <Eyebrow className="mb-2">{t("detection.gateHeading")}</Eyebrow>
                  <p className="m-0 flex items-start gap-2 text-body-sm">
                    <Icon name="check" size="sm" className="mt-0.5 shrink-0 text-green" />
                    {t("detection.gatePassed", { count: flagship.cascadeSensors })}
                  </p>
                  <Eyebrow className="mt-4 mb-2">{t("detection.ruleHeading")}</Eyebrow>
                  <p className="m-0 text-body-sm text-ink-dim">{t(`common:rules.${flagship.rule}`)}</p>
                </Panel>
              </div>
            </div>
          )}
        </Section>

        {/* ══ REASONING ══════════════════════════════════════════════════ */}
        <Section id="reasoning">
          <Heading id="reasoning-heading">{t("reasoning.heading")}</Heading>
          <Lede>{t("reasoning.body")}</Lede>

          {analysis.isPending ? (
            <SkeletonRows count={2} />
          ) : (
            <>
              <div className="mt-10 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
                <EvidenceTable
                  label={t("app:analysis.evidenceEyebrow")}
                  rows={analysis.data.evidence}
                  labelFor={(key) => t(`app:analysis.evidence.${key}`)}
                  className="bg-card"
                />

                <Panel>
                  <Eyebrow className="mb-3">{t("app:analysis.toolCalls")}</Eyebrow>
                  <ol className="m-0 flex list-none flex-col gap-2 p-0">
                    {analysis.data.toolCalls.map((call) => (
                      <li key={call.tool} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-subtle pb-1.5">
                        <span className="mono text-body-sm">{call.tool}</span>
                        <span className="mono text-micro font-normal text-ink-dim">{call.args}</span>
                      </li>
                    ))}
                  </ol>
                </Panel>

                <Panel>
                  <Eyebrow className="mb-3">{t("app:analysis.ruledOut")}</Eyebrow>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {analysis.data.ruledOut.map((reason) => (
                      <li key={reason} className="flex items-center gap-2 text-body-sm text-ink-dim">
                        <Icon name="x" size="sm" className="shrink-0 text-ink-mute" />
                        {t(`app:analysis.ruledOutItems.${reason}`)}
                      </li>
                    ))}
                  </ul>
                  <Eyebrow className="mt-4 mb-2">{t("app:analysis.similarEvents")}</Eyebrow>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {analysis.data.similarEvents.map((event) => (
                      <li key={event.alertId} className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
                        <Mono className="text-ink-dim">{event.assetId}</Mono>
                        <span className="text-micro font-normal text-on-green">
                          {t("app:analysis.avoidedHours", { hours: formatHours(event.avoidedHours) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>

              <p className="mt-8 max-w-[68ch] text-body text-ink-dim">{t("reasoning.closing")}</p>
            </>
          )}
        </Section>

        {/* ══ ASSISTANT ══════════════════════════════════════════════════
            This band ran in the dark theme in the previous pass. Reverted: the
            inversion was a flourish nobody asked for, the committed world is
            light-primary, and scoping a theme to one section is exactly what
            exposed the inherited-colour bug. The dark theme is real and stays
            first-class — its home is the app's own toggle, where a control-room
            reader turns it on for every screen rather than one band. */}
        <Section id="assistant" className="bg-sunken">
          <Heading id="assistant-heading">{t("assistant.heading")}</Heading>
          <Lede>{t("assistant.body")}</Lede>

          <div className="mt-10 grid gap-6 [grid-template-columns:minmax(0,1fr)_minmax(240px,300px)] max-xl:grid-cols-1">
            <Panel className="p-6 max-lg:p-4">
              <div className="mb-5 flex flex-wrap items-center gap-2.5 border-b border-hairline pb-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md tint-violet">
                  <Icon name="ai" size="sm" className="text-violet" />
                </span>
                <span className="text-title">{t("app:dock.title")}</span>
                <span className="text-body-sm text-ink-dim">
                  {t("assistant.contextLabel")}: <Mono>{thread.data?.context?.assetId ?? "—"}</Mono>
                </span>
              </div>

              {thread.isPending ? <SkeletonRows count={3} /> : <ChatThread messages={thread.data.messages} label={t("assistant.threadLabel")} />}

              <div className="mt-6 flex flex-wrap gap-2 border-t border-hairline pt-4">
                {thread.data?.suggestions?.map((suggestion) => (
                  <Chip as="span" key={suggestion}>
                    {suggestion}
                  </Chip>
                ))}
              </div>
            </Panel>

            <div className="flex flex-col gap-4">
              <AiInsight>{t("assistant.note")}</AiInsight>

              {/* Provenance is always on screen — including the provenance of an
                  assistant reply. This is what separates the answer from a
                  general-purpose model guessing about bearings. */}
              <Panel className="h-fit">
                <Eyebrow className="mb-2.5">{t("assistant.sawHeading")}</Eyebrow>
                <p className="m-0 text-body-sm text-ink-dim">{t("assistant.sawBody")}</p>
                <ul className="mt-3 flex list-none flex-col gap-2 p-0">
                  {["signals", "siblings", "baseline", "logbook", "history", "cmms"].map((key) => (
                    <li key={key} className="flex items-start gap-2 text-body-sm text-ink-dim">
                      <Icon name="check" size="sm" className="mt-0.5 shrink-0 text-ink-mute" />
                      <span>{t(`assistant.saw.${key}`, { asset: flagship?.assetId ?? "the asset" })}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </Section>

        {/* ══ WORK ═══════════════════════════════════════════════════════ */}
        <Section id="work">
          <Heading id="work-heading">{t("work.heading")}</Heading>
          <Lede>{t("work.body")}</Lede>

          {workOrders.isPending || !draftedOrder ? (
            <SkeletonRows count={2} />
          ) : (
            <div className="mt-10 grid gap-4 [grid-template-columns:minmax(0,1fr)_minmax(280px,340px)] max-xl:grid-cols-1">
              <Panel stripe="violet">
                <div className="mb-3.5 flex flex-wrap items-center gap-2">
                  <AiBadge label={t("work.aiDrafted")} />
                  <PlainBadge>{t(`app:workOrders.state.${draftedOrder.state}`)}</PlainBadge>
                  <Mono className="text-ink-dim">{draftedOrder.id}</Mono>
                </div>

                <h3 className="m-0 text-title">{t(`app:workOrders.titles.${draftedOrder.title}`)}</h3>

                <dl className="mt-4 grid gap-x-6 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                  <Field label={t("common:metrics.reading")}>{formatMeasure(flagship?.reading)}</Field>
                  <Field label={t("common:metrics.threshold")}>{formatMeasure(flagship?.threshold)}</Field>
                  <Field label={t("common:metrics.baseline")}>{formatMeasure(flagship?.baseline)}</Field>
                  <Field label={t("common:metrics.fusionScore")}>{flagship?.fusionScore}</Field>
                </dl>

                <Eyebrow className="mt-5 mb-2 border-t border-subtle pt-4">{t("work.writeBackHeading")}</Eyebrow>
                <p className="m-0 max-w-[62ch] text-body-sm text-ink-dim">{t("work.writeBackBody")}</p>
              </Panel>

              <Panel stripe="amber" className="h-fit">
                <div className="mb-3 flex items-center gap-2">
                  <Icon name="lock" size="sm" className="text-amber" />
                  <Eyebrow>{t("common:gates.loto")}</Eyebrow>
                </div>
                <p className="m-0 text-body-sm text-ink-dim">{t("work.gateNote")}</p>
                <ul className="mt-4 flex list-none flex-col gap-2 p-0">
                  {draftedOrder.gates.map((gate) => (
                    <li key={gate} className="flex items-center gap-2 text-body-sm">
                      <Icon name="shield" size="sm" className="shrink-0 text-ink-mute" />
                      {t(`common:gates.${gate}`)}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}
        </Section>

        {/* ══ THE PLANT ══════════════════════════════════════════════════ */}
        <Section id="plant" className="bg-sunken">
          <Heading id="plant-heading">{t("plant.heading")}</Heading>
          <Lede>{t("plant.body")}</Lede>

          {org.isPending ? (
            <SkeletonRows count={3} />
          ) : (
            <div className="mt-10 overflow-x-auto rounded-sm border border-hairline bg-card shadow-edge">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-sunken">
                    <Th>{t("plant.columnSite")}</Th>
                    <Th>{t("plant.columnProduct")}</Th>
                    <Th end>{t("plant.columnLines")}</Th>
                    <Th end>{t("plant.columnSensors")}</Th>
                    <Th end>{t("plant.columnUnits")}</Th>
                    <Th>{t("plant.columnState")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {org.data.sites.map((site) => {
                    const health = topline.data?.sites?.find((entry) => entry.siteId === site.id);
                    return (
                      <tr key={site.id} className="border-t border-subtle">
                        <th scope="row" className="px-3.5 py-3 text-start">
                          <span className="block text-body-sm font-semibold">{site.name}</span>
                          <span className="block text-micro font-normal text-ink-dim">
                            {site.city} · {site.countryName}
                          </span>
                        </th>
                        <td className="px-3.5 py-3 text-body-sm text-ink-dim">{site.product}</td>
                        <td className="num px-3.5 py-3 text-end text-body-sm">{formatInteger(site.lines)}</td>
                        <td className="num px-3.5 py-3 text-end text-body-sm">{formatInteger(site.sensors)}</td>
                        {/* The site's own unit, shown as the machine-minted
                            string it is. This column is the argument. */}
                        <td className="px-3.5 py-3 text-end">
                          <Mono className="text-ink-dim">{site.units.vibration}</Mono>
                        </td>
                        <td className="px-3.5 py-3">
                          <span className="inline-flex items-center gap-2 text-body-sm">
                            <Dot tone={STATE_TONE[health?.state] ?? "green"} size={7} />
                            {health ? t(`common:state.${health.state}`) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* The units rule shown, not claimed: two thresholds for the same
              physical limit, in the units their own sites report. */}
          <div className="mt-10 border-t border-hairline pt-8">
            <h3 className="m-0 text-title">{t("plant.unitsHeading")}</h3>
            <p className="mt-2.5 max-w-[74ch] text-body leading-[1.62] text-ink-dim">{t("plant.unitsBody")}</p>
            {bearingPair.length ? (
              <div className="mt-5 flex flex-col gap-2.5">
                {bearingPair.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            ) : null}
          </div>
        </Section>

        {/* ══ SOURCES ════════════════════════════════════════════════════ */}
        <Section id="sources">
          <Heading id="sources-heading">{t("sources.heading")}</Heading>
          <Lede>{t("sources.body")}</Lede>

          <ConnectorList />
        </Section>

        {/* ══ CLOSE ══════════════════════════════════════════════════════ */}
        <section className="border-t border-hairline bg-sunken">
          <Shell className="py-20 max-lg:py-12">
            <h2 className="m-0 max-w-[24ch] text-balance text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.02em]">
              {t("close.heading")}
            </h2>
            <p className="mt-5 max-w-[68ch] text-body leading-[1.62] text-ink-dim">{t("close.body")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ForgeButton asChild variant="primary" size="lg">
                <Link to={signedIn ? "/app/home" : "/login"}>
                  {signedIn ? t("close.dashboard") : t("close.primary")}
                  <Icon name="right" size="sm" className="mirror-rtl" />
                </Link>
              </ForgeButton>
            </div>
          </Shell>
        </section>
      </main>

      <footer className="border-t border-hairline bg-card">
        <Shell className="flex flex-wrap items-start justify-between gap-8 py-10">
          <BrandLockup size="sm" />
          <div className="flex max-w-[74ch] flex-col gap-2">
            <p className="m-0 text-micro font-normal text-ink-dim">{t("footer.synthetic")}</p>
            <p className="m-0 text-micro font-normal text-ink-dim">{t("footer.apis")}</p>
            <p className="m-0 text-micro font-normal text-ink-mute">{t("common:footer.copyright", { year: CURRENT_YEAR })}</p>
          </div>
        </Shell>
      </footer>
    </div>
  );
}

/* ══ HERO PRODUCT FRAME ═══════════════════════════════════════════════ */

/**
 * The product running, framed.
 *
 * Not a screenshot and not a mock: the alert card and the trace are the same
 * components the application renders, reading the same query layer. The thin
 * chrome strip above them is real product furniture — scope, live indicator,
 * refresh time — which is what makes the frame read as a running system rather
 * than a marketing composition.
 */
function ProductFrame({ flagship, analysis, topline }) {
  const { t } = useTranslation(["marketing", "app", "common"]);

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-card shadow-lift">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline bg-sunken px-4 py-2.5">
        <span className="flex items-center gap-2">
          <Dot tone="green" size={7} />
          <span className="text-micro">{t("hero.frameLabel")}</span>
        </span>
        {topline?.refreshedAt ? (
          <span className="text-micro font-normal text-ink-dim">{t("hero.frameRefresh", { when: formatRelative(topline.refreshedAt) })}</span>
        ) : null}
        <span className="flex-1" />
        {topline ? (
          <span className="flex items-center gap-4 max-lg:hidden">
            <FrameStat label={t("common:metrics.oee")} value={`${formatDecimal(topline.oee.value)}%`} />
            <FrameStat label={t("common:metrics.mtbf")} value={`${formatInteger(topline.mtbf.value)}h`} />
          </span>
        ) : null}
      </div>

      <div className="grid [grid-template-columns:minmax(0,1.35fr)_minmax(0,1fr)] max-xl:grid-cols-1">
        <div className="border-e border-hairline p-5 max-xl:border-e-0 max-xl:border-b">
          <SignalTrace
            draw
            values={analysis.trace}
            threshold={analysis.traceThreshold}
            normalBand={analysis.traceNormalBand}
            anomalyFrom={analysis.traceAnomalyFrom}
            unit={analysis.traceUnit}
            label={flagship.assetName}
          />
        </div>

        <div className="flex flex-col gap-3.5 p-5">
          <AlertCard alert={flagship} compact />

          {/* The verdict. Red because that is the consequence, and it carries
              the glyph and the words as well as the hue. */}
          <div className="rounded-sm border border-hairline stripe-red bg-page p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <Icon name="ai" size="sm" className="text-violet" />
              <Eyebrow>{t("app:analysis.rootCause")}</Eyebrow>
            </div>
            <p className="m-0 text-body font-semibold text-on-red">{t("hero.verdict", { eta: formatHours(flagship.etaHours) })}</p>
            <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">{t("hero.verdictSub")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FrameStat({ label, value }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-label font-bold uppercase text-ink-dim">{label}</span>
      <Num className="text-body-sm font-bold">{value}</Num>
    </span>
  );
}

/* ══ CONNECTORS ═══════════════════════════════════════════════════════ */

/**
 * Each source declares what it provides and, explicitly, what it does not.
 * Rendered as rows rather than a grid of matching cards — the negative column is
 * the differentiating claim, and it needs to sit beside the positive one to read
 * as a contract instead of a feature list.
 */
function ConnectorList() {
  const { t } = useTranslation(["marketing", "common"]);
  const { data, isPending } = useConnectors();

  if (isPending) return <SkeletonRows count={3} className="mt-10" />;

  return (
    <div className="mt-10 flex flex-col gap-2.5">
      {data.items.map((connector) => (
        <Panel
          key={connector.id}
          className="grid gap-x-8 gap-y-4 [grid-template-columns:minmax(190px,240px)_minmax(0,1fr)_minmax(0,1fr)] max-xl:grid-cols-1"
        >
          <div>
            <div className="flex items-center gap-2">
              <Dot tone={STATE_TONE[connector.state] ?? "green"} size={7} />
              <span className="text-title">{t(`common:connectorFamilies.${connector.family}`)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5">
              <Mono className="text-ink-dim">{connector.protocol}</Mono>
              {connector.tags ? <Num className="text-micro font-normal text-ink-dim">{t("sources.tags", { count: connector.tags })}</Num> : null}
              <span className="text-micro font-normal text-ink-mute">{t("sources.synced", { when: formatRelative(connector.lastSyncAt) })}</span>
            </div>
          </div>

          <div>
            <Eyebrow className="mb-2">{t("sources.provides")}</Eyebrow>
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {connector.provides.map((item) => (
                <li key={item} className="rounded-sm tint-green px-2 py-1 text-micro text-on-green">
                  {t(`common:dataKinds.${item}`)}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Eyebrow className="mb-2">{t("sources.doesNotProvide")}</Eyebrow>
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {connector.doesNotProvide.map((item) => (
                <li key={item} className="rounded-sm bg-sunken px-2 py-1 text-micro font-normal text-ink-dim line-through decoration-ink-mute">
                  {t(`common:dataKinds.${item}`)}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      ))}
    </div>
  );
}

/* ══ CHROME ═══════════════════════════════════════════════════════════ */

function SiteHeader() {
  const { t } = useTranslation(["marketing", "common"]);
  // Same read as the page's other CTAs: the button opens the dashboard when a
  // session is already present. This one matters most, because the wordmark
  // next to it links back to `/`, and a signed-in visitor cycling between the
  // two would otherwise see a "Sign in" button that reads as being logged out.
  const signedIn = hasSession();

  const sections = [
    { href: "#detection", label: t("nav.detection") },
    { href: "#reasoning", label: t("nav.reasoning") },
    { href: "#assistant", label: t("nav.assistant") },
    { href: "#plant", label: t("nav.plant") },
    { href: "#sources", label: t("nav.sources") },
  ];

  // Opaque, not translucent. The Flat-Light Rule: backdrop-filter was removed
  // from every light surface deliberately, and a sticky header over dense
  // content is exactly where it costs contrast.
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-card">
      <a href="#content" className="sr-only-focusable absolute z-50 m-2 rounded-sm bg-card px-3 py-2 text-control shadow-lift">
        {t("common:nav.skipToContent")}
      </a>
      <Shell className="flex min-h-14 items-center gap-7 py-2">
        <Link to="/" className="flex shrink-0 items-center">
          <BrandLockup size="lg" />
        </Link>

        <nav aria-label={t("nav.label")} className="flex-1 max-xl:hidden">
          <ul className="m-0 flex list-none items-center gap-6 p-0">
            {sections.map((section) => (
              <li key={section.href}>
                <a href={section.href} className="text-body-sm text-ink-dim transition-colors hover:text-ink">
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2.5">
          <ForgeButton asChild variant="primary">
            <Link to={signedIn ? "/app/home" : "/login"}>
              {signedIn ? t("nav.dashboard") : t("nav.login")}
            </Link>
          </ForgeButton>
        </div>
      </Shell>
    </header>
  );
}

/* LoginButton is gone. It existed to render a secondary "Log in" beside a
   primary "Open the demo plant"; with the demo entrance removed, signing in IS
   the primary action at each of the three call sites, so the wrapper had one
   caller shape left and no reason to exist. */

/* ══ LAYOUT PRIMITIVES ════════════════════════════════════════════════ */

/** Page gutter. Wider than the app's: this is a document, not a console. */
function Shell({ className, children }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-14 max-xl:px-8 max-lg:px-5", className)}>{children}</div>;
}

/**
 * A band. More space above a heading than below it, one rhythm throughout.
 *
 * The section labels itself from its own heading, so `headingId` is threaded
 * through rather than assumed — an `aria-labelledby` pointing at an id nobody
 * rendered is worse than no label at all.
 */
function Section({ id, className, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("border-b border-hairline py-20 max-lg:py-12", className)}>
      <Shell>{children}</Shell>
    </section>
  );
}

function Heading({ id, children }) {
  return (
    <h2 id={id} className="m-0 max-w-[30ch] text-balance text-[clamp(1.625rem,3.1vw,2.25rem)] font-semibold leading-[1.14] tracking-[-0.02em]">
      {children}
    </h2>
  );
}

function Lede({ children }) {
  return <p className="mt-5 max-w-[72ch] text-body leading-[1.62] text-ink-dim">{children}</p>;
}

function Th({ children, end }) {
  return (
    <th scope="col" className={cn("eyebrow px-3.5 py-2.5", end ? "text-end" : "text-start")}>
      {children}
    </th>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-subtle pb-1.5">
      <dt className="text-body-sm text-ink-dim">{label}</dt>
      <dd className="num m-0 text-body-sm font-semibold">{children}</dd>
    </div>
  );
}

/**
 * Lives here rather than in features/, because Data Fusion has no screen yet and
 * a one-call feature module would be premature abstraction. Moves when that
 * module is built. The URL still comes from the endpoint registry — nothing in
 * the app writes a path inline, including here.
 */
function useConnectors() {
  return useQuery({
    queryKey: queryKeys.connectors,
    queryFn: ({ signal }) => get(endpoints.dataFusion.connectors, { signal }),
    staleTime: 15 * 60_000,
  });
}
