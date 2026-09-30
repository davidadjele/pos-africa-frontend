import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'
import type { EvenementActivite } from '../../partage/api/contrat'
import { formaterDateHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { formaterTaux } from '../../partage/montants/taxes'

export interface ContexteActivite {
  devise: Devise
  fuseauHoraire: string
  /** Noms des établissements visibles, pour les rôles enregistrés par identifiant. */
  etablissements: ReadonlyMap<string, string>
}

const ACTIONS_VALIDEES = new Set([
  'LIGNE_ANNULER_APRES_ENVOI',
  'TABLE_TRANSFERER',
  'REMISE_APPLIQUER',
  'REMISE_AU_DELA_PLAFOND',
  'ARTICLE_OFFRIR',
  'PAIEMENT_REMBOURSER',
  'CAISSE_MOUVEMENT',
])

/** Phrase de l'action : l'auteur et l'objet en gras, sans jargon. */
export function PhraseActivite({ evenement }: Readonly<{ evenement: EvenementActivite }>) {
  return (
    <Trans
      i18nKey={`activite.types.${evenement.type}`}
      values={valeurs(evenement)}
      components={{ b: <strong /> }}
    />
  )
}

function valeurs(evenement: EvenementActivite): Record<string, string> {
  return {
    auteur: evenement.auteurNom ?? '',
    objet: evenement.objetLibelle,
    etablissement: evenement.etablissementNom ?? '',
    validateur: evenement.detailsNoms.validateurId ?? '',
    action: evenement.objetLibelle,
  }
}

/** Auteur affiché : une action faite depuis l'espace plateforme n'a pas d'auteur dans l'entreprise. */
export function auteurDe(evenement: EvenementActivite, t: TFunction): EvenementActivite {
  const action = ACTIONS_VALIDEES.has(evenement.objetLibelle)
    ? t(`activite.actions.${evenement.objetLibelle}`)
    : t('activite.actions.autre')
  return {
    ...evenement,
    auteurNom: evenement.auteurNom ?? t('activite.equipeTonti'),
    ...(evenement.type === 'VALIDATION_GERANT_UTILISEE' ? { objetLibelle: action } : {}),
  }
}

/** Ce qui a changé, en clair : « 1 000 F → 1 200 F », « 18 % → 19 % », les rôles avant et après. */
export function detailActivite(
  evenement: EvenementActivite,
  t: TFunction,
  { devise, fuseauHoraire, etablissements }: ContexteActivite,
): string | null {
  const { avant, apres } = evenement.details as { avant?: unknown; apres?: unknown }
  const montant = (valeur: unknown) =>
    typeof valeur === 'number'
      ? formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })
      : t('activite.prixDeBase')
  switch (evenement.type) {
    case 'PRIX_MODIFIE':
    case 'PRIX_ETABLISSEMENT_MODIFIE':
      return `${montant(avant)} → ${montant(apres)}`
    case 'TAUX_TAXE_MODIFIE':
      return typeof avant === 'number' && typeof apres === 'number'
        ? `${formaterTaux(avant)} → ${formaterTaux(apres)}`
        : null
    case 'TAXE_CREEE': {
      const taux = evenement.details.taux
      return typeof taux === 'number'
        ? t('activite.tauxInitial', { taux: formaterTaux(taux) })
        : null
    }
    case 'TAXE_PRODUIT_MODIFIEE':
      return `${typeof avant === 'string' ? avant : t('activite.aucune')} → ${
        typeof apres === 'string' ? apres : t('activite.aucune')
      }`
    case 'RUPTURE_DECLAREE': {
      const jusqua = evenement.details.jusqua
      return typeof jusqua === 'string'
        ? t('activite.jusqua', { date: formaterDateHeure(jusqua, fuseauHoraire) })
        : null
    }
    case 'LIGNE_ANNULEE':
      return annulation(evenement, t, montant)
    case 'REMISE_APPLIQUEE':
    case 'ARTICLE_OFFERT':
      return remise(evenement, t, montant)
    case 'REMISE_RETIREE':
      return t('activite.remiseRetiree', {
        montant: montant(evenement.details.montant),
        ou: ou(evenement, t),
      })
    case 'NOTE_ANNULEE':
      return annulationNote(evenement, t, montant)
    case 'TABLE_TRANSFEREE':
      return t('activite.transfert', {
        de: texte(evenement.details.de),
        vers: texte(evenement.details.vers),
        numero: numero(evenement, t),
      })
    case 'SERVEUR_CHANGE':
      return t('activite.serveurChange', {
        avant: texte(evenement.details.avant),
        apres: texte(evenement.details.apres),
        numero: numero(evenement, t),
      })
    case 'ROLES_MODIFIES':
      return t('activite.roles', {
        avant: roles(avant, t, etablissements),
        apres: roles(apres, t, etablissements),
      })
    default:
      return null
  }
}

