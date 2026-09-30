import { queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  CategorieResume,
  PageProduits,
  ProduitResume,
  TaxeResume,
} from '../../partage/api/contrat'

export const TAILLE_PAGE_PRODUITS = 50

export const requeteTaxes = queryOptions({
  queryKey: ['catalogue', 'taxes'],
  queryFn: ({ signal }) => appelerApi<TaxeResume[]>('/taxes', { signal }),
})

export const requeteCategories = queryOptions({
  queryKey: ['catalogue', 'categories'],
  queryFn: ({ signal }) => appelerApi<CategorieResume[]>('/categories', { signal }),
})

export interface FiltresProduits {
  categorieId: string | null
  actifs: boolean
  recherche: string
  page: number
}

export function requeteProduits({ categorieId, actifs, recherche, page }: FiltresProduits) {
  const parametres = new URLSearchParams({
    actifs: String(actifs),
    page: String(page),
    taille: String(TAILLE_PAGE_PRODUITS),
  })
  if (categorieId !== null) parametres.set('categorieId', categorieId)
  if (recherche.trim() !== '') parametres.set('recherche', recherche.trim())
  return queryOptions({
    queryKey: ['catalogue', 'produits', { categorieId, actifs, recherche: recherche.trim(), page }],
    queryFn: ({ signal }) =>
      appelerApi<PageProduits>(`/produits?${parametres.toString()}`, { signal }),
  })
}

export function requeteProduit(id: string) {
  return queryOptions({
    queryKey: ['catalogue', 'produit', id],
    queryFn: ({ signal }) => appelerApi<ProduitResume>(`/produits/${id}`, { signal }),
  })
}
