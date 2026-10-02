import type { components } from './schema'

/** Seul corps d'erreur de l'API (ADR backend 0003), tel que décrit par l'OpenAPI. */
export type ReponseErreur = components['schemas']['ReponseErreur']
export type ChampInvalide = components['schemas']['ChampInvalide']

/** Codes que l'interface sait traduire : CodeErreur du backend, plus RESEAU_INDISPONIBLE côté client. */
export const CODES_ERREUR = [
  'REQUETE_INVALIDE',
  'NON_AUTHENTIFIE',
  'IDENTIFIANTS_INVALIDES',
  'SESSION_EXPIREE',
  'ACCES_REFUSE',
  'AUCUNE_ENTREPRISE',
  'ENTREPRISE_SUSPENDUE',
  'RESSOURCE_INTROUVABLE',
  'METHODE_NON_AUTORISEE',
  'CONFLIT_MODIFICATION',
  'CODE_APPAIRAGE_INVALIDE',
  'PIN_INCORRECT',
  'PROFIL_BLOQUE',
  'VALIDATION_REQUISE',
  'TAXE_EN_USAGE',
  'CATEGORIE_EN_USAGE',
  'SALLE_EN_USAGE',
  'TABLE_OCCUPEE',
  'TABLE_INDISPONIBLE',
  'PRODUIT_EPUISE',
  'PRODUIT_INDISPONIBLE',
  'NOTE_NON_VIDE',
  'NOTE_ENTAMEE',
  'CAISSE_FERMEE',
  'REMBOURSEMENT_HORS_JOURNEE',
  'VALIDATION_INVALIDE',
  'CODE_ETABLISSEMENT_DEJA_UTILISE',
  'STOCK_INSUFFISANT',
  'PLAFOND_ARDOISE_DEPASSE',
  'ARDOISE_NON_SOLDEE',
  'COMPTE_VERROUILLE',
  'TROP_DE_TENTATIVES',
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
