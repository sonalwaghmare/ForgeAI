/**
 * Lines & Assets — the operational overlay.
 *
 * SYNTHETIC, like everything in this directory. The screens behind it are gated
 * on `VITE_DEMO_MODE`.
 *
 * ── This file does NOT define the plant ───────────────────────────────────
 * `hierarchy.js` already does, and it turns out to model exactly what the design
 * needs: Findlay Line 1 is Cupper → Bodymaker 3 → Trimmer → Washer → Decorator 2
 * → IBO Oven → Necker → Palletizer, which is the prototype's eight-station
 * can-body line in the prototype's order. Line 2 and Compressed Air are there
 * too, with their assets.
 *
 * So the line list, the asset list and the material-flow order are all READ FROM
 * `HIERARCHY_NODES` by the mock handler. What lives here is only the operational
 * facts a hierarchy node does not carry — health, throughput, vendor, run hours,
 * who owns it — keyed by the node id it belongs to.
 *
 * The alternative was a second list of lines and assets beside the first. That
 * is how Settings → Sites & Hierarchy and this screen end up disagreeing about
 * how many assets are on Line 1, which is the kind of contradiction a demo
 * audience finds in about ninety seconds.
 *
 * Alert counts and severities are not here either: they are derived from
 * `alerts.js` in the handler, so a line's anomaly badge and the anomaly list it
 * links to are the same set of records counted twice rather than two numbers
 * that have to be kept in step by hand.
 *
 * ── Units belong to the site ──────────────────────────────────────────────
 * Findlay is inches/sec, °F, psi and gal/min — never converted. The prototype's
 * mm/s and °C would be the wrong instrument reading on this plant's screens.
 *
 * ── Why Line 1 is stopped ─────────────────────────────────────────────────
 * The prototype stops its rich line at the Washer with a frozen coolant flow and
 * starves the four stations downstream. Our universe already contains that fault
 * — `ALR-4470`, frozen signal, coolant flow reading 0 gal/min — but it sits on
 * Compressor C-12, on the utility line that supplies the Washer. So the Washer
 * is BLOCKED rather than faulted, the constraint is one line over, and the AI
 * card says so. Same screen state as the design, no invented alert, and it
 * happens to be a better story: the thing that stopped production is not the
 * thing that broke.
 */

/* The document registry. This file used to carry its own six-document list per
   asset, reusing ids the registry also holds — see `assetDocuments` below. */
import { resolveDocsForAsset, resolveMediaForAsset } from './fusionDocs'

/* ── Deterministic series ─────────────────────────────────────────────────
   Never `Math.random()`, which the prototype uses and which redraws every trace
   on every render. `hold` freezes the tail, which is what a frozen signal looks
   like on a chart and is the whole point of the Washer's card. */
export function series(count, base, amplitude, { freq = 4, seed = 1, drift = 0, spikeAt = null, holdFrom = null, holdAt = 0 } = {}) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1)
    if (holdFrom != null && t >= holdFrom) {
      out.push(Math.round(holdAt * 100) / 100)
      continue
    }
    const jitter = Math.sin((i + 1) * seed * 12.9898) * amplitude * 0.22
    let value = base + amplitude * Math.sin(t * Math.PI * freq) + jitter
    if (drift && t > 0.4) value += (t - 0.4) * amplitude * drift
    if (spikeAt != null && Math.abs(t - spikeAt) < 0.045) value += amplitude * 2.6
    out.push(Math.round(value * 100) / 100)
  }
  return out
}

/* ══ LINES ═══════════════════════════════════════════════════════════════
   Keyed by the hierarchy's line node id. `rich` marks the one line with a
   modelled material flow; the others open a summary, which is the prototype's
   arrangement and is honest about where the depth actually is.

   `state` is `running` | `stopped` | `idle`. Idle is not a fault and never
   takes a fault colour — a line nobody scheduled is not a line that broke. */
export const LINE_OPS = {
  line_fdy_1: {
    rich: true,
    kind: 'canBody',
    building: 'Building A — Can Body',
    floor: 1,
    target: 2200,
    unit: 'cans/min',
    state: 'stopped',
    stoppedAtAssetId: 'FDY-WSH-01',
    stoppedForMinutes: 4,
    topLoss: 'Coolant supply loss · Washer',
    health: 72,
    oee: 71,
    oeeDeltaPts: -8,
    outputToday: 418_000,
    outputPct: 76,
    shift: 'night',
    operatorId: 'usr_ops_1',
    runningSince: '22:00',
  },
  line_fdy_2: {
    kind: 'canBody',
    building: 'Building A — Can Body',
    floor: 1,
    target: 2200,
    unit: 'cans/min',
    state: 'running',
    health: 91,
    oee: 86,
    oeeDeltaPts: 1.2,
    topLoss: 'Layer-gripper wear · Palletizer',
    outputToday: 1_284_000,
    outputPct: 97,
    shift: 'night',
    operatorId: 'usr_ops_1',
    runningSince: '22:00',
  },
  line_fdy_util: {
    kind: 'utility',
    building: 'Mechanical Mezzanine',
    floor: 3,
    target: 400,
    unit: 'scfm',
    state: 'running',
    health: 58,
    oee: 81,
    topLoss: 'Coolant loop fault · Compressor C-12',
    oeeDeltaPts: -2.4,
    outputToday: null,
    outputPct: null,
    shift: 'night',
    operatorId: 'usr_rel_1',
    runningSince: '22:00',
  },
  line_wtm_1: {
    kind: 'ends',
    building: 'Halle 2 — Ends',
    floor: 1,
    target: 1800,
    unit: 'ends/min',
    state: 'running',
    health: 88,
    oee: 84,
    topLoss: 'Changeovers · Shell Press 4',
    oeeDeltaPts: 0.6,
    outputToday: 902_000,
    outputPct: 94,
    shift: 'morning',
    operatorId: 'usr_rel_1',
    runningSince: '06:00',
  },
  line_pnq_1: {
    kind: 'canBody',
    building: 'Block C',
    floor: 1,
    target: 2000,
    unit: 'cans/min',
    state: 'idle',
    health: 95,
    oee: null,
    topLoss: null,
    oeeDeltaPts: null,
    outputToday: null,
    outputPct: null,
    shift: 'morning',
    operatorId: 'usr_ops_1',
    runningSince: null,
  },
}

/* ══ ASSETS ══════════════════════════════════════════════════════════════
   Keyed by the hierarchy's asset code. One record per asset, carrying both what
   the list view needs (type, health, owner, stream state) and what the station
   detail needs (vendor, model, run hours, throughput) — they describe the same
   machine, and splitting them across two fixtures is how the two screens start
   reporting different next-service dates.

   `throughput` is the current rate in the LINE's unit. `blocked` is a station
   that cannot run; `starved` is one with nothing arriving. The distinction
   matters on the flow strip: only one of the eight is actually in trouble. */
