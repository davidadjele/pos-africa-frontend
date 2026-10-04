import type { TonStatut } from '../../partage/ui/BadgeStatut'

/** Seuils de la cuisine : au-delà de 10 minutes un bon traîne, au-delà de 20 il est en retard. */
const ALERTE_MINUTES = 10
const RETARD_MINUTES = 20

const deuxChiffres = (valeur: number) => String(valeur).padStart(2, '0')

/** Temps écoulé depuis l'envoi, en « mm:ss », et sa couleur. */
export function chrono(
  envoyeLe: string,
  maintenant: Date,
): { texte: string; ton: Extract<TonStatut, 'succes' | 'alerte' | 'danger'> } {
  const secondes = Math.max(
    0,
    Math.floor((maintenant.getTime() - new Date(envoyeLe).getTime()) / 1000),
  )
  const minutes = Math.floor(secondes / 60)
  const heures = Math.floor(minutes / 60)
  const texte =
    heures > 0
      ? `${String(heures)}:${deuxChiffres(minutes % 60)}:${deuxChiffres(secondes % 60)}`
      : `${deuxChiffres(minutes)}:${deuxChiffres(secondes % 60)}`
  if (minutes >= RETARD_MINUTES) return { texte, ton: 'danger' }
  return { texte, ton: minutes >= ALERTE_MINUTES ? 'alerte' : 'succes' }
}

/** Colonnes remplies à tour de rôle : pas de trou sous un bon court, l'ordre se lit de gauche à droite. */
export function enColonnes<T>(elements: readonly T[], nombre: number): T[][] {
  const colonnes: T[][] = Array.from({ length: nombre }, () => [])
  elements.forEach((element, rang) => {
    colonnes[rang % nombre]?.push(element)
  })
  return colonnes
}

/** Bons apparus depuis le dernier passage ; rien au premier chargement, pour ne pas sonner à l'ouverture. */
export function nouveauxBons(connus: ReadonlySet<string> | null, ids: readonly string[]): number {
  if (connus === null) return 0
  return ids.filter((id) => !connus.has(id)).length
}
