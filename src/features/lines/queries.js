import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { fetchAsset, fetchAssets, fetchLine, fetchLines } from './api'
import { importAssets } from './import'
import { uploadAssetDocument } from './api'

/**
 * Lines & Assets reads.
 *
 * Gated at the hook, as everywhere behind the demo flag. Cached hard: the plant
 * does not change shape between renders and nothing here mutates it, so the
 * default 30-second staleness would refetch thirty assets every time the tab
 * regained focus.
 *
 * `enabled` on the two detail hooks also guards against a missing route param —
 * a URL typed without an id should render the screen's empty state, not fire a
 * request for `/production-lines/undefined`.
 */
const DEMO = { enabled: config.demoMode, staleTime: 15 * 60_000 }

export const useLines = (siteId) =>
  useQuery({
    queryKey: queryKeys.productionLines(siteId),
    queryFn: ({ signal }) => fetchLines(siteId, signal),
    ...DEMO,
  })

export const useLine = (lineId) =>
  useQuery({
    queryKey: queryKeys.productionLine(lineId),
    queryFn: ({ signal }) => fetchLine(lineId, signal),
    ...DEMO,
    enabled: DEMO.enabled && Boolean(lineId),
  })

export const useAsset = (assetId) =>
  useQuery({
    queryKey: queryKeys.asset(assetId),
    queryFn: ({ signal }) => fetchAsset(assetId, signal),
    ...DEMO,
    enabled: DEMO.enabled && Boolean(assetId),
  })

/**
 * The asset collection.
 *
 * `placeholderData` keeps the previous page on screen while the next one loads,
 * so typing in the search box moves the rows rather than blanking the table and
 * collapsing the page under the cursor.
 */
export const useAssets = (params) =>
  useQuery({
    queryKey: queryKeys.assets(params),
    queryFn: ({ signal }) => fetchAssets(params, signal),
    placeholderData: (previous) => previous,
    ...DEMO,
  })

/**
 * Commit a bulk import.
 *
 * Sweeps `['assets']` and `['production-lines']` on success: imported assets
 * change the table, the floor map, the line asset counts and the site totals in
 * the header, and every one of those is a cached read that would otherwise keep
 * showing the plant as it was a moment ago.
 */
export const useImportAssets = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importAssets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['production-lines'] })
    },
  })
}

/**
 * Attach a document to an asset.
 *
 * Invalidates that asset only. The register lives inside the asset record, so
 * the sweep is one key rather than the `['assets']` root — re-reading every
 * other machine because one of them gained a PDF is work nobody asked for.
 */
export const useUploadAssetDocument = (assetId) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (document) => uploadAssetDocument(assetId, document),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.asset(assetId) }),
  })
}
