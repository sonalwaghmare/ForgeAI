import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { IconSprite } from '@/components/forge/IconSprite'
import i18n from '@/i18n'
import { queryClient } from '@/services/queryClient'
import { DemoRoleProvider } from './DemoRoleProvider'
import { ScopeProvider } from './ScopeProvider'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from './ToastProvider'

/**
 * Everything the tree needs, in the order it needs it.
 *
 * i18n outermost because the error boundary renders translated copy; the sprite
 * is mounted once here so every <Icon> anywhere can reference it.
 */
export function AppProviders({ children }) {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ScopeProvider>
            <DemoRoleProvider>
            <TooltipProvider delayDuration={200}>
              {/* Inside the error boundary's siblings, outside its child: a
                  toast fired during a mutation must survive the screen that
                  fired it unmounting. */}
              <ToastProvider>
                <IconSprite />
                <ErrorBoundary>{children}</ErrorBoundary>
              </ToastProvider>
            </TooltipProvider>
            </DemoRoleProvider>
          </ScopeProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </I18nextProvider>
  )
}
