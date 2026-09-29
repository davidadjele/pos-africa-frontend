import { QueryClient } from '@tanstack/react-query'
import { ErreurApi } from '../partage/api/ErreurApi'

/**
 * Seules les pannes passagères (réseau, 5xx) sont réessayées : une erreur métier ou un refus
 * (4xx) donnerait la même réponse.
 */
export function creerClientRequetes({ nouvelEssai = true }: { nouvelEssai?: boolean } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (echecs, erreur) =>
          nouvelEssai &&
          echecs < 2 &&
          erreur instanceof ErreurApi &&
          (erreur.statut === 0 || erreur.statut >= 500),
        refetchOnWindowFocus: false,
      },
    },
  })
}
