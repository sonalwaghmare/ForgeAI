import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { PlainBadge, StateBadge } from '@/components/forge/StatusBadge'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { usePlan, useSetModule } from '@/features/org/plan'
import { ALL_NAV_ITEMS } from '@/shell/navigation'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatDateTime, formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Settings — Modules & Plan.
 *
 * DEMO. See `DEMO-MODE.md` §8.22.
 *
 * ── The cards are the entitlement map the navigation rail reads ───────────
 * Not a second list beside it. `/v1/org/entitlements` has gated the rail since
 * before this page existed, and a toggle here changes that map — so switching
 * Logbook off removes Logbook from the rail on the next render, and switching
 * it back puts it there. That is the only version of this screen worth
 * building, because a module switch that governs nothing is not a switch.
 *
 * It costs the design's taxonomy. Its ten cards — Predictive Failure, Root
 * Cause Analysis, Compliance & Safety IOW — are features inside modules rather
 * than modules, and not one of them is a thing this product can switch off.
 *
 * ── Three switches are disabled, in place, each with its own reason ───────
 * Workbook has no screen to reveal: it is the one prototype module this rebuild
 * decided not to build, and its card says so rather than "Upgrade required".
 * Overview and Settings are always on, because turning Settings off would take
 * away the page you would use to turn it back on — the design's own Platform
 * Admin card reads "Always included" and is right about it.
 *
 * ── Upgrading buys ceilings, not modules ──────────────────────────────────
 * Every module this product has is in Professional, so a tier that unlocked
 * modules would have to invent something to withhold. What the next tier
 * actually raises is the limits — and the estate is already on one of them,
 * three sites against a limit of three, which the banner states and a reader
 * can check by counting the sites.
 */

/**
 * Entitlement → the rail item it gates.
 *
 * Keyed by `entitlement` and not by `id`, because the two are deliberately not
 * the same word: the rail's Home item is gated by `overview` and its Reports
 * item by `analytics`. Reading the icon, the route and the name off the item
 * this way is what stops a card from drawing a module under a glyph or a name
 * the rail does not use for it.
 */
const NAV = new Map(ALL_NAV_ITEMS.map((item) => [item.entitlement, item]))

export function ModulesPage() {
  const { t } = useTranslation(['app', 'common'])

  useDocumentTitle(`${t('settings.modules.title')} · ${t('common:brand.name')}`)

  const plan = usePlan()
  const summary = plan.data?.plan
  const modules = plan.data?.modules ?? []

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-5">
        <h1 className="m-0 text-headline">{t('settings.modules.title')}</h1>
        <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
          {t('settings.modules.intro')}
        </p>
      </header>

      {plan.isError ? (
        <ErrorState
          error={plan.error}
          title={t('settings.modules.loadFailed')}
          onRetry={() => plan.refetch()}
        />
      ) : plan.isPending ? (
        <SkeletonRows count={5} />
      ) : (
        <div className="flex flex-col gap-4">
          <PlanBanner summary={summary} />

          <div className="grid gap-3.5 lg:grid-cols-2">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>

          <UsageSummary usage={summary.usage} />
        </div>
      )}
    </div>
  )
}

/* ══ THE PLAN ════════════════════════════════════════════════════════════ */

