import type { TFunction } from 'i18next'
import type { EtatLigneStock, MouvementStockResume } from '../../partage/api/contrat'
import type { TonStatut } from '../../partage/ui/BadgeStatut'

/** À traiter en tête : le négatif, la rupture, le stock faible, puis ce qui reste à compter. */
const RANGS: Record<EtatLigneStock, number> = {
  NEGATIF: 0,
  RUPTURE: 1,
  FAIBLE: 2,
  A_COMPTER: 3,
  EN_STOCK: 4,
}

export function rangStock(etat: EtatLigneStock): number {
  return RANGS[etat]
}

export function estATraiter(etat: EtatLigneStock): boolean {
  return etat === 'NEGATIF' || etat === 'RUPTURE' || etat === 'FAIBLE'
}

export const TONS_ETAT: Record<EtatLigneStock, TonStatut> = {
  NEGATIF: 'danger',
  RUPTURE: 'danger',
  FAIBLE: 'alerte',
  A_COMPTER: 'neutre',
  EN_STOCK: 'succes',
}

export const TONS_MOUVEMENT: Record<MouvementStockResume['type'], TonStatut> = {
  INITIAL: 'info',
  RECEPTION: 'succes',
  VENTE: 'neutre',
  RETOUR: 'info',
  PERTE: 'danger',
  INVENTAIRE: 'alerte',
}

/** « −2 », « +24 », « 0 » : le signe moins typographique, comme pour les montants. */
export function quantiteSignee(quantite: number, avecPlus = false): string {
  if (quantite < 0) return `−${String(Math.abs(quantite))}`
  return avecPlus && quantite > 0 ? `+${String(quantite)}` : String(quantite)
}

/** Le détail d'un mouvement, sous son badge de type : « BL 2231 », « Casse ». */
export function detailMouvement(mouvement: MouvementStockResume, t: TFunction): string {
  if (mouvement.reference !== undefined) return mouvement.reference
  // La note d'origine d'une vente, d'un retour ou d'une perte après annulation : « n°42, T4 ».
  const parties = [
    ...(mouvement.motif === undefined ? [] : [t(`stock.motifs.${mouvement.motif}`)]),
    ...(mouvement.detail === undefined ? [] : [mouvement.detail]),
  ]
  return parties.join(', ')
}

/** « Réception, BL 2231 », « Perte, casse », « Inventaire (−2) », « Premier comptage ». */
export function libelleMouvement(mouvement: MouvementStockResume, t: TFunction): string {
  const type = t(`stock.mouvements.${mouvement.type}`)
  if (mouvement.reference !== undefined) return `${type}, ${mouvement.reference}`
  if (mouvement.type === 'INVENTAIRE')
    return `${type} (${quantiteSignee(mouvement.quantite, true)})`
  const detail = detailMouvement(mouvement, t)
  return detail === ''
    ? type
    : `${type}, ${mouvement.motif === undefined ? detail : detail.charAt(0).toLowerCase() + detail.slice(1)}`
}
