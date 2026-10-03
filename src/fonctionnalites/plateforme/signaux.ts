import type { EntreprisePlateforme } from '../../partage/api/contrat'

/** Seuil fixe pour l'instant : une semaine sans vente mérite un appel au client. */
const SEPT_JOURS_MS = 7 * 24 * 60 * 60 * 1000

export type SignalEntreprise = 'SANS_VENTE' | 'NOUVELLE'

/**
 * Ce que l'équipe plateforme doit remarquer dans la liste : une entreprise nouvelle à accompagner, ou une
 * entreprise active qui ne vend plus. Une entreprise suspendue n'appelle aucun signal : son statut le dit déjà.
 */
export function signalEntreprise(
  entreprise: Pick<EntreprisePlateforme, 'statut' | 'creeLe' | 'derniereVenteLe'>,
  maintenant: Date,
): SignalEntreprise | null {
  if (entreprise.statut !== 'ACTIVE') return null
  const depuis = (date: string) => maintenant.getTime() - new Date(date).getTime()
  if (depuis(entreprise.creeLe) < SEPT_JOURS_MS) return 'NOUVELLE'
  if (
    entreprise.derniereVenteLe === undefined ||
    depuis(entreprise.derniereVenteLe) > SEPT_JOURS_MS
  )
    return 'SANS_VENTE'
  return null
}
