import { queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type {
  ARelancer,
  ArdoisesEtablissement,
  ClientEnCaisse,
  FicheClient,
} from '../../partage/api/contrat'

export function requeteArdoises(etablissementId: string) {
  return queryOptions({
    queryKey: ['ardoises', etablissementId],
    queryFn: ({ signal }) =>
      appelerApi<ArdoisesEtablissement>(`/etablissements/${etablissementId}/clients`, { signal }),
  })
}

export function requeteFicheClient(etablissementId: string, clientId: string) {
  return queryOptions({
    queryKey: ['ardoises', etablissementId, clientId],
    queryFn: ({ signal }) =>
      appelerApi<FicheClient>(`/etablissements/${etablissementId}/clients/${clientId}`, {
        signal,
      }),
  })
}

/** Le compteur du menu « Ardoises » : les clients à relancer. */
export const requeteARelancer = queryOptions({
  queryKey: ['ardoises', 'a-relancer'],
  queryFn: ({ signal }) => appelerApi<ARelancer>('/ardoises/a-relancer', { signal }),
})

/** Les clients que la caisse peut choisir pour mettre une note sur l'ardoise. */
export const requeteClientsCaisse = queryOptions({
  queryKey: ['caisse', 'clients'],
  queryFn: ({ signal }) => appelerCaisse<ClientEnCaisse[]>('/caisse/clients', { signal }),
})
