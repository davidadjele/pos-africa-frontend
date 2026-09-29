import { queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import type { PageEmployes, RoleAttribuable } from '../../partage/api/contrat'

export const TAILLE_PAGE = 50

export function requetePersonnel(page: number) {
  return queryOptions({
    queryKey: ['personnel', page],
    queryFn: ({ signal }) =>
      appelerApi<PageEmployes>(`/personnel?page=${String(page)}&taille=${String(TAILLE_PAGE)}`, {
        signal,
      }),
  })
}

export const requeteRoles = queryOptions({
  queryKey: ['personnel', 'roles'],
  queryFn: ({ signal }) => appelerApi<RoleAttribuable[]>('/roles', { signal }),
  staleTime: 5 * 60_000,
})
