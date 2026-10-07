/**
 * Date orders, as the formatting locales that produce them.
 *
 * `Intl` will not take DD/MM/YYYY as an instruction — it takes a locale and
 * gives you that locale's field order. So each choice names the locale that
 * produces it, which is the standard way to do this and is honest about what is
 * happening underneath.
 *
 * Here rather than in the fixture because the app reads it — `useApplyOrgFormatting`
 * turns the stored key into the locale `format.js` uses — and a page reaching
 * into `mocks/` would bundle the demo layer into the production build. The
 * fixture imports it from here, which is the same seam `FUSION_STATUSES` uses.
 *
 * The formatting locale is deliberately NOT the interface language: a German
 * plant reading an English interface still wants its own date order.
 */
export const DATE_FORMATS = {
  dmy: 'en-GB',
  mdy: 'en-US',
  ymd: 'sv-SE',
}

export const DATE_FORMAT_KEYS = Object.keys(DATE_FORMATS)

export const TIME_FORMATS = ['h24', 'h12']
