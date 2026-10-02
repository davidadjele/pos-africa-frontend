import { decimalesDe, type Devise } from '../../partage/montants/formaterMontant'

const MARQUE_ORDRE_OCTETS = String.fromCodePoint(0xfeff)

/**
 * Un tableau en CSV pour le comptable : points-virgules et marque d'ordre des octets, pour qu'un tableur réglé en
 * français l'ouvre sans assistant d'import.
 */
export function versCsv(lignes: readonly (readonly (string | number)[])[]): string {
  const champ = (valeur: string | number) => {
    const texte = String(valeur)
    return /[;"\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte
  }
  return `${MARQUE_ORDRE_OCTETS}${lignes.map((ligne) => ligne.map(champ).join(';')).join('\r\n')}\r\n`
}

/** Le montant en unités (« 1284500 », « -12,05 ») : jamais d'arithmétique flottante sur les unités mineures. */
export function montantCsv(unitesMineures: number, devise: Devise): string {
  const decimales = decimalesDe(devise)
  if (decimales === 0) return String(unitesMineures)
  const signe = unitesMineures < 0 ? '-' : ''
  const chiffres = String(Math.abs(unitesMineures)).padStart(decimales + 1, '0')
  return `${signe}${chiffres.slice(0, -decimales)},${chiffres.slice(-decimales)}`
}

/** Le fichier part par le navigateur : aucun appel de plus au serveur. */
export function telechargerCsv(nomFichier: string, contenu: string) {
  const lien = document.createElement('a')
  const adresse = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }))
  lien.href = adresse
  lien.download = nomFichier
  lien.click()
  URL.revokeObjectURL(adresse)
}
