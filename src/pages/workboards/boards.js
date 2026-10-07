/**
 * Workboards — the demo board set.
 *
 * DEMO. See `DEMO-MODE.md` §8.1. Hardcoded, by request: no endpoint stores a board
 * and nothing persists one, so these are literals transcribed from the design. The
 * index and the canvas both say so on screen rather than letting a reader take
 * "12 elements · updated 2 min ago" for a fact about their plant.
 *
 * `updatedMinutesAgo` rather than a date string, so the list is always plausibly
 * recent — the same trick the alert fixtures use. The design's newest board is
 * dated 14 Aug whenever you open it.
 */

export const BOARD_STATUS_TONE = {
  active: 'green',
  draft: 'amber',
  complete: 'watch',
  archived: 'ack',
}

export const BOARD_STATUSES = ['active', 'draft', 'complete', 'archived']

export const BOARDS = [
  {
    id: 'WB-1042',
    status: 'active',
    linked: 'ALR-1024',
    asset: 'Bodymaker BM-03',
    line: 'Line 3',
    owner: 'Priya Nair',
    collaborators: ['PN', 'TO'],
    elements: 12,
    updatedMinutesAgo: 2,
    tags: ['bearing', 'vibration', 'rca'],
  },
  {
    id: 'WB-1038',
    status: 'active',
    linked: 'ALR-1019',
    asset: 'Washer WS-01',
    line: 'Line 3',
    owner: 'T. Olsen',
    collaborators: ['TO', 'KR'],
    elements: 8,
    updatedMinutesAgo: 64,
    tags: ['coolant', 'pid'],
  },
  {
    id: 'WB-1031',
    status: 'complete',
    linked: 'ALR-0987',
    asset: 'Compressor C-12',
    line: 'Line 1',
    owner: 'J. Marlow',
    collaborators: ['JM', 'SC', 'DK'],
    elements: 21,
    updatedMinutesAgo: 4320,
    tags: ['cascade', 'closed'],
  },
  {
    id: 'WB-1024',
    status: 'draft',
    linked: null,
    asset: 'Trimmer TR-02',
    line: 'Line 3',
    owner: 'Sarah Chen',
    collaborators: ['SC'],
    elements: 4,
    updatedMinutesAgo: 7200,
    tags: ['oee', 'speed'],
  },
  {
    id: 'WB-1019',
    status: 'active',
    linked: null,
    asset: 'Multiple',
    line: 'All lines',
    owner: 'D. Kim',
    collaborators: ['DK', 'PN', 'JM', 'SC'],
    elements: 17,
    updatedMinutesAgo: 10080,
    tags: ['recurring', 'review'],
  },
  {
    id: 'WB-1004',
    status: 'archived',
    linked: null,
    asset: 'HX-204',
    line: 'Line 2',
    owner: 'E. Visser',
    collaborators: ['EV'],
    elements: 9,
    updatedMinutesAgo: 30240,
    tags: ['thermal', 'crossSite'],
  },
]

export const boardById = (id) => BOARDS.find((board) => board.id === id) ?? null

/** An instant, not a phrase — a relative label is wrong by the second render. */
export const updatedAt = (board) => new Date(Date.now() - board.updatedMinutesAgo * 60_000)

/**
 * What sits on a board, per board.
 *
 * Only WB-1042 is laid out in full; the rest open on the same surface with the
 * cards the design shows for their subject. Rather than authoring six layouts, the
 * board's own subject is substituted into one — which is honest for a demo and
 * means adding a board does not mean drawing a canvas.
 */
export const BOARD_LAYOUT = [
  { key: 'asset', kind: 'asset', x: 2, y: 4, w: 30 },
  { key: 'signal', kind: 'chart', x: 36, y: 2, w: 38 },
  { key: 'finding', kind: 'rca', x: 78, y: 6, w: 20 },
  { key: 'pid', kind: 'pid', x: 4, y: 46, w: 30 },
  { key: 'sop', kind: 'sop', x: 38, y: 52, w: 28 },
  { key: 'wo', kind: 'wo', x: 70, y: 48, w: 27 },
]

export const BOARD_LINKS = [
  ['asset', 'signal'],
  ['signal', 'finding'],
  ['pid', 'asset'],
  ['sop', 'wo'],
  ['finding', 'wo'],
]

export const BOARD_TRACE = [8.1, 8.3, 8.9, 9.4, 10.2, 11.1, 11.9, 12.8, 13.5, 14.1, 14.8, 15.2]
