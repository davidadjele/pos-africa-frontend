import { queryOptions } from '@tanstack/react-query'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type { EtatCaisse, EtatEncaissement } from '../../partage/api/contrat'

/** La caisse de cette tablette : ouverte ou non, et les opérateurs Mobile Money du pays. */
export const requeteOuvertureCaisse = queryOptions({
  queryKey: ['caisse', 'ouverture'],
  queryFn: ({ signal }) => appelerCaisse<EtatCaisse>('/caisse/ouverture', { signal }),
})

export function requeteEncaissement(commandeId: string) {
  return queryOptions({
    queryKey: ['caisse', 'encaissement', commandeId],
    queryFn: ({ signal }) =>
      appelerCaisse<EtatEncaissement>(`/caisse/commandes/${commandeId}/encaissement`, { signal }),
  })
}
