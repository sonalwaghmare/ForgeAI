import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { STRIPE_CLASS, TINT_CLASS, ON_TINT_CLASS } from '@/lib/tone'
import { Icon } from './Icon'
import { ForgeButton } from './ForgeButton'
import { Panel } from './Panel'
import { Dot, Eyebrow, Num } from './primitives'
import { PlainBadge, SeverityBadge } from './StatusBadge'

/**
 * The briefing renderer.
 *
 * A briefing is a one-sided conversation, so it speaks the same block vocabulary
 * as ChatThread rather than inventing a second rendering model — `lead`, `pulse`,
 * `card`, `closing`, with `items`, `rows`, `stats` and `people` inside a card.
 *
 * Two corrections against the prototype, both of them things DESIGN.md forbids
 * outright:
 *
 *  - The assistant avatar was a 135° violet-to-blue gradient. That is the single
 *    most recognisable generated-software signature in current software. Flat
 *    violet with the node glyph carries the same meaning with none of the smell.
 *  - Person avatars were the same gradient, reversed. They are now a neutral
 *    surface with initials, because a person is not an AI and colour here would
 *    say the wrong thing.
 *
 * Card accents are earned: a card takes a coloured leading edge only when the
 * fixture gives it one, which the fixture does only for safety, risk and AI
 * authorship. An unaccented card is the default.
 */

/**
 * ── Where the measure lives ────────────────────────────────────────────────
 * On this container, and nowhere else. The paragraphs inside used to carry their
 * own `max-w-[68ch]` on top of it, which meant prose stopped roughly two-thirds
 * of the way across while the SQDCP strip in the next bubble ran the full width —
 * a ragged right edge down the middle of a column that is supposed to read as one
 * document.
 *
 * 56rem is the design's own 880px column and is the measure. One cap, set once,
 * applied to every block equally, is what keeps the thread aligned.
 */
export function Briefing({ blocks, className }) {
  return (
    <div className={cn('mx-auto flex max-w-[56rem] flex-col gap-4', className)}>
      {blocks.map((block, index) => (
        <Bubble key={index} last={index === blocks.length - 1}>
          <Block block={block} />
        </Bubble>
      ))}
    </div>
  )
}

/**
 * The speaker mark plus its content. Rendered once per block so the thread reads
 * as a sequence of statements rather than one wall of panels.
 */
