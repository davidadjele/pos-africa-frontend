import { queryOptions } from '@tanstack/react-query'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type {
  CommandeDetail,
  LigneCarteEtablissement,
  PlanDeSalle,
  StockCaisse,
} from '../../partage/api/contrat'

/** Relu souvent : plusieurs tablettes ouvrent et remplissent des notes dans la même salle. */
export const requetePlan = queryOptions({
  queryKey: ['caisse', 'plan'],
  queryFn: ({ signal }) => appelerCaisse<PlanDeSalle>('/caisse/plan', { signal }),
  refetchInterval: 15_000,
})

/** Relue chaque minute : une rupture déclarée par le gérant grise la tuile sans recharger la caisse. */
export const requeteCarteCaisse = queryOptions({
  queryKey: ['caisse', 'carte'],
  queryFn: ({ signal }) => appelerCaisse<LigneCarteEtablissement[]>('/caisse/carte', { signal }),
  refetchInterval: 60_000,
})

/** Le stock restant des produits suivis : « 3 restants » sur la tuile, l'alerte ou le refus selon la politique. */
export const requeteStockCaisse = queryOptions({
  queryKey: ['caisse', 'stock'],
  queryFn: ({ signal }) => appelerCaisse<StockCaisse>('/caisse/stock', { signal }),
  refetchInterval: 60_000,
})

/** Le stock d'un produit à la caisse ; undefined s'il n'est pas suivi. */
export function stockDuProduit(stock: StockCaisse | undefined, produitId: string) {
  return stock?.articles.find((article) => article.produitId === produitId)
}

/** Plus rien à vendre : à zéro, en dessous, ou jamais compté (la politique stricte n'en suppose pas). */
export function sansStock(article: StockCaisse['articles'][number]): boolean {
  return (article.quantite ?? 0) <= 0
}

export function requeteCommande(id: string) {
  return queryOptions({
    queryKey: ['caisse', 'commande', id],
    queryFn: ({ signal }) => appelerCaisse<CommandeDetail>(`/caisse/commandes/${id}`, { signal }),
  })
}
