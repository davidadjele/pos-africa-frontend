import type { TFunction } from 'i18next'
import type { EntreeActivitePlateforme } from '../../partage/api/contrat'
import type { TonStatut } from '../../partage/ui/BadgeStatut'
import { RAISONS } from './DialoguesEntreprise'

export const TYPES_ACTIVITE = [
  'ENTREPRISE_CREEE',
  'ENTREPRISE_MODIFIEE',
  'ENTREPRISE_SUSPENDUE',
  'ENTREPRISE_REACTIVEE',
  'MOT_DE_PASSE_REINITIALISE',
  'MEMBRE_AJOUTE',
  'MEMBRE_DESACTIVE',
  'MEMBRE_REACTIVE',
] as const

const TONS: Record<string, TonStatut> = {
  ENTREPRISE_CREEE: 'succes',
  ENTREPRISE_REACTIVEE: 'succes',
  ENTREPRISE_SUSPENDUE: 'danger',
  MEMBRE_DESACTIVE: 'danger',
  MOT_DE_PASSE_REINITIALISE: 'alerte',
}

export function tonActivite(type: string): TonStatut {
  return TONS[type] ?? 'neutre'
}

/** Le détail tel que noté par le serveur, avec la raison d'une suspension traduite (« IMPAYE : … »). */
export function detailActivite(entree: EntreeActivitePlateforme, t: TFunction): string {
  const detail = entree.detail ?? ''
  // À la création, le détail répète le nom de l'entreprise, déjà dans sa colonne.
  if (detail === entree.entrepriseNom) return ''
  if (entree.type !== 'ENTREPRISE_SUSPENDUE') return detail
  const [raison = '', ...reste] = detail.split(' : ')
  const connue = RAISONS.find((candidate) => candidate === raison)
  if (connue === undefined) return detail
  return [t(`plateforme.fiche.suspension.raisons.${connue}`), ...reste].join(' : ')
}
