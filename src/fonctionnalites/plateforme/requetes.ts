import { queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  FicheEntreprisePlateforme,
  PageEntreprisesPlateforme,
} from '../../partage/api/contrat'

export const TAILLE_PAGE = 50

export function requeteEntreprises(page: number, recherche: string) {
  const parametres = new URLSearchParams({
    ...(recherche === '' ? {} : { recherche }),
    page: String(page),
    taille: String(TAILLE_PAGE),
  })
  return queryOptions({
    queryKey: ['plateforme', 'entreprises', recherche, page],
    queryFn: ({ signal }) =>
      appelerApi<PageEntreprisesPlateforme>(`/plateforme/entreprises?${parametres.toString()}`, {
        signal,
      }),
  })
}

export function requeteFicheEntreprise(id: string) {
  return queryOptions({
    queryKey: ['plateforme', 'entreprise', id],
    queryFn: ({ signal }) =>
      appelerApi<FicheEntreprisePlateforme>(`/plateforme/entreprises/${id}`, { signal }),
  })
}

// L'administrateur n'a pas d'entreprise : les dates suivent le fuseau de son appareil.
export const FUSEAU_APPAREIL = Intl.DateTimeFormat().resolvedOptions().timeZone
