import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Data Fusion — Images & 3D Media.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── Its own collection, not a `?kind=` on documents ───────────────────────
 * The two share a linking model and nothing else. A photograph has no revision,
 * no page count, no expiry and nothing to verify; it is looked at rather than
 * read, so it is a grid rather than a register. Folding them together would mean
 * a table with four columns that are always empty for half its rows.
 */

/** The four kinds, in the order the chip strip lists them. */
export const MEDIA_TYPES = ['photo', 'model3d', 'thermal', 'video']

export const useFusionMedia = (params) =>
  useQuery({
    queryKey: queryKeys.fusionMedia(params),
    queryFn: ({ signal }) => get(endpoints.dataFusion.media, { signal, params }),
    enabled: config.demoMode,
    placeholderData: (previous) => previous,
  })

export function useUploadMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => post(endpoints.dataFusion.media, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fusion'] })
      // Asset Detail's Documents tab prints a media count beside its document
      // count, resolved from this registry.
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}
