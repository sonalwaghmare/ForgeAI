import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/forge/Field'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { StateBadge } from '@/components/forge/StatusBadge'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { PAGE_SIZES, TablePagination } from '@/components/forge/TablePagination'
import { TrendChart } from '@/components/forge/TrendChart'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useBilling, useSetBillingContact } from '@/features/org/billing'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatCurrency, formatDateTime, formatInteger } from '@/lib/format'
import { downloadBlob, simplePdf } from '@/lib/pdf'
import { cn } from '@/lib/cn'

/**
 * Settings — Billing & Usage.
 *
 * DEMO. See `DEMO-MODE.md` §8.23. The design's six panels: the plan banner,
 * four usage cards, the usage trend, the invoice table, the payment method and
 * the Enterprise call to action.
 *
 * ── This is the page that asserts the most, and it says which parts ───────
 * A price, a renewal date, an invoice history and a card on file are contract,
 * not telemetry — nothing here can derive them and there is no billing service
 * to ask. So they are authored, they are grouped in one fixture, and every one
 * of them carries `authored: true` on the wire. The plan, its ceilings and the
 * four meters are the same objects Modules & Plan draws, so the two screens
 * cannot report different usage.
 *
 * ── Update Payment is disabled, and this one is not a shortcut ────────────
 * Collecting a card number is the single interaction this product must never
 * simulate. A form that looks like a payment form teaches the person in front
 * of it that it is safe to type a card into this application, and there is no
 * processor on the other end. Update Contact is real: an email address is a
 * contact detail, not a credential.
 *
 * ── The invoice PDF is a real PDF ─────────────────────────────────────────
 * Written by `lib/pdf.js` in about twenty lines rather than by a 380KB
 * dependency. A control labelled PDF that hands over a text file is the same
 * class of defect this effort keeps removing.
 *
 * ── The trend has one real anchor ─────────────────────────────────────────
 * Its last point is today's actual sensor figure against the plan's ceiling —
 * the same number the meter above it prints — and the five months behind it are
 * a demo shape. So the right-hand end of the line can be checked, and the
 * history does not claim anything was recorded.
 */

export function BillingPage() {
  const { t } = useTranslation(['app', 'common'])

  useDocumentTitle(`${t('settings.billing.title')} · ${t('common:brand.name')}`)

  const billing = useBilling()
  const data = billing.data

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-5">
        <h1 className="m-0 text-headline">{t('settings.billing.title')}</h1>
        <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
          {t('settings.billing.intro')}
        </p>
      </header>

      {billing.isError ? (
        <ErrorState
          error={billing.error}
          title={t('settings.billing.loadFailed')}
          onRetry={() => billing.refetch()}
        />
      ) : billing.isPending ? (
        <SkeletonRows count={5} />
      ) : (
        <div className="flex flex-col gap-4">
          <PlanBanner data={data} />

          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr))]">
            {USAGE_CARDS.map((id) => (
              <UsageCard key={id} id={id} row={data.plan.usage[id]} />
            ))}
          </div>

          <UsageTrend trend={data.trend} />
          <Invoices data={data} />

          <div className="grid gap-3.5 lg:grid-cols-2">
            <PaymentMethod payment={data.payment} />
            <EnterpriseCard gains={data.gains} salesEmail={data.salesEmail} plan={data.plan} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ══ PLAN ════════════════════════════════════════════════════════════════ */

