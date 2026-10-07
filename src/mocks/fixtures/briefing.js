/**
 * The role-adaptive briefing — the product's home surface.
 *
 * PRODUCT.md's second positioning claim is that a briefing replaces the
 * dashboard: the same plant state produces a different, shorter, more actionable
 * read for an operator than for a COO. This fixture is that claim as data.
 *
 * SYNTHETIC. Every figure is authored.
 *
 * Briefing prose is NOT routed through the i18n layer, for the same reason the
 * assistant's replies are not: this is model output, generated in the org's
 * `aiOutputLocale`, and it arrives as content. Only the furniture around it —
 * tab labels, the composer placeholder, the eyebrow that says which kind of
 * block this is — goes through `t()`.
 *
 * Blocks reuse the vocabulary ChatThread already speaks, extended with `pulse`,
 * `card`, `stats` and `rows`. A briefing is a one-sided conversation, so it
 * should not invent a second rendering model.
 *
 * Content is anchored to this universe, not the prototype's: the manager sits at
 * Findlay and reads the same FDY-BM-03 bearing the Anomalies screen and the
 * public page show, so the three surfaces agree.
 */

import { composePerson, personById } from './people'

/**
 * Who does what tonight, from the registry.
 *
 * The card needs a name, initials and a role; every one of those belongs to the
 * person rather than to the briefing, and only the task and its priority are the
 * briefing's own.
 */
const delegation = (rows) =>
  rows.map(([id, task, priority]) => ({ ...composePerson(personById(id)), task, priority }))