function PlanBanner({ summary }) {
  const { t } = useTranslation(['app', 'common'])
  const { sites, sensors } = summary.usage

  /* The one limit this estate is actually against. Worth saying out loud on the
     banner, because it is the only thing on the page that upgrading would
     change today. */
  const atSiteLimit = sites.limit != null && sites.used >= sites.limit

  return (
    <Panel stripe="violet" className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="m-0 flex flex-wrap items-center gap-2.5 text-body-sm text-ink">
          <PlainBadge className="caps font-semibold">
            {t(`settings.modules.tiers.${summary.tier}`)}
          </PlainBadge>
          <Num className="font-semibold">
            {t('settings.modules.banner.summary', {
              active: summary.activeModules,
              total: summary.totalModules,
              sites: sites.used,
              sensors: formatInteger(sensors.used),
            })}
          </Num>
          {atSiteLimit ? (
            <StateBadge tone="amber">{t('settings.modules.banner.atSiteLimit')}</StateBadge>
          ) : null}
        </p>
        <p className="m-0 mt-1 text-micro font-normal text-ink-mute">
          <Num>
            {t('settings.modules.banner.renews', {
              date: formatDateTime(summary.renewsOn, { dateStyle: 'medium' }),
              period: t(`settings.modules.periods.${summary.period}`),
            })}
          </Num>
        </p>
      </div>

      {/* There is no payment path in this build, and inventing one would be the
          worst kind of pretend. It goes to Billing & Usage, which is where a
          plan is changed and where the tiers and their ceilings are set out. */}
      {summary.upgradeTo ? (
        <ForgeButton asChild variant="primary">
          <Link to="/app/settings/billing">
            {t('settings.modules.banner.upgrade', {
              tier: t(`settings.modules.tiers.${summary.upgradeTo}`),
            })}
            <Icon name="arrow-right" size="xs" className="mirror-rtl" />
          </Link>
        </ForgeButton>
      ) : null}
    </Panel>
  )
}

/* ══ A MODULE ════════════════════════════════════════════════════════════ */