const asset = (type, vendor, model, installed, runHours, sensorCount, criticality, ownerId, extra = {}) => ({
  type,
  vendor,
  model,
  installed,
  runHours,
  sensorCount,
  criticality,
  ownerId,
  online: true,
  ...extra,
})

export const ASSET_OPS = {
  /* Line 1 — the modelled can-body line, stopped at the Washer. */
  'FDY-CUP-01': asset('cupper', 'Stolle', 'S-Cup 1200', '2019-06-04', 38_291, 84, 'high', 'usr_ops_1', {
    health: 91, throughput: 2100, oee: 94, nextPMHours: 540, lastSeenMinutes: 1, tags: ['draw'], sensors: ['current','vibration'],
  }),
  'FDY-BM-03': asset('bodymaker', 'Stolle', 'S2C BM-90', '2019-07-12', 41_284, 128, 'critical', 'usr_ops_1', {
    health: 64, throughput: 1980, oee: 88, nextPMHours: 312, lastSeenMinutes: 1, tags: ['rotating', 'spindle'], sensors: ['vibration','temperature','current','vision'],
  }),
  'FDY-TRM-01': asset('trimmer', 'Stolle', 'ST-90', '2019-08-04', 39_102, 62, 'medium', 'usr_rel_1', {
    health: 88, throughput: 2050, oee: 92, nextPMHours: 410, lastSeenMinutes: 2, tags: ['cutting'], sensors: ['vibration','current'],
  }),
  'FDY-WSH-01': asset('washer', 'Stolle', 'WSH-Cleanline', '2018-03-20', 49_102, 96, 'critical', 'usr_rel_1', {
    health: 47, throughput: 0, oee: 0, blocked: true, nextPMHours: 0, lastSeenMinutes: 1, tags: ['coolant'], sensors: ['flow','conductivity','temperature','vision'],
  }),
  'FDY-DEC-02': asset('decorator', 'KBA-Metalprint', 'MetalStar 3', '2020-09-01', 28_910, 144, 'high', 'usr_ops_1', {
    health: 82, throughput: 0, oee: 0, starved: true, nextPMHours: 880, lastSeenMinutes: 1, tags: ['printing'], sensors: ['pressure','current','vision'],
  }),
  'FDY-OVN-01': asset('oven', 'LTG', 'BLOC 3000', '2020-09-12', 28_840, 88, 'medium', 'usr_mgr_1', {
    health: 74, throughput: 0, oee: 0, starved: true, nextPMHours: 900, lastSeenMinutes: 3, tags: ['thermal'], sensors: ['temperature','flow'],
  }),
  'FDY-NCK-01': asset('necker', 'Stolle', 'S-Neck 32', '2020-09-22', 28_720, 92, 'medium', 'usr_ops_1', {
    health: 85, throughput: 0, oee: 0, starved: true, nextPMHours: 920, lastSeenMinutes: 1, tags: ['forming'], sensors: ['vibration','current'],
  }),
  'FDY-PAL-01': asset('palletizer', 'Husky', 'PA-5000', '2021-01-10', 23_100, 48, 'low', 'usr_ops_1', {
    health: 90, throughput: 0, oee: 0, starved: true, nextPMHours: 1240, lastSeenMinutes: 2, tags: ['packaging'], sensors: ['acoustic','current'],
  }),

  /* Line 2 — running clean. */
  'FDY-CUP-02': asset('cupper', 'Stolle', 'S-Cup 1200', '2020-02-18', 31_040, 84, 'high', 'usr_ops_1', {
    health: 93, throughput: 2180, oee: 95, nextPMHours: 700, lastSeenMinutes: 1, tags: ['draw'], sensors: ['current','vibration'],
  }),
  'FDY-BM-07': asset('bodymaker', 'Stolle', 'S2C BM-90', '2020-02-20', 30_918, 128, 'critical', 'usr_ops_1', {
    health: 90, throughput: 2160, oee: 93, nextPMHours: 620, lastSeenMinutes: 1, tags: ['rotating', 'spindle'], sensors: ['vibration','temperature','current'],
  }),
  'FDY-DEC-04': asset('decorator', 'KBA-Metalprint', 'MetalStar 3', '2021-05-06', 21_480, 144, 'high', 'usr_ops_1', {
    health: 89, throughput: 2140, oee: 91, nextPMHours: 1010, lastSeenMinutes: 1, tags: ['printing'], sensors: ['pressure','current','vision'],
  }),
  'FDY-PAL-02': asset('palletizer', 'Husky', 'PA-5000', '2021-06-30', 19_220, 48, 'low', 'usr_ops_1', {
    health: 78, throughput: 2130, oee: 90, nextPMHours: 240, lastSeenMinutes: 2, tags: ['packaging'], sensors: ['acoustic','current'],
  }),

  /* Compressed Air — the utility line the Washer's coolant comes from. */
  'FDY-CMP-12': asset('compressor', 'Atlas Copco', 'ZR 315', '2017-11-02', 62_410, 74, 'critical', 'usr_rel_1', {
    health: 41, throughput: 372, oee: 81, nextPMHours: 0, lastSeenMinutes: 1, tags: ['rotating', 'criticalSpare'], sensors: ['flow','temperature','pressure','vibration'],
  }),
  'FDY-CHL-02': asset('chiller', 'Trane', 'RTAC 400', '2018-04-15', 55_900, 52, 'high', 'usr_rel_1', {
    health: 76, throughput: null, oee: null, nextPMHours: 480, lastSeenMinutes: 4, tags: ['cooling'], sensors: ['pressure','temperature'],
  }),

  /* Weißenthurm and Pune — present so the screen holds up when the scope moves,
     without pretending to a depth nobody has authored. */
  'WTM-PRS-04': asset('press', 'Soudronic', 'SP-4000', '2019-03-11', 34_100, 66, 'high', 'usr_rel_1', {
    health: 71, throughput: 1720, oee: 84, nextPMHours: 180, lastSeenMinutes: 1, tags: ['forming'], sensors: ['vibration','current'],
  }),
  'WTM-CVR-02': asset('press', 'Soudronic', 'CV-2200', '2019-03-11', 33_880, 58, 'high', 'usr_rel_1', {
    health: 80, throughput: 1740, oee: 85, nextPMHours: 360, lastSeenMinutes: 2, tags: ['forming'], sensors: ['temperature','pressure'],
  }),
  'PNQ-BM-02': asset('bodymaker', 'Stolle', 'S2C BM-90', '2021-08-09', 17_640, 128, 'critical', 'usr_ops_1', {
    health: 86, throughput: 0, oee: null, nextPMHours: 520, lastSeenMinutes: 6, tags: ['rotating'], sensors: ['flow','vibration'],
  }),
  'PNQ-NCK-01': asset('necker', 'Stolle', 'S-Neck 32', '2021-08-09', 17_520, 92, 'medium', 'usr_ops_1', {
    health: 92, throughput: 0, oee: null, nextPMHours: 760, lastSeenMinutes: 6, tags: ['forming'], sensors: ['vibration'],
  }),
}

