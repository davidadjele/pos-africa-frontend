const CENT_POUR_CENT = 10_000n

/** Remise en points de base sur un montant en unités mineures, arrondie comme le serveur (entiers seulement). */
export function remiseEnPourcentage(montant: number, tauxPointsDeBase: number): number {
  const produit = BigInt(montant) * BigInt(tauxPointsDeBase)
  return Number((produit * 2n + CENT_POUR_CENT) / (CENT_POUR_CENT * 2n))
}

/** Taux réel d'une remise en montant, arrondi au-dessus : il se compare au plafond du rôle comme le serveur. */
export function tauxDe(remise: number, base: number): number {
  if (base <= 0) return 0
  return Number((BigInt(remise) * CENT_POUR_CENT + BigInt(base) - 1n) / BigInt(base))
}
