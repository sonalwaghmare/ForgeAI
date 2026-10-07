import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { Page, useAssistant } from "@/shell/AppShell";
import { Field, TextArea } from "@/components/forge/Field";
import { Chip } from "@/components/forge/Chip";
import { ForgeButton, IconButton } from "@/components/forge/ForgeButton";
// The dropdown left with the status menu. Nothing on this screen opens a menu any
// more: the lifecycle is two transitions, each reached from the control that causes
// it, rather than five states chosen from a list.
import { ForgeDialog } from "@/components/forge/ForgeDialog";
import { ForgeSelect } from "@/components/forge/ForgeSelect";
import { HierarchyTrail } from "@/components/forge/HierarchyTrail";
import { AskOnSelection } from "@/components/forge/AskOnSelection";
import { Icon } from "@/components/forge/Icon";
import { Panel } from "@/components/forge/Panel";
import { RadarSweep } from "@/components/forge/RadarSweep";
import { ErrorState, SkeletonRows } from "@/components/forge/States";
import { RcaBadge, SeverityBadge, hueForSeverity, statusLabel } from "@/components/forge/StatusBadge";
// `Mono` left with the retired `evidence_citations` card: the evidence it set in
// monospace is now prose on the cause it argues for, and prose is not a machine string.
import { Eyebrow, Num, Serial } from "@/components/forge/primitives";
// `ANOMALY_STATUSES` and `hasRcaContent` left with the status menu — nothing here
// enumerates the lifecycle or gates a transition on an analysis existing now.
import { LIKELIHOODS, awaitsRcaRequest, isRcaRunning } from "@/features/anomalies/api";
import { RCA_POLL_CEILING_MS, useAnomaly, useAnomalyRca, useUpdateAnomaly, useUpdateAnomalyRca } from "@/features/anomalies/queries";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
// `config` is imported by the commented-out demo-mode block below; keep the import
// with it so restoring that block is one uncomment, not two.
// eslint-disable-next-line no-unused-vars
import { config } from "@/services/config";
// `formatPercent` left with the confidence card — nothing on this screen is a ratio
// any more.
import { formatDateTime, formatHours, formatInteger } from "@/lib/format";
import { ANOMALY_STATUS_ICON, ANOMALY_STATUS_TONE, ON_TINT_CLASS, STRIPE_CLASS, TINT_CLASS } from "@/lib/tone";
import { cn } from "@/lib/cn";
import { ActionTab } from "./ActionTab";
import { AnalysisTab } from "./AnalysisTab";
import { WorkboardTab } from "./WorkboardTab";

/**
 * One anomaly, and the analysis for it — request, wait, read, edit, approve.
 *
 * ── Four states from two fields, and a 404 that is one of them ────────────
 * `GET .../rca` answers 404 until somebody asks for an analysis, which is where
 * every anomaly starts. `fetchAnomalyRca` turns that into `null`, so this screen
 * branches on data and keeps `isError` for real faults:
 *
 *   null, or status `pending`   → not investigated. Offer to run it.
 *   `queued`, no content        → the radar. Poll every 2s.
 *   `queued`, past the ceiling  → stopped watching. Offer to check again.
 *   content present             → the report, editable in place, approvable.
 *
 * Both fields are load-bearing and each one alone gets a state wrong. Status alone
 * would show three headings over nothing, because `queued` carries `content: {}`
 * and `PATCH .../rca` can set `draft` without setting content. Content alone —
 * which this screen shipped first — put the radar over every `pending` row, so an
 * analysis nobody had requested looked like one the server was working on. Hence
 * `awaitsRcaRequest` and `isRcaRunning`, both of which read the pair.
 *
 * ── The poll has a ceiling, and not because the backend is unfinished ─────
 * Two minutes, then it stops and says so. The generator is being merged and will
 * work; a ceiling is still right, because a generator that hangs, dies, or loses
 * its queue is an ordinary production failure, and an uncapped 2-second poll in a
 * background tab is how that becomes a quiet flood of requests. The state it lands
 * in is "still analysing — check again", not an error, because as far as this
 * screen knows nothing has failed.
 */
export function AnomalyDetailPage() {
  const { anomalyId } = useParams();
  const { t } = useTranslation(["app", "common"]);

  const anomaly = useAnomaly(anomalyId);

  /**
   * Tell the assistant what a conversation here would be about, without opening
   * it. The copilot scopes by anomaly, so an ungrounded dock can only refuse —
   * and opening it on navigation would take 360px from the data on every anomaly
   * anyone merely glances at.
   */
  const { groundAnomaly, quote } = useAssistant();

  /**
   * A highlighted clause of the analysis, attached to the assistant's composer.
   *
   * It does not ask anything. A generated description runs to nine lines and the
   * question somebody has about it is almost always about one clause — but which
   * question is theirs, not this screen's. So the passage is carried across and
   * the field is focused, which removes the retyping and decides nothing.
   */
  const payloadRef = useRef(null);
  const quoteToAssistant = useCallback(
    (text) => {
      if (!anomaly.data) return;
      quote(
        {
          id: anomaly.data.id,
          serialNumber: anomaly.data.serialNumber,
          assetName: anomaly.data.hierarchy?.machine ?? anomaly.data.hierarchy?.line ?? null,
        },
        text,
      );
    },
    [anomaly.data, quote],
  );
  useEffect(() => {
    if (!anomaly.data) return;
    groundAnomaly({
      id: anomaly.data.id,
      serialNumber: anomaly.data.serialNumber,
      assetName: anomaly.data.hierarchy?.machine ?? anomaly.data.hierarchy?.line ?? null,
    });
  }, [anomaly.data, groundAnomaly]);

  /**
   * Whether this visit has outlasted the ceiling.
   *
   * A fact about how long THIS visit has been watching, not about the record — so
   * leaving and coming back starts the clock again, which is right: somebody
   * returning deserves a fresh look before being told it is slow.
   */
  const [gaveUpOn, setGaveUpOn] = useState(null);

  const rca = useAnomalyRca(anomalyId, { poll: !gaveUpOn });

  // Requested and running — `queued` with nothing in it yet. The hook stops polling
  // on its own the moment content lands; this is the other end, the point where the
  // screen stops claiming to watch. A `pending` row is not running and is not
  // watched: nobody has asked the server for it.
  const running = isRcaRunning(rca.data);

  /**
   * `stalled` is DERIVED, and the state records only which row was abandoned.
   *
   * The obvious shape — a boolean set true by the timer and false by an early
   * return in the same effect — sets state synchronously during the effect on every
   * unrelated re-render, which cascades. Recording the id instead means state is
   * only ever written from the timer callback, and every reset falls out of the
   * comparison: content arriving clears it, and so does navigating to another
   * anomaly, with no second effect to keep in step.
   */
  const stalled = running && gaveUpOn === rca.data.id;

  useEffect(() => {
    if (!running) return undefined;
    const id = rca.data.id;
    const timer = setTimeout(() => setGaveUpOn(id), RCA_POLL_CEILING_MS);
    return () => clearTimeout(timer);
  }, [running, rca.data?.id]);

  useDocumentTitle(`${anomaly.data?.serialNumber ?? t("anomalies.detail.title")} · ${t("common:brand.name")}`);

  return (
    <Page>
      {/* ── Leave at one end, act at the other ───────────────────────────
          Back and Dismiss share one row above the record, pushed to opposite
          ends. Dismiss is the only action on this screen that changes the
          anomaly itself — approval acts on the analysis — so it sits apart from
          the panel's own controls rather than among them.

          It renders only once the anomaly has loaded: an action bar offering to
          dismiss a record that turned out to 404 is a button with nothing behind
          it. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ForgeButton asChild>
          <Link to="/app/anomalies">
            {/* A direction, not a glyph — mirrored under `dir="rtl"`. */}
            <Icon name="right" size="xs" className="rotate-180 rtl:rotate-0" />
            {t("anomalies.detail.back")}
          </Link>
        </ForgeButton>

        <div className="flex-1" />

        {anomaly.data ? <DismissAction anomaly={anomaly.data} rca={rca.data} /> : null}
      </div>

      {anomaly.isPending ? (
        <SkeletonRows count={3} />
      ) : anomaly.isError ? (
        <ErrorState error={anomaly.error} title={t("anomalies.detail.loadFailed")} onRetry={() => anomaly.refetch()} />
      ) : (
        <>
          {/* ── Everything below here is the server's own words ───────────
              The ref bounds where a text selection offers to ask the assistant
              about itself. It goes around the record and the analysis and NOT
              around the action bar above: offering to explain a Back button is
              offering to explain this application to the person using it. */}
          <div ref={payloadRef}>
            <AnomalyHeader anomaly={anomaly.data} rca={rca.data} />
            <RcaSection anomaly={anomaly.data} anomalyId={anomalyId} rca={rca} stalled={stalled} />
          </div>

          <AskOnSelection containerRef={payloadRef} onAsk={quoteToAssistant} />
        </>
      )}
    </Page>
  );
}

/* ══ HEADER ════════════════════════════════════════════════════════════ */

/**
 * The record, stated once, with the one control that changes it.
 *
 * Same anatomy as the list card so arriving reads as a zoom rather than a different
 * screen: badges, title, attachment trail, then the identifier and its timestamp in
 * a side column. What changes is scale.
 *
 * The status badge is gone from here — it is stated once at the foot of the side
 * column, by `StatusFact`. Two renderings of one field on one card is how they end up
 * disagreeing.
 */