function Bubble({ children }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-[30px] shrink-0 items-center justify-center rounded-[9px] tint-violet">
        <Icon name="ai" size="sm" className="text-violet" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function Block({ block }) {
  const { t } = useTranslation(['app', 'common'])

  if (block.type === 'lead') {
    return <p className="m-0 text-body leading-[1.65] text-ink">{block.text}</p>
  }

  if (block.type === 'pulse') {
    return <Pulse items={block.items} />
  }

  if (block.type === 'closing') {
    return (
      <div>
        <p className="m-0 text-body leading-[1.65] text-ink">{block.text}</p>
        {block.actions?.length ? <Actions actions={block.actions} className="mt-3.5" /> : null}
        <p className="mt-4 mb-0 text-micro font-normal italic text-ink-dim">
          {t('common:ai.disclaimer')}
        </p>
      </div>
    )
  }

  // card
  return (
    <Panel stripe={block.accent ?? null} className="p-4.5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {block.icon ? (
          <Icon
            name={block.icon}
            size="sm"
            className={block.iconTone ? undefined : 'text-ink-mute'}
            style={block.iconTone ? { color: `var(--hue-${block.iconTone})` } : undefined}
          />
        ) : null}
        <Eyebrow>{block.eyebrow}</Eyebrow>
        {block.badge ? <Badge badge={block.badge} /> : null}
      </div>

      {block.lead ? (
        <p className="m-0 text-body-sm leading-[1.6] text-ink-dim">{block.lead}</p>
      ) : null}

      {block.stats?.length ? <Stats stats={block.stats} className="mt-3.5" /> : null}

      {block.items?.length ? (
        <ul className="mt-3.5 mb-0 flex list-none flex-col p-0">
          {block.items.map((item, index) => (
            <li
              key={index}
              className={cn(
                'flex gap-2.5 py-2 text-body-sm leading-[1.55]',
                index > 0 && 'border-t border-subtle',
              )}
            >
              <Dot tone={item.tone ?? 'green'} size={7} className={cn('mt-1.5', !item.tone && 'opacity-40')} />
              <span className="min-w-0 flex-1">{item.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {block.rows?.length ? (
        <ul className="mt-3.5 mb-0 flex list-none flex-col p-0">
          {block.rows.map((row, index) => (
            <li
              key={index}
              className={cn(
                'flex flex-wrap items-center gap-2.5 py-2.5',
                index > 0 && 'border-t border-subtle',
              )}
            >
              <Dot tone={row.tone ?? 'green'} size={7} className={cn('shrink-0', !row.tone && 'opacity-40')} />
              <span className="min-w-0 flex-1 text-body-sm leading-[1.5]">{row.text}</span>
              {row.action ? (
                <ForgeButton asChild size="sm">
                  <Link to={row.action.to}>
                    {row.action.label}
                    <Icon name="right" size="xs" className="mirror-rtl" />
                  </Link>
                </ForgeButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {block.people?.length ? (
        <ul className="mt-3.5 mb-0 flex list-none flex-col p-0">
          {block.people.map((person) => (
            <li
              key={person.name}
              className="flex flex-wrap items-center gap-3 border-t border-subtle py-2.5 first:border-t-0"
            >
              {/* Neutral, not a gradient. A person is not an AI. */}
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-hairline bg-sunken text-label font-bold text-ink-dim">
                {person.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-semibold">
                  {person.name}{' '}
                  {/* A key, not a sentence. It used to be English written into
                      the fixture and printed straight out, which read as English
                      in every locale. */}
                  <span className="font-normal text-ink-dim">
                    · {t(`common:roles.${person.role}`)}
                  </span>
                </span>
                <span className="mt-0.5 block text-body-sm text-ink-dim">{person.task}</span>
              </span>
              <SeverityBadge severity={person.priority} />
            </li>
          ))}
        </ul>
      ) : null}

      {block.actions?.length ? <Actions actions={block.actions} className="mt-4" /> : null}
    </Panel>
  )
}

/**
 * The SQDCP pulse strip — the daily-management scorecard, one tile per pillar.
 *
 * This is the one place a row of metric tiles is justified without being a
 * filter: SQDCP is a fixed, named, industry-standard set that a manager reads in
 * this exact order every morning. It is a scorecard, not a dashboard ornament,
 * and dropping a pillar would break the ritual rather than tidy the layout.
 */
function Pulse({ items }) {
  const { t } = useTranslation('app')
  return (
    <dl className="m-0 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr))]">
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            'rounded-sm border border-hairline bg-card p-3 shadow-edge',
            // Top edge rather than the leading edge: a pulse tile is a
            // scorecard cell, and the leading edge means severity elsewhere.
            'border-t-[3px]',
          )}
          style={{ borderTopColor: item.tone ? `var(--hue-${item.tone})` : 'var(--border-hairline)' }}
        >
          <dt className="flex items-center gap-1.5">
            <Icon
              name={item.icon}
              size="xs"
              className={item.tone ? undefined : 'text-ink-mute'}
              style={item.tone ? { color: `var(--hue-${item.tone})` } : undefined}
            />
            <Eyebrow as="span">{t(`home.pulse.${item.key}`, { defaultValue: item.key })}</Eyebrow>
          </dt>
          <dd className="m-0">
            <Num className="mt-1.5 block text-title leading-none">{item.value}</Num>
            <span
              className="mt-1 block text-micro font-normal"
              style={{ color: item.tone ? `var(--on-${item.tone})` : 'var(--ink-dim)' }}
            >
              {item.caption}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Stats({ stats, className }) {
  return (
    <dl
      className={cn(
        'm-0 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(8rem,1fr))]',
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-sm bg-sunken px-3 py-2.5">
          <dt className="eyebrow">{stat.label}</dt>
          <dd className="m-0 mt-1">
            <Num
              className="text-title leading-none"
              style={stat.tone ? { color: `var(--on-${stat.tone})` } : undefined}
            >
              {stat.value}
            </Num>{' '}
            <span className="text-micro font-normal text-ink-dim">{stat.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Actions({ actions, className }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {actions.map((action) => (
        <ForgeButton
          key={action.label}
          asChild
          size="sm"
          variant={action.primary ? 'primary' : 'secondary'}
        >
          <Link to={action.to}>
            {action.icon ? <Icon name={action.icon} size="xs" /> : null}
            {action.label}
          </Link>
        </ForgeButton>
      ))}
    </div>
  )
}

function Badge({ badge }) {
  if (badge.tone === 'plain' || !badge.tone) return <PlainBadge>{badge.label}</PlainBadge>
  const tone = badge.tone === 'ok' ? 'green' : badge.tone === 'high' ? 'amber' : 'red'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-[3px] text-micro',
        TINT_CLASS[tone],
        ON_TINT_CLASS[tone],
      )}
    >
      {badge.label}
    </span>
  )
}

export { STRIPE_CLASS }
