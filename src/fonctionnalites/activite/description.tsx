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
    case 'ROLES_MODIFIES':
      return t('activite.roles', {
        avant: roles(avant, t, etablissements),
        apres: roles(apres, t, etablissements),
      })
    default:
      return null
  }
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
