import type { TFunction } from 'i18next'
import type { EcritureArdoise, TypeEcriture } from '../../partage/api/contrat'
import type { TonStatut } from '../../partage/ui/BadgeStatut'

const JOUR = 86_400_000

/** Au-delà, une dette est « à relancer » : le même seuil que le serveur. */
export const JOURS_RELANCE = 30

/** Jours entiers écoulés depuis une date : 0 le jour même. */
export function joursDepuis(iso: string, maintenant = Date.now()): number {
  return Math.max(0, Math.floor((maintenant - new Date(iso).getTime()) / JOUR))
}

export const TONS_ECRITURE: Record<TypeEcriture, TonStatut> = {
  VENTE_A_CREDIT: 'neutre',
  REGLEMENT: 'succes',
  CORRECTION: 'info',
}

/** « Vente à crédit, n°42, T4 », « Règlement, espèces ». */
export function libelleEcriture(ecriture: EcritureArdoise, t: TFunction): string {
  const type = t(`ardoise.ecritures.${ecriture.type}`)
  return ecriture.detail === undefined ? type : `${type}, ${ecriture.detail}`
}

/** « Yawa T. », ou « Yawa T., validé par Afi M. » quand un gérant a validé. */
export function auteurEcriture(ecriture: EcritureArdoise, t: TFunction): string {
  return ecriture.autorisePar === undefined
    ? ecriture.par
    : t('ardoise.validePar', { par: ecriture.par, validateur: ecriture.autorisePar })
}