/* ══ COMPONENTS AND SENSORS ══════════════════════════════════════════════
   Two machines are modelled to component depth, which is what the prototype
   does and is the right call: a component tree authored for all thirty assets
   would be thirty inventions nobody reads. The two that are modelled are the two
   the plant is currently arguing about.

   Sensor readings AGREE WITH `alerts.js` where an alert exists on that sensor —
   Vibration RMS reads 0.6 in/s here because `ALR-4471` says 0.6 in/s. A station
   screen and an anomaly screen showing different numbers for one instrument is
   the single most expensive kind of demo bug, because it is invisible until
   somebody asks.

   `alertId` links the sensor to that record rather than restating its severity,
   so resolving the anomaly changes this card too. */
export const ASSET_COMPONENTS = {
  'FDY-BM-03': [
    {
      id: 'motorA',
      name: 'Main spindle motor (Motor A)',
      vendor: 'ABB',
      model: 'M3BP 280SMA',
      state: 'watch',
      sensors: [
        {
          id: 'VIBX',
          name: 'Vibration RMS',
          tag: 'ns=2;s=PLC1.FDY.BM03.VibX',
          unit: 'in/s',
          value: 0.6,
          normal: [0.08, 0.49],
          alertId: 'ALR-4471',
          series: series(60, 0.16, 0.06, { freq: 3, seed: 2, drift: 5.4, spikeAt: 0.72 }),
        },
        {
          id: 'VIBY',
          name: 'Vibration RMS · Y',
          tag: 'ns=2;s=PLC1.FDY.BM03.VibY',
          unit: 'in/s',
          value: 0.19,
          normal: [0.08, 0.49],
          alertId: null,
          series: series(60, 0.19, 0.04, { freq: 4, seed: 5 }),
        },
        {
          id: 'TEMP',
          name: 'Bearing temp',
          tag: 'ns=2;s=PLC1.FDY.BM03.TBrg',
          unit: '°F',
          value: 173,
          normal: [140, 185],
          alertId: null,
          series: series(60, 158, 6, { freq: 6, seed: 9, drift: 2.1 }),
        },
      ],
    },
    { id: 'ram', name: 'Ram assembly', vendor: 'Stolle', model: 'Ram-S2C', state: 'ok', sensors: [] },
    { id: 'tooling', name: 'Punch & die tooling', vendor: 'Stolle', model: 'DC-90', state: 'ok', sensors: [] },
    { id: 'lube', name: 'Lubrication system', vendor: 'Lubriquip', model: 'Centro-Matic', state: 'ok', sensors: [] },
  ],
  'FDY-WSH-01': [
    {
      id: 'coolant',
      name: 'Coolant supply header',
      vendor: 'Stolle',
      model: 'CS-40',
      state: 'tripped',
      sensors: [
        {
          id: 'FLOW',
          name: 'Coolant flow',
          tag: 'ns=2;s=PLC2.FDY.WSH01.FlowSup',
          unit: 'gal/min',
          value: 0,
          normal: [1.3, 5.3],
          // The Washer's own instrument reading the supply that failed one line
          // over. Same fault, second witness — which is exactly why the flow
          // card and the compressor's alert must show the same zero.
          alertId: 'ALR-4470',
          series: series(60, 4.2, 0.8, { freq: 4, seed: 3, holdFrom: 0.68, holdAt: 0 }),
        },
      ],
    },
    {
      id: 'rinse',
      name: 'Stage 4 rinse',
      vendor: 'Stolle',
      model: 'RL-4',
      state: 'watch',
      sensors: [
        {
          id: 'COND',
          name: 'Conductivity',
          tag: 'ns=2;s=PLC2.FDY.WSH01.Cond4',
          unit: 'µS/cm',
          value: 620,
          normal: [180, 500],
          alertId: 'ALR-4460',
          series: series(60, 330, 55, { freq: 3, seed: 7, drift: 3.4 }),
        },
      ],
    },
    { id: 'sprayBars', name: 'Spray bars', vendor: 'Stolle', model: 'SB-12', state: 'ok', sensors: [] },
    { id: 'dryer', name: 'Dry-off oven', vendor: 'LTG', model: 'DO-900', state: 'ok', sensors: [] },
  ],
}

/**
 * Line throughput, last thirty minutes.
 *
 * Holds at zero from the freeze onward rather than decaying, because that is
 * what a line stopping looks like on a rate chart, and a gentle slope to zero
 * would misrepresent how abruptly it went.
 */
export const LINE_THROUGHPUT = {
  line_fdy_1: series(60, 2050, 90, { freq: 3, seed: 4, holdFrom: 0.68, holdAt: 0 }),
  line_fdy_2: series(60, 2150, 60, { freq: 3, seed: 6 }),
  line_fdy_util: series(60, 372, 18, { freq: 4, seed: 8 }),
  line_wtm_1: series(60, 1720, 70, { freq: 3, seed: 10 }),
  line_pnq_1: series(60, 0, 0, { freq: 1, seed: 12, holdFrom: 0, holdAt: 0 }),
}

/**
 * What the machine makes of the line right now.
 *
 * Content, not furniture — Forge AI wrote it and an endpoint will serve it. Line
 * 1's names the constraint, and the constraint is deliberately not on Line 1.
 */
export const LINE_NOTE = {
  line_fdy_1:
    'The Washer is the constraint, and the fault is not on this line. Coolant supply from Compressor C-12 froze at 03:42 — ALR-4470, flow reading zero against a 4.2 gal/min baseline — and the Washer interlocked four minutes later. Decorator 2 through Palletizer are starved with roughly six minutes of buffer before the halt propagates back to the Bodymaker. WO-7731 is released against C-12 and is the fastest path back to rate.',
  line_fdy_2:
    'Running to plan at 97% of target. Palletizer 2 is the only watch item: layer-gripper acoustic emission has been running 14 dB above baseline since the changeover, which is wear rather than damage, and PM falls due in ten days regardless.',
  line_fdy_util:
    'Compressor C-12 is still making air at 372 scfm, so the utility line reads as running — but its coolant loop is dead and the machine is on borrowed time. It is also what stopped Line 1. Treat this as the plant-critical work order tonight, not the Washer.',
  line_wtm_1:
    'Shell Press 4 vibration is elevated but inside the band and PM is 180 hours out. No action this shift.',
  line_pnq_1: 'Idle since the end of the morning shift. Nothing scheduled until Monday.',
}

