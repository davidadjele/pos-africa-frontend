import { queryOptions } from '@tanstack/react-query'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type {
  CommandeDetail,
  LigneCarteEtablissement,
  PlanDeSalle,
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

export function requeteCommande(id: string) {
  return queryOptions({
    queryKey: ['caisse', 'commande', id],
    queryFn: ({ signal }) => appelerCaisse<CommandeDetail>(`/caisse/commandes/${id}`, { signal }),
  })
}
