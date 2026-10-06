import type { GroupeCarte } from '../../partage/api/contrat'

function groupeDe(groupes: readonly GroupeCarte[], choixId: string): GroupeCarte | undefined {
  return groupes.find((groupe) => groupe.choix.some((choix) => choix.id === choixId))
}

/**
 * Touche un choix : il remplace l'autre choix d'un groupe à choix unique, s'ajoute ou se retire dans un groupe à
 * choix multiple, sans dépasser le maximum. Un choix épuisé ne se prend pas.
 */
export function basculer(
  groupes: readonly GroupeCarte[],
  choisis: readonly string[],
  choixId: string,
): string[] {
  const groupe = groupeDe(groupes, choixId)
  const choix = groupe?.choix.find((un) => un.id === choixId)
  if (groupe === undefined || choix === undefined) return [...choisis]
  if (choisis.includes(choixId)) return choisis.filter((id) => id !== choixId)
  if (choix.epuise) return [...choisis]
  const duGroupe = new Set(groupe.choix.map((un) => un.id))
  if (!groupe.choixMultiple) return [...choisis.filter((id) => !duGroupe.has(id)), choixId]
  const dejaDansLeGroupe = choisis.filter((id) => duGroupe.has(id)).length
  if (groupe.maximum !== undefined && dejaDansLeGroupe >= groupe.maximum) return [...choisis]
  return [...choisis, choixId]
}

/** Les groupes obligatoires sans choix : « Ajouter » attend qu'ils soient remplis. */
export function groupesManquants(
  groupes: readonly GroupeCarte[],
  choisis: readonly string[],
): GroupeCarte[] {
  return groupes.filter(
    (groupe) => groupe.obligatoire && !groupe.choix.some((choix) => choisis.includes(choix.id)),
  )
}

/** Le prix d'une unité, suppléments compris, en unités mineures. */
export function prixAvecChoix(
  prix: number,
  groupes: readonly GroupeCarte[],
  choisis: readonly string[],
): number {
  return groupes
    .flatMap((groupe) => groupe.choix)
    .filter((choix) => choisis.includes(choix.id))
    .reduce((total, choix) => total + choix.supplement, prix)
}

/** Les choix dans l'ordre de la carte : c'est ainsi que le serveur les fige et compare deux lignes. */
export function choixDansLOrdre(
  groupes: readonly GroupeCarte[],
  choisis: readonly string[],
): string[] {
  return groupes
    .flatMap((groupe) => groupe.choix)
    .map((choix) => choix.id)
    .filter((id) => choisis.includes(id))
}
