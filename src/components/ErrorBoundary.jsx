import { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'

/**
 * Catches render errors so one broken screen does not blank the shell.
 *
 * The message names what happened and what clears it. The error text itself is
 * never rendered — it can carry operational data, and it is not translated.
 */
class ErrorBoundaryInner extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    // A real deployment forwards this to the error reporter. Console in dev is
    // enough while there is no backend to receive it.
    if (import.meta.env.DEV) console.error('[boundary]', error, info?.componentStack)
  }

  render() {
    const { t, children } = this.props
    if (!this.state.failed) return children

    return (
      <div
        role="alert"
        className="m-6 rounded-sm border border-hairline stripe-red bg-card p-6 text-center shadow-edge"
      >
        <Icon name="bolt" size="lg" className="mx-auto text-red" />
        <p className="mt-3 text-title">{t('errors.boundary.title')}</p>
        <p className="mx-auto mt-2 max-w-[52ch] text-body-sm text-ink-dim">
          {t('errors.boundary.body')}
        </p>
        <div className="mt-4 flex justify-center">
          <ForgeButton variant="primary" onClick={() => window.location.reload()}>
            {t('errors.boundary.reload')}
          </ForgeButton>
        </div>
      </div>
    )
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner)
