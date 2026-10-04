import type { LigneCarteEtablissement, LigneNote } from '../../partage/api/contrat'

/** Attendu par la cuisine : envoyé, ni prêt ni servi. Une boisson servie au bar n'attend personne. */
export function pasEncorePret(ligne: LigneNote): boolean {
  return (
    ligne.statut === 'ENVOYEE' &&
    ligne.enCuisine &&
    ligne.preteLe === undefined &&
    ligne.servieLe === undefined
  )
}

/**
 * L'envoi part-il en cuisine ? Non si tous les articles à envoyer sont servis au bar : la caisse dit alors
 * « Valider ». Un produit absent de la carte chargée compte comme cuisine, le libellé habituel.
 */
export function envoiVersLaCuisine(
  lignes: readonly LigneNote[],
  carte: readonly LigneCarteEtablissement[] | undefined,
): boolean {
  const categories = new Map(
    (carte ?? []).map((produit) => [produit.produitId, produit.categorie.envoyeeEnCuisine]),
  )
  return lignes.some(
    (ligne) => ligne.statut === 'BROUILLON' && categories.get(ligne.produitId) !== false,
  )
}
