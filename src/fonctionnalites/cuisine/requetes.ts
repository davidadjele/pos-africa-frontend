import { queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import type { EcranCuisine } from '../../partage/api/contrat'

/** Pas de flux temps réel : l'écran se relit toutes les 5 secondes, même sans personne devant. */
export const requeteEcranCuisine = queryOptions({
  queryKey: ['cuisine'],
  queryFn: ({ signal }) => appelerApi<EcranCuisine>('/appareil/cuisine', { signal }),
  refetchInterval: 5000,
  refetchIntervalInBackground: true,
})
