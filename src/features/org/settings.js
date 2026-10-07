import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, patch, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { DATE_FORMATS } from '@/lib/orgFormats'
import { setOrgFormatting } from '@/lib/format'

/**
 * Organisation settings — the General page.
 *
 * DEMO. See `DEMO-MODE.md` §8.21.
 *
 * Separate from `features/operations/queries.js`, which reads `/v1/org` and
 * `/v1/org/entitlements` and is cached hard because those change rarely. This
 * one is written to, so it invalidates.
 */
export const useOrgSettings = () =>
  useQuery({
    queryKey: queryKeys.orgSettings,
    queryFn: ({ signal }) => get(endpoints.org.settings, { signal }),
    enabled: config.demoMode,
  })

/**
 * Apply the org's date, clock and zone to every formatter in the product.
 *
 * Mounted once, in the shell. An effect is the right tool here and not the
 * pattern this codebase keeps catching itself in: nothing sets React state, it
 * pushes a value into a module that the formatters read, which is a genuine
 * synchronisation with something outside React.
 *
 * It runs on the settings rather than on a save, so the preference is in force
 * on the first render after a reload — not only for whoever happened to press
 * Save.
 */
export function useApplyOrgFormatting() {
  const settings = useOrgSettings().data?.settings

  const dateFormat = settings?.dateFormat
  const timeFormat = settings?.timeFormat
  const timeZone = settings?.timeZone

  useEffect(() => {
    if (!dateFormat && !timeFormat && !timeZone) return
    setOrgFormatting({
      formattingLocale: DATE_FORMATS[dateFormat] ?? null,
      hour12: timeFormat ? timeFormat === 'h12' : null,
      timeZone: timeZone ?? null,
    })
  }, [dateFormat, timeFormat, timeZone])
}

/**
 * Change them.
 *
 * Invalidates the org record as well as the settings: renaming the organisation
 * changes `/v1/org`, which the scope selector reads, and a top bar still showing
 * the old name would make the field look like it had failed. The audit log goes
 * too, because the change is written there.
 */
export function useSaveOrgSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values) => patch(endpoints.org.settings, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orgSettings })
      queryClient.invalidateQueries({ queryKey: queryKeys.org })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}

/**
 * Put every setting back.
 *
 * Invalidates everything, which is the one place in this codebase where that is
 * the correct instrument rather than a shortcut: the call resets six modules,
 * and enumerating their keys here would be a list to forget to update the next
 * time a settings module gains state.
 */
export function useResetSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => post(endpoints.org.reset),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/** The export. A plain read — it takes nothing and changes nothing. */
export const fetchExport = () => get(endpoints.org.export)