/* ══ ASSET BRIEFING AND PERFORMANCE ══════════════════════════════════════
   The Asset Detail screen's AI Synopsis view.

   ── Composed from the asset's own numbers, not authored per asset ────────
   The prototype hardcodes one briefing and shows it on all thirty machines, so
   every asset claims a drive-end bearing at 13.7× baseline. Eighteen authored
   paragraphs would be the other extreme and would go stale the moment a fixture
   value moved.

   These build the prose from what the record already says — health, state, the
   worst open alert, its projected time to trip. The result is specific to the
   machine, cannot contradict the cards beside it, and stays true when somebody
   edits a health score. Wording is the design's; the facts are ours.

   Still content rather than furniture: Forge AI wrote it and an endpoint will
   serve it, so none of it goes through `t()`. */

export function assetBriefing(asset, alerts, componentOfWorst) {
  const worst = alerts[0]
  const state = asset.blocked
    ? 'blocked'
    : asset.starved
      ? 'starved'
      : asset.online
        ? 'running'
        : 'offline'
  const urgent = Boolean(worst) || (asset.health ?? 100) < 65

  if (!urgent) {
    return {
      urgent: false,
      text: `${asset.name} is ${state} at a health score of ${asset.health}/100, with every monitored signal inside its normal band. Nothing needs your attention on this machine. The next preventive maintenance falls due in ${Math.round((asset.nextPMHours ?? 0) / 24)} days.`,
      prompts: ['Summarise this week', 'Any upcoming maintenance?', 'How does it compare to peers?'],
    }
  }

  const lead = `${asset.name} is ${state} at a health score of ${asset.health}/100.`
  if (!worst) {
    return {
      urgent: true,
      text: `${lead} No anomaly is open on it, but health has fallen below the level where this machine usually runs — worth a look on the next walk-round rather than an intervention now.`,
      prompts: ['What changed?', 'Show the last 30 days', 'Compare with the sister machine'],
    }
  }

  const eta = worst.etaHours ? ` I project a threshold breach in about ${worst.etaHours} hours.` : ''
  const where = componentOfWorst ? ` on the ${componentOfWorst.toLowerCase()}` : ''
  return {
    urgent: true,
    text: `${lead} Here is what needs your attention: ${worst.sensor}${where} is reading ${worst.reading.value} ${worst.reading.unit} against a ${worst.baseline.value} ${worst.baseline.unit} baseline and a ${worst.threshold.value} ${worst.threshold.unit} threshold, and ${worst.detectors.length} detectors agree.${eta} That is ${worst.id}, and it is the item to action on this machine.`,
    prompts: [`Why is ${worst.sensor.toLowerCase()} rising?`, 'Create an inspection work order', 'Show similar past failures'],
  }
}

/**
 * The four performance figures and the OEE trend behind them.
 *
 * Derived from health so a degraded machine reads as one, with the trend
 * generated around the resulting OEE. Deterministic, seeded off the id's
 * characters so two assets at the same health still get different lines.
 */