function AnomalyHeader({ anomaly, rca }) {
  const { t } = useTranslation(["app", "common"]);

  const stripe = hueForSeverity(anomaly.severity);

  return (
    <Panel className={cn("flex items-start gap-6 max-lg:flex-wrap", stripe && STRIPE_CLASS[stripe])}>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={anomaly.severity} dot />
          {/* From the RCA query, never from `anomaly.rcaStatus`.
              `AnomalyOut` omits `rca_status` — only the LIST item carries it — so
              the record this screen holds always reports `pending`, and trusting it
              would show "No analysis" over a finished report. `GET .../rca` is the
              only truthful source here. Absent until that lands, rather than
              wrong. */}
          {rca ? <RcaBadge status={rca.status} /> : null}
        </div>

        <h1 className="m-0 text-headline">{anomaly.title}</h1>
        <HierarchyTrail hierarchy={anomaly.hierarchy} className="mt-2" />

        {/* ── Ask Forge AI ────────────────────────────────────────────
            Demo-gated and purely additive: this screen is the LIVE anomaly
            resource and nothing about its data changes here. The seeded
            question names the machine, and `?q=` is the Copilot screen's own
            entry point. With the flag off there is no Copilot screen, so the
            link is not offered rather than being a broken one. */}
        {/* {config.demoMode && anomaly.hierarchy?.machine ? (
          <ForgeButton asChild size="sm" variant="ghost" className="mt-3">
            <Link
              to={`/app/copilot?mode=trouble&q=${encodeURIComponent(
                `What is wrong with ${anomaly.hierarchy.machine}?`,
              )}`}
            >
              <Icon name="ai" size="xs" />
              {t('copilot.askAbout')}
            </Link>
          </ForgeButton>
        ) : null} */}
      </div>

      {/* ── The facts, in a row rather than a stack ──────────────────────
          Status sits before Detected, both on one line under the serial.

          They were stacked, which made this column taller than the title beside it
          and left a band of empty card under the hierarchy trail — the header was
          sized by the column rather than by its own content. Side by side, the
          column is two lines deep and the panel closes up behind it.

          Status first because it is the question asked on arrival: what state is
          this record in. The timestamp is what gets quoted into a work order
          afterwards.

          Each field keeps its own start edge and the pair start-aligns as a group,
          so the two eyebrows sit at the same y and each value begins under its own
          label. Wraps to a stack below `sm`, where two fields side by side would be
          a few words wide. */}
      <div className="shrink-0 max-lg:w-full">
        {/* Flush to the corner. `text-end` inside a block whose width is set by the
            two fields below it, so the id sits above the end of the pair rather
            than above the start of Status — which is what "top right" means on a
            panel whose right edge is the id's own. */}
        <Serial
          as="div"
          value={anomaly.serialNumber}
          className="mb-2.5 font-semibold text-on-forge lg:text-end"
        />

        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <StatusFact anomaly={anomaly} />

          <div>
            {/* ── "Detected", not "Created" ────────────────────────────────
                The prototype labels this slot CREATED while the field behind it
                is named `detected`. The real API has both, and in the seeded
                data they are months apart: `created_at` is when the row was
                written, `detected_at` is when the plant misbehaved. An operator
                is asking the second question.

                Absolute, not relative. "7 months ago" is right in a scanning
                list; on the record itself this is what gets quoted into a work
                order. */}
            <Eyebrow as="div">{t("anomalies.detail.detected")}</Eyebrow>
            <p className="mt-1.5 mb-0 flex items-center gap-1.5">
              <Icon name="cal" size="xs" className="text-ink-mute" />
              <Num className="text-body font-medium">
                {anomaly.detectedAt ? formatDateTime(anomaly.detectedAt, IST_STAMP) : "—"}
              </Num>
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/**
 * The status, stated. Nothing here changes it.
 *
 * ── Why the menu went ────────────────────────────────────────────────────
 * This was a five-item dropdown that could put the anomaly into any state at any
 * time, which made the lifecycle a thing the reader had to know rather than a thing
 * the product runs. The lifecycle is now two transitions and neither is chosen from
 * a list: an anomaly arrives `open`, a person dismisses it from the action above, or
 * somebody approves its analysis and it becomes `acknowledged`. Both are consequences
 * of a decision made somewhere else on the screen.
 *
 * So this is a fact in a column of facts, built exactly like the serial and the
 * detected time beside it — an eyebrow over a value. It keeps the glyph and hue the
 * list's facet tiles and card badges use, so the state reads the same here as it did
 * on the row that was clicked to arrive.
 *
 * ── It renders every status, including the two the product withdrew ──────
 * `escalated` and `resolved` are gone from the interface and NOT from the database:
 * the enum still declares them and rows still sit in them. A record in one of those
 * states opens here and must say so plainly rather than showing a blank or falling
 * back to "open" — see `RETIRED_STATUSES`. `StatusGlyph` already answers an unmapped
 * value with a neutral disc, so a sixth member added server-side lands the same way.
 *
 * The "waiting for an analysis" caption went with the menu. It explained why a
 * control was missing, and there is no longer a control for it to explain.
 *
 * The state's own caption went too — "Awaiting triage" under Open. It is still on
 * the list's facet tiles, where it is doing real work: there the reader is choosing
 * between five similar words and the caption is what separates them. Here there is
 * one status and its word is the whole of it, so the line was a third row in a
 * two-row header explaining a term the reader had just clicked through.
 */
function StatusFact({ anomaly }) {
  const { t } = useTranslation(["app", "common"]);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Eyebrow as="div">{t("anomalies.columns.status")}</Eyebrow>
      <span className="inline-flex items-center gap-2">
        <StatusGlyph status={anomaly.status} />
        <span className="text-control font-medium text-ink">{statusLabel(t, anomaly.status)}</span>
      </span>
    </div>
  );
}

/**
 * Dismiss — the one action that acts on the anomaly rather than on its analysis.
 *
 * ── Available with no analysis, on instruction ───────────────────────────
 * The old status menu appeared only once an RCA existed, on the argument that
 * judging an anomaly without the evidence this product exists to produce is a
 * decision taken blind. Dismiss is the exception and it is the right one: deciding a
 * detection is not worth investigating IS the judgement, and requiring an
 * investigation first inverts it. So it is offered from the moment the record loads.
 *
 * ── Only on an open anomaly ──────────────────────────────────────────────
 * Not disabled on the others — absent. `open` is the only state dismissal is a move
 * FROM: an acknowledged anomaly has been taken on by somebody, a dismissed one is
 * already there, and the two withdrawn states are not reachable from this UI at all.
 * A disabled button in each of those cases would be a control explaining, four times
 * over, that it does not apply — and DESIGN.md's own position is that a permanently
 * disabled control teaches people to keep trying it.
 *
 * The action bar therefore holds only Back on a record that cannot be dismissed,
 * which is honest: there is nothing to do to it from here. `StatusFact` in the header
 * is what says why, in words, a few lines below.
 *
 * There is deliberately no counterpart that re-opens a dismissed anomaly — that
 * transition was not asked for, and inventing it would put a third way to move the
 * lifecycle back into a UI that just had five cut to two.
 *
 * ── Danger, and a dialog ─────────────────────────────────────────────────
 * The variant is `danger` because this is the destructive end of the lifecycle: a
 * dismissed anomaly stops being triaged and drops out of every open-work view. The
 * confirmation is the same shape approval gets, for the same reason — this is a
 * judgement with somebody's name behind it, not a toggle.
 */

/**
 * Why somebody moved an anomaly, per transition.
 *
 * A closed list rather than free text, because the value of this field is entirely
 * in it being countable: "41% of dismissals on this line are sensor faults" is a
 * finding, and forty differently-worded sentences meaning that are not. The comment
 * box is where the wording goes, and `other` on the dismiss list is its escape
 * hatch.
 *
 * ── Two lists, not one shared one ─────────────────────────────────────────
 * The question is different in each case. Dismissing asks why this detection was
 * not worth acting on — a judgement about the DETECTOR, which is what makes it
 * worth counting. Approving asks what happens to the anomaly next, because
 * approving an analysis is also what acknowledges it, and somebody taking a record
 * on is saying what they are taking it on FOR. Merging them would produce a list
 * where most options are wrong for whichever dialog you are in.
 *
 * Client-side only, and NOT enums the server declares — `AnomalyUpdate` has no
 * field for any of this. Written out here so that when the API gains one, the lists
 * move to `features/anomalies/api.js` beside `ANOMALY_STATUSES` and these constants
 * are deleted rather than reconciled.
 */
const DISMISS_REASONS = ["falsePositive", "plannedMaintenance", "duplicate", "sensorFault", "other"];
const APPROVE_REASONS = ["reviewing", "assigning", "monitoring"];

/**
 * The confirmation both lifecycle transitions use: what it will do, why, and a
 * comment.
 *
 * One component rather than two of the same shape. The two dialogs differ in their
 * verb, their tone and their reason list and in nothing else, and the parts that
 * are easy to get subtly wrong — resetting the fields when it reopens, requiring a
 * reason, keeping a failed write in front of the button that caused it, refusing to
 * close mid-flight — are exactly the parts that should not exist twice.
 *
 * ── Neither the reason nor the comment is sent ────────────────────────────
 * `PATCH /anomalies/{id}` accepts `title`, `severity` and `status`, and
 * `PATCH .../rca` accepts `content` and `status`. There is no field on the wire for
 * either of these on either transition, so both are collected and dropped.
 *
 * That is a deliberate, temporary state — the controls are being built ahead of the
 * endpoint — and the one thing it must not do is lie about itself. The prototype's
 * copy for these dialogs says the reason and comments "are recorded to the activity
 * log and used to improve AI recommendations", which is a sentence this product
 * cannot honour: a person would type an explanation of a judgement, watch it
 * vanish, and have no way to know. So `hint` on the comment box states what
 * actually happens, and BACKEND-GAPS.md carries the request for the fields. When
 * they land, `onConfirm` already receives both.
 *
 * @param {object} props
 * @param {string} props.reasonKey  i18n path under `anomalies.detail` holding this
 *   transition's reason labels; its keys ARE the option list, via `reasons`
 * @param {(input: {reason: string, comment: string}) => void} props.onConfirm
 */
function TransitionDialog({
  open,
  pending,
  error,
  title,
  body,
  reasons,
  reasonKey,
  confirmLabel,
  pendingLabel,
  confirmVariant,
  confirmIcon,
  errorText,
  onClose,
  onConfirm,
}) {
  const { t } = useTranslation(["app", "common"]);
  const [reason, setReason] = useState(null);
  const [comment, setComment] = useState("");

  /**
   * Reopening starts clean.
   *
   * A reason left over from a dialog somebody cancelled is the wrong answer
   * pre-selected the next time they open it, and it would be pre-selected without
   * them having chosen it. Done here rather than in each opener so every call site
   * gets it without having to remember.
   *
   * Adjusted during render rather than in an effect. React's own answer for
   * "reset state when a prop changes", and the reason is not style: an effect
   * would paint one frame carrying the previous dialog's answer before clearing
   * it, and the lint rule that forbids it is describing that cascade. This path
   * re-renders before anything reaches the screen.
   */
  const [openedWith, setOpenedWith] = useState(open);
  if (open !== openedWith) {
    setOpenedWith(open);
    setReason(null);
    setComment("");
  }

  return (
    <ForgeDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
      size="sm"
      title={title}
      footer={
        <>
          <ForgeButton
            variant={confirmVariant}
            /* A reason is required. The whole point of asking is that the answer is
               countable, and a transition with no reason is the row that makes the
               count unusable — so the control waits rather than defaulting to one,
               which would put a judgement nobody made on the record. */
            disabled={pending || !reason}
            onClick={() => onConfirm({ reason, comment })}
          >
            <Icon name={confirmIcon} size="sm" />
            {pending ? pendingLabel : confirmLabel}
          </ForgeButton>
          <ForgeButton disabled={pending} onClick={onClose}>
            {t("common:actions.cancel")}
          </ForgeButton>
        </>
      }
    >
      {/* A failed write keeps the dialog open, in front of the button that caused
          it. Closing first would report the failure onto a surface that had already
          gone. */}
      {error ? (
        <p className="mt-0 mb-3 flex items-start gap-1.5 text-body-sm text-on-red">
          <Icon name="bolt" size="xs" className="mt-0.5 shrink-0" />
          <span>{errorText}</span>
        </p>
      ) : null}

      <p className="m-0 text-body text-ink-dim">{body}</p>

      <fieldset className="m-0 mt-4 border-0 p-0">
        <legend className="mb-2 p-0 text-control text-ink">{t("anomalies.detail.transitionReason")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((key) => (
            <Chip key={key} selected={reason === key} disabled={pending} onClick={() => setReason(key)}>
              {t(`anomalies.detail.${reasonKey}.${key}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <TextArea
        className="mt-4"
        label={t("anomalies.detail.transitionComment")}
        hint={t("anomalies.detail.transitionNotSent")}
        rows={3}
        value={comment}
        disabled={pending}
        onChange={(event) => setComment(event.target.value)}
        placeholder={t("anomalies.detail.transitionCommentPlaceholder")}
      />
    </ForgeDialog>
  );
}

function DismissAction({ anomaly, rca }) {
  const { t } = useTranslation(["app", "common"]);
  const update = useUpdateAnomaly();
  const [confirming, setConfirming] = useState(false);

  /* Read before the early returns, so the hooks above always run: this component
     mounts for every anomaly and only its output is conditional. */
  if (anomaly.status !== "open") return null;

  /**
   * Gone while an analysis is running.
   *
   * Dismissing means "this detection was not worth acting on", and that judgement
   * cannot honestly be made in the seconds after somebody asked the machine to
   * explain the detection — the evidence for or against it is being produced right
   * now. Offering the control there invites a decision the next screen refresh
   * might contradict.
   *
   * Absent rather than disabled, which is the same call the `open` check above
   * makes and DESIGN.md's position generally: a permanently disabled control
   * teaches people to keep trying it. The RCA panel below says what is happening
   * and the button returns on its own when the analysis lands.
   */
  if (isRcaRunning(rca)) return null;

  return (
    <>
      <ForgeButton
        variant="danger"
        disabled={update.isPending}
        onClick={() => {
          update.reset();
          setConfirming(true);
        }}
      >
        <Icon name="x" size="sm" />
        {update.isPending ? t("anomalies.detail.dismissing") : t("anomalies.detail.dismiss")}
      </ForgeButton>

      <TransitionDialog
        open={confirming}
        pending={update.isPending}
        error={update.isError}
        errorText={t("anomalies.detail.statusFailed")}
        title={t("anomalies.detail.dismissTitle", { serial: anomaly.serialNumber })}
        /* The status this moves to, named. `statusLabel` rather than the literal
           word, so this and the badge that appears afterwards cannot disagree — and
           so a rename of the lifecycle reaches both. */
        body={
          <Trans
            i18nKey="anomalies.detail.dismissBody"
            t={t}
            values={{ status: statusLabel(t, "dismissed") }}
            components={{ status: <strong className="font-semibold text-ink" /> }}
          />
        }
        reasons={DISMISS_REASONS}
        reasonKey="dismissReasons"
        confirmLabel={t("anomalies.detail.dismissConfirm")}
        pendingLabel={t("anomalies.detail.dismissing")}
        confirmVariant="danger"
        confirmIcon="x"
        onClose={() => setConfirming(false)}
        onConfirm={() => update.mutate({ id: anomaly.id, status: "dismissed" }, { onSuccess: () => setConfirming(false) })}
      />
    </>
  );
}

/**
 * One status as its mark: the glyph in a disc of its own hue.
 *
 * The same pairing the facet tiles and the card badges use, at the size the header
 * can afford. An unmapped status takes the sunken fill and a generic bolt, so a
 * sixth lifecycle member added server-side renders as an unfamiliar-but-working
 * row rather than a hole.
 */
function StatusGlyph({ status, className }) {
  const tone = ANOMALY_STATUS_TONE[status] ?? null;

  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", tone ? TINT_CLASS[tone] : "bg-sunken", className)}>
      <Icon name={ANOMALY_STATUS_ICON[status] ?? "bolt"} size="xs" className={tone ? ON_TINT_CLASS[tone] : "text-ink-dim"} />
    </span>
  );
}

/* ══ RCA LIFECYCLE ═════════════════════════════════════════════════════ */

function RcaSection({ anomaly, anomalyId, rca, stalled }) {
  const { t } = useTranslation(["app", "common"]);
  const { investigate } = useAssistant();

  if (rca.isPending) return <SkeletonRows count={2} className="mt-5" />;

  if (rca.isError) {
    return <ErrorState error={rca.error} title={t("anomalies.detail.rcaFailed")} onRetry={() => rca.refetch()} className="mt-5" />;
  }

  /**
   * Nobody has asked yet — either no row (the endpoint 404'd) or a row parked at
   * `pending`. Both get the invitation to start one.
   *
   * The `pending` half of that used to fall through to the radar, because the
   * branch below tested for empty content rather than for status. So an anomaly
   * whose analysis had never been requested showed a sweeping radar and "Analysing
   * root cause" — the screen asserting the server was working on something it had
   * never been told about, which is the one thing this product's provenance
   * principle rules out.
   */
  if (awaitsRcaRequest(rca.data)) {
    return (
      <RcaPrompt title={t("anomalies.detail.notInvestigated")} body={t("anomalies.detail.notInvestigatedBody")}>
        <ForgeButton
          variant="ai"
          size="lg"
          onClick={() =>
            investigate({
              id: anomalyId,
              serialNumber: anomaly?.serialNumber,
              assetName: anomaly?.hierarchy?.machine ?? anomaly?.hierarchy?.line ?? null,
            })
          }
        >
          <Icon name="ai" size="sm" />
          {t("anomalies.detail.investigate")}
        </ForgeButton>
      </RcaPrompt>
    );
  }

  /**
   * Requested and running: `queued`, with nothing in `content` yet. This is the
   * only state the radar belongs to.
   *
   * A `draft` or `approved` row with empty content deliberately does NOT land here
   * any more — a status a person set by hand is not a job to wait on, so it falls
   * through to the panel, which states each missing field as absent.
   */
  if (isRcaRunning(rca.data)) {
    return stalled ? (
      <RcaPrompt title={t("anomalies.detail.stalled")} body={t("anomalies.detail.stalledBody")}>
        <ForgeButton disabled={rca.isFetching} onClick={() => rca.refetch()}>
          <Icon name="search" size="sm" />
          {rca.isFetching ? t("anomalies.detail.checking") : t("anomalies.detail.checkAgain")}
        </ForgeButton>
      </RcaPrompt>
    ) : (
      <Analysing />
    );
  }

  return <RcaPanel anomaly={anomaly} anomalyId={anomalyId} rca={rca.data} />;
}

/**
 * The radar, and what it is doing.
 *
 * ── One phase, not the prototype's four ───────────────────────────────────
 * The prototype cycles "Investigating anomaly" → "Analysing root cause" →
 * "Building recommendations" → "Preparing work order" on a timer. That is a
 * fabricated pipeline: the server reports one status and nothing else, so
 * announcing that it has moved on to drafting a corrective plan would be this
 * screen inventing progress it cannot see. PRODUCT.md's fourth principle is that
 * provenance is always on screen; a fake stage is the exact opposite.
 *
 * So: the one phase the design's own screenshot shows, held for the duration. The
 * radar carries the liveness, the copy carries the truth.
 *
 * `role="status"` rather than a bare `aria-live`, so the heading and the caption
 * are announced as one update instead of two.
 */
function Analysing() {
  const { t } = useTranslation(["app", "common"]);

  return (
    <div role="status" className="mt-5 flex flex-col items-center gap-2 px-6 py-12 text-center">
      <RadarSweep className="mb-4" />
      <h2 className="m-0 text-title">{t("anomalies.detail.analysing")}</h2>
      <p className="m-0 max-w-[52ch] text-body-sm text-ink-dim">{t("anomalies.detail.analysingBody")}</p>
    </div>
  );
}

/**
 * The centred prompt the design puts under the header card.
 *
 * ── Flat violet, not the prototype's gradient ─────────────────────────────
 * The prototype draws this mark as a `linear-gradient(135deg,#BF5AF2,#7B3FE4)` disc
 * inside a radial halo. DESIGN.md forbids both and names violet-on-an-AI-affordance
 * as the clearest generated-software tell there is. The radar earns its single-hue
 * alpha falloff because a sweep IS one; a static disc earns nothing, so this is the
 * violet tint with the node glyph — the convention every other AI surface uses.
 *
 * ── The action opens the Copilot panel, which is where it runs ────────────
 * The prototype's copy reads "Run Investigate anomaly from the Forge AI Copilot
 * panel", and that is now what happens — the button grounds the dock on this
 * anomaly and asks it to investigate. It could not before: the dock was built on
 * the fixture alert shape and had no way to talk about an anomaly at all. It is
 * now scoped by `page_anomaly_id` and `run_rca` is one of its tools, so the button
 * is a way into the conversation rather than a second, quieter implementation of
 * it.
 *
 * That is deliberate and it costs something. Starting an analysis now needs the
 * copilot service, where before it was a bare `POST .../rca/request`. The trade is
 * that there is exactly one path — whatever the button does, the user could have
 * typed, and the answer comes back in the same place either way.
 */
function RcaPrompt({ title, body, children }) {
  return (
    <div className="mt-5 flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full tint-violet">
        <Icon name="ai" size="lg" className="text-violet" />
      </span>

      <div className="flex flex-col items-center gap-2">
        <h2 className="m-0 text-title">{title}</h2>
        <p className="m-0 max-w-[52ch] text-body-sm text-ink-dim">{body}</p>
      </div>

      {children ? <div className="flex flex-col items-center gap-2.5">{children}</div> : null}
    </div>
  );
}

/* ══ THE ANALYSIS ══════════════════════════════════════════════════════ */

/**
 * The analysis: a report, not a form full of paragraphs.
 *
 * ── Why this is a two-column layout of cards ──────────────────────────────
 * The first version put all three fields in one panel as stacked headings, which
 * read as a settings page that happened to contain prose. The design's AI Synopsis
 * screen is the reference: separate cards down a main column, each opened by a
 * 10px uppercase eyebrow naming exactly what it holds, and a narrow rail beside
 * them for the figures you glance at rather than read.
 *
 * That split is doing work. The main column is *argument* — a hypothesis, the
 * causes ranked under it, the evidence under those — and it is read top to bottom,
 * once. The rail is *metadata* — how confident, over what window, when — and it is
 * glanced at repeatedly while reading the argument. Interleaving them, which is
 * what a single stacked panel does, means the reader loses their place in the
 * argument every time they check a number.
 *
 * ── The rail is built from fields that were being thrown away ─────────────
 * `AnomalyOut` returns `window_start`, `window_end`, `last_detected_at` and
 * `updated_at`; this screen fetched all four and rendered none of them. They are
 * the answer to "how much data is this conclusion standing on", which is the first
 * question anyone asks of a machine-authored diagnosis — so the rail is not padding
 * invented to balance the layout, it is the part that was missing.
 *
 * ── What the design has that this deliberately does not ──────────────────
 * No AI Synopsis / Analysis / Action tabs: there is one tab's worth of content and
 * two empty tabs is worse than none. No Recommended Actions, Scheduling or Required
 * Parts cards, and no "Create work order from plan" — the model returns four keys
 * and none of them is a plan, a part or a window. And no `→` affordance in each
 * card corner, because there is nowhere for it to go. Every one of those is a card
 * the design fills with placeholder data; drawing them empty, or filling them, would
 * be the one failure this screen cannot recover from.
 */
function RcaPanel({ anomaly, anomalyId, rca }) {
  const { t } = useTranslation(["app", "common"]);
  const update = useUpdateAnomalyRca(anomalyId);
  const acknowledge = useUpdateAnomaly();

  /* Which of the four the reader is on. Local, not a URL param: the other
     three are demo content with nothing worth linking somebody to, and the
     anomaly itself already has an address. */
  const [tab, setTab] = useState("synopsis");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(rca.content));
  const [confirmingApproval, setConfirmingApproval] = useState(false);

  const approved = rca.status === "approved";

  /**
   * Approving the analysis acknowledges the anomaly.
   *
   * ── Two writes, and the second one can fail on its own ───────────────────
   * There is no single endpoint for this: `PATCH .../rca` moves the analysis and
   * `PATCH /anomalies/{id}` moves the anomaly, and the frontend sequences them. So
   * the honest failure model is that approval can succeed and acknowledgement not,
   * and this must never present that as one atomic act.
   *
   * It is therefore chained on success rather than fired alongside — an
   * acknowledgement written for an approval that was rejected is the worse half to
   * get wrong. If the second call fails the first still stands: the dialog closes,
   * the analysis reads Approved because it is, and the header keeps saying Open with
   * an error beside it. That is the true state of the system, and it is recoverable —
   * approving again re-runs the pair.
   *
   * Skipped when the anomaly is already `acknowledged`, so re-approving an edited
   * analysis does not send a write that changes nothing. Deliberately NOT skipped for
   * `dismissed`: somebody who dismissed an anomaly and then approved its analysis has
   * changed their mind in the direction of the evidence, and the acknowledgement is
   * the more recent judgement of the two.
   */
  function approve() {
    update.mutate(
      { status: "approved" },
      {
        onSuccess: () => {
          setConfirmingApproval(false);
          if (anomaly.status !== "acknowledged") {
            acknowledge.mutate({ id: anomaly.id, status: "acknowledged" });
          }
        },
      },
    );
  }

  function save() {
    /**
     * The whole stored object, with only the edited keys replaced.
     *
     * `PATCH .../rca` replaces `content` wholesale — there is no merge server-side —
     * so spreading the original first is what keeps any key this editor does not know
     * about from being deleted on the first save. The column has no schema and the
     * generator is still being built, so unknown keys are the expected case rather
     * than a defensive hypothetical — and right now they include the three keys the
     * generator just retired, which a reviewer editing an older analysis would
     * otherwise destroy by opening the editor and pressing Save.
     */
    update.mutate(
      {
        content: {
          ...rca.content,
          what_happened: draft.whatHappened,
          fault_domain: draft.faultDomain,
          ranked_causes: draft.rankedCauses,
        },
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  function startEditing() {
    // Re-read on entry rather than trusting the copy taken at mount: the poll or
    // another reviewer may have moved the record since this screen opened.
    setDraft(toDraft(rca.content));
    update.reset();
    setEditing(true);
  }

  return (
    <section className="mt-5 flex flex-col gap-4">
      {/* ── The tab strip ─────────────────────────────────────────────────
          The design's own `AI Synopsis · Analysis · Action` row, replacing the
          violet band that used to sit here. Two of the three are permanently
          disabled: they exist in the design, and showing them states the shape of
          the module rather than pretending this screen is the whole of it.

          Disabled with `aria-disabled` AND `disabled`, so they leave the tab order
          instead of being focus stops that do nothing. Their accessible name says
          why — a sighted reader gets the muted treatment, a screen-reader user gets
          "Analysis, not available yet" rather than an unexplained dead control.
          DESIGN.md warns that a permanently disabled control teaches people to keep
          trying it; naming the reason is the cheapest honest answer to that.

          ── Where the AI marking went ────────────────────────────────────────
          The band this replaced carried the violet stripe and glyph that marked the
          section as machine-authored, and the tab is deliberately text only — no
          glyph, unlike `HomePage`'s synopsis tab.

          The AI Surface convention is still satisfied, by the three devices it names
          other than the stripe. The tab's own label says "AI Synopsis", which is the
          provenance stated in words. The `RcaBadge` in the header above carries the
          violet node glyph beside "Analysis drafted". And the italic verification
          disclaimer closes the panel. Three statements of authorship, none of them a
          decoration on a tab — which also keeps the tab row reading as navigation
          rather than as one labelled control and two dim ones.

          Actions sit at the right end of the same row rather than in a second bar:
          they act on what the tab is showing, and a toolbar of its own would put a
          horizontal rule between a tab and its own content. */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5 border-b border-hairline">
        <div role="tablist" aria-label={t("anomalies.detail.tabs.label")} className="flex gap-1">
          {RCA_TABS.map((id) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setTab(id)}
                className={cn(
                  "-mb-px border-b-2 px-4.5 py-2.5 text-control transition-colors",
                  selected
                    ? "border-b-forge font-bold text-ink"
                    : "border-b-transparent font-medium text-ink-dim hover:text-ink",
                  "max-lg:min-h-11",
                )}
              >
                {t(`anomalies.detail.tabs.${id}`)}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Two lines, state above provenance.
            ==================================
            These sat on one line and the approved state was the case that showed
            why that was wrong: a violet sentence and a grey timestamp abutting each
            other read as one run-on string, with nothing to say which was the
            claim and which was the metadata. Stacked, the top line is what this
            analysis IS — a locked statement, or the controls that can change it —
            and the line under it is when it last moved. End-aligned so both ragged
            edges settle against the panel's own edge rather than against each
            other. */}
        <div className={cn("flex flex-col items-end gap-1 pb-2", tab !== "synopsis" && "hidden")}>
          {editing ? (
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <ForgeButton disabled={update.isPending} onClick={() => setEditing(false)}>
                {t("common:actions.cancel")}
              </ForgeButton>
              <ForgeButton variant="primary" disabled={update.isPending} onClick={save}>
                {update.isPending ? t("anomalies.detail.saving") : t("anomalies.detail.save")}
              </ForgeButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              {/* Edit survives approval. An approved analysis is still editable —
                  a reviewer who signs one off and then spots a wrong bearing
                  number should fix it in place rather than being locked out of the
                  record. What approval marks is that a person has read it, not that
                  the text is frozen. */}
              <ForgeButton onClick={startEditing}>
                <Icon name="pencil" size="sm" />
                {t("anomalies.detail.edit")}
              </ForgeButton>
              {/* Approve is the one control that does go: it is the end of the
                  lifecycle the backend models, and a button whose only effect is to
                  re-send the state it already shows is noise. */}
              {approved ? null : (
                <ForgeButton
                  variant="primary"
                  disabled={update.isPending}
                  onClick={() => {
                    update.reset();
                    setConfirmingApproval(true);
                  }}
                >
                  <Icon name="check" size="sm" />
                  {update.isPending ? t("anomalies.detail.approving") : t("anomalies.detail.approve")}
                </ForgeButton>
              )}
            </div>
          )}

          <Num className="text-body-sm text-ink-dim">
            {t("anomalies.detail.rcaUpdated", {
              when: rca.updatedAt ? formatDateTime(rca.updatedAt, IST_STAMP) : "—",
            })}
          </Num>
        </div>
      </div>

      {update.isError ? (
        <p className="m-0 flex items-start gap-1.5 text-body-sm text-on-red">
          <Icon name="bolt" size="xs" className="mt-0.5 shrink-0" />
          <span>{t("anomalies.detail.saveFailed")}</span>
        </p>
      ) : null}

      {/* The half-completed approval, named. The analysis IS approved — that write
          succeeded — and only the anomaly's own status did not move, so this says
          exactly that rather than reporting a failure the reader can see is not
          total. Approving again retries the pair. */}
      {acknowledge.isError ? (
        <p className="m-0 flex items-start gap-1.5 text-body-sm text-on-amber">
          <Icon name="bolt" size="xs" className="mt-0.5 shrink-0" />
          <span>{t("anomalies.detail.ackFailed")}</span>
        </p>
      ) : null}

      {tab === "synopsis" ? (
        <>
        {/* Argument on the left, figures on the right. The rail is a fixed 20rem
            because its content is short labelled values that must not stretch; the
            main column takes the remainder and `minmax(0,1fr)` is what stops a long
            unbroken citation from widening the grid past the viewport. Below xl the
            rail moves under the argument rather than beside it — at that width a
            320px column leaves the prose too narrow to read. */}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-4">
            {editing ? <RcaEditor draft={draft} onChange={setDraft} /> : <RcaReport content={rca.content} />}
          </div>

          {/* Sticky from `xl` up, where it is a column beside the argument rather
              than a block under it.

              The analysis runs to several screens and these two cards are short, so
              in normal flow they scrolled away and left a tall empty column next to
              the causes — which is most of what read as dead space. They are the
              window the analysis is about and the provenance of it: exactly the two
              facts worth having in view while reading the rest.

              `self-start`, because a sticky box cannot also stretch to the row's
              height. `top-0` is the top of the scrollport; the top bar is outside
              it. */}
          <aside className="flex flex-col gap-4 xl:sticky xl:top-0 xl:self-start">
            <WindowCard anomaly={anomaly} />
            <ProvenanceCard anomaly={anomaly} rca={rca} />
          </aside>
        </div>

        <p className="m-0 text-body-sm text-ink-mute italic">{t("anomalies.detail.rcaDisclaimer")}</p>
        </>
      ) : null}

      {tab === "analysis" ? <AnalysisTab anomaly={anomaly} /> : null}
      {tab === "action" ? <ActionTab /> : null}
      {tab === "workboard" ? <WorkboardTab anomaly={anomaly} /> : null}

      <ApproveDialog
        open={confirmingApproval}
        pending={update.isPending}
        error={update.error}
        onClose={() => setConfirmingApproval(false)}
        onConfirm={approve}
      />
    </section>
  );
}

/**
 * The confirmation in front of approval.
 *
 * ── Why this one action gets a dialog when almost nothing else does ───────
 * DESIGN.md's position is that a modal for a task needing neither interruption nor
 * protected focus is a smell, and this screen otherwise obeys that — the editor is
 * inline, the status control is a menu, saving is a button. Approval is the
 * exception because it is the one action that puts a person's name behind a
 * machine-written document. Everything else here is reversible in a click;
 * approval is a judgement, and a moment's pause is the point.
 *
 * ── What it says ─────────────────────────────────────────────────────────
 * What approval MEANS, not what it forbids. An earlier draft of this dialog said
 * the analysis could not be edited afterwards, and that was removed with the lock
 * it described: an approved analysis is still editable, so the sentence would have
 * been a promise the screen does not keep — the worst kind of confirmation copy.
 * What is left is the claim somebody is actually making by pressing it.
 *
 * It also states the side effect, because there is one now: approving moves the
 * anomaly itself to Acknowledged. A confirmation that hides the second thing the
 * button does is worse than no confirmation.
 *
 * ── Failure stays in the dialog ──────────────────────────────────────────
 * A failed approval closes nothing. The panel behind has its own error line, but it
 * would be reporting on a dialog that had already vanished — so the write's error
 * is rendered here, in front of the button that caused it, and the dialog only
 * closes on success or on Cancel.
 */
function ApproveDialog({ open, pending, error, onClose, onConfirm }) {
  const { t } = useTranslation(["app", "common"]);

  return (
    <TransitionDialog
      open={open}
      pending={pending}
      error={error}
      errorText={t("anomalies.detail.approveFailed")}
      title={t("anomalies.detail.approveTitle")}
      /**
       * Two facts, and the second one is the reason this dialog asks for a reason
       * at all: approving does not only sign off the analysis, it moves the anomaly
       * to Acknowledged. `statusLabel` names that state rather than the word being
       * written out here, for the same reason the dismiss body does — this and the
       * badge that appears afterwards must not be able to disagree.
       */
      body={
        <Trans
          i18nKey="anomalies.detail.approveBody"
          t={t}
          values={{ status: statusLabel(t, "acknowledged") }}
          components={{ status: <strong className="font-semibold text-ink" /> }}
        />
      }
      reasons={APPROVE_REASONS}
      reasonKey="approveReasons"
      confirmLabel={t("anomalies.detail.approveConfirm")}
      pendingLabel={t("anomalies.detail.approving")}
      confirmVariant="primary"
      confirmIcon="check"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

/**
 * `content` → editable state, in this app's own naming.
 *
 * Arrays and their rows are cloned, not referenced. The editor replaces rows
 * immutably, but a shallow copy would still hand it the same objects the query
 * cache holds — so Cancel would have nothing to fall back to.
 */
function toDraft(content) {
  return {
    whatHappened: content?.what_happened ?? "",
    faultDomain: content?.fault_domain ?? "",
    /* Two levels deep now: a cause owns two evidence arrays, and cloning only the
       cause would hand the editor the cache's own arrays to splice. */
    rankedCauses: (content?.ranked_causes ?? []).map((entry) => ({
      ...entry,
      supporting_evidence: [...(entry.supporting_evidence ?? [])],
      against_evidence: [...(entry.against_evidence ?? [])],
    })),
  };
}

/**
 * The module's three tabs, of which one is built.
 *
 * `Analysis` would hold the per-sensor traces and the cross-sensor correlation, and
 * `Action` the corrective plan and the work order. Both are listed rather than
 * hidden because they are real parts of the design, and a reader who can see the
 * shape of the module stops wondering whether they have missed something. Neither
 * has an endpoint behind it: there is no timeseries route and nothing returns a
 * plan, so they stay disabled until there is something true to put in them.
 */
const RCA_TABS = ["synopsis", "analysis", "action", "workboard"];

/* ══ CARDS ═════════════════════════════════════════════════════════════ */

/**
 * One card of the report.
 *
 * The eyebrow is the card's whole chrome — no title bar, no icon, no border under
 * the heading. DESIGN.md opens every card with a 10px/700 uppercase label in Ink
 * Muted and this is that, unchanged, which is why three of these stacked read as one
 * document rather than as three widgets.
 *
 * `count` is offered because most of these sections are lists, and a reader deciding
 * whether to expand their attention wants the length before the content. It is a
 * plain figure rather than a badge: a count is not a state.
 *
 * `aside` is the end of the same baseline row — one short fact that belongs to the
 * card rather than sitting inside it. Only the description card uses it, for the
 * fault domain. It wraps to its own line rather than compressing the eyebrow,
 * because the eyebrow is the one thing on the card that must stay readable.
 *
 * `tone` colours the card's leading edge and its eyebrow together, so a section's
 * hue is stated twice — on the 3px edge that makes the column scannable from the
 * side, and on the heading that names what the hue means. One prop rather than two,
 * because a card whose stripe and heading disagreed would be a bug nobody could see.
 */
function RcaCard({ eyebrow, tone = null, count, aside, children, className }) {
  return (
    <Panel stripe={tone} className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Eyebrow as="h3" className={cn("m-0", tone && ON_TINT_CLASS[tone])}>
          {eyebrow}
        </Eyebrow>
        {count != null ? <Num className="text-micro font-normal text-ink-mute">{formatInteger(count)}</Num> : null}
        {aside ? <span className="ms-auto">{aside}</span> : null}
      </div>
      {children}
    </Panel>
  );
}

/**
 * A labelled value in the rail — the design's Scheduling card, structurally.
 *
 * A real `<dl>` row rather than two divs in a flex: these are term/definition pairs,
 * a screen reader announces them as such, and it is free.
 */
function RailRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-body-sm text-ink-dim">{label}</dt>
      <dd className="m-0 text-end text-body-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

/* ══ RAIL ══════════════════════════════════════════════════════════════ */

/*
 * ── The confidence card is gone, and nothing replaces it ──────────────────
 * It rendered `content.confidence` as a violet figure over a 0–1 bar, at the top of
 * this rail. The generator no longer emits the field, and a card that draws itself
 * only when a key happens to be present is a rail that changes height for reasons the
 * reader cannot see — so it is deleted rather than left to fail quietly.
 *
 * Deliberately not substituted. The obvious replacement is to derive a confidence
 * from the leading cause's likelihood, and that would be this screen inventing a
 * figure the model did not state. What the analysis now offers in its place is
 * better and it is in the argument column: the evidence for and against each cause,
 * and the gaps it could not fill.
 */

/**
 * The window the conclusion stands on.
 *
 * Four fields the API has always returned and this screen never showed. They are
 * the first thing to check against a diagnosis: a fault localised from five minutes
 * of signal is a different claim from one localised from three days, and until now
 * the screen gave the reader no way to tell which they were reading.
 *
 * The duration is derived rather than asked for, because the pair implies it and
 * "23:55 → 00:00" makes somebody do the subtraction themselves — across midnight,
 * in this very payload.
 */
function WindowCard({ anomaly }) {
  const { t } = useTranslation(["app", "common"]);

  if (!anomaly.windowStart && !anomaly.windowEnd && !anomaly.lastDetectedAt) return null;

  const span = anomaly.windowStart && anomaly.windowEnd ? (new Date(anomaly.windowEnd) - new Date(anomaly.windowStart)) / 3_600_000 : null;

  return (
    <RcaCard eyebrow={t("anomalies.detail.window")}>
      <dl className="m-0 flex flex-col gap-2">
        <RailRow label={t("anomalies.detail.windowStart")}>
          <Stamp value={anomaly.windowStart} />
        </RailRow>
        <RailRow label={t("anomalies.detail.windowEnd")}>
          <Stamp value={anomaly.windowEnd} />
        </RailRow>
        {span != null ? (
          <RailRow label={t("anomalies.detail.windowSpan")}>
            <Num>{formatHours(span)}</Num>
          </RailRow>
        ) : null}
        <RailRow label={t("anomalies.detail.lastDetected")}>
          <Stamp value={anomaly.lastDetectedAt} />
        </RailRow>
      </dl>
    </RcaCard>
  );
}

/** When the analysis was asked for and last touched. */
function ProvenanceCard({ anomaly, rca }) {
  const { t } = useTranslation(["app", "common"]);

  return (
    <RcaCard eyebrow={t("anomalies.detail.provenance")}>
      <dl className="m-0 flex flex-col gap-2">
        <RailRow label={t("anomalies.detail.requested")}>
          <Stamp value={rca.createdAt} />
        </RailRow>
        <RailRow label={t("anomalies.detail.generated")}>
          <Stamp value={rca.updatedAt} />
        </RailRow>
        {/* The ANOMALY's timestamp, not the analysis's — the two rows above are
            both about the RCA, and "Record updated" did not say which record it
            meant in a card where two of them have one. */}
        <RailRow label={t("anomalies.detail.anomalyUpdated")}>
          <Stamp value={anomaly.updatedAt} />
        </RailRow>
      </dl>
    </RcaCard>
  );
}

/**
 * The zone this screen's absolute timestamps are read in.
 *
 * Four stamps are pinned to India Standard Time on a 12-hour clock, by request:
 * Detection Window and Analysis Record in the rail, the anomaly's own Detected
 * stamp in the header, and the "Updated {when}" line beside the tabs. Every
 * relative time on the screen still follows the org's configured zone through
 * `formatDateTime`'s default, and this constant is deliberately not exported so
 * it cannot spread further.
 */
const RAIL_TIME_ZONE = "Asia/Kolkata";

/**
 * The four pinned stamps share one options object so they cannot drift apart.
 *
 * `hour12` is passed explicitly rather than left to the locale, because
 * `formatDateTime` merges the org's own `hour12` in first and an org set to
 * 24-hour would otherwise win here.
 */
const IST_STAMP = {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: RAIL_TIME_ZONE,
  hour12: true,
};

/**
 * A timestamp in the rail. Tabular so a column of them aligns on the digits, which
 * is the only reason a column of dates is scannable at all.
 *
 * The zone is IST on a 12-hour clock, and neither is printed beside the value — by
 * request. The header's Detected stamp and the "Updated {when}" line now read the
 * same way, so the absolute times on this screen agree with each other; relative
 * times elsewhere on it still follow the org's zone.
 */
function Stamp({ value }) {
  if (!value) return <span className="text-ink-mute">—</span>;
  return <Num>{formatDateTime(value, IST_STAMP)}</Num>;
}

/* ══ READ ══════════════════════════════════════════════════════════════ */

/**
 * The analysis, read.
 *
 * ── Two cards, in the order the argument is made ──────────────────────────
 * What happened → what probably caused it. That is the shape of a diagnosis, and it
 * is read top to bottom.
 *
 * The Ruled Out and Data Gaps cards were removed by request. Worth recording what
 * went with them: they were the analysis showing its work and stating the limits of
 * its own evidence, which is the objection a reliability engineer raises first. The
 * keys still exist on the stored payload and the editor's spread preserves them, so
 * nothing is destroyed — they are simply no longer rendered or editable here.
 *
 * ── Colour: the anomaly list's discipline, applied here ───────────────────
 * This panel has been through both failure modes. It shipped grey and read as
 * low-effort; it was then coloured with tinted wells per section and read as too
 * much. `AnomalyCard` is the reference that settles it, and its rule is exact:
 *
 *   **Hue appears on a 3px leading edge and inside small badges. Never as a
 *   tinted region behind content.**
 *
 * A list row is a white card with a hairline, a coloured edge, three small pills and
 * a serial in accent ink — everything else is plain ink on plain card. That is why a
 * screen of fifty of them is calm and still scannable, and it is the whole answer
 * here too. So the hues stay, and they stay on edges, glyphs, 10px eyebrows and
 * pills; the tinted fills are gone.
 *
 * What each edge means, all four of them already in the system:
 *
 *   Violet   Description — Reasoning Violet is AI authorship, and this narrative is
 *            the machine's own account of the event. DESIGN.md asks for a violet
 *            leading edge on any surface the AI authored; this panel had none.
 *   Severity Each cause — its edge is its likelihood, on the same ramp the list reads
 *            severity from, and low earns no edge for the same reason it earns none
 *            there. That is what makes the ranking visible from the side of the page.
 *   Blue     Ruled out — Dismissed Blue means "a judgement was made that this is not
 *            worth acting on", which is precisely what a ruled-out cause is.
 *   Amber    Data gaps — the watch hue, on the one card that qualifies every
 *            conclusion above it.
 *
 * The Root Cause Analysis card itself stays unstriped on purpose: its rows carry
 * their own edges, and a fifth on the container around them would be a frame
 * competing with its own contents.
 */
function RcaReport({ content }) {
  const { t } = useTranslation(["app", "common"]);

  const causes = content.ranked_causes ?? [];

  return (
    <>
      {/* Fault domain rides on the description's eyebrow line rather than taking a
          card or a rail row of its own. It is one word that classifies the event the
          card underneath narrates, so it belongs with it — and a whole card for one
          word would read as a metric tile. */}
      <RcaCard eyebrow={t("anomalies.detail.description")} tone="violet" aside={<FaultDomain value={content.fault_domain} />}>
        {content.what_happened ? (
          /**
           * One flow, at the full width of the card.
           *
           * DESIGN.md caps narrative prose at 70–80ch, and this deliberately does
           * not: the cap left half of a 1700px card empty, and a two-column
           * version of it was rejected for breaking the description into two
           * blocks to be read in sequence. Requested, recorded here rather than
           * left as an unexplained missing constraint — the measure still holds
           * everywhere else on this screen, including the ruled-out reasons and
           * the data gaps below.
           *
           * What that costs: lines run to roughly twice the length at which the
           * eye reliably finds the start of the next one. The page cap keeps it
           * bounded at all.
           */
          <Narrative text={content.what_happened} />
        ) : (
          <Absent />
        )}
      </RcaCard>

      <RcaCard eyebrow={t("anomalies.detail.rootCauses")} count={causes.length || null}>
        {causes.length ? (
          /* An ordered list, because the ranking IS the content — `ranked_causes`
             means the first is the leading hypothesis, and bullets would throw that
             away. */
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {causes.map((cause, index) => (
              <CauseRow key={index} cause={cause} rank={index + 1} />
            ))}
          </ol>
        ) : (
          <Absent />
        )}
      </RcaCard>

    </>
  );
}

/**
 * The description, with each line's lead-in emboldened.
 *
 * The generator writes this as one newline-separated block of "Label — sentence"
 * lines: Window, Breach, Peak departure, Baseline band, Beyond threshold, Recovery,
 * and whatever else it decides to emit. Flat, they read as an undifferentiated wall
 * and the reader has to find the em dash on every line to work out what each one is
 * about.
 *
 * So the lead-in is bolded — by SHAPE, not by a list of known labels. The set is
 * open: the generator is still being built and a hardcoded list would silently stop
 * bolding the day it adds a seventh line. The rule is "short run of text before an
 * em dash, at the start of a line", which is the actual convention the payload
 * follows.
 *
 * The guard is the length cap. Without it, a prose sentence that happens to contain
 * an em dash would get its first clause bolded, which is worse than not bolding at
 * all — so anything past a plausible label length is left alone. The text is
 * rendered as text either way; nothing here interprets it as markup.
 */
function Narrative({ text }) {
  return (
    <p className="m-0 text-body whitespace-pre-line">
      {String(text)
        .split("\n")
        .map((line, index, all) => {
          const split = line.indexOf(" — ");
          const isLabel = split > 0 && split <= 28;
          return (
            <Fragment key={index}>
              {isLabel ? (
                <>
                  <strong className="font-semibold text-ink">{line.slice(0, split)}</strong>
                  {line.slice(split)}
                </>
              ) : (
                line
              )}
              {index < all.length - 1 ? "\n" : null}
            </Fragment>
          );
        })}
    </p>
  );
}

/**
 * The fault domain, verbatim.
 *
 * No label map, and one hue for every value. The vocabulary is not declared anywhere
 * — `process` is the only value anybody has seen — so translating it would mean
 * inventing a set the generator has not agreed to, and toning it PER VALUE would mean
 * inventing a ladder on top of that: a red `mechanical` beside an amber `process`
 * would be this screen ranking domains nobody has ranked.
 *
 * Violet instead, for every value alike, which says the true thing — this
 * classification is the model's, not the plant's. That is Reasoning Violet's one
 * meaning, and the pill is `AiBadge`'s own device: a violet hairline outline and
 * violet ink, no fill. Outline rather than tint on purpose — it sits on the eyebrow
 * line of the panel's first card, where a filled chip is the first thing the eye
 * lands on and it should not be.
 */
function FaultDomain({ value }) {
  const { t } = useTranslation(["app", "common"]);
  if (!value) return null;

  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-body-sm text-ink-dim">{t("anomalies.detail.faultDomain")}</span>
      <span className="inline-flex items-center rounded-pill border border-violet/40 px-2.5 py-[3px] text-micro text-on-violet">{value}</span>
    </span>
  );
}

/**
 * One ranked cause: the claim, what supports it, what argues against it, and how to
 * settle the question.
 *
 * ── The rank is a numbered disc, and the leading one is marked ────────────
 * The design numbers its action steps in outlined circles; the same device is right
 * here for a stronger reason — these are ranked, not merely sequential, so the
 * number carries meaning rather than order of operations. It comes from the list
 * position, so it cannot disagree with the order it is numbering.
 *
 * Rank 1 takes the accent and a "leading" label. `ranked_causes` puts the model's
 * best hypothesis first and nothing else on screen says so; a reader skimming three
 * equally-weighted rows has to infer it from position, which is exactly the kind of
 * thing that gets inferred wrong at 2am on a night shift.
 *
 * ── The likelihood is the row's leading edge, not just a pill ─────────────
 * The 3px edge is this system's primary emphasis device, and a ranked cause is
 * exactly what it is for: red, amber and watch down the side of the list make the
 * ranking readable from the edge of the page, before any of the words are. The pill
 * stays as well — the edge is a hue and the pill is the word, and colour-blind mode
 * and print both need the word.
 *
 * ── The badge is pinned to the claim it qualifies ─────────────────────────
 * It used to take `flex-1` on the cause text and sit at the far end of the row, which
 * on a wide viewport left it floating in the middle of empty space with nothing to
 * align to — it read as a stray chip rather than as a property of the sentence beside
 * it. It now follows the text directly and sits on the text's own baseline.
 *
 * ── For and against, stacked ──────────────────────────────────────────────
 * Two columns was the first arrangement and it lost to the payload: the model emits
 * lopsided pairs — seven supports against one counter — so one column wrapped every
 * sentence to three lines while the other sat empty. See the layout note below.
 *
 * Green supports, amber counters — on the arrow and the 10px heading, not on a fill
 * behind the sentences. The tinted-well version of this was the single loudest thing
 * on the panel: two saturated blocks inside a third block, inside a card. On the
 * glyph the hue does the same job at a fraction of the volume, which is exactly the
 * trade `AnomalyCard` makes with its dotted severity pill.
 *
 * ── Body text, not monospace ──────────────────────────────────────────────
 * These read "bearing_temp_C rose 23.4°C in 6 minutes while load_pct stayed flat at
 * 62%" — sentences that happen to contain tag names. The retired `evidence_citations`
 * were bare machine strings and were set in mono for it; setting a sentence in mono
 * because it mentions a tag is monospace as a costume, which DESIGN.md refuses.
 */
function CauseRow({ cause, rank }) {
  const { t } = useTranslation(["app", "common"]);
  const leading = rank === 1;
  const tone = LIKELIHOOD_TONE[cause.likelihood] ?? null;

  const supporting = cause.supporting_evidence ?? [];
  const against = cause.against_evidence ?? [];
  const hasEvidence = supporting.length > 0 || against.length > 0;

  return (
    <li className={cn("flex gap-3 rounded-sm border border-subtle bg-sunken p-3.5", tone && STRIPE_CLASS[tone])}>
      {/* Neutral, with the accent reserved for rank 1 — the same single-accent
          restraint the list shows by giving one string (the serial) accent ink and
          leaving the rest plain. A disc tinted by likelihood was tried and it made
          every row carry a filled coloured circle, which is a status light on a
          record that has no status. The likelihood is on the edge and in the pill;
          the disc's job is the rank. */}
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-micro",
          leading ? "border-forge/40 tint-forge text-on-forge" : "border-hairline text-ink-dim",
        )}
      >
        <Num>{rank}</Num>
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <p className="m-0 max-w-[68ch] text-body font-medium">{cause.cause}</p>
          <LikelihoodBadge value={cause.likelihood} />
          {leading ? (
            <Eyebrow as="span" className="text-on-forge">
              {t("anomalies.detail.leadingCause")}
            </Eyebrow>
          ) : null}
        </div>

        {hasEvidence ? (
          /**
           * Stacked at full width, not side by side.
           *
           * They were two equal columns, on the reasoning that weighing one list
           * against the other is the whole operation and stacking makes the reader
           * hold the first in their head while reading the second. That reasoning
           * assumed two lists of comparable length. In practice the model emits
           * seven supports against one counter, or two against four — so one column
           * crammed every sentence into three wrapped lines while the other sat
           * empty, and the pair read as a fault in the layout.
           *
           * Full width gives each sentence one line or two instead of three, which
           * is the whole of the clutter. The cards are taller and there is less on
           * screen at once, which is the trade being made deliberately: this is a
           * document somebody reads at 2am, not a dashboard they scan.
           *
           * The hairline above still separates a claim from its support — the one
           * thing that must not be left to spacing alone.
           */
          <div className="flex flex-col gap-4 border-t border-subtle pt-3">
            {supporting.length ? (
              <EvidenceList heading={t("anomalies.detail.supports")} items={supporting} glyph="up" tone="green" />
            ) : null}
            {against.length ? (
              <EvidenceList heading={t("anomalies.detail.against")} items={against} glyph="down" tone="amber" />
            ) : null}
          </div>
        ) : null}

        {/* The verification step, set apart because it is the only line in the whole
            analysis that asks somebody to do something. Everything above it is a
            claim; this is the test that settles it — so it gets its own surface, the
            glyph and the label. The surface is the plain card tone lifted off the
            sunken row, not a tint: one step of elevation says "separate" without
            adding a fifth hue to a row that already carries an edge and a pill. */}
        {cause.verification ? (
          <div className="flex gap-2.5 rounded-sm border border-hairline bg-card px-3 py-2.5">
            <Icon name="eye" size="xs" className="mt-0.5 shrink-0 text-ink-mute" />
            <p className="m-0 min-w-0 max-w-[72ch] text-body-sm">
              <Eyebrow as="span" className="me-2">
                {t("anomalies.detail.verification")}
              </Eyebrow>
              <span className="text-ink-dim">{cause.verification}</span>
            </p>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * One side of the argument for a cause.
 *
 * The arrows are a matched pair from the icon set and they say what the list does to
 * the likelihood — raises it, lowers it — which is more precise than a tick and a
 * cross would be. Counter-evidence is not wrong; it is evidence that points the other
 * way, and a cross would tell the reader to discount it.
 *
 * The hue is on the 10px heading and the arrow and nowhere else — no fill behind the
 * sentences. Two coloured marks per column against plain ink is enough to tell the
 * columns apart at a glance, and it leaves the sentences themselves reading as text
 * rather than as content inside a status block.
 */
function EvidenceList({ heading, items, glyph, tone }) {
  return (
    <div className="min-w-0">
      {/* The arrow moved from every item to the heading. It says what the list does
          to the likelihood — raises it, lowers it — and that is a property of the
          LIST, so seven copies of it down the side of seven sentences was the same
          statement made seven times. Once, beside the word it qualifies. */}
      <Eyebrow as="h4" className={cn("m-0 flex items-center gap-1.5", ON_TINT_CLASS[tone])}>
        <Icon name={glyph} size="xs" aria-hidden="true" className="shrink-0" />
        {heading}
      </Eyebrow>
      {/* A hairline down the inside edge in place of the per-item glyphs: it groups
          the list and marks where it ends without adding a mark per line, and it is
          structural at 1px so it carries no second claim. Logical inline-start, so
          it mirrors under `dir="rtl"`. */}
      <ul className="m-0 mt-2 flex list-none flex-col gap-2.5 border-s border-subtle p-0 ps-3.5">
        {items.map((item, index) => (
          <li key={index} className="text-body-sm leading-relaxed text-ink-dim">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A field the model did not fill. Stated, not left blank. */
function Absent() {
  const { t } = useTranslation(["app", "common"]);
  return <p className="m-0 text-body-sm text-ink-mute">{t("anomalies.detail.fieldAbsent")}</p>;
}

/**
 * How likely a cause is, on the three-step ladder the model emits.
 *
 * Toned off the severity ramp rather than given hues of its own — high is the one to
 * act on, low is a note — because likelihood and severity are the same kind of
 * judgement, and separate palettes would make one card teach two ladders.
 *
 * A value outside the ladder still renders, neutral and verbatim. Nothing
 * server-side constrains this field, so an unrecognised one is data, not an error.
 */
function LikelihoodBadge({ value }) {
  const { t } = useTranslation(["app", "common"]);
  if (!value) return null;

  const tone = LIKELIHOOD_TONE[value] ?? null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-pill px-2.5 py-[3px] text-micro",
        tone ? cn(TINT_CLASS[tone], ON_TINT_CLASS[tone]) : "bg-card text-ink-dim",
      )}
    >
      {t(`anomalies.detail.likelihood.${value}`, { defaultValue: value })}
    </span>
  );
}

/**
 * ── `low` takes no hue, exactly as low severity takes none in the list ────
 * It was briefly given Watch, to stop the ladder reading as two steps and an absence.
 * That is the wrong reading: in `AnomalyCard` a low-severity row is deliberately the
 * one with no edge and a neutral pill, and the absence IS the signal — it is what
 * lets the eye find the rows that matter without reading a word. A low-likelihood
 * cause is the same kind of thing, and giving it a colour is what turns a stack of
 * causes into a stack of coloured rows.
 */
const LIKELIHOOD_TONE = { high: "red", medium: "amber", low: null };

/* ══ EDIT ══════════════════════════════════════════════════════════════ */

/**
 * The same cards, editable — every field the report renders.
 *
 * Every card keeps its position, eyebrow and order when the panel flips — the prose
 * just becomes a textarea in place. A separate edit screen would mean checking a
 * change against a remembered version of the original rather than against the
 * original, which is how a review step stops being one.
 *
 * ── Two cards the report hides, and this one always shows ─────────────────
 * ── Lists are add and remove, not reorderable ─────────────────────────────
 * Ranking is the content, so reordering is a real operation somebody will eventually
 * want — but drag-and-drop is a keyboard-accessibility problem of its own, and
 * move-up/move-down on every row is a lot of chrome for a two-item list. Left out
 * deliberately; the order the model produced survives every edit.
 */
function RcaEditor({ draft, onChange }) {
  const { t } = useTranslation(["app", "common"]);

  const set = (patch) => onChange({ ...draft, ...patch });

  const setCause = (index, patch) =>
    set({
      rankedCauses: draft.rankedCauses.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)),
    });


  return (
    <>
      {/* Same tones as the report, card for card. The editor is the same document
          with its prose swapped for fields, so a flip to Edit that drained every hue
          out of the column would read as landing on a different screen — and the
          reviewer would lose the section colours they had just learnt to navigate
          by. */}
      <RcaCard eyebrow={t("anomalies.detail.description")} tone="violet">
        {/* The card's eyebrow is the label, so the field's own is bound and hidden
            rather than printed twice. */}
        <TextArea
          id="rca-what-happened"
          label={t("anomalies.detail.description")}
          labelHidden
          rows={4}
          value={draft.whatHappened}
          onChange={(event) => set({ whatHappened: event.target.value })}
          className="max-w-[72ch]"
        />

        {/* A free-text field, not a select. The report renders this value verbatim
            because nothing declares the vocabulary; offering a fixed list here would
            invent one, and worse, would quietly rewrite a value the generator emitted
            into the nearest option somebody happened to pick. */}
        <Field
          id="rca-fault-domain"
          label={t("anomalies.detail.faultDomain")}
          hint={t("anomalies.detail.faultDomainHint")}
          value={draft.faultDomain}
          onChange={(event) => set({ faultDomain: event.target.value })}
          className="max-w-[20rem]"
        />
      </RcaCard>

      <RcaCard eyebrow={t("anomalies.detail.rootCauses")} count={draft.rankedCauses.length || null}>
        <div className="flex flex-col gap-3">
          {draft.rankedCauses.map((cause, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-sm border border-subtle bg-sunken p-3.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-micro",
                    index === 0 ? "border-forge/40 tint-forge text-on-forge" : "border-hairline text-ink-dim",
                  )}
                >
                  <Num>{index + 1}</Num>
                </span>
                <div className="flex-1" />
                <IconButton
                  bare
                  label={t("anomalies.detail.removeCause", { position: index + 1 })}
                  onClick={() =>
                    set({
                      rankedCauses: draft.rankedCauses.filter((_, position) => position !== index),
                    })
                  }
                  className="size-8"
                >
                  <Icon name="trash" size="sm" />
                </IconButton>
              </div>

              <TextArea
                id={`rca-cause-${index}`}
                label={t("anomalies.detail.cause")}
                rows={2}
                value={cause.cause ?? ""}
                onChange={(event) => setCause(index, { cause: event.target.value })}
              />

              <LikelihoodField index={index} value={cause.likelihood} onChange={(likelihood) => setCause(index, { likelihood })} />

              {/* The two evidence lists stay stacked in the editor even though the
                  report sets them side by side. Reading is comparison and wants the
                  columns; typing is one field at a time, and a 50%-width textarea
                  inside an already-inset card is a worse place to write a sentence
                  than a full-width one. */}
              <StringList
                idPrefix={`rca-support-${index}`}
                legend={t("anomalies.detail.supports")}
                itemLabel={(position) => t("anomalies.detail.supportItem", { position })}
                removeLabel={(position) => t("anomalies.detail.removeSupport", { position })}
                addLabel={t("anomalies.detail.addSupport")}
                items={cause.supporting_evidence ?? []}
                onChange={(supporting_evidence) => setCause(index, { supporting_evidence })}
              />

              <StringList
                idPrefix={`rca-against-${index}`}
                legend={t("anomalies.detail.against")}
                itemLabel={(position) => t("anomalies.detail.againstItem", { position })}
                removeLabel={(position) => t("anomalies.detail.removeAgainst", { position })}
                addLabel={t("anomalies.detail.addAgainst")}
                items={cause.against_evidence ?? []}
                onChange={(against_evidence) => setCause(index, { against_evidence })}
              />

              <TextArea
                id={`rca-verification-${index}`}
                label={t("anomalies.detail.verification")}
                hint={t("anomalies.detail.verificationHint")}
                rows={2}
                value={cause.verification ?? ""}
                onChange={(event) => setCause(index, { verification: event.target.value })}
              />
            </div>
          ))}

          <ForgeButton
            className="self-start"
            onClick={() =>
              set({
                rankedCauses: [
                  ...draft.rankedCauses,
                  {
                    cause: "",
                    likelihood: "medium",
                    verification: "",
                    supporting_evidence: [],
                    against_evidence: [],
                  },
                ],
              })
            }
          >
            <Icon name="plus" size="sm" />
            {t("anomalies.detail.addCause")}
          </ForgeButton>
        </div>
      </RcaCard>

    </>
  );
}

/**
 * An editable list of sentences — the shape three of the new fields share.
 *
 * ── One component, because three hand-rolled ones would drift ─────────────
 * `supporting_evidence`, `against_evidence` and `data_gaps` are all `string[]` and
 * all want the same thing: a labelled row per entry, a remove control on each, and one
 * Add at the end. Written out three times, the third would quietly lose the
 * `labelHidden` binding or the position in a remove label, which is the class of bug
 * nothing catches because the screen still looks right.
 *
 * ── Every row is labelled, and no label is visible ────────────────────────
 * A column of identical unlabelled inputs is unusable with a screen reader — "edit
 * text, edit text, edit text". Each carries "Supporting evidence 2", bound and hidden,
 * so the position a sighted reader gets from the layout is available to a reader who
 * gets no layout at all. `legend` is the visible heading for the group; `data_gaps`
 * passes none because its card's eyebrow already is one, and printing it twice is what
 * the report side avoids too.
 *
 * A `Field`, not a `TextArea`: these are single sentences, and a stack of four-row
 * textareas turns one cause into a full screen of scrolling. They wrap and grow the
 * row, so nothing is clipped.
 */
function StringList({ idPrefix, legend, itemLabel, removeLabel, addLabel, items, onChange }) {
  return (
    <div>
      {legend ? (
        <Eyebrow as="h4" className="m-0 mb-2">
          {legend}
        </Eyebrow>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <Field
              id={`${idPrefix}-${index}`}
              label={itemLabel(index + 1)}
              labelHidden
              value={item}
              onChange={(event) => onChange(items.map((entry, position) => (position === index ? event.target.value : entry)))}
              className="flex-1"
            />
            <IconButton
              label={removeLabel(index + 1)}
              onClick={() => onChange(items.filter((_, position) => position !== index))}
              className="shrink-0"
            >
              <Icon name="trash" size="sm" />
            </IconButton>
          </div>
        ))}

        <ForgeButton className="self-start" onClick={() => onChange([...items, ""])}>
          <Icon name="plus" size="sm" />
          {addLabel}
        </ForgeButton>
      </div>
    </div>
  );
}

/**
 * Likelihood, as a select that cannot lose an unrecognised value.
 *
 * Nothing server-side constrains this field — `content` is a bare dict — so the
 * three-step ladder is a statement about what the model emits, not a contract. A
 * payload carrying something else has that value appended to the options and left
 * selected, rather than being silently coerced to "medium" the first time somebody
 * opens the editor and saves.
 */
function LikelihoodField({ index, value, onChange }) {
  const { t } = useTranslation(["app", "common"]);

  const known = LIKELIHOODS.includes(value);
  const options = LIKELIHOODS.map((entry) => ({
    value: entry,
    label: t(`anomalies.detail.likelihood.${entry}`),
  }));

  return (
    <ForgeSelect
      id={`rca-likelihood-${index}`}
      label={t("anomalies.detail.likelihoodLabel")}
      value={value || "medium"}
      onValueChange={onChange}
      options={value && !known ? [...options, { value, label: value }] : options}
      className="max-w-[16rem]"
    />
  );
}
