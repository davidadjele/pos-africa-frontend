import type { RapportVentes } from '../../partage/api/contrat'

type Heure = RapportVentes['parHeure'][number]

/** Même bascule que la journée de caisse (JourneeCommerciale) : 4 h ouvre la journée, 3 h la ferme. */
const HEURE_BASCULE = 4

function rang(heure: number): number {
  return (heure - HEURE_BASCULE + 24) % 24
}

/**
 * Les heures dans l'ordre de la journée de caisse, de la première à la dernière vente, les heures creuses à 0 :
 * le creux de l'après-midi se voit au lieu de disparaître.
 */
export function heuresDeLaJournee(heures: readonly Heure[]): Heure[] {
  if (heures.length === 0) return []
  const parRang = new Map(heures.map((heure) => [rang(heure.heure), heure]))
  const rangs = [...parRang.keys()]
  const premier = Math.min(...rangs)
  const dernier = Math.max(...rangs)
  const continues: Heure[] = []
  for (let position = premier; position <= dernier; position++) {
    const heure = (position + HEURE_BASCULE) % 24
    continues.push(
      parRang.get(position) ?? {
        heure,
        notes: 0,
        total: 0,
        especes: 0,
        mobileMoney: 0,
        carte: 0,
        ardoise: 0,
      },
    )
  }
  return continues
}