/** « 1 × 3 500 F, T4, n°42. Motif : Non servie. Validé par Afi M. » */
function annulation(
  evenement: EvenementActivite,
  t: TFunction,
  montant: (valeur: unknown) => string,
): string {
  const { quantite, motif, detail, table, numero } = evenement.details
  const ou = [
    ...(typeof table === 'string' ? [table] : []),
    ...(typeof numero === 'number' ? [t('caisse.note.numero', { numero })] : []),
  ].join(', ')
  const valeurs = {
    quantite: typeof quantite === 'number' ? quantite : 0,
    montant: montant(evenement.details.montant),
    ou,
    motif:
      motif === 'AUTRE' && typeof detail === 'string'
        ? detail
        : t(`caisse.motifs.${typeof motif === 'string' ? motif : 'AUTRE'}`),
  }
  const validateur = evenement.detailsNoms.validateurId
  return validateur === undefined
    ? t('activite.annulation', valeurs)
    : t('activite.annulationValidee', { ...valeurs, validateur })
}

/** « 12 600 F, T4, n°42. Motif : Le client est parti. Validé par Afi M. » */
function annulationNote(
  evenement: EvenementActivite,
  t: TFunction,
  montant: (valeur: unknown) => string,
): string {
  const { motif, detail, table } = evenement.details
  const valeurs = {
    montant: montant(evenement.details.montant),
    ou: [...(typeof table === 'string' ? [table] : []), numero(evenement, t)].join(', '),
    motif:
      motif === 'AUTRE' && typeof detail === 'string'
        ? detail
        : t(`caisse.motifs.${typeof motif === 'string' ? motif : 'AUTRE'}`),
  }
  const validateur = evenement.detailsNoms.validateurId
  return validateur === undefined
    ? t('activite.annulationNote', valeurs)
    : t('activite.annulationNoteValidee', { ...valeurs, validateur })
}

/** « −360 F, T4, n°42. Motif : Client fidèle. » ou « 1 × offert (1 200 F), … » */
function remise(
  evenement: EvenementActivite,
  t: TFunction,
  montant: (valeur: unknown) => string,
): string {
  const { motif, detail, quantite } = evenement.details
  const valeurs = {
    montant: montant(evenement.details.montant),
    quantite: typeof quantite === 'number' ? quantite : 1,
    ou: ou(evenement, t),
    motif:
      motif === 'AUTRE' && typeof detail === 'string'
        ? detail
        : t(`caisse.motifsRemise.${typeof motif === 'string' ? motif : 'AUTRE'}`),
  }
  const offert = evenement.type === 'ARTICLE_OFFERT'
  const validateur = evenement.detailsNoms.validateurId
  if (validateur === undefined) {
    return t(offert ? 'activite.offert' : 'activite.remise', valeurs)
  }
  return t(offert ? 'activite.offertValide' : 'activite.remiseValidee', { ...valeurs, validateur })
}

/** « T4, n°42 » ou « n°43 ». */
function ou(evenement: EvenementActivite, t: TFunction): string {
  const table = evenement.details.table
  return [...(typeof table === 'string' ? [table] : []), numero(evenement, t)].join(', ')
}

function numero(evenement: EvenementActivite, t: TFunction): string {
  const valeur = evenement.details.numero
  return typeof valeur === 'number' ? t('caisse.note.numero', { numero: valeur }) : ''
}

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : ''
}

/** « SERVEUR@<établissement> » enregistrés par le serveur, rendus « Serveur à Bè Kpota ». */
function roles(valeur: unknown, t: TFunction, etablissements: ReadonlyMap<string, string>): string {
  if (!Array.isArray(valeur) || valeur.length === 0) return t('activite.aucunRole')
  return valeur
    .filter((role): role is string => typeof role === 'string')
    .map((role) => {
      const [code = '', etablissement = ''] = role.split('@')
      const ou =
        etablissement === 'ENTREPRISE'
          ? t('activite.touteLEntreprise').toLowerCase()
          : (etablissements.get(etablissement) ?? t('activite.autreEtablissement'))
      return t('activite.roleA', { role: t(`roles.${code}`), etablissement: ou })
    })
    .join(', ')
}
