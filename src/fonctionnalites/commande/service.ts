import type { LigneNote } from '../../partage/api/contrat'

/** Attendu par la cuisine : envoyé, ni prêt ni servi. Une boisson servie au bar n'attend personne. */
export function pasEncorePret(ligne: LigneNote): boolean {
  return (
    ligne.statut === 'ENVOYEE' &&
    ligne.enCuisine &&
    ligne.preteLe === undefined &&
    ligne.servieLe === undefined
  )
}
