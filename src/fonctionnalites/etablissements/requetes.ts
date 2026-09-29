import { queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import type { PageEtablissements } from '../../partage/api/contrat'

export const TAILLE_PAGE = 50

export function requeteEtablissements(page: number) {
  return queryOptions({
    queryKey: ['etablissements', page],
    queryFn: ({ signal }) =>
      appelerApi<PageEtablissements>(
        `/etablissements?page=${String(page)}&taille=${String(TAILLE_PAGE)}`,
        { signal },
      ),
  })
}
