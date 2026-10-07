import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, patch, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Data Fusion — Documents & SOPs.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── The same records Asset Detail resolves against ────────────────────────
 * `assetDocuments()` used to author six documents per asset with a hand-written
 * inheritance level, reusing ids this registry also holds. Both now read one
 * collection, which is why verifying a document here has to invalidate
 * `['assets']` as well — the asset's own Documents tab prints that flag.
 */

/** The eight types, in the order the chip strip lists them. */
export const DOC_TYPES = [
  'manual',
  'sop',
  'drawing',
  'datasheet',
  'certificate',
  'policy',
  'report',
  'layout',
]

/** How widely a document applies. Shallowest last — the inheritance order. */
export const DOC_SCOPES = ['instance', 'line', 'site', 'enterprise']

/** What a link can point at, plus the "attached to nothing" case. */
export const DOC_LINK_KINDS = ['asset', 'line', 'site']

/** The two views. Same records, different density. */
export const DOC_VIEWS = ['list', 'cards']

export const useFusionDocs = (params) =>
  useQuery({
    queryKey: queryKeys.fusionDocs(params),
    queryFn: ({ signal }) => get(endpoints.dataFusion.documents, { signal, params }),
    enabled: config.demoMode,
    placeholderData: (previous) => previous,
  })

/**
 * One document, with what it reaches.
 *
 * A separate request from the list rather than reading the row already cached:
 * `reaches` walks every asset in the estate through the resolver, which is work
 * the list has no use for and would be doing twelve times over.
 */
export const useFusionDoc = (id) =>
  useQuery({
    queryKey: queryKeys.fusionDoc(id),
    queryFn: ({ signal }) => get(endpoints.dataFusion.document(id), { signal }),
    enabled: config.demoMode && Boolean(id),
  })

/**
 * Upload one.
 *
 * `verified` is deliberately not in the payload, the same way `authoredBy` is
 * not in `createWorkOrder`'s. A document is verified when somebody has checked
 * the revision, and the person who just uploaded it has by definition not done
 * that yet — the server sets it false and the register shows the new row in the
 * unverified filter, which is where it belongs.
 */
export function useUploadDoc() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => post(endpoints.dataFusion.documents, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fusion'] })
      // A document linked to an asset appears on that asset's Documents tab the
      // moment it is filed, and the Overview counts one more.
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}

/**
 * Sign off that a revision has been checked.
 *
 * The only write this screen has, and it is one-way. A revision number and an
 * owner come from the system of record that filed the document; verification is
 * a judgement the person reading it actually makes.
 */
export function useVerifyDoc() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => patch(endpoints.dataFusion.document(id), { verified: true }),
    onSuccess: (doc) => {
      queryClient.setQueryData(queryKeys.fusionDoc(doc.id), (previous) =>
        previous ? { ...previous, ...doc } : previous,
      )
      queryClient.invalidateQueries({ queryKey: ['fusion'] })
      /* Asset Detail's Documents tab prints the same flag off the same record,
         and the Overview counts unverified documents on a card. Neither is under
         the `fusion` root. */
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}
