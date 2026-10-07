/**
 * The product icon set, drawn rather than borrowed.
 *
 * One consistent grammar: 24×24 grid, 1.8px stroke, round caps and joins,
 * `fill: none`. lucide is installed for shadcn's internal chevrons and checks,
 * but its default 2px stroke reads heavier than this set, so product icons come
 * from here.
 *
 * Rendered once near the top of the tree; <Icon> references these by id.
 */
export function IconSprite() {
  return (
    <svg style={{ display: 'none' }} aria-hidden="true" focusable="false">
      <symbol id="i-home" viewBox="0 0 24 24">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </symbol>
      <symbol id="i-bolt" viewBox="0 0 24 24">
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
      </symbol>
      <symbol id="i-gauge" viewBox="0 0 24 24">
        <path d="M12 13l5-4" />
        <circle cx="12" cy="13" r="9" />
        <path d="M5 18a8 8 0 0 1 14 0" />
      </symbol>
      <symbol id="i-factory" viewBox="0 0 24 24">
        <path d="M3 21V9l6 4V9l6 4V5l6 4v12H3Z" />
      </symbol>
      {/* A production line: a workpiece on a segmented conveyor. The existing
          `rail` is a split panel and reads as a layout, not as a line. */}
      <symbol id="i-conveyor" viewBox="0 0 24 24">
        <rect x="2" y="15" width="20" height="4.5" rx="2.25" />
        <path d="M7 15v4.5M12 15v4.5M17 15v4.5" />
        <rect x="8.5" y="6" width="7" height="7" rx="1.2" />
      </symbol>
      {/* A machine: housing, rotor, drive shaft. Deliberately not a cog — that
          is `gear`, which means Settings, and a machine is not a setting. */}
      <symbol id="i-machine" viewBox="0 0 24 24">
        <rect x="2.5" y="6.5" width="13" height="11" rx="2" />
        <circle cx="9" cy="12" r="3.2" />
        <path d="M15.5 12h4.5M20 9.5v5" />
      </symbol>
      <symbol id="i-chart" viewBox="0 0 24 24">
        <path d="M3 3v18h18" />
        <path d="m7 14 3-3 3 3 5-6" />
      </symbol>
      <symbol id="i-cal" viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </symbol>
      <symbol id="i-search" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3-3" />
      </symbol>
      <symbol id="i-wrench" viewBox="0 0 24 24">
        <path d="M14 7a4 4 0 0 1-5 5L5 16a2 2 0 0 0 3 3l4-4a4 4 0 0 0 5-5l-2 2-2-1-1-2 2-2Z" />
      </symbol>
      <symbol id="i-plug" viewBox="0 0 24 24">
        <path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v6" />
      </symbol>
      <symbol id="i-map" viewBox="0 0 24 24">
        <path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
        <path d="M9 4v14M15 6v14" />
      </symbol>
      {/* A cog, not a sun. The previous version was a circle with eight
          radiating lines and no outer body, which reads as a sunburst — the
          concentric outer circle is what turns the spokes into teeth. */}
      <symbol id="i-gear" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 4.5V2.5M12 19.5v2M19.5 12h2M4.5 12h-2M17.3 6.7l1.4-1.4M5.3 18.7l1.4-1.4M17.3 17.3l1.4 1.4M5.3 5.3l1.4 1.4" />
      </symbol>
      <symbol id="i-pencil" viewBox="0 0 24 24">
        <path d="M5 19h3.5L19.4 8.1a2.5 2.5 0 0 0-3.5-3.5L5 15.5V19Z" />
        <path d="m15 5.6 3.4 3.4" />
      </symbol>
      <symbol id="i-trash" viewBox="0 0 24 24">
        <path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13" />
        <path d="M10.5 11v5.5M13.5 11v5.5" />
      </symbol>
      <symbol id="i-globe" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </symbol>
      <symbol id="i-bell" viewBox="0 0 24 24">
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </symbol>
      <symbol id="i-eye" viewBox="0 0 24 24">
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </symbol>
      <symbol id="i-sun" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
      </symbol>
      <symbol id="i-moon" viewBox="0 0 24 24">
        <path d="M20 13A8 8 0 1 1 11 4a6 6 0 0 0 9 9Z" />
      </symbol>
      <symbol id="i-rail" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </symbol>
      <symbol id="i-down" viewBox="0 0 24 24">
        <path d="m6 9 6 6 6-6" />
      </symbol>
      <symbol id="i-up" viewBox="0 0 24 24">
        <path d="m6 15 6-6 6 6" />
      </symbol>
      <symbol id="i-right" viewBox="0 0 24 24">
        <path d="m9 6 6 6-6 6" />
      </symbol>
      {/* A chevron with a shaft. `right` on its own is the disclosure and
          navigation mark; this one states a relation between two things that sit
          beside each other, which needs the tail to read as a connection rather
          than as "forward". */}
      <symbol id="i-arrow-right" viewBox="0 0 24 24">
        <path d="M4 12h15" />
        <path d="m13 6 6 6-6 6" />
      </symbol>
      <symbol id="i-x" viewBox="0 0 24 24">
        <path d="M6 6l12 12M18 6 6 18" />
      </symbol>
      <symbol id="i-plus" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </symbol>
      {/* Its pair. A zoom control needs both, and rotating the ✕ by 45° — which
          is what the two zoom-out buttons in Lines & Assets were doing — draws a
          plus, so both ends of the control said the same thing. */}
      <symbol id="i-minus" viewBox="0 0 24 24">
        <path d="M5 12h14" />
      </symbol>
      <symbol id="i-list" viewBox="0 0 24 24">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </symbol>
      <symbol id="i-board" viewBox="0 0 24 24">
        <rect x="3" y="4" width="7" height="16" rx="1.5" />
        <rect x="14" y="4" width="7" height="10" rx="1.5" />
      </symbol>
      <symbol id="i-users" viewBox="0 0 24 24">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6" />
      </symbol>
      <symbol id="i-send" viewBox="0 0 24 24">
        <path d="m4 12 16-8-6 16-3-6-7-2Z" />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path d="m4 12 5 5L20 6" />
      </symbol>
      <symbol id="i-shield" viewBox="0 0 24 24">
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </symbol>
      <symbol id="i-doc" viewBox="0 0 24 24">
        <path d="M6 3h8l4 4v14H6V3Z" />
        <path d="M14 3v4h4M9 13h6M9 17h4" />
      </symbol>
      <symbol id="i-layers" viewBox="0 0 24 24">
        <path d="m12 3 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4M4 17l8 4 8-4" />
      </symbol>
      <symbol id="i-lock" viewBox="0 0 24 24">
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </symbol>
      <symbol id="i-thermo" viewBox="0 0 24 24">
        <path d="M14 14V4a2 2 0 1 0-4 0v10a4 4 0 1 0 4 0Z" />
      </symbol>
      <symbol id="i-wave" viewBox="0 0 24 24">
        <path d="M2 12h3l2-6 3 12 3-9 2 5 2-3h5" />
      </symbol>
      {/* Copilot: a hexagonal node graph. The filled nodes are intentional —
          it depicts a graph, which is the one exception to the stroke rule
          alongside the Forge mark itself. */}
      <symbol id="i-ai" viewBox="0 0 24 24">
        <polygon points="12,2.4 20,7 20,17 12,21.6 4,17 4,7" />
        <path
          d="M12 12V8M12 12l4.4-2.2M12 12l4.4 2.4M12 12v4.5M12 12l-4.4 2.4M12 12L7.6 9.8"
          strokeWidth="1.1"
        />
        <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
      </symbol>
    </svg>
  )
}
