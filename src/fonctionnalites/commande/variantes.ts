import type { LigneCarteEtablissement } from '../../partage/api/contrat'

/** Les variantes d'un produit dans la carte de la caisse, de la moins chère à la plus chère. */
export function variantesDe(
  carte: readonly LigneCarteEtablissement[],
  parentId: string,
): LigneCarteEtablissement[] {
  return carte.filter((ligne) => ligne.parentId === parentId).sort((a, b) => a.prix - b.prix)
}