/** SQDCP is the Tier-1 huddle order. The briefing is structured to match it. */
export const BRIEFINGS = {
  /* ─────────────────────────── LINE OPERATOR ─────────────────────────── */
  lineOperator: {
    role: 'lineOperator',
    personId: 'usr_ops_1',
    siteId: 'site_pune',
    context: 'Night shift · Line 1 · Pune Plant',
    blocks: [
      {
        type: 'lead',
        text: "Good evening, Arjun. You're on Night shift, Line 1 at Pune. Before you head out to the floor, here is your pre-shift brief — safety first, then your assets, your tasks, and what the last shift left you.",
      },
      {
        type: 'pulse',
        items: [
          { key: 'safety', icon: 'shield', value: '0', caption: 'incidents · 142 days clean', tone: 'green' },
          { key: 'quality', icon: 'search', value: '99.1%', caption: 'first-pass yield', tone: 'green' },
          { key: 'delivery', icon: 'gauge', value: '72.1%', caption: 'OEE · below target', tone: 'amber' },
          { key: 'tasks', icon: 'wrench', value: '4', caption: '2 due this shift', tone: null },
        ],
      },
      {
        type: 'card',
        accent: 'green',
        icon: 'shield',
        iconTone: 'green',
        eyebrow: 'Safety and pre-shift checks',
        badge: { label: 'Acknowledge required', tone: 'ok' },
        lead: 'No open safety incidents — 142 days clean. Two routine checks are assigned to you before the line starts.',
        rows: [
          {
            tone: 'green',
            text: 'Lockout/tagout verification on Bodymaker 2, coming off overnight PM. Confirm isolation is removed before restart.',
            action: { label: 'Verify', to: '/app/assets' },
          },
          {
            tone: 'watch',
            text: 'PPE and guard check on the Line 1 conveyor — the belt guard was opened during the last shift sensor swap.',
            action: { label: 'Check', to: '/app/assets' },
          },
        ],
        actions: [{ label: 'Start safety checklist', icon: 'shield', primary: true, to: '/app/assets' }],
      },
      {
        type: 'card',
        icon: 'cal',
        iconTone: 'forge',
        eyebrow: 'Handover notes for you',
        badge: { label: 'From afternoon shift', tone: 'plain' },
        lead: 'The outgoing shift flagged two items on your assets to keep an eye on.',
        items: [
          {
            tone: 'amber',
            text: 'Coolant flow on Bodymaker 2 has been restricted for two hours — 41 L/min against a 48 L/min floor. Running, but watch it.',
          },
          {
            tone: null,
            text: 'Spindle 6 on the Necker is oscillating slightly above its limit. Low severity, but it is on your walk.',
          },
        ],
        actions: [{ label: 'View the alert', icon: 'bolt', to: '/app/anomalies' }],
      },
      {
        type: 'card',
        accent: 'forge',
        icon: 'wrench',
        iconTone: 'forge',
        eyebrow: 'My tasks this shift',
        badge: { label: '4 tasks', tone: 'plain' },
        rows: [
          { tone: 'amber', text: 'Field-check the coolant supply line on Bodymaker 2', action: { label: 'Open', to: '/app/anomalies' } },
          { tone: 'watch', text: 'Record hourly can-count against target on the Line 1 board', action: { label: 'Log', to: '/app/oee' } },
          { tone: null, text: 'Clean and reset the Necker spindle station per procedure', action: { label: 'View', to: '/app/assets' } },
          { tone: null, text: 'Walk the conveyor guard reinstatement with the outgoing lead', action: { label: 'View', to: '/app/assets' } },
        ],
      },
      {
        type: 'closing',
        text: 'That is your brief. Flag anything unusual on the Bodymaker coolant loop immediately — I am watching it too. Stay safe out there.',
        actions: [
          { label: 'Ask a follow-up', icon: 'ai', to: '/app/copilot' },
          { label: 'My alerts', icon: 'bell', to: '/app/anomalies' },
          { label: 'My work orders', icon: 'wrench', to: '/app/work-orders' },
        ],
      },
    ],
  },

  /* ───────────────────────── PLANT / LINE MANAGER ────────────────────── */
  plantManager: {
    role: 'plantManager',
    personId: 'usr_mgr_1',
    siteId: 'site_findlay',
    context: 'Night shift · Findlay Plant',
    blocks: [
      {
        type: 'lead',
        text: 'Good evening, Dana. Here is your brief for the night shift at Findlay. I have structured it the way your Tier-1 huddle runs — safety, quality, delivery, cost, people — then your action list and the team plan. The afternoon shift handed over three open items.',
      },
      {
        type: 'pulse',
        items: [
          { key: 'safety', icon: 'shield', value: '0', caption: 'incidents · 142 days', tone: 'green' },
          { key: 'quality', icon: 'search', value: '98.6%', caption: 'FPY · washer drifting', tone: 'amber' },
          { key: 'delivery', icon: 'gauge', value: '71.8%', caption: 'OEE · 13.2 pt gap', tone: 'amber' },
          { key: 'cost', icon: 'bolt', value: '$84k', caption: 'downtime cost MTD', tone: 'amber' },
          { key: 'people', icon: 'users', value: '11/12', caption: 'manning · 1 absent', tone: null },
        ],
      },
      {
        type: 'card',
        icon: 'cal',
        iconTone: 'forge',
        eyebrow: 'Shift handover summary',
        badge: { label: 'Afternoon · 14:00–22:00', tone: 'plain' },
        lead: 'The afternoon shift held rate on Line 1 through the whole window, with two unplanned stops totalling 47 minutes. The main loss was the discharge bearing on Bodymaker 3 — still running, but the vibration slope is now the thing that decides your night.',
        stats: [
          { label: 'Output', value: '248.4k', unit: 'cans' },
          { label: 'Downtime', value: '47 min', unit: '2 stops' },
          { label: 'Avg OEE', value: '71.8%', unit: '−2 pts', tone: 'amber' },
          { label: 'Scrap', value: '0.9%', unit: 'in spec' },
        ],
        actions: [{ label: 'View the shift report', icon: 'chart', to: '/app/shifts' }],
      },
      {
        type: 'card',
        accent: 'green',
        icon: 'shield',
        iconTone: 'green',
        eyebrow: 'Safety and compliance',
        badge: { label: '142 days clean', tone: 'ok' },
        lead: 'No incidents or near-misses overnight. One open compliance item and one permit waiting on your signature.',
        rows: [
          {
            tone: 'watch',
            text: 'The guard interlock on the Line 1 conveyor was opened during a sensor swap. Verify it is reinstated before ramp-up.',
            action: { label: 'Review', to: '/app/assets' },
          },
          {
            tone: 'forge',
            text: 'Hot-work permit pending for the IBO Oven zone 3 burner. Your sign-off is required before maintenance starts.',
            action: { label: 'Authorise', to: '/app/work-orders' },
          },
        ],
      },
      {
        type: 'card',
        accent: 'red',
        icon: 'bolt',
        iconTone: 'red',
        eyebrow: "Tonight's game plan",
        badge: { label: 'Top 3', tone: 'high' },
        lead: 'Where to spend your attention, in order. The Bodymaker 3 bearing is the big rock and it has a deadline.',
        items: [
          {
            tone: 'red',
            text: 'Bodymaker 3 discharge bearing. Four sibling sensors agree and the trip threshold is about four and a half hours out. The work order is drafted and waiting on release — this one does not survive the shift if you leave it.',
          },
          {
            tone: 'amber',
            text: 'Recover the OEE gap. Running 71.8% against 85%. The Palletizer on Line 2 is the drag, with three gripper stops in the last shift.',
          },
          {
            tone: 'watch',
            text: 'Washer stage 4 conductivity has drifted from 310 to 620 µS/cm. Not urgent tonight, but it is a quality risk building over days, not hours.',
          },
        ],
        actions: [
          { label: 'Open the bearing alert', icon: 'bolt', primary: true, to: '/app/anomalies' },
          { label: 'OEE breakdown', icon: 'gauge', to: '/app/oee' },
        ],
      },
      {
        type: 'card',
        accent: 'forge',
        icon: 'chart',
        iconTone: 'forge',
        eyebrow: 'Production and cost watch',
        lead: "Tonight's order book needs 2.06M cans. At the current rate you finish about 40 minutes behind unless the Palletizer stabilises. Downtime is costing roughly $84k month to date, and 71% of that traces to Line 1.",
        stats: [
          { label: 'Target tonight', value: '2.06M', unit: 'cans' },
          { label: 'Projected', value: '2.02M', unit: '−40 min', tone: 'amber' },
          { label: 'Power', value: '1.18', unit: 'kWh / k cans', tone: 'green' },
        ],
      },
      {
        type: 'card',
        accent: 'forge',
        icon: 'search',
        iconTone: 'forge',
        eyebrow: 'Action items and approvals',
        rows: [
          {
            tone: 'red',
            text: 'ALR-4471 on Bodymaker 3 is critical and unacknowledged for 34 minutes.',
            action: { label: 'Acknowledge', to: '/app/anomalies' },
          },
          {
            tone: 'violet',
            text: 'WO-7734 — replace the discharge bearing. Drafted by Forge AI, awaiting your release.',
            action: { label: 'Review', to: '/app/work-orders' },
          },
          {
            tone: 'watch',
            text: 'Bearing 6312-C3 is down to two on hand against a reorder point of four.',
            action: { label: 'View parts', to: '/app/work-orders' },
          },
          {
            tone: null,
            text: 'The coolant flow switch on Compressor C-12 has read zero for 78 minutes while its neighbours stayed live.',
            action: { label: 'Schedule', to: '/app/anomalies' },
          },
        ],
      },
      {
        type: 'card',
        accent: 'green',
        icon: 'users',
        iconTone: 'green',
        eyebrow: 'Team and delegation',
        badge: { label: '11 of 12 present', tone: 'plain' },
        lead: 'One absence tonight and the load is covered. Based on skills and current load, this is how I would delegate the open items.',
        /* Named by id. This card used to carry a third copy of three people —
           their names, their initials and their roles spelled out in English —
           beside the two registries that already held them. The registry fills
           all three in, so a rename lands here too and the role is a key the
           card can translate. */
        people: delegation([
          ['usr_rel_1', 'Release WO-7734 and stage the bearing replacement', 'critical'],
          ['usr_ops_1', 'Field-check the Compressor C-12 coolant flow switch', 'high'],
          ['usr_mgr_1', 'Authorise the hot-work permit for the oven burner', 'medium'],
        ]),
      },
      {
        type: 'card',
        icon: 'map',
        iconTone: 'violet',
        eyebrow: 'Suggested Gemba walk',
        lead: 'If you do one floor walk tonight, start at Bodymaker 3, then the Line 2 Palletizer. That is where tonight’s risk and loss are concentrated.',
        actions: [{ label: 'Open the line layout', icon: 'map', to: '/app/assets' }],
      },
      {
        type: 'closing',
        text: 'That is your brief, Dana. I will keep watching the bearing and the OEE gap, and raise it if anything escalates. Have a strong shift.',
        actions: [
          { label: 'Ask a follow-up', icon: 'ai', to: '/app/copilot' },
          { label: 'All alerts', icon: 'bell', to: '/app/anomalies' },
          { label: 'All work orders', icon: 'wrench', to: '/app/work-orders' },
        ],
      },
    ],
  },

  /* ──────────────────────────── EXECUTIVE ────────────────────────────── */
  executive: {
    role: 'executive',
    personId: 'usr_exe_1',
    siteId: null,
    context: 'Enterprise · 3 sites · 13 lines',
    blocks: [
      {
        type: 'lead',
        text: 'Good evening, James. Here is your enterprise brief across three sites and thirteen lines. Network OEE is 74.4% and flat week over week. One site needs attention, and there is one decision waiting on you.',
      },
      {
        type: 'pulse',
        items: [
          { key: 'safety', icon: 'shield', value: '0', caption: 'recordable · 30 days', tone: 'green' },
          { key: 'oee', icon: 'gauge', value: '74.4%', caption: 'network · flat WoW', tone: 'amber' },
          { key: 'cost', icon: 'bolt', value: '$1.2M', caption: 'downtime MTD · up 8%', tone: 'red' },
          { key: 'service', icon: 'chart', value: '96.4%', caption: 'on time in full', tone: 'green' },
        ],
      },
      {
        type: 'card',
        accent: 'amber',
        icon: 'globe',
        iconTone: 'amber',
        eyebrow: 'Network status and risk',
        badge: { label: '1 site on watch', tone: 'high' },
        lead: 'Weißenthurm leads at 79.4% OEE and Pune is steady at 72.1%. Findlay is the outlier at 71.8%, with three critical anomalies open and the highest downtime cost in the network.',
        stats: [
          { label: 'Weißenthurm', value: '79.4%', unit: 'on plan', tone: 'green' },
          { label: 'Pune', value: '72.1%', unit: 'steady', tone: 'green' },
          { label: 'Findlay', value: '71.8%', unit: 'on watch', tone: 'amber' },
        ],
        actions: [{ label: 'Open the executive dashboard', icon: 'map', primary: true, to: '/app/executive' }],
      },
      {
        type: 'card',
        accent: 'red',
        icon: 'search',
        iconTone: 'red',
        eyebrow: 'Decision waiting on you',
        lead: 'Findlay has requested capital approval to bring the Bodymaker bearing replacement programme forward by one quarter. Three of the last four bearing failures across the network were on that same machine class.',
        rows: [
          {
            tone: 'red',
            text: 'Bearing replacement programme — bring forward one quarter. Estimated avoided downtime, 34 hours annually.',
            action: { label: 'Review', to: '/app/executive' },
          },
        ],
      },
      {
        type: 'card',
        icon: 'chart',
        iconTone: 'green',
        eyebrow: 'What the platform has caught',
        lead: 'Across the three sites, 214 hours of unplanned stoppage have been avoided year to date by acting on a warning rather than a failure. The earliest warning this month was four and a half hours ahead of a trip.',
        stats: [
          { label: 'Hours avoided', value: '214', unit: 'YTD', tone: 'green' },
          { label: 'Earliest warning', value: '4h 30m', unit: 'this month' },
          { label: 'Sensors monitored', value: '2,560', unit: 'live' },
        ],
      },
      {
        type: 'closing',
        text: 'That is the network. The only thing that needs you tonight is the Findlay capital request. Everything else is being handled at site level.',
        actions: [
          { label: 'Ask a follow-up', icon: 'ai', to: '/app/copilot' },
          { label: 'Executive dashboard', icon: 'map', to: '/app/executive' },
        ],
      },
    ],
  },
}

/** Prompts offered under the composer. Contextual, so they live with the data. */
export const BRIEFING_SUGGESTIONS = {
  lineOperator: ['What should I watch tonight?', 'Show my tasks', 'What did the last shift leave me?'],
  plantManager: ['Why is OEE down?', 'What needs my approval?', 'Draft the handover note'],
  executive: ['Which site is at risk?', 'What has this saved us?', 'Compare the three sites'],
}
