const CENT_POUR_CENT = 10_000n
const ESPACE_INSECABLE = '\u00a0'

/**
 * Taxe comprise dans un prix TTC, en unités mineures : prix × taux / (100 % + taux), arrondie à
 * l'unité la plus proche. En entiers (BigInt) : jamais de flottant sur un montant.
 */
export function taxeIncluse(prixTtc: number, tauxPointsDeBase: number): number {
  const numerateur = BigInt(prixTtc) * BigInt(tauxPointsDeBase)
  const denominateur = CENT_POUR_CENT + BigInt(tauxPointsDeBase)
  return Number((numerateur * 2n + denominateur) / (denominateur * 2n))
}

/** 1 800 points de base : « 18 % » ; 1 925 : « 19,25 % ». */
export function formaterTaux(pointsDeBase: number): string {
  const entier = Math.trunc(pointsDeBase / 100)
  const reste = pointsDeBase % 100
  let decimales = String(reste).padStart(2, '0')
  if (reste % 10 === 0) decimales = reste === 0 ? '' : String(reste / 10)
  const virgule = decimales === '' ? '' : ',' + decimales
  return `${String(entier)}${virgule}${ESPACE_INSECABLE}%`
}

/** Pourcentage saisi (« 18 », « 19,25 ») en points de base, ou null s'il n'est pas lisible. */
export function lireTaux(saisie: string): number | null {
  const correspondance = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(saisie.trim())
  if (correspondance === null) return null
  const [, entier = '0', decimales = ''] = correspondance
  const points = Number(entier) * 100 + Number(decimales.padEnd(2, '0'))
  return points <= 10_000 ? points : null
}
