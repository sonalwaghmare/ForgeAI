import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { cn } from '@/lib/cn'

/**
 * The canvas toolbar.
 *
 * DEMO. Shown for shape and deliberately INERT — the canvas under it does not pan,
 * drag or connect, and a toolbar that looked live would promise five interactions
 * none of which exist. Every control is `disabled` with the reason as its title, so
 * a sighted reader gets the muted treatment and everybody else gets told why.
 *
 * DESIGN.md's rule: a control that responds is a control that promises something.
 */
const TOOLS = [
  { key: 'select', icon: 'right' },
  { key: 'pan', icon: 'map' },
  { key: 'note', icon: 'doc' },
  { key: 'connect', icon: 'layers' },
  { key: 'comment', icon: 'users' },
]

export function BoardToolbar() {
  const { t } = useTranslation(['app', 'common'])
  return (
    <div
      role="group"
      aria-label={t('workboards.toolsLabel')}
      className="flex gap-0.5 rounded-md bg-sunken p-[3px]"
    >
      {TOOLS.map((tool, index) => (
        <button
          key={tool.key}
          type="button"
          disabled
          aria-label={t(`workboards.tool.${tool.key}`)}
          title={t('workboards.readOnly')}
          className={cn(
            'flex size-8 cursor-not-allowed items-center justify-center rounded-xs',
            index === 0 ? 'bg-card text-ink shadow-edge' : 'text-ink-mute',
          )}
        >
          <Icon name={tool.icon} size="sm" />
        </button>
      ))}
    </div>
  )
}
