import { decimalesDe, type Devise } from './formaterMontant'

/**
 * Montant saisi (« 12 500 », « 12,50 ») en unités mineures de la devise, ou null s'il n'est pas
 * lisible ou plus précis que la devise. Lu sur le texte, sans flottant.
 */
export function lireMontant(saisie: string, devise: Devise): number | null {
  const decimales = decimalesDe(devise)
  const nettoyee = saisie.replace(/[\s  ]/g, '')
  const motif =
    decimales === 0 ? /^(\d+)$/ : new RegExp(`^(\\d+)(?:[.,](\\d{1,${String(decimales)}}))?$`)
  const correspondance = motif.exec(nettoyee)
  if (correspondance === null) return null
  const [, entier = '', fraction = ''] = correspondance
  const valeur = Number(entier + fraction.padEnd(decimales, '0'))
  return Number.isSafeInteger(valeur) ? valeur : null
}
