/** Miroir du record backend com.posafrica.commun.web.ReponseErreur : seul corps d'erreur de l'API. */
export interface ReponseErreur {
  statut: number
  /** Code stable (CodeErreur backend, ou RESEAU_INDISPONIBLE côté client) que l'interface traduit. */
  code: string
  message: string
  traceId?: string
  champs?: ChampInvalide[]
  /** Présent uniquement en développement local. */
  details?: Record<string, unknown>
}

export interface ChampInvalide {
  champ: string
  message: string
}

export const CODES_ERREUR = [
  'REQUETE_INVALIDE',
  'NON_AUTHENTIFIE',
  'ACCES_REFUSE',
  'RESSOURCE_INTROUVABLE',
  'METHODE_NON_AUTORISEE',
  'CONFLIT_MODIFICATION',
  'STOCK_INSUFFISANT',
  'ERREUR_INTERNE',
  'RESEAU_INDISPONIBLE',
] as const

export type CodeErreur = (typeof CODES_ERREUR)[number]

export function estReponseErreur(valeur: unknown): valeur is ReponseErreur {
  if (typeof valeur !== 'object' || valeur === null) return false
  const candidat = valeur as Record<string, unknown>
  return (
    typeof candidat.statut === 'number' &&
    typeof candidat.code === 'string' &&
    typeof candidat.message === 'string'
  )
}
