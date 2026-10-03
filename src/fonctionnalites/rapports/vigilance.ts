import type { RapportVentes } from '../../partage/api/contrat'

export type TonVigilance = 'danger' | 'alerte' | 'info'
export type CleVigilance = 'remboursements' | 'annulations' | 'remises' | 'ardoise'

/** Un point à surveiller : la page le traduit à partir de sa clé et de ses valeurs. */
export interface PointVigilance {
  cle: CleVigilance
  ton: TonVigilance
  valeurs: Record<string, number | string>
}

const RANG: Record<TonVigilance, number> = { danger: 0, alerte: 1, info: 2 }
/** Une hausse des remises sous ce seuil (en points de part des ventes) reste du bruit. */
const HAUSSE_REMISES_POINTS = 1

function partDesRemises(remises: number, chiffreAffaires: number): number {
  return chiffreAffaires === 0 ? 0 : (remises / chiffreAffaires) * 100
}

/**
 * Ce qui mérite l'attention dans les ventes de la période, du plus grave au moins grave. Les caisses, le stock et
 * les ardoises à relancer se suivent au tableau de bord.
 */
export function pointsDeVigilance(rapport: RapportVentes): PointVigilance[] {
  const points: PointVigilance[] = []
  const { annulations, indicateurs, precedent, ardoise } = rapport
  if (annulations.articles > 0) {
    points.push({
      cle: 'annulations',
      ton: 'alerte',
      valeurs: {
        articles: annulations.articles,
        montant: annulations.montant,
        serveur: annulations.serveur ?? '',
        articlesDuServeur: annulations.articlesDuServeur,
      },
    })
  }
  const part = partDesRemises(indicateurs.remises, indicateurs.chiffreAffaires)
  const partAvant = partDesRemises(precedent.remises, precedent.chiffreAffaires)
  if (part - partAvant > HAUSSE_REMISES_POINTS) {
    points.push({ cle: 'remises', ton: 'alerte', valeurs: { part, partAvant } })
  }
  if (indicateurs.notesRemboursees > 0) {
    points.push({
      cle: 'remboursements',
      ton: 'danger',
      valeurs: { montant: indicateurs.remboursements, notes: indicateurs.notesRemboursees },
    })
  }
  if (ardoise.montant > 0) {
    points.push({
      cle: 'ardoise',
      ton: 'info',
      valeurs: { montant: ardoise.montant, clients: ardoise.clients },
    })
  }
  return points.sort((a, b) => RANG[a.ton] - RANG[b.ton])
}
