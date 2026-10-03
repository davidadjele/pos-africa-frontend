import type { ModePaiement } from '../../partage/api/contrat'

/** Une couleur vive par mode de paiement, la même dans tous les graphiques. */
export const FOND_MODE: Record<ModePaiement, string> = {
  ESPECES: 'bg-graphique-especes',
  MOBILE_MONEY: 'bg-graphique-mobile-money',
  CARTE: 'bg-graphique-carte',
  ARDOISE: 'bg-graphique-ardoise',
}

export const MODES: ModePaiement[] = ['ESPECES', 'MOBILE_MONEY', 'CARTE', 'ARDOISE']

const FOND_CATEGORIE: Record<string, string> = {
  OCRE: 'bg-graphique-ocre',
  BRIQUE: 'bg-graphique-brique',
  FEUILLE: 'bg-graphique-feuille',
  LAGUNE: 'bg-graphique-lagune',
  PRUNE: 'bg-graphique-prune',
  SABLE: 'bg-graphique-sable',
  MENTHE: 'bg-graphique-menthe',
  ARDOISE: 'bg-graphique-ardoise-categorie',
}

/** La version vive de la couleur d'une catégorie de la carte. */
export function fondCategorie(couleur: string): string {
  return FOND_CATEGORIE[couleur] ?? 'bg-graphique-ardoise-categorie'
}
