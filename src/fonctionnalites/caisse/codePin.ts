/**
 * Même règle que le backend (CodePin) : chiffres tous identiques (1111), suite croissante (1234) ou
 * décroissante (4321). Vérifiée ici pour le dire avant l'envoi, dans la langue de la tablette.
 */
export function codePinTropSimple(code: string): boolean {
  let identiques = true
  let croissant = true
  let decroissant = true
  for (let rang = 1; rang < code.length; rang++) {
    const ecart = code.charCodeAt(rang) - code.charCodeAt(rang - 1)
    identiques &&= ecart === 0
    croissant &&= ecart === 1
    decroissant &&= ecart === -1
  }
  return identiques || croissant || decroissant
}
