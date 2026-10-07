import { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { Dot, Mono, Num } from '@/components/forge/primitives'
import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The hierarchy scope selector.
 *
 * DEMO. Narrows the channel grid to a branch of the plant.
 *
 * ── Three corrections to the prototype's version ──────────────────────────
 * **The counts are counted.** The prototype hardcodes `count: 7` on the root and
 * `count: 3` on each of three sites, which add to nine. Here every number comes
 * from `scopeTree()`, which walks the channel catalogue, so a site's count is the
 * sum of its lines' and the root's is the sum of the regions'. `verify:mocks`
 * asserts both.
 *
 * **No row leads to an empty grid.** Nodes with no channels beneath them are not
 * offered. A scope menu of dead ends is worse than a shorter menu.
 *
 * **It is a tree, and says so.** `role="tree"` with `aria-expanded` and
 * `aria-level` on each row, so a screen reader gets the depth the indentation
 * shows. The prototype nests `div`s and puts the disclosure and the selection on
 * two overlapping click targets in the same row; here the caret is its own
 * button with its own label, and the rest of the row selects.
 *
 * Assets are deliberately absent — the toolbar's asset select is that control,
 * and two ways to narrow to one machine is one too many.
 */

/** Tier → the glyph that stands for it. Same vocabulary as the hierarchy screen. */
const TIER_ICON = {
  enterprise: 'globe',
  region: 'map',
  subRegion: 'map',
  site: 'factory',
  line: 'conveyor',
}

/** A node's worst channel state → the dot beside it. `ok` earns no dot. */
const STATE_TONE = { violation: 'red', warning: 'amber', ok: null }

export function ScopeSelector({ nodes, value, onChange, total }) {
  const { t } = useTranslation(['app', 'common'])
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => new Set())

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const hasChildren = useMemo(() => {
    const set = new Set()
    for (const node of nodes) if (node.parentId) set.add(node.parentId)
    return set
  }, [nodes])

  /** Depth by walking up, so the list can stay flat and still indent correctly. */
  const depthOf = (node) => {
    let depth = 0
    let current = byId.get(node.parentId)
    while (current) {
      depth += 1
      current = byId.get(current.parentId)
    }
    return depth
  }

  /** Hidden when any ancestor is collapsed — not only the immediate parent. */
  const isHidden = (node) => {
    let current = byId.get(node.parentId)
    while (current) {
      if (collapsed.has(current.id)) return true
      current = byId.get(current.parentId)
    }
    return false
  }

  const toggle = (id) =>
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const current = byId.get(value)
  const label = current?.name ?? t('sensors.scope.all')
  const count = current?.count ?? total

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          'flex min-w-[15rem] items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2',
          'text-body-sm transition-colors hover:border-forge focus-visible:border-forge',
        )}
      >
        <Icon name="map" size="sm" className="shrink-0 text-on-forge" />
        <span className="min-w-0 flex-1 truncate text-start font-semibold">{label}</span>
        <Num className="shrink-0 text-micro font-normal text-ink-dim">
          {t('sensors.scope.channels', { count })}
        </Num>
        <Icon name="down" size="xs" className="shrink-0 text-ink-mute" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className={cn(
            'z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-sm border border-hairline bg-card p-1.5 shadow-lift',
            'dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]',
          )}
        >
          <p className="m-0 flex items-center gap-2 px-2.5 py-2 text-eyebrow text-ink-dim">
            <Icon name="map" size="xs" className="text-on-forge" />
            {t('sensors.scope.heading')}
          </p>

          <ul role="tree" aria-label={t('sensors.scope.heading')} className="m-0 max-h-[24rem] list-none overflow-y-auto p-0">
            {nodes.filter((node) => !isHidden(node)).map((node) => {
              const depth = depthOf(node)
              const expandable = hasChildren.has(node.id)
              const tone = STATE_TONE[node.state] ?? null
              return (
                <li
                  key={node.id}
                  role="treeitem"
                  aria-level={depth + 1}
                  aria-selected={value === node.id}
                  aria-expanded={expandable ? !collapsed.has(node.id) : undefined}
                  className="m-0"
                >
                  <div
                    className={cn(
                      'flex items-center gap-1.5 rounded-xs',
                      value === node.id && 'bg-sunken',
                    )}
                    // Logical: under dir="rtl" the tree indents from the other
                    // edge, which is the whole point of the property.
                    style={{ paddingInlineStart: `${depth * 0.85}rem` }}
                  >
                    {expandable ? (
                      <button
                        type="button"
                        onClick={() => toggle(node.id)}
                        aria-label={t(collapsed.has(node.id) ? 'sensors.scope.expand' : 'sensors.scope.collapse', {
                          node: node.name,
                        })}
                        className="flex size-6 shrink-0 items-center justify-center text-ink-mute hover:text-ink"
                      >
                        <Icon
                          name="right"
                          size="xs"
                          className={cn('transition-transform mirror-rtl', !collapsed.has(node.id) && 'rotate-90')}
                        />
                      </button>
                    ) : (
                      <span aria-hidden="true" className="size-6 shrink-0" />
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onChange(node.id)
                        setOpen(false)
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-xs px-1 py-1.5 text-start hover:bg-sunken"
                    >
                      <Icon
                        name={TIER_ICON[node.tier] ?? 'machine'}
                        size="xs"
                        className={cn('shrink-0', depth === 0 ? 'text-on-forge' : 'text-ink-mute')}
                      />
                      {tone ? <Dot tone={tone} size={6} /> : null}
                      <span className={cn('min-w-0 flex-1 truncate text-body-sm', depth === 0 && 'font-semibold')}>
                        {node.name}
                      </span>
                      {/* The code, not an invented KPI. Same decision as the top
                          bar's scope panel — see DEMO-MODE.md §3. */}
                      <Mono className="shrink-0 text-micro text-ink-mute">{node.code}</Mono>
                      <Num className="shrink-0 text-micro font-normal tabular-nums text-ink-dim">
                        {formatInteger(node.count)}
                      </Num>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
