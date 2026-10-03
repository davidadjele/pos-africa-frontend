import { queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  ErreurPlateforme,
  MembrePlateforme,
  PageActivitePlateforme,
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

/** @param code début du traceId lu par le client ; vide : les erreurs des dernières 24 heures */
export function requeteErreurs(code: string | null) {
  return queryOptions({
    queryKey: ['plateforme', 'erreurs', code],
    queryFn: ({ signal }) =>
      appelerApi<ErreurPlateforme[]>(
        code === null
          ? '/plateforme/erreurs'
          : `/plateforme/erreurs?${new URLSearchParams({ code }).toString()}`,
        { signal },
      ),
  })
}

export function requeteEquipe() {
  return queryOptions({
    queryKey: ['plateforme', 'equipe'],
    queryFn: ({ signal }) => appelerApi<MembrePlateforme[]>('/plateforme/equipe', { signal }),
  })
}

export interface FiltresActivite {
  type?: string
  auteur?: string
  entrepriseId?: string
  recherche?: string
}

export function requeteActivite(filtres: FiltresActivite, page: number, taille = TAILLE_PAGE) {
  const parametres = new URLSearchParams({
    ...filtres,
    page: String(page),
    taille: String(taille),
  })
  return queryOptions({
    queryKey: ['plateforme', 'activite', filtres, page, taille],
    queryFn: ({ signal }) =>
      appelerApi<PageActivitePlateforme>(`/plateforme/activite?${parametres.toString()}`, {
        signal,
      }),
  })
}
