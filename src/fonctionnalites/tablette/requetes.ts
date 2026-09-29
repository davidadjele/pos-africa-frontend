import { queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import type { AppareilCourant } from '../../partage/api/contrat'

/** La tablette se fait reconnaître par son cookie d'appareil ; 401 si elle n'est pas (ou plus) enregistrée. */
export const requeteAppareil = queryOptions({
  queryKey: ['appareil'],
  queryFn: ({ signal }) => appelerApi<AppareilCourant>('/appareil', { signal }),
  staleTime: 60_000,
})
