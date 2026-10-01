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
  'CLIENT_CREDIT',
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
    case 'CAISSE_OUVERTE':
      return t('activite.fond', { montant: montant(evenement.details.fond) })
    case 'RETRAIT_CAISSE':
    case 'DEPENSE_CAISSE':
    case 'APPORT_CAISSE': {
      const valeurs = {
        montant: montant(evenement.details.montant),
        motif: texte(evenement.details.motif),
      }
      const validateur = evenement.detailsNoms.validateurId
      return validateur === undefined
        ? t('activite.mouvement', valeurs)
        : t('activite.mouvementValide', { ...valeurs, validateur })
    }
    case 'CLOTURE_CAISSE':
    case 'ECART_CAISSE':
      return cloture(evenement, t, montant)
    case 'RECEPTION_STOCK': {
      const reference = evenement.details.reference
      return t('activite.reception', {
        quantite: nombre(evenement.details.quantite),
        apres: nombreSigne(evenement.details.apres),
        reference: typeof reference === 'string' ? `, ${reference}` : '',
      })
    }
    case 'PERTE_STOCK':
      return t('activite.perte', {
        quantite: nombre(evenement.details.quantite),
        motif: t(`stock.motifs.${texte(evenement.details.motif) || 'AUTRE'}`).toLowerCase(),
        apres: nombreSigne(evenement.details.apres),
      })
    case 'ECART_INVENTAIRE': {
      const { attendu, compte, ecart, motif } = evenement.details
      const signe = typeof ecart === 'number' && ecart > 0 ? '+' : ''
      return t('activite.ecartInventaire', {
        attendu: nombreSigne(attendu),
        compte: nombreSigne(compte),
        ecart: `${signe}${nombreSigne(ecart)}`,
        motif: t(`stock.motifs.${texte(motif) || 'AUTRE'}`).toLowerCase(),
      })
    }
    case 'VENTE_SANS_STOCK':
      return t('activite.venteSansStock', {
        quantite: nombre(evenement.details.quantite),
        apres: nombreSigne(evenement.details.apres),
        detail: texte(evenement.details.detail),
      })
    case 'VENTE_ARDOISE':
    case 'PLAFOND_ARDOISE_DEPASSE': {
      const { plafond, depassement } = evenement.details
      const valeurs = {
        montant: montant(evenement.details.montant),
        note: texte(evenement.details.note),
        solde: montant(evenement.details.solde),
        plafond: montant(plafond),
        depassement: montant(depassement),
      }
      const cle =
        evenement.type === 'VENTE_ARDOISE' ? 'activite.venteArdoise' : 'activite.depassementArdoise'
      const validateur = evenement.detailsNoms.validateurId
      return validateur === undefined
        ? t(cle, valeurs)
        : t(
            evenement.type === 'VENTE_ARDOISE'
              ? 'activite.venteArdoiseValidee'
              : 'activite.depassementArdoiseValide',
            {
              ...valeurs,
              validateur,
            },
          )
    }
    case 'PLAFOND_ARDOISE_MODIFIE': {
      const plafond = (valeur: unknown) =>
        typeof valeur === 'number' ? montant(valeur) : t('activite.sansPlafond')
      return t('activite.plafondArdoise', { avant: plafond(avant), apres: plafond(apres) })
    }
    case 'POLITIQUE_STOCK_MODIFIEE':
      return t('activite.politiqueStock', {
        avant: t(`activite.politiques.${texte(evenement.details.avant) || 'ENTREPRISE'}`),
        apres: t(`activite.politiques.${texte(evenement.details.apres) || 'ENTREPRISE'}`),
      })
    case 'REMBOURSEMENT': {
      const { mode, motif, detail } = evenement.details
      const valeurs = {
        montant: montant(evenement.details.montant),
        mode: t(`encaissement.modesEn.${texte(mode) || 'ESPECES'}`),
        ou: ou(evenement, t),
        motif:
          motif === 'AUTRE' && typeof detail === 'string'
            ? detail
            : t(`remboursement.motifs.${texte(motif) || 'AUTRE'}`),
      }
      const validateur = evenement.detailsNoms.validateurId
      return validateur === undefined
        ? t('activite.remboursement', valeurs)
        : t('activite.remboursementValide', { ...valeurs, validateur })
    }
    case 'ECART_OUVERTURE_CAISSE': {
      const { attendu, fond, ecart, explication } = evenement.details
      return t('activite.ouvertureEcart', {
        attendu: montant(attendu),
        compte: montant(fond),
        ecart:
          typeof ecart === 'number' ? `${ecart > 0 ? '+' : '−'}${montant(Math.abs(ecart))}` : '',
        explication: texte(explication),
      })
    }
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

/** « Attendu 15 700 F, compté 15 000 F, écart −700 F : Monnaie rendue en trop » */
function cloture(
  evenement: EvenementActivite,
  t: TFunction,
  montant: (valeur: unknown) => string,
): string {
  const { attendu, compte, ecart, explication } = evenement.details
  const valeurs = { attendu: montant(attendu), compte: montant(compte) }
  if (typeof ecart !== 'number' || ecart === 0) return t('activite.cloture', valeurs)
  return t('activite.clotureEcart', {
    ...valeurs,
    ecart: `${ecart > 0 ? '+' : '−'}${montant(Math.abs(ecart))}`,
    explication: texte(explication),
  })
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

function nombre(valeur: unknown): string {
  return typeof valeur === 'number' ? String(Math.abs(valeur)) : ''
}

/** « −3 » avec le signe moins typographique, comme les montants. */
function nombreSigne(valeur: unknown): string {
  if (typeof valeur !== 'number') return ''
  return valeur < 0 ? `−${String(Math.abs(valeur))}` : String(valeur)
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
