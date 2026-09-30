import { queryOptions, useQuery } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type { ProfilCaisse, SessionCaisseCourante } from '../../partage/api/contrat'
import { useJetonCaisse } from '../../partage/api/jetonCaisse'

/** Qui peut prendre la caisse : relu à chaque retour à l'écran (profil bloqué ou PIN réinitialisé entre-temps). */
export const requetePersonnelCaisse = queryOptions({
  queryKey: ['appareil', 'personnel'],
  queryFn: ({ signal }) => appelerApi<ProfilCaisse[]>('/appareil/personnel', { signal }),
  staleTime: 0,
})

export function requeteSessionCaisse(jeton: string) {
  return queryOptions({
    queryKey: ['caisse', 'moi', jeton],
    queryFn: ({ signal }) => appelerCaisse<SessionCaisseCourante>('/caisse/moi', { signal }),
    staleTime: Infinity,
  })
}

/** « Kossi A. » devient « KA » dans la pastille du profil. */
export function initiales(nomCourt: string): string {
  return nomCourt
    .split(/\s+/)
    .map((mot) => mot.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** L'employé qui tient la caisse : ses permissions masquent ce que son rôle ne peut pas faire. */
export function useSessionCaisse(): SessionCaisseCourante | undefined {
  const jeton = useJetonCaisse()
  return useQuery({ ...requeteSessionCaisse(jeton ?? ''), enabled: jeton !== null }).data
}
