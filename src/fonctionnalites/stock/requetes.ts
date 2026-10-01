import { queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import type { EtatStock, MouvementStockResume, StockATraiter } from '../../partage/api/contrat'

export function requeteStock(etablissementId: string) {
  return queryOptions({
    queryKey: ['stock', etablissementId],
    queryFn: ({ signal }) =>
      appelerApi<EtatStock>(`/etablissements/${etablissementId}/stock`, { signal }),
  })
}

export function requeteHistoriqueStock(etablissementId: string, produitId: string) {
  return queryOptions({
    queryKey: ['stock', etablissementId, 'historique', produitId],
    queryFn: ({ signal }) =>
      appelerApi<MouvementStockResume[]>(
        `/etablissements/${etablissementId}/stock/${produitId}/mouvements`,
        { signal },
      ),
  })
}

/** Le compteur du menu « Stock ». */
export const requeteStockATraiter = queryOptions({
  queryKey: ['stock', 'a-traiter'],
  queryFn: ({ signal }) => appelerApi<StockATraiter>('/stock/a-traiter', { signal }),
})
