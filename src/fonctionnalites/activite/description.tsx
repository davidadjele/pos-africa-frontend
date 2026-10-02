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

/** Ce que chaque détail utilise : la traduction, les montants dans la devise, l'heure locale, les établissements. */
interface Outils {
  t: TFunction
  montant: (valeur: unknown) => string
  contexte: ContexteActivite
}

type Detail = (evenement: EvenementActivite, outils: Outils) => string | null

/** Ce qui a changé, en clair : « 1 000 F → 1 200 F », « 18 % → 19 % », les rôles avant et après. */
export function detailActivite(
  evenement: EvenementActivite,
  t: TFunction,
  contexte: ContexteActivite,
): string | null {
  const montant = (valeur: unknown) =>
    typeof valeur === 'number'
      ? formaterMontant({ unitesMineures: valeur, devise: contexte.devise }, { forme: 'courte' })
      : t('activite.prixDeBase')
  return DETAILS[evenement.type]?.(evenement, { t, montant, contexte }) ?? null
}

const avantApres = (evenement: EvenementActivite) =>
  evenement.details as { avant?: unknown; apres?: unknown }

const prix: Detail = (evenement, { montant }) => {
  const { avant, apres } = avantApres(evenement)
  return `${montant(avant)} → ${montant(apres)}`
}

const tauxTaxe: Detail = (evenement) => {
  const { avant, apres } = avantApres(evenement)
  if (typeof avant !== 'number' || typeof apres !== 'number') return null
  return `${formaterTaux(avant)} → ${formaterTaux(apres)}`
}

const taxeCreee: Detail = (evenement, { t }) => {
  const taux = evenement.details.taux
  return typeof taux === 'number' ? t('activite.tauxInitial', { taux: formaterTaux(taux) }) : null
}

const taxeProduit: Detail = (evenement, { t }) => {
  const { avant, apres } = avantApres(evenement)
  const nom = (valeur: unknown) => (typeof valeur === 'string' ? valeur : t('activite.aucune'))
  return `${nom(avant)} → ${nom(apres)}`
}

const rupture: Detail = (evenement, { t, contexte }) => {
  const jusqua = evenement.details.jusqua
  if (typeof jusqua !== 'string') return null
  return t('activite.jusqua', { date: formaterDateHeure(jusqua, contexte.fuseauHoraire) })
}

const mouvementCaisse: Detail = (evenement, { t, montant }) => {
  const valeurs = {
    montant: montant(evenement.details.montant),
    motif: texte(evenement.details.motif),
  }
  return avecValidateur(evenement, t, 'activite.mouvement', 'activite.mouvementValide', valeurs)
}

const reception: Detail = (evenement, { t }) => {
  const reference = evenement.details.reference
  return t('activite.reception', {
    quantite: nombre(evenement.details.quantite),
    apres: nombreSigne(evenement.details.apres),
    reference: typeof reference === 'string' ? `, ${reference}` : '',
  })
}

const perte: Detail = (evenement, { t }) =>
  t('activite.perte', {
    quantite: nombre(evenement.details.quantite),
    motif: motifDeStock(evenement.details.motif, t),
    apres: nombreSigne(evenement.details.apres),
  })

const ecartInventaire: Detail = (evenement, { t }) => {
  const { attendu, compte, ecart, motif } = evenement.details
  const signe = typeof ecart === 'number' && ecart > 0 ? '+' : ''
  return t('activite.ecartInventaire', {
    attendu: nombreSigne(attendu),
    compte: nombreSigne(compte),
    ecart: `${signe}${nombreSigne(ecart)}`,
    motif: motifDeStock(motif, t),
  })
}

const venteSansStock: Detail = (evenement, { t }) =>
  t('activite.venteSansStock', {
    quantite: nombre(evenement.details.quantite),
    apres: nombreSigne(evenement.details.apres),
    detail: texte(evenement.details.detail),
  })

const venteArdoise: Detail = (evenement, { t, montant }) => {
  const valeurs = {
    montant: montant(evenement.details.montant),
    note: texte(evenement.details.note),
    solde: montant(evenement.details.solde),
    plafond: montant(evenement.details.plafond),
    depassement: montant(evenement.details.depassement),
  }
  return evenement.type === 'VENTE_ARDOISE'
    ? avecValidateur(evenement, t, 'activite.venteArdoise', 'activite.venteArdoiseValidee', valeurs)
    : avecValidateur(
        evenement,
        t,
        'activite.depassementArdoise',
        'activite.depassementArdoiseValide',
        valeurs,
      )
}

const plafondArdoise: Detail = (evenement, { t, montant }) => {
  const { avant, apres } = avantApres(evenement)
  const plafond = (valeur: unknown) =>
    typeof valeur === 'number' ? montant(valeur) : t('activite.sansPlafond')
  return t('activite.plafondArdoise', { avant: plafond(avant), apres: plafond(apres) })
}

const politiqueStock: Detail = (evenement, { t }) => {
  const politique = (valeur: unknown) => t(`activite.politiques.${texte(valeur) || 'ENTREPRISE'}`)
  return t('activite.politiqueStock', {
    avant: politique(evenement.details.avant),
    apres: politique(evenement.details.apres),
  })
}

const remboursement: Detail = (evenement, { t, montant }) => {
  const { mode, motif, detail } = evenement.details
  const valeurs = {
    montant: montant(evenement.details.montant),
    mode: t(`encaissement.modesEn.${texte(mode) || 'ESPECES'}`),
    ou: ou(evenement, t),
    motif: motifLisible(motif, detail, 'remboursement.motifs', t),
  }
  return avecValidateur(
    evenement,
    t,
    'activite.remboursement',
    'activite.remboursementValide',
    valeurs,
  )
}

