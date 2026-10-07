import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { ForgeButton } from './ForgeButton'

/**
 * Empty, error and loading. Not afterthoughts: on a plant floor these are the
 * states a user hits when something is already going wrong, so the copy names
 * the problem and the recovery rather than apologising.
 *
 * No blob illustrations — an abstract shape in an empty state is the clearest
 * generated-software tell there is. A single stroke icon and a sentence.
 */

export function EmptyState({ icon = 'bolt', title, body, action, className }) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'rounded-sm border border-hairline bg-card px-6 py-11 text-center shadow-edge',
        className,
      )}
    >
      <Icon name={icon} size="lg" className="mx-auto text-ink-mute" />
      <p className="mt-3 text-body font-semibold">{title ?? t('empty.noResults')}</p>
      <p className="mt-1.5 text-body-sm text-ink-dim">{body ?? t('empty.noResultsBody')}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

/**
 * @param {object} props
 * @param {import('@/services/apiError').ApiError} [props.error]
 * @param {() => void} [props.onRetry]
 */
export function ErrorState({ error, title, onRetry, className }) {
  const { t } = useTranslation()
  const messageKey = error?.messageKey ?? 'errors.unknown'

  return (
    <div
      className={cn(
        'rounded-sm border border-hairline stripe-red bg-card px-6 py-9 text-center shadow-edge',
        className,
      )}
      role="alert"
    >
      <Icon name="bolt" size="lg" className="mx-auto text-red" />
      <p className="mt-3 text-body font-semibold">{title ?? t('errors.title')}</p>
      <p className="mx-auto mt-1.5 max-w-[52ch] text-body-sm text-ink-dim">{t(messageKey)}</p>
      {error?.requestId ? (
        <p className="mono mt-2 text-micro font-normal text-ink-dim">
          {t('errors.requestId', { id: error.requestId })}
        </p>
      ) : null}
      {onRetry && (error?.retryable ?? true) ? (
        <div className="mt-4 flex justify-center">
          <ForgeButton onClick={onRetry}>{t('actions.retry')}</ForgeButton>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Skeleton rows shaped like the content that replaces them, so the layout does
 * not jump when data lands.
 */
export function SkeletonRows({ count = 5, className }) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col gap-2.5', className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-sm border border-hairline bg-card p-4 shadow-edge"
          aria-hidden="true"
        >
          <div className="flex gap-2">
            <div className="h-[19px] w-20 animate-pulse rounded-pill bg-sunken" />
            <div className="h-[19px] w-24 animate-pulse rounded-pill bg-sunken" />
          </div>
          <div className="mt-2.5 h-[21px] w-2/5 animate-pulse rounded-xs bg-sunken" />
          <div className="mt-2 h-4 w-3/5 animate-pulse rounded-xs bg-sunken" />
        </div>
      ))}
    </div>
  )
}