function ModuleCard({ module }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const set = useSetModule()

  const nav = NAV.get(module.id)
  /* The rail's own label where there is a rail item, and this page's own only
     for the module that has none. */
  const name = nav ? t(`screens.${nav.id}`) : t(`settings.modules.names.${module.id}`)
  const locked = module.locked

  return (
    <Panel className={cn('flex flex-col gap-3 p-4', !module.enabled && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-sm border border-hairline bg-sunken"
        >
          {/* The rail's own icon. A module drawn with a different glyph in two
              places is two modules to anybody scanning. */}
          <Icon name={nav?.icon ?? 'layers'} size="sm" className="text-ink-dim" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-2 text-body-sm font-semibold text-ink">
            {name}
            {locked === 'notBuilt' ? (
              <PlainBadge>{t('settings.modules.badge.notBuilt')}</PlainBadge>
            ) : locked === 'alwaysOn' ? (
              <PlainBadge>{t('settings.modules.badge.alwaysOn')}</PlainBadge>
            ) : (
              <StateBadge tone="green" dot={false}>
                {t('settings.modules.badge.included')}
              </StateBadge>
            )}
          </p>
          <p className="m-0 text-micro font-normal text-ink-mute">
            {t(`settings.modules.descriptions.${module.id}`)}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={module.enabled}
          aria-label={name}
          disabled={Boolean(locked) || set.isPending}
          onClick={() =>
            set.mutate(
              { id: module.id, enabled: !module.enabled },
              {
                onSuccess: (result) =>
                  toast(
                    result?.ok === false
                      ? t(`settings.modules.refused.${result.reason}`, { name })
                      : t(module.enabled ? 'settings.modules.turnedOff' : 'settings.modules.turnedOn', {
                          name,
                        }),
                    result?.ok === false ? 'critical' : 'ok',
                  ),
              },
            )
          }
          className={cn(
            'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors',
            module.enabled ? 'bg-forge' : 'bg-hairline',
            (locked || set.isPending) && 'cursor-not-allowed opacity-50',
          )}
        >
          {/* `bg-white`, not `bg-card`. The knob is not a surface sitting on the
              page — it is a physical part of a control, read against a Forge
              Orange track. `bg-card` is opaque white in light and 6% white in
              dark, so in dark the knob all but disappeared into the track. Same
              call `ForgeButton` makes with `text-white` on a primary fill. */}
          <span
            aria-hidden="true"
            className="absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200"
            style={{ insetInlineStart: module.enabled ? '19px' : '3px' }}
          />
        </button>
      </div>

      {/* What the module is currently doing, counted off the fixture that owns
          it. An em dash where there is nothing honest to count — better than a
          figure invented so every card has one. */}
      <p className="m-0 text-micro font-normal text-ink-dim">
        {locked === 'notBuilt' ? (
          t('settings.modules.notBuiltReason')
        ) : module.metric ? (
          <Num>
            {t(`settings.modules.metrics.${module.metric.key}`, {
              count: module.metric.value,
              formatted: formatInteger(module.metric.value),
            })}
          </Num>
        ) : (
          '—'
        )}
      </p>

      {/* The design's Configure. It goes to the module, which is the only place
          a module is configured — there is no second settings surface for one. */}
      {nav && module.enabled && !module.locked ? (
        <ForgeButton asChild size="sm" className="mt-auto w-full">
          <Link to={nav.to}>{t('settings.modules.open', { name })}</Link>
        </ForgeButton>
      ) : null}
    </Panel>
  )
}

/* ══ USAGE ═══════════════════════════════════════════════════════════════ */

const USAGE_ROWS = ['sensors', 'apiCalls', 'copilotSessions', 'storage']

function UsageSummary({ usage }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <Panel className="p-4">
      <Eyebrow as="h2" className="mb-1">
        {t('settings.modules.usage.title')}
      </Eyebrow>
      <p className="mt-0 mb-4 text-body-sm text-ink-dim">{t('settings.modules.usage.intro')}</p>

      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {USAGE_ROWS.map((id) => (
          <UsageBar key={id} id={id} row={usage[id]} />
        ))}
      </div>

      <p className="mt-4 mb-0 text-micro font-normal text-ink-mute">
        {t('settings.modules.usage.note')}
      </p>
    </Panel>
  )
}

/**
 * One meter.
 *
 * Three states, and they are genuinely different: a reading against a ceiling,
 * a reading against no ceiling, and no reading at all. The third is API calls —
 * nothing in this build serves a request, so the bar has nothing to draw and
 * says so instead of sitting empty, which would be a claim that the answer is
 * zero.
 */
function UsageBar({ id, row }) {
  const { t } = useTranslation(['app', 'common'])

  const bytes = row.unit === 'bytes'
  const used = bytes ? row.usedKb : row.used
  const limit = bytes ? row.limitKb : row.limit

  const unmeasured = used == null
  const unlimited = limit == null
  const pct = unmeasured || unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100))

  /* The ladder is the reverse of the health one: a full bar is the bad end. */
  const tone = pct >= 90 ? 'red' : pct >= 75 ? 'amber' : 'green'

  const amount = (value) =>
    value == null ? null : bytes ? formatBytes(t, value) : formatInteger(value)

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-body-sm text-ink">{t(`settings.modules.usage.rows.${id}`)}</span>
        <Num className="text-body-sm tabular-nums text-ink-dim">
          {unmeasured
            ? t('settings.modules.usage.noReading')
            : unlimited
              ? t('settings.modules.usage.ofUnlimited', { used: amount(used) })
              : t('settings.modules.usage.ofLimit', { used: amount(used), limit: amount(limit) })}
        </Num>
      </div>
      <span
        role="meter"
        aria-label={t(`settings.modules.usage.rows.${id}`)}
        aria-valuenow={unmeasured ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="block h-1.5 overflow-hidden rounded-pill bg-sunken"
      >
        {unmeasured ? null : (
          <span
            className="block h-full rounded-pill"
            style={{ width: `${pct}%`, background: `var(--hue-${tone})` }}
          />
        )}
      </span>
      {unmeasured ? (
        <p className="m-0 mt-1 text-micro font-normal text-ink-mute">
          {t(`settings.modules.usage.unmeasured.${row.unmeasured}`)}
        </p>
      ) : null}
    </div>
  )
}

/** KB in, the unit that suits out. 37 MB reported as "0.0 GB" is a rounding lie. */
function formatBytes(t, kb) {
  if (kb >= 1024 * 1024) return t('settings.modules.usage.gb', { value: (kb / 1048576).toFixed(1) })
  if (kb >= 1024) return t('settings.modules.usage.mb', { value: Math.round(kb / 1024) })
  return t('settings.modules.usage.kb', { value: Math.round(kb) })
}