function PlanBanner({ data }) {
  const { t } = useTranslation(['app', 'common'])
  const { plan } = data
  const { sites, sensors } = plan.usage

  return (
    <Panel stripe="forge" className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 p-4">
      {/* `flex-1 min-w-0` so the gains row wraps inside this column instead of
          pushing the button block onto its own line — which is what it did, and
          why the design's top-right cluster ended up under the copy. */}
      <div className="min-w-0 flex-1">
        {/* Tinted, not neutral. A plan tier is the one badge on this page that
            is about identity rather than health, which is what Forge Orange is
            for. */}
        <StateBadge tone="forge" dot={false} className="caps font-semibold">
          {t(`settings.modules.tiers.${plan.tier}`)}
        </StateBadge>

        <p className="mt-2 mb-0 text-body font-semibold text-ink">
          <Num>
            {t('settings.modules.banner.summary', {
              active: plan.activeModules,
              total: plan.totalModules,
              sites: sites.used,
              sensors: formatInteger(sensors.limit),
            })}
          </Num>
        </p>

        <p className="m-0 mt-1 text-micro font-normal text-ink-mute">
          <Num>
            {t('settings.billing.banner.terms', {
              date: formatDateTime(plan.renewsOn, { dateStyle: 'long' }),
              period: t(`settings.modules.periods.${plan.period}`),
              renew: t(data.autoRenew ? 'settings.billing.banner.autoOn' : 'settings.billing.banner.autoOff'),
              amount: data.monthly == null ? '' : formatCurrency(data.monthly, data.currency),
            })}
          </Num>
        </p>

        {/* What this tier includes and what the next one adds, derived by
            comparing the two rows of the tier table — so the row cannot promise
            something the table does not grant. */}
        <ul className="m-0 mt-2.5 flex flex-wrap list-none gap-x-4 gap-y-1 p-0">
          {data.gains.map((gain) => (
            <li key={gain.key} className="flex items-center gap-1.5 text-micro text-ink-mute">
              {/* Hollow, because every one of these is a ceiling this tier does
                  NOT lift — the design's own `○` treatment for the half of the
                  list you do not have. */}
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full border border-hairline"
              />
              <Num>
                {t(`settings.billing.gains.${gain.key}`, {
                  from: formatInteger(gain.from),
                })}
              </Num>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <ForgeButton asChild variant="primary">
          <a href={`mailto:${data.salesEmail}`}>
            {t('settings.modules.banner.upgrade', {
              tier: t(`settings.modules.tiers.${plan.upgradeTo}`),
            })}
          </a>
        </ForgeButton>
        {/* The design's "Manage Subscription". What can actually be managed from
            here is which modules are on, so that is where it goes. */}
        <Link to="/app/settings/modules" className="text-micro text-on-forge underline">
          {t('settings.billing.banner.manage')}
        </Link>
      </div>
    </Panel>
  )
}

/* ══ USAGE ═══════════════════════════════════════════════════════════════ */

const USAGE_CARDS = ['sensors', 'apiCalls', 'copilotSessions', 'storage']

function UsageCard({ id, row }) {
  const { t } = useTranslation(['app', 'common'])

  const bytes = row.unit === 'bytes'
  const used = bytes ? row.usedKb : row.used
  const limit = bytes ? row.limitKb : row.limit

  const unlimited = limit == null
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const tone = pct >= 90 ? 'red' : pct >= 75 ? 'amber' : 'green'

  const amount = (value) =>
    value == null ? '' : bytes ? formatGb(t, value) : formatInteger(value)

  return (
    <Panel className="p-3.5">
      <Eyebrow as="h3" className="mb-1.5">
        {t(`settings.modules.usage.rows.${id}`)}
      </Eyebrow>
      <p className="m-0 text-title tabular-nums text-ink">
        <Num>
          {unlimited
            ? t('settings.billing.usage.ofUnlimited', { used: amount(used) })
            : t('settings.modules.usage.ofLimit', { used: amount(used), limit: amount(limit) })}
        </Num>
      </p>
      <span
        role="meter"
        aria-label={t(`settings.modules.usage.rows.${id}`)}
        aria-valuenow={unlimited ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 block h-1.5 overflow-hidden rounded-pill bg-sunken"
      >
        <span
          className="block h-full rounded-pill"
          style={{
            /* An unlimited allowance has no denominator, so there is nothing
               honest for the bar to be a fraction OF. It draws a short marker
               meaning "in use" rather than a fill that implies a proportion. */
            width: unlimited ? '18%' : `${pct}%`,
            background: `var(--hue-${unlimited ? 'green' : tone})`,
          }}
        />
      </span>
      <p
        className={cn(
          'm-0 mt-1.5 text-micro font-normal',
          !unlimited && pct >= 75 ? 'text-on-amber' : 'text-ink-mute',
        )}
      >
        {unlimited
          ? t('settings.billing.usage.unlimited')
          : pct >= 90
            ? t('settings.billing.usage.atLimit')
            : pct >= 75
              ? t('settings.billing.usage.nearLimit')
              : t('settings.billing.usage.headroom', { pct: 100 - pct })}
      </p>
    </Panel>
  )
}

function UsageTrend({ trend }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <Panel className="p-4">
      <Eyebrow as="h2" className="mb-1">
        {t('settings.billing.trend.title')}
      </Eyebrow>
      <p className="mt-0 mb-3 text-body-sm text-ink-dim">{t('settings.billing.trend.intro')}</p>

      <TrendChart
        legend={false}
        series={[
          {
            key: 'usage',
            label: t('settings.billing.trend.seriesLabel'),
            /* Forge Orange. Without a tone the stroke resolves to
               `var(--hue-undefined)` and the line draws in the browser's
               default — which is what it was doing. */
            tone: 'forge',
            values: trend.points.map((point) => point.value),
          },
        ]}
        label={t('settings.billing.trend.seriesLabel')}
        format={(value) => `${Math.round(value)}%`}
        xTicks={trend.points.map((point) =>
          formatDateTime(point.at, { month: 'short' }),
        )}
      />

      <p className="m-0 mt-3 text-micro font-normal text-ink-mute">
        {t('settings.billing.trend.note')}
      </p>
    </Panel>
  )
}

/* ══ INVOICES ════════════════════════════════════════════════════════════ */

function Invoices({ data }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const rows = data.invoices
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const periodOf = (row) =>
    row.annual
      ? t('settings.billing.invoices.annualPeriod', {
          period: formatDateTime(row.periodStart, { year: 'numeric', month: 'short' }),
        })
      : formatDateTime(row.periodStart, { year: 'numeric', month: 'short' })

  function download(row) {
    const lines = [
      t('settings.billing.pdf.heading'),
      '',
      `${t('settings.billing.invoices.columns.invoice')}: ${row.id}`,
      `${t('settings.billing.invoices.columns.period')}: ${periodOf(row)}`,
      `${t('settings.billing.pdf.org')}: ${t('common:brand.name')}`,
      `${t('settings.billing.pdf.plan')}: ${t(`settings.modules.tiers.${data.plan.tier}`)}`,
      `${t('settings.billing.pdf.sites')}: ${data.plan.usage.sites.used}`,
      '',
      `${t('settings.billing.invoices.columns.amount')}: ${formatCurrency(row.amount, row.currency)}`,
      `${t('settings.billing.invoices.columns.status')}: ${t(`settings.billing.status.${row.status}`)}`,
      '',
      t('settings.billing.pdf.synthetic'),
    ]
    downloadBlob(`${row.id}.pdf`, simplePdf({ lines }))
    toast(t('settings.billing.invoices.downloaded', { id: row.id }), 'ok')
  }

  return (
    <Panel className="p-4">
      <Eyebrow as="h2" className="mb-3">
        {t('settings.billing.invoices.title')}
      </Eyebrow>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          <caption className="sr-only">{t('settings.billing.invoices.caption')}</caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className="py-2 pe-3 text-start font-semibold text-ink-dim">
                {t('settings.billing.invoices.columns.invoice')}
              </th>
              <th scope="col" className="py-2 pe-3 text-start font-semibold text-ink-dim">
                {t('settings.billing.invoices.columns.period')}
              </th>
              <th scope="col" className="py-2 pe-3 text-end font-semibold text-ink-dim">
                {t('settings.billing.invoices.columns.amount')}
              </th>
              <th scope="col" className="py-2 pe-3 text-start font-semibold text-ink-dim">
                {t('settings.billing.invoices.columns.status')}
              </th>
              <th scope="col" className="py-2 text-end font-semibold text-ink-dim">
                {t('settings.billing.invoices.columns.download')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-b border-hairline last:border-b-0">
                <th scope="row" className="py-2.5 pe-3 text-start font-normal">
                  {/* A machine identifier, so monospace — the one place this
                      system uses it. */}
                  <Mono>{row.id}</Mono>
                </th>
                <td className="py-2.5 pe-3 text-ink-dim">
                  <Num>{periodOf(row)}</Num>
                </td>
                <td className="py-2.5 pe-3 text-end font-semibold tabular-nums text-ink">
                  <Num>{formatCurrency(row.amount, row.currency)}</Num>
                </td>
                <td className="py-2.5 pe-3">
                  <StateBadge tone={row.status === 'paid' ? 'green' : 'amber'}>
                    {t(`settings.billing.status.${row.status}`)}
                  </StateBadge>
                </td>
                <td className="py-2.5 text-end">
                  <ForgeButton
                    variant="ghost"
                    size="sm"
                    className="text-on-forge hover:text-on-forge"
                    onClick={() => download(row)}
                  >
                    {t('settings.billing.invoices.pdf')}
                    <Icon name="down" size="xs" />
                  </ForgeButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        total={rows.length}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        label={t('settings.billing.invoices.rowNoun')}
      />
    </Panel>
  )
}

/* ══ PAYMENT ═════════════════════════════════════════════════════════════ */

function PaymentMethod({ payment }) {
  const { t } = useTranslation(['app', 'common'])
  const [editing, setEditing] = useState(false)

  return (
    <Panel className="p-4">
      <Eyebrow as="h2" className="mb-3">
        {t('settings.billing.payment.title')}
      </Eyebrow>

      <div className="flex items-center gap-3">
        {/* The network's own mark, in the network's own colour. A Visa chip in
            Forge Orange would be a worse lie than a grey box — it is somebody
            else's mark and it has one colour. The three are tokens like every
            other colour in this product; see the fenced block in `tokens.css`
            for why they are exempt from theming. */}
        <span
          aria-hidden="true"
          className="grid h-8 w-12 shrink-0 place-items-center rounded-sm text-micro font-bold caps text-white"
          style={{ background: `var(--brand-${payment.brand})` }}
        >
          {t(`settings.billing.payment.brands.${payment.brand}`)}
        </span>
        <div className="min-w-0">
          {/* Four digits and an expiry is all a payment method should ever be on
              a screen. There is no number in the payload to print. */}
          <p className="m-0 text-body-sm font-semibold text-ink">
            <Num>
              {t('settings.billing.payment.card', {
                brand: t(`settings.billing.payment.brands.${payment.brand}`),
                last4: payment.last4,
              })}
            </Num>
          </p>
          <p className="m-0 text-micro font-normal text-ink-mute">
            <Num>
              {t('settings.billing.payment.expires', {
                month: String(payment.expiryMonth).padStart(2, '0'),
                year: String(payment.expiryYear).slice(-2),
              })}
            </Num>{' '}
            · {payment.contactEmail}
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {/* Disabled, in place, with the reason. The one control in this product
            that must never be simulated. */}
        <ForgeButton disabled title={t('settings.billing.payment.updateUnavailable')}>
          {t('settings.billing.payment.updatePayment')}
        </ForgeButton>
        <ForgeButton onClick={() => setEditing(true)}>
          {t('settings.billing.payment.updateContact')}
        </ForgeButton>
      </div>

      <p className="m-0 mt-3 text-micro font-normal text-ink-mute">
        {t('settings.billing.payment.updateUnavailable')}
      </p>

      {editing ? <ContactDialog payment={payment} onClose={() => setEditing(false)} /> : null}
    </Panel>
  )
}

/** One field, and it is not a credential. */
function ContactDialog({ payment, onClose }) {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const save = useSetBillingContact()
  const [email, setEmail] = useState(payment.contactEmail ?? '')

  return (
    <ForgeDialog
      open
      onOpenChange={(next) => !next && onClose()}
      size="sm"
      title={t('settings.billing.payment.contactTitle')}
      footer={
        <>
          <ForgeButton onClick={onClose}>{t('common:actions.cancel')}</ForgeButton>
          <span className="flex-1" />
          <ForgeButton
            variant="primary"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(email, {
                onSuccess: (result) => {
                  toast(
                    result.ok
                      ? t('settings.billing.payment.contactSaved')
                      : t('settings.billing.payment.contactInvalid'),
                    result.ok ? 'ok' : 'critical',
                  )
                  if (result.ok) onClose()
                },
              })
            }
          >
            {t('common:actions.save')}
          </ForgeButton>
        </>
      }
    >
      <Field
        id="billing-contact"
        type="email"
        label={t('settings.billing.payment.contactLabel')}
        hint={t('settings.billing.payment.contactHint')}
        value={email}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => setEmail(event.target.value)}
      />
    </ForgeDialog>
  )
}

/* ══ THE UPGRADE ═════════════════════════════════════════════════════════ */

function EnterpriseCard({ gains, salesEmail, plan }) {
  const { t } = useTranslation(['app', 'common'])

  if (!plan.upgradeTo) return null

  return (
    <Panel stripe="violet" className="flex flex-col p-4">
      <Eyebrow as="h2" className="mb-3">
        {t('settings.billing.enterprise.title', {
          tier: t(`settings.modules.tiers.${plan.upgradeTo}`),
        })}
      </Eyebrow>

      {/* The same derivation the banner uses, phrased as the gain. Nothing here
          is a marketing list: each line names a ceiling in the tier table and
          the value currently in force. */}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {gains.map((gain) => (
          <li key={gain.key} className="flex items-start gap-2 text-body-sm text-ink">
            <Icon name="check" size="xs" className="mt-1 shrink-0 text-violet" />
            <Num>
              {t(`settings.billing.gains.${gain.key}`, { from: formatInteger(gain.from) })}
            </Num>
          </li>
        ))}
      </ul>

      {/* It opens a message. It does not send one, and nothing here records a
          lead — both of which a button called Contact Sales could plausibly be
          faking. */}
      <ForgeButton asChild variant="primary" className="mt-4 w-full">
        <a href={`mailto:${salesEmail}`}>
          {t('settings.billing.enterprise.contact')}
          <Icon name="arrow-right" size="xs" className="mirror-rtl" />
        </a>
      </ForgeButton>
    </Panel>
  )
}

/** GB with one decimal, which is the unit a plan ceiling is quoted in. */
function formatGb(t, kb) {
  return t('settings.modules.usage.gb', { value: (kb / 1048576).toFixed(1) })
}