const ouvertureEcart: Detail = (evenement, { t, montant }) => {
  const { attendu, fond, ecart, explication } = evenement.details
  return t('activite.ouvertureEcart', {
    attendu: montant(attendu),
    compte: montant(fond),
    ecart: ecartSigne(ecart, montant),
    explication: texte(explication),
  })
}

const remiseRetiree: Detail = (evenement, { t, montant }) =>
  t('activite.remiseRetiree', { montant: montant(evenement.details.montant), ou: ou(evenement, t) })

const transfert: Detail = (evenement, { t }) =>
  t('activite.transfert', {
    de: texte(evenement.details.de),
    vers: texte(evenement.details.vers),
    numero: numero(evenement, t),
  })

const serveurChange: Detail = (evenement, { t }) =>
  t('activite.serveurChange', {
    avant: texte(evenement.details.avant),
    apres: texte(evenement.details.apres),
    numero: numero(evenement, t),
  })

const rolesModifies: Detail = (evenement, { t, contexte }) => {
  const { avant, apres } = avantApres(evenement)
  return t('activite.roles', {
    avant: roles(avant, t, contexte.etablissements),
    apres: roles(apres, t, contexte.etablissements),
  })
}

/** Les types sans détail (désactivations, réactivations…) n'ont qu'une phrase. */
const DETAILS: Partial<Record<EvenementActivite['type'], Detail>> = {
  PRIX_MODIFIE: prix,
  PRIX_ETABLISSEMENT_MODIFIE: prix,
  TAUX_TAXE_MODIFIE: tauxTaxe,
  TAXE_CREEE: taxeCreee,
  TAXE_PRODUIT_MODIFIEE: taxeProduit,
  RUPTURE_DECLAREE: rupture,
  LIGNE_ANNULEE: (evenement, { t, montant }) => annulation(evenement, t, montant),
  REMISE_APPLIQUEE: (evenement, { t, montant }) => remise(evenement, t, montant),
  ARTICLE_OFFERT: (evenement, { t, montant }) => remise(evenement, t, montant),
  CAISSE_OUVERTE: (evenement, { t, montant }) =>
    t('activite.fond', { montant: montant(evenement.details.fond) }),
  RETRAIT_CAISSE: mouvementCaisse,
  DEPENSE_CAISSE: mouvementCaisse,
  APPORT_CAISSE: mouvementCaisse,
  CLOTURE_CAISSE: (evenement, { t, montant }) => cloture(evenement, t, montant),
  ECART_CAISSE: (evenement, { t, montant }) => cloture(evenement, t, montant),
  RECEPTION_STOCK: reception,
  PERTE_STOCK: perte,
  ECART_INVENTAIRE: ecartInventaire,
  VENTE_SANS_STOCK: venteSansStock,
  VENTE_ARDOISE: venteArdoise,
  PLAFOND_ARDOISE_DEPASSE: venteArdoise,
  PLAFOND_ARDOISE_MODIFIE: plafondArdoise,
  POLITIQUE_STOCK_MODIFIEE: politiqueStock,
  REMBOURSEMENT: remboursement,
  ECART_OUVERTURE_CAISSE: ouvertureEcart,
  REMISE_RETIREE: remiseRetiree,
  NOTE_ANNULEE: (evenement, { t, montant }) => annulationNote(evenement, t, montant),
  TABLE_TRANSFEREE: transfert,
  SERVEUR_CHANGE: serveurChange,
  ROLES_MODIFIES: rolesModifies,
}

/** La phrase simple, ou celle qui nomme le gérant qui a validé. */
function avecValidateur(
  evenement: EvenementActivite,
  t: TFunction,
  cle: string,
  cleValidee: string,
  valeurs: Record<string, string | number>,
): string {
  const validateur = evenement.detailsNoms.validateurId
  return validateur === undefined ? t(cle, valeurs) : t(cleValidee, { ...valeurs, validateur })
}

/** Le motif traduit, ou ce que l'employé a écrit pour « Autre ». */
function motifLisible(motif: unknown, detail: unknown, prefixe: string, t: TFunction): string {
  if (motif === 'AUTRE' && typeof detail === 'string') return detail
  return t(`${prefixe}.${texte(motif) || 'AUTRE'}`)
}

function motifDeStock(motif: unknown, t: TFunction): string {
  return t(`stock.motifs.${texte(motif) || 'AUTRE'}`).toLowerCase()
}

/** « +200 F », « −700 F » ; vide sans écart connu. */
function ecartSigne(ecart: unknown, montant: (valeur: unknown) => string): string {
  if (typeof ecart !== 'number') return ''
  return `${ecart > 0 ? '+' : '−'}${montant(Math.abs(ecart))}`
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
    motif: motifLisible(motif, detail, 'caisse.motifs', t),
  }
  return avecValidateur(evenement, t, 'activite.annulation', 'activite.annulationValidee', valeurs)
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
    motif: motifLisible(motif, detail, 'caisse.motifs', t),
  }
  return avecValidateur(
    evenement,
    t,
    'activite.annulationNote',
    'activite.annulationNoteValidee',
    valeurs,
  )
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
    motif: motifLisible(motif, detail, 'caisse.motifsRemise', t),
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
    ecart: ecartSigne(ecart, montant),
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