export function assetPerformance(assetId, asset) {
  const seed = [...assetId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 17
  const health = asset.health ?? 80
  const oee = asset.oee ?? Math.round((health * 0.92 + seed * 0.3) * 10) / 10
  const availability = Math.round(Math.min(99.4, 62 + health * 0.34 + seed * 0.2) * 10) / 10
  return {
    kpis: [
      { key: 'oee', value: oee, unit: '%', deltaPct: Math.round((health - 78) * 0.4 * 10) / 10 },
      { key: 'availability', value: availability, unit: '%', deltaPct: Math.round((health - 74) * 0.12 * 10) / 10 },
      { key: 'runtime', value: Math.round((14 + (health / 100) * 8) * 10) / 10, unit: 'h', deltaPct: 0 },
      { key: 'mtbf', value: Math.round(120 + health * 2.4 + seed * 6), unit: 'h', deltaPct: Math.round((health - 82) * 0.5 * 10) / 10 },
      /* Uptime and MTTR are here rather than in a second composer because the
         two views pick four each from one set — the synopsis takes OEE,
         availability, runtime and MTBF; the Overview takes OEE, uptime, MTBF and
         MTTR. Computing them twice is how the same machine ends up with two
         different MTBFs on two tabs of one screen. */
      { key: 'uptime', value: Math.round(Math.min(99.6, 88 + health * 0.12) * 100) / 100, unit: '%', deltaPct: Math.round((health - 76) * 0.05 * 10) / 10 },
      { key: 'mttr', value: Math.round((1.4 + (100 - health) * 0.04) * 10) / 10, unit: 'h', deltaPct: Math.round((78 - health) * 0.2 * 10) / 10 },
    ],
    trend: series(30, oee, 3.4, { freq: 3, seed: seed + 1 }),
  }
}

/**
 * The windows the OEE trend card offers, shortest first.
 *
 * `live` is the last hour. The prototype labels a chip Live and shows the same
 * static line behind it; naming the window it actually covers is the smallest
 * possible correction and stops the chip promising a stream.
 */
export const TREND_WINDOWS = ['live', '4h', '8h', '12h', '24h']

/** Five evenly spaced labels across a window, in whichever unit reads. */
function axisTicks(hours) {
  // Minutes under two hours, days over two — "-168h" is a week written in the
  // one unit nobody thinks in.
  const useMinutes = hours < 2
  const useDays = hours > 48
  const span = useMinutes ? hours * 60 : useDays ? hours / 24 : hours
  const unit = useMinutes ? 'm' : useDays ? 'd' : 'h'
  return [
    `-${span}${unit}`,
    `-${Math.round((span * 3) / 4)}${unit}`,
    `-${Math.round(span / 2)}${unit}`,
    `-${Math.round(span / 4)}${unit}`,
    'now',
  ]
}

const WINDOW_SPEC = {
  live: { hours: 1, points: 30 },
  '4h': { hours: 4, points: 32 },
  '8h': { hours: 8, points: 32 },
  '12h': { hours: 12, points: 36 },
  '24h': { hours: 24, points: 48 },
}

/**
 * One trace per window, plus the labels along its time axis.
 *
 * All five are returned together because they are five views of one shift's
 * data and total about 180 numbers — a request per chip would put a spinner on
 * a control whose whole point is to be flicked through.
 *
 * A shorter window is not a slice of the longer one here: each is generated at
 * its own resolution, which is what a real downsampled query returns and what
 * makes the 4h view show detail the 24h view averages away.
 */
export function assetOeeWindows(assetId, asset) {
  const seed = [...assetId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 17
  const oee = asset.oee ?? Math.round((asset.health ?? 80) * 0.92 * 10) / 10

  return Object.fromEntries(
    TREND_WINDOWS.map((window, index) => {
      const spec = WINDOW_SPEC[window]
      return [
        window,
        {
          values: series(spec.points, oee, 1.4 + index * 0.9, {
            freq: 2 + index,
            seed: seed + index * 3 + 1,
          }),
          /* Five labels, evenly spaced, oldest first. `now` rather than `0h`
             because the axis ends at the present.

             Under two hours the axis is in minutes: the one-hour window in
             hours reads "-1h -1h -1h -0h now", which is four labels saying
             nothing and one rounding error. */
          ticks: axisTicks(spec.hours),
        },
      ]
    }),
  )
}

/* ══ ASSET DETAIL · OVERVIEW ═════════════════════════════════════════════
   The Detailed view's Overview tab. Composed, like the briefing above, from
   what the record already says — see the note there for why.

   Deliberately NOT built: the prototype's 3D preview (there is no model, and a
   grid with a placeholder image is a promise the product cannot keep) and its
   "Tree View", whose rows are an oil-and-gas hierarchy from a different demo
   entirely. The asset's real hierarchy path replaces the second; the first is
   simply absent. */

/** Deterministic 0…1 from a string and an index. Replaces `Math.random()`. */
export function noise(key, index) {
  const seed = [...key].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const value = Math.sin((seed + index * 37.19) * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

/**
 * Where the machine spent its time, as proportions plus the segments that make
 * them up.
 *
 * Three states, and their percentages sum to 100 because the segments are laid
 * end to end rather than authored beside a total that nobody checks. A stopped
 * or blocked asset gets more downtime; an idle line gets more idle.
 */
export function assetStatusHistory(assetId, asset) {
  const windows = { '24h': 24, '7d': 7 * 24, '30d': 30 * 24 }
  const down = asset.blocked ? 14 : asset.starved ? 4 : (asset.health ?? 90) < 60 ? 9 : 3
  const idle = asset.starved ? 34 : asset.online ? 12 : 46
  const running = 100 - down - idle

  return Object.fromEntries(
    Object.keys(windows).map((window) => {
      /* Segments are generated by walking the window and handing each slice to
         one of the three states in proportion — so what is drawn IS the split
         reported beside it, rather than a second authored thing that has to
         agree with it. */
      const slices = 24
      const target = { running, idle, down }
      const spent = { running: 0, idle: 0, down: 0 }
      const rows = { running: [], idle: [], down: [] }
      for (let i = 0; i < slices; i += 1) {
        const behind = Object.keys(target).sort(
          (a, b) => target[b] - (spent[b] / slices) * 100 - (target[a] - (spent[a] / slices) * 100),
        )
        // A little jitter so the bands do not read as a repeating pattern, but
        // never enough to change which state is owed the slice.
        const pick = noise(assetId + window, i) > 0.86 ? behind[1] : behind[0]
        spent[pick] += 1
        const last = rows[pick][rows[pick].length - 1]
        if (last && last.start + last.width === (i / slices) * 100) last.width += 100 / slices
        else rows[pick].push({ start: (i / slices) * 100, width: 100 / slices })
      }
      return [
        window,
        {
          hours: windows[window],
          // Oldest first, like every other time axis in the product. The design
          // runs this one axis newest-first and the chart under it oldest-first,
          // which is two directions on one screen.
          ticks: axisTicks(windows[window]),
          /* The last row takes the remainder rather than its own rounding, so
             the three always sum to 100. Three independently rounded thirds add
             up to 101 about as often as not, and a split that does not total is
             the first thing a reader checks. */
          rows: ['running', 'idle', 'down'].map((key, index, all) => {
            const others = all
              .slice(0, index)
              .reduce((sum, other) => sum + Math.round((spent[other] / slices) * 100), 0)
            const pct =
              index === all.length - 1
                ? 100 - others
                : Math.round((spent[key] / slices) * 100)
            return { key, pct, segments: rows[key] }
          }),
        },
      ]
    }),
  )
}

/**
 * Sensor kind → a plausible reading, band and unit, PER UNIT SYSTEM.
 *
 * Two tables rather than one, because engineering units belong to the site and
 * are never converted — that rule is stated in `hierarchy.js` and is the reason
 * `site_findlay` carries `units: {vibration: 'in/s', …}` while Weißenthurm and
 * Pune carry mm/s and °C. A single imperial table put in/s bands on the German
 * press, which then disagreed with `ALR-4468`'s own reading of 14.8 mm/s on that
 * exact instrument.
 *
 * Exported because `signals.js` builds the Sensor Explorer's channel catalogue
 * from the same table. A channel's band on the explorer card and the same
 * channel's band on the asset's Signal Trend are therefore one fact, not two.
 *
 * The upper edge of each band is deliberately the alert threshold the alert
 * fixture uses for that kind — `ALR-4471` trips vibration at 0.49 in/s, and that
 * is where this band ends.
 */
export const SIGNAL_SPEC = {
  imperial: {
    vibration: { name: 'Vibration RMS', unit: 'in/s', base: 0.18, amplitude: 0.06, band: [0.08, 0.49] },
    temperature: { name: 'Bearing temp', unit: '°F', base: 158, amplitude: 7, band: [140, 185] },
    pressure: { name: 'Discharge pressure', unit: 'psi', base: 52, amplitude: 6, band: [29, 72] },
    current: { name: 'Motor current', unit: 'A', base: 41, amplitude: 5, band: [30, 55] },
    flow: { name: 'Coolant flow', unit: 'gal/min', base: 4.2, amplitude: 0.7, band: [1.3, 5.3] },
    acoustic: { name: 'Acoustic emission', unit: 'dB', base: 84, amplitude: 5, band: [70, 90] },
    conductivity: { name: 'Conductivity', unit: 'µS/cm', base: 330, amplitude: 45, band: [180, 500] },
    vision: { name: 'Vision inspection', unit: '%', base: 99.2, amplitude: 0.4, band: [98, 100] },
  },
  metric: {
    vibration: { name: 'Vibration RMS', unit: 'mm/s', base: 4.6, amplitude: 1.5, band: [2.0, 12.5] },
    temperature: { name: 'Bearing temp', unit: '°C', base: 70, amplitude: 4, band: [60, 85] },
    pressure: { name: 'Discharge pressure', unit: 'bar', base: 3.6, amplitude: 0.4, band: [2.0, 5.0] },
    current: { name: 'Motor current', unit: 'A', base: 41, amplitude: 5, band: [30, 55] },
    flow: { name: 'Coolant flow', unit: 'L/min', base: 52, amplitude: 6, band: [48, 60] },
    acoustic: { name: 'Acoustic emission', unit: 'dB', base: 84, amplitude: 5, band: [70, 90] },
    conductivity: { name: 'Conductivity', unit: 'µS/cm', base: 330, amplitude: 45, band: [180, 500] },
    vision: { name: 'Vision inspection', unit: '%', base: 99.2, amplitude: 0.4, band: [98, 100] },
  },
}

/**
 * The spec for one kind at one site.
 *
 * `unitSystem` comes from the site node, not from a guess at the asset code —
 * a plant that is re-parented keeps its instruments and its units together.
 */
export const specFor = (unitSystem, kind) =>
  (SIGNAL_SPEC[unitSystem] ?? SIGNAL_SPEC.imperial)[kind] ?? null

/**
 * The traces behind the Signal Trend selector and the Telemetry card.
 *
 * A modelled machine's real sensors come first and keep their authored series,
 * so the Overview and the component rail plot the same line for the same
 * instrument. The rest are generated from the asset's declared sensor kinds —
 * an asset that says it has a flow meter gets a flow trace, not a stock one.
 *
 * `unitSystem` is the SITE's, passed in by the handler that already has the node.
 * It defaults to imperial only so that a caller with no site to hand still gets a
 * trace; every caller in the adapter passes the real one.
 */
export function assetSignals(assetId, asset, unitSystem = 'imperial') {
  const modelled = (ASSET_COMPONENTS[assetId] ?? []).flatMap((component) =>
    component.sensors.map((sensor) => ({
      key: sensor.id,
      name: sensor.name,
      unit: sensor.unit,
      band: sensor.normal,
      values: sensor.series,
      alertId: sensor.alertId,
      component: component.name,
    })),
  )
  const covered = new Set(modelled.map((signal) => signal.name.toLowerCase()))

  const generated = (asset.sensors ?? [])
    .map((kind) => specFor(unitSystem, kind) && { kind, ...specFor(unitSystem, kind) })
    .filter(Boolean)
    .filter((spec) => !covered.has(spec.name.toLowerCase()))
    .map((spec, index) => ({
      key: spec.kind,
      name: spec.name,
      unit: spec.unit,
      band: spec.band,
      values: series(48, spec.base, spec.amplitude, {
        freq: 3 + index,
        seed: (assetId.charCodeAt(4) ?? 7) + index * 5,
      }),
      alertId: null,
      component: null,
    }))

  return [...modelled, ...generated]
}

/**
 * Downtime by cause, worst first, with the running cumulative share.
 *
 * A Pareto is only worth drawing if it is ordered and cumulative — that is the
 * whole analysis. Sorting here rather than in the component means the cumulative
 * column cannot be computed against a different order than the one drawn.
 */
export function assetPareto(assetId, asset) {
  const causes = asset.blocked
    ? [['Coolant supply loss', 42], ['Interlock trips', 18], ['Changeovers', 11], ['Sensor faults', 7], ['Other', 5]]
    : [['Changeovers', 22], ['Minor stops', 17], ['Bearing wear', 12], ['Sensor faults', 6], ['Other', 4]]
  const scaled = causes.map(([label, hours], index) => [
    label,
    Math.max(1, Math.round(hours * (0.6 + noise(assetId, index) * 0.7))),
  ])
  const ordered = [...scaled].sort((a, b) => b[1] - a[1])
  const total = ordered.reduce((sum, [, hours]) => sum + hours, 0)
  let cumulative = 0
  return ordered.map(([label, hours]) => {
    cumulative += hours
    return { label, hours, cumulativePct: Math.round((cumulative / total) * 100) }
  })
}

/** The recent-activity rail. Derived from the alerts and work orders that exist. */
export function assetTimeline(assetId, asset, alerts, workOrders) {
  const events = []
  for (const alert of alerts.slice(0, 2)) {
    events.push({ key: alert.id, tone: 'red', text: `${alert.sensor} anomaly detected`, at: alert.detectedAt })
  }
  for (const order of workOrders) {
    events.push({ key: order.id, tone: 'ack', text: `${order.id} ${order.authoredBy === 'ai' ? 'drafted by Forge AI' : 'raised'}`, at: null })
  }
  if (asset.nextPMHours === 0) {
    events.push({ key: 'pm', tone: 'amber', text: 'Preventive maintenance overdue', at: null })
  } else {
    events.push({ key: 'pm', tone: 'green', text: 'Preventive maintenance completed', at: null })
  }
  events.push({ key: 'model', tone: 'violet', text: 'Anomaly model retrained', at: null })
  return events
}

/* ══ ASSET DETAIL · THE REMAINING TABS ═══════════════════════════════════ */

/** Working days back from today, as an ISO instant. */
const daysAgo = (days) => new Date(Date.now() - days * 86_400_000).toISOString()

const HISTORY_SOURCES = ['telemetry', 'vision', 'fusion', 'manual']
const HISTORY_OUTCOMES = ['resolved', 'resolved', 'resolved', 'dismissed']

/**
 * Ninety days of this asset's alerts — and the heatmap above them.
 *
 * ── One set of events, counted three ways ─────────────────────────────────
 * The prototype authors the table, the four tiles and the heatmap separately, so
 * it reports 18 alerts in a table, 178 in the heatmap's total and 4 rows on
 * screen. Here the events are generated once and everything else is counted off
 * them: the tiles, the per-day squares, the failure-mode split and the source
 * split. They cannot disagree because there is nothing to disagree with.
 *
 * Open alerts come from `alerts.js` and are prepended, so the row an operator
 * clicked through from the anomaly list is the same record here.
 */
export function assetAlertHistory(assetId, asset, openAlerts) {
  const signals = assetSignals(assetId, asset)
  const load = 6 + Math.round(noise(assetId + 'load', 0) * 10) + openAlerts.length * 2

  const history = Array.from({ length: load }, (_, index) => {
    const n = (offset) => noise(assetId + 'hist', index * 5 + offset)
    const signal = signals[Math.floor(n(1) * signals.length)] ?? signals[0]
    const severity = n(2) > 0.86 ? 'critical' : n(2) > 0.58 ? 'high' : n(2) > 0.28 ? 'medium' : 'low'
    return {
      id: `ALH-${assetId.slice(-2)}${String(index + 10).padStart(2, '0')}`,
      // Spread across the window rather than clustered at one end, but not
      // evenly — an even spread is the one distribution real faults never have.
      dayIndex: Math.min(90, Math.round(2 + n(3) * 88)),
      severity,
      title: signal ? `${signal.name} ${severity === 'low' ? 'drift' : 'exceedance'}` : 'Threshold exceedance',
      signal: signal?.name ?? null,
      source: HISTORY_SOURCES[Math.floor(n(4) * HISTORY_SOURCES.length)],
      outcome: HISTORY_OUTCOMES[Math.floor(n(5) * HISTORY_OUTCOMES.length)],
      minutesToAcknowledge: Math.round(4 + n(6) * 40),
      hoursToResolve: Math.round((0.5 + n(7) * 6) * 10) / 10,
    }
  })

  const open = openAlerts.map((alert) => ({
    id: alert.id,
    dayIndex: 0,
    severity: alert.severity,
    title: `${alert.sensor} · ${alert.component}`,
    signal: alert.sensor,
    source: 'fusion',
    outcome: 'open',
    minutesToAcknowledge: null,
    hoursToResolve: null,
    live: true,
  }))

  const events = [...open, ...history].sort((a, b) => a.dayIndex - b.dayIndex)

  // The heatmap: 91 squares, each the number of events that fell on that day.
  const counts = Array.from({ length: 91 }, () => 0)
  for (const event of events) counts[90 - event.dayIndex] += 1

  const closed = history.filter((event) => event.outcome !== 'open')
  const mean = (values) =>
    values.length ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : 0

  const tally = (key) =>
    Object.entries(
      events.reduce((acc, event) => ({ ...acc, [event[key]]: (acc[event[key]] ?? 0) + 1 }), {}),
    )
      .map(([label, count]) => ({ label, count, pct: Math.round((count / events.length) * 100) }))
      .sort((a, b) => b.count - a.count)

  return {
    events,
    counts,
    stats: {
      total: events.length,
      peak: Math.max(...counts),
      activeDays: counts.filter(Boolean).length,
      lastSeven: counts.slice(-7).reduce((sum, count) => sum + count, 0),
      avgAcknowledgeMinutes: mean(closed.map((event) => event.minutesToAcknowledge)),
      avgResolveHours: mean(closed.map((event) => event.hoursToResolve)),
      dismissedPct: closed.length
        ? Math.round((closed.filter((event) => event.outcome === 'dismissed').length / closed.length) * 100)
        : 0,
    },
    failureModes: tally('signal').slice(0, 5),
    bySource: tally('source'),
  }
}

/**
 * The asset's work orders, its parts consumption and what it has cost.
 *
 * Real orders from `operations.js` first — the same records the Work Orders
 * module will read — then a deterministic history so the Completed tab is not
 * empty on a machine that has been running for five years.
 */
export function assetWorkOrders(assetId, asset, orders) {
  /* Three buckets, as the design has them. `open` is work that needs a decision,
     `scheduled` is work with a slot, `closed` is history. The prototype shows the
     three counts and only ever fills the first, which is the kind of tab that
     reads as broken the moment somebody clicks it. */
  const scheduled = [
    {
      id: `WO-${7300 + (assetId.charCodeAt(5) % 60)}`,
      title: 'Quarterly preventive maintenance',
      assignee: 'Karan Patel',
      state: 'scheduled',
      dueInDays: 3 + (assetId.charCodeAt(6) % 9),
    },
    {
      id: `WO-${7360 + (assetId.charCodeAt(6) % 60)}`,
      title: 'Recalibrate instrumentation',
      assignee: null,
      state: 'scheduled',
      dueInDays: 12 + (assetId.charCodeAt(4) % 14),
    },
  ]

  const closed = Array.from({ length: 3 + Math.round(noise(assetId + 'wo', 0) * 5) }, (_, index) => ({
    id: `WO-${7000 + (assetId.charCodeAt(5) % 90) * 10 + index}`,
    title: index % 2 ? 'Quarterly preventive maintenance' : 'Bearing inspection and re-grease',
    assignee: index % 3 === 0 ? 'Karan Patel' : 'Ines Brandt',
    state: 'closed',
    at: daysAgo(18 + index * 21),
  }))

  const parts = [
    { sku: 'BRG-6312-C3', label: 'Drive-end bearing', used: 2 + (assetId.charCodeAt(6) % 3), onHand: 2, reorderAt: 4 },
    { sku: 'SEAL-3120', label: 'Shaft seal', used: 4, onHand: 6, reorderAt: 4 },
    { sku: 'FLT-9040', label: 'Coolant filter', used: 6, onHand: 0, reorderAt: 2 },
  ]

  const partsCost = parts.reduce((sum, part) => sum + part.used * 640, 0)
  const labourCost = Math.round((closed.length + orders.length) * 780)

  return {
    open: orders.map((order, index) => ({
      id: order.id,
      title: order.title,
      assignee: order.authoredBy === 'ai' ? null : 'Ines Brandt',
      state: order.state,
      priority: order.priority,
      authoredBy: order.authoredBy,
      estimateHours: order.estimateHours,
      // Urgent work is due today; the rest lands tomorrow. Derived from the
      // record rather than authored, so a re-prioritised order moves its date.
      dueInDays: order.priority === 'urgent' ? 0 : 1 + index,
    })),
    scheduled,
    closed,
    parts,
    cost: {
      parts: partsCost,
      labour: labourCost,
      total: partsCost + labourCost,
      // Against the same period last year. Negative is good here and the card
      // colours it accordingly — maintenance spend falling is not a regression.
      deltaPct: -(2 + ((assetId.charCodeAt(5) % 7) / 2)),
      currency: 'USD',
    },
  }
}

/**
 * Documents resolved for this asset.
 *
 * `via` is the point: a manual does not belong to one machine, it belongs to the
 * model, and a safety procedure belongs to the site. Showing where each document
 * was inherited from is what makes the list trustworthy — otherwise a reader
 * cannot tell which ones somebody actually attached to this asset.
 */
/**
 * Documents uploaded during this session, by asset id.
 *
 * Module state, like the tasks and handovers fixtures: an upload has to survive
 * a navigation or the wizard behind it is a form that throws its own result
 * away. Resets on reload, which is the right lifetime for a demo.
 */
const UPLOADED = {}

/** Append an uploaded document. Returns the stored record. */
export function addAssetDocument(assetId, document) {
  const stored = {
    ...document,
    id: `D-9${String(Object.values(UPLOADED).flat().length + 1).padStart(3, '0')}`,
    updated: new Date().toISOString(),
    uploaded: true,
  }
  UPLOADED[assetId] = [stored, ...(UPLOADED[assetId] ?? [])]
  return stored
}

/**
 * Documents resolved for this asset.
 *
 * ── This function used to author its own six ──────────────────────────────
 * It carried a hand-written list with a hand-written `via` on each row, and it
 * reused ids — D-1009, D-1012 — that the Data Fusion document registry also
 * carries, under different names and different owners. Two lists of one
 * collection, and nothing that could notice they disagreed.
 *
 * It now asks `resolveDocsForAsset`, so this tab and the Documents & SOPs screen
 * are the same records, and `via` is COMPUTED from where the link actually sits
 * in the estate rather than typed beside the row. Attaching a document to a site
 * makes it appear here, on every machine at that site, without anything being
 * edited here.
 *
 * `asset` is no longer read: the old list interpolated the vendor and model into
 * two of its titles. Real documents have the names they were filed under.
 */
export function assetDocuments(assetId) {
  const resolved = resolveDocsForAsset(assetId)

  /* Uploads first: the thing you just added is the thing you are looking for.
     They stay session-local rather than joining the registry, because the
     registry is shared across every asset and an upload here was attached to
     one machine. */
  const items = [
    ...(UPLOADED[assetId] ?? []),
    ...resolved.map((doc) => ({
      id: doc.id,
      name: doc.name,
      kind: doc.type,
      via: doc.via,
      rev: doc.rev,
      sizeKb: doc.sizeKb,
      pages: doc.pages,
      owner: doc.owner,
      updated: doc.date,
      verified: doc.verified,
    })),
  ]

  return {
    items,
    // Now a real count. It was pinned to zero with a comment saying the media
    // store did not exist; it does.
    mediaCount: resolveMediaForAsset(assetId).length,
    sources: [...new Set(items.map((document) => document.via))],
    kinds: [...new Set(items.map((document) => document.kind))].map((kind) => ({
      kind,
      count: items.filter((document) => document.kind === kind).length,
    })),
  }
}

/** The next PM, its checklist, and what else falls in the same month. */
export function assetMaintenance(assetId, asset) {
  const checklist = [
    ['Visual inspection of guards and interlocks', 5],
    ['Check drive belt tension', 5],
    ['Lubricate drive bearings', 10],
    ['Verify motor current within band', 5],
    ['Clean and clear debris', 15],
    ['Test emergency stops', 10],
    ['Inspect shaft alignment', 15],
    ['Verify sensor readings against thresholds', 12],
    ['Record findings and photographs', 10],
    ['Sign off and submit', 2],
  ].map(([label, minutes], index) => ({
    label,
    minutes,
    // Two done, the rest not — a checklist nobody has started reads as
    // decoration, and one fully complete reads as history.
    done: index < 2,
  }))

  const overdue = asset.nextPMHours === 0
  /* A real instant, not a day number. The calendar has to place it in a month
     with the right weekday, and the card prints the date and the time — neither
     of which can be derived from "day 26". Computed from the hours the asset
     record already carries, so moving a PM moves both. */
  const nextAt = new Date(Date.now() + (asset.nextPMHours ?? 0) * 3_600_000)
  nextAt.setHours(9, 0, 0, 0)

  const inMonth = (dayOfMonth) =>
    new Date(nextAt.getFullYear(), nextAt.getMonth(), dayOfMonth, 9, 0, 0, 0).toISOString()

  return {
    overdue,
    inHours: asset.nextPMHours ?? 0,
    nextAt: nextAt.toISOString(),
    windowHours: 4,
    assignee: 'Karan Patel',
    assigneeRole: 'maintenanceLead',
    kind: 'quarterly',
    checklist,
    /* Everything else falling in that month, the PM included, so the grid shows
       the appointment the card above is about rather than three unrelated
       markers beside it. */
    events: [
      { key: 'down', day: 8, label: 'Down event', tone: 'red', at: inMonth(8) },
      { key: 'calibration', day: 15, label: 'Sensor calibration', tone: 'ack', at: inMonth(15) },
      {
        key: 'pm',
        day: nextAt.getDate(),
        label: 'PM · quarterly',
        tone: overdue ? 'red' : 'amber',
        at: nextAt.toISOString(),
        primary: true,
      },
    ],
  }
}

/** The bill of materials, as a depth-indented tree with a health per line. */
export function assetBom(assetId, asset) {
  const modelled = ASSET_COMPONENTS[assetId]
  if (modelled) {
    return modelled.flatMap((component, index) => [
      {
        name: component.name,
        depth: 0,
        health: Math.max(20, (asset.health ?? 80) + (index % 2 ? 9 : -13)),
      },
      ...component.sensors.map((sensor) => ({
        name: sensor.name,
        depth: 1,
        health: sensor.alertId ? 38 : 88,
      })),
    ])
  }
  return [
    { name: asset.name, depth: 0, health: asset.health ?? 80 },
    { name: 'Drive assembly', depth: 1, health: Math.max(30, (asset.health ?? 80) - 8) },
    { name: 'Drive-end bearing', depth: 2, health: Math.max(25, (asset.health ?? 80) - 22) },
    { name: 'Non-drive-end bearing', depth: 2, health: Math.min(98, (asset.health ?? 80) + 12) },
    { name: 'Lubrication circuit', depth: 1, health: Math.min(96, (asset.health ?? 80) + 6) },
  ]
}

/**
 * What the model thinks happens next.
 *
 * The confidence and the window come from the worst open alert — its fusion
 * score and its projected time to trip — rather than the prototype's fixed 87%
 * and fixed Mar 14–21 on every machine in the plant.
 */
export function assetInsights(assetId, asset, openAlerts) {
  const worst = openAlerts[0]
  const clusters = [
    { label: 'Bearing fatigue', score: 62 },
    { label: 'Lubrication starvation', score: 41 },
    { label: 'Sensor drift', score: 28 },
  ].map((cluster, index) => ({
    ...cluster,
    score: Math.min(96, Math.round(cluster.score + noise(assetId + 'cluster', index) * 26)),
  }))
  if (worst) {
    clusters.unshift({
      label: `${worst.sensor} → ${worst.component.toLowerCase()}`,
      score: worst.fusionScore,
    })
  }

  return {
    predicted: worst
      ? {
          confidence: worst.fusionScore,
          etaHours: worst.etaHours,
          sensor: worst.sensor,
          component: worst.component,
        }
      : null,
    clusters: clusters.sort((a, b) => b.score - a.score).slice(0, 4),
    model: {
      name: 'vibration-fusion v4.1',
      retrainedAt: daysAgo(38),
      samples: 12_402,
      f1: 0.91,
      contributed: 300 + (assetId.charCodeAt(4) % 9) * 40,
    },
  }
}

/**
 * The audit trail.
 *
 * Actor matters more than action here, so `system` rows are marked as such: an
 * operator scanning for who changed what needs the machine's own entries to fall
 * away, and italics do that faster than a filter.
 */
export function assetAudit(assetId, asset, openAlerts, orders) {
  const entries = []
  for (const alert of openAlerts.slice(0, 2)) {
    entries.push({
      id: `${alert.id}-raised`,
      actor: 'system',
      action: `Raised ${alert.id}`,
      detail: `${alert.sensor} crossed ${alert.threshold.value} ${alert.threshold.unit}`,
      at: alert.detectedAt,
    })
    if (alert.assigneeId) {
      entries.push({
        id: `${alert.id}-ack`,
        actor: 'Ines Brandt',
        action: `Acknowledged ${alert.id}`,
        detail: 'Investigating with the field technician',
        at: alert.detectedAt,
      })
    }
  }
  for (const order of orders) {
    entries.push({
      id: `${order.id}-created`,
      actor: order.authoredBy === 'ai' ? 'system' : 'Dana Okafor',
      action: `Created ${order.id}`,
      detail: order.authoredBy === 'ai' ? 'Drafted by Forge AI from the open anomaly' : 'Raised manually',
      at: null,
    })
  }
  entries.push({
    id: 'health',
    actor: 'system',
    action: 'Recomputed health score',
    detail: `Now ${asset.health}/100 · daily batch`,
    at: null,
  })
  entries.push({
    id: 'model',
    actor: 'system',
    action: 'Retrained the anomaly model',
    detail: 'vibration-fusion v4.1',
    at: daysAgo(38),
  })
  return entries
}
