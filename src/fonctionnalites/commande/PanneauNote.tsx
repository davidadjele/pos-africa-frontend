import type { TFunction } from 'i18next'
import { clsx } from 'clsx'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CommandeDetail, DemandeLigne, LigneNote } from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { formaterTaux } from '../../partage/montants/taxes'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { EtatVide } from '../../partage/ui/EtatVide'
import { libelleMotif } from './ChoixMotif'

/** Un article à envoyer qui ne se vend plus : il bloquerait l'envoi. */
export type Rupture = 'EPUISE' | 'RETIRE'

/** « T4, Terrasse » ou « n°43, Comptoir » : où est la note, dans les phrases des dialogues. */
export function ouEstLaNote(note: CommandeDetail, t: TFunction) {
  return note.table === undefined
    ? numeroEtCanal(note, t)
    : `${note.table.nom}, ${note.table.salle}`
}

/** « n°43, Comptoir » : une note sans table se désigne par son numéro du jour et son canal. */
export function numeroEtCanal(note: Pick<CommandeDetail, 'numero' | 'canal'>, t: TFunction) {
  return [t('caisse.note.numero', { numero: note.numero }), t(`caisse.canaux.${note.canal}`)].join(
    ', ',
  )
}

export function PanneauNote({
  note,
  devise,
  fuseauHoraire,
  modifiable,
  ruptures,
  envoiEnCours,
  peutEncaisser,
  peutServir,
  surServir,
  surServirTout,
  versLaCuisine = true,
  surEncaisser,
  actions,
  surRetirerAddition,
  surRevenir,
  surEnvoyer,
  surModifier,
  surOuvrirLigne,
}: Readonly<{
  note: CommandeDetail
  devise: Devise
  fuseauHoraire: string
  modifiable: boolean
  ruptures: ReadonlyMap<string, Rupture>
  envoiEnCours: boolean
  /** Menu des actions sur la note entière, s'il y en a pour cet employé. */
  actions: ReactNode
  surRetirerAddition: () => void
  surRevenir: () => void
  surEnvoyer: (nombre: number) => void
  /** L'employé a le droit d'encaisser (caissier, gérant, propriétaire). */
  peutEncaisser: boolean
  surEncaisser: () => void
  /** Tout employé qui prend des commandes suit le service, même sur une note payée. */
  peutServir: boolean
  surServir: (ligne: LigneNote) => void
  surServirTout: () => void
  /** Rien pour la cuisine : le bouton dit « Valider », pas « en préparation ». */
  versLaCuisine?: boolean
  surModifier: (ligne: LigneNote, demande: DemandeLigne) => void
  surOuvrirLigne: (ligne: LigneNote) => void
}>) {
  const { t } = useTranslation()
  const numero = t('caisse.note.numero', { numero: note.numero })
  const ouverte = t('caisse.note.ouverte', {
    heure: formaterHeure(note.ouverteLe, fuseauHoraire),
    serveur: note.serveur,
  })
  const detail = [
    ...(note.table === undefined ? [] : [numero]),
    ...(note.couverts === undefined ? [] : [t('caisse.plan.couverts', { count: note.couverts })]),
    ...(note.clientNom === undefined ? [] : [t('caisse.note.pour', { nom: note.clientNom })]),
    ouverte,
  ].join(', ')
  const aServir = note.lignes
    .filter((ligne) => ligne.statut === 'ENVOYEE' && ligne.servieLe === undefined)
    .reduce((somme, ligne) => somme + ligne.quantite, 0)
  const aEnvoyer = note.lignes
    .filter((ligne) => ligne.statut === 'BROUILLON')
    .reduce((somme, ligne) => somme + ligne.quantite, 0)
  const total = formaterMontant({ unitesMineures: note.total, devise })
  const courte = (montant: number) =>
    formaterMontant({ unitesMineures: montant, devise }, { forme: 'courte' })

  return (
    <section
      aria-label={t('caisse.note.titre')}
      className="flex min-h-0 flex-1 flex-col rounded-moyen border border-trait bg-surface lg:w-ticket-largeur"
    >
      <div className="flex items-start gap-3 border-b border-trait px-4 py-3.5">
        <Bouton icone={ArrowLeft} className="shrink-0 whitespace-nowrap" onClick={surRevenir}>
          {t('caisse.note.retourPlan')}
        </Bouton>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="m-0 flex items-baseline gap-2">
            <span className="text-titre-ecran text-encre">{note.table?.nom ?? numero}</span>
            <span className="text-corps-fort text-attenue">
              {note.table?.salle ?? t(`caisse.canaux.${note.canal}`)}
            </span>
          </h1>
          {/* « n°42, … » garde sa minuscule ; sans table, la phrase commence par « ouverte » ou « pour ». */}
          <span
            className={clsx(
              'text-legende text-attenue',
              note.table === undefined && 'first-letter:uppercase',
            )}
          >
            {detail}
          </span>
        </div>
        <span className="ml-auto shrink-0">{actions}</span>
      </div>
      {peutServir && aServir > 0 && (
        <div className="flex items-center gap-3 border-b border-trait bg-alerte-fond px-4 py-2.5 text-libelle text-encre">
          <span className="flex-1 font-semibold">
            {t('caisse.service.aServir', { count: aServir })}
          </span>
          <Bouton className="shrink-0" onClick={surServirTout}>
            {t(note.table === undefined ? 'caisse.service.remettre' : 'caisse.service.toutServi')}
          </Bouton>
        </div>
      )}
      {note.totalPaye > 0 && (
        <p className="m-0 border-b border-trait bg-succes-fond px-4 py-2.5 text-libelle text-encre">
          {t('caisse.note.entamee', { paye: courte(note.totalPaye) })}
        </p>
      )}
      {note.additionDemandeeLe !== undefined && (
        <div className="flex items-center gap-2 border-b border-trait bg-info-fond px-4 py-2.5 text-libelle text-encre">
          <span className="flex-1">
            {t('caisse.note.addition.bandeau', {
              heure: formaterHeure(note.additionDemandeeLe, fuseauHoraire),
              nom: note.additionDemandeePar ?? '',
            })}
          </span>
          {modifiable && (
            <Bouton
              aria-label={t('caisse.note.addition.retirer')}
              className="shrink-0"
              onClick={surRetirerAddition}
            >
              {t('caisse.note.addition.retirerCourt')}
            </Bouton>
          )}
        </div>
      )}

      {note.lignes.length === 0 ? (
        <div className="flex-1 p-5">
          <EtatVide titre={t('caisse.note.vide.titre')} phrase={t('caisse.note.vide.phrase')} />
        </div>
      ) : (
        <ul
          aria-label={t('caisse.note.lignes')}
          className="m-0 flex-1 list-none overflow-y-auto px-4 py-0"
        >
          {note.lignes.map((ligne) => (
            <LigneDeNote
              key={ligne.id}
              ligne={ligne}
              serveur={note.serveur}
              devise={devise}
              fuseauHoraire={fuseauHoraire}
              modifiable={modifiable}
              rupture={ligne.statut === 'BROUILLON' ? ruptures.get(ligne.produitId) : undefined}
              surModifier={(demande) => {
                surModifier(ligne, demande)
              }}
              surOuvrir={() => {
                surOuvrirLigne(ligne)
              }}
              peutServir={peutServir}
              surServir={() => {
                surServir(ligne)
              }}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5 border-t border-trait px-4 py-3">
        {note.remises > 0 && (
          <>
            <span className="flex justify-between gap-3 text-libelle text-attenue">
              <span>
                {t('caisse.note.sousTotal', {
                  articles: t('caisse.note.articles', { count: note.articles }),
                })}
              </span>
              <span className="chiffres">{courte(note.sousTotal)}</span>
            </span>
            {note.remises - (note.remiseNote?.montant ?? 0) > 0 && (
              <span className="flex justify-between gap-3 text-libelle font-semibold text-info">
                <span>{t('caisse.note.remisesLignes')}</span>
                <span className="chiffres">
                  −{courte(note.remises - (note.remiseNote?.montant ?? 0))}
                </span>
              </span>
            )}
            {note.remiseNote !== undefined && (
              <span className="flex justify-between gap-3 text-libelle font-semibold text-info">
                <span>
                  {t('caisse.note.remiseNote', {
                    remise:
                      note.remiseNote.taux === undefined
                        ? courte(note.remiseNote.montant)
                        : formaterTaux(note.remiseNote.taux),
                    motif: libelleMotif(
                      note.remiseNote.motif,
                      note.remiseNote.detail,
                      t,
                      'caisse.motifsRemise',
                    ),
                  })}
                </span>
                <span className="chiffres shrink-0">−{courte(note.remiseNote.montant)}</span>
              </span>
            )}
          </>
        )}
        <span className="flex flex-wrap justify-between gap-x-3 text-libelle text-attenue">
          <span>{note.remises > 0 ? '' : t('caisse.note.articles', { count: note.articles })}</span>
          {note.taxes.map((taxe) => (
            <span key={taxe.nom}>
              {t('caisse.note.dont', {
                taxe: `${taxe.nom} ${formaterTaux(taxe.tauxPointsDeBase)}`,
              })}{' '}
              <span className="chiffres">
                {formaterMontant({ unitesMineures: taxe.montant, devise }, { forme: 'courte' })}
              </span>
            </span>
          ))}
        </span>
        <span className="flex items-baseline justify-between">
          <span className="text-corps-fort text-encre">{t('caisse.note.total')}</span>
          <span className="chiffres text-montant-total text-encre">{total}</span>
        </span>
      </div>
      {(modifiable || peutEncaisser || note.totalPaye > 0) && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {/* Une seule action principale : envoyer tant qu'il reste des articles, sinon encaisser. */}
          {modifiable && aEnvoyer > 0 && (
            <Bouton
              variante="principal"
              className="min-h-bouton-encaisser text-titre-carte"
              enCours={envoiEnCours}
              onClick={() => {
                surEnvoyer(aEnvoyer)
              }}
            >
              {t(versLaCuisine ? 'caisse.note.envoyer' : 'caisse.note.valider', {
                count: aEnvoyer,
              })}
            </Bouton>
          )}
          <Bouton
            variante={modifiable && aEnvoyer > 0 ? 'secondaire' : 'principal'}
            disabled={!peutEncaisser || note.total - note.totalPaye <= 0}
            className={clsx(
              'justify-between',
              modifiable && aEnvoyer > 0
                ? 'min-h-cible-caisse'
                : 'min-h-bouton-encaisser text-titre-carte',
            )}
            onClick={surEncaisser}
          >
            <span>
              {t(note.totalPaye > 0 ? 'caisse.note.encaisserReste' : 'caisse.note.encaisser')}
            </span>
            <span className="chiffres">{courte(note.total - note.totalPaye)}</span>
          </Bouton>
          {!peutEncaisser && (
            <p className="m-0 text-legende text-attenue">{t('caisse.note.parCaissier')}</p>
          )}
        </div>
      )}
    </section>
  )
}

/** « Annulé à 21:05, Non servie. Validé par Afi M. », « À envoyer », « Envoyé à 20:40, servi à 20:52 ». */
function statutDeLigne(ligne: LigneNote, serveur: string, fuseauHoraire: string, t: TFunction) {
  const heure = (instant: string | undefined) =>
    instant === undefined ? '' : formaterHeure(instant, fuseauHoraire)
  if (ligne.statut === 'ANNULEE') {
    const motif =
      ligne.motifAnnulation === 'AUTRE' && ligne.detailAnnulation !== undefined
        ? ligne.detailAnnulation
        : t(`caisse.motifs.${ligne.motifAnnulation ?? 'AUTRE'}`)
    const validation =
      ligne.annulationValideePar === undefined
        ? []
        : [t('caisse.note.valideePar', { nom: ligne.annulationValideePar })]
    return [
      t('caisse.note.annuleeA', { heure: heure(ligne.annuleeLe), motif }),
      ...validation,
    ].join(' ')
  }
  // Qui a pris quoi : utile quand un collègue ajoute sur la note d'un autre.
  const auteur =
    ligne.ajouteePar !== '' && ligne.ajouteePar !== serveur
      ? `, ${t('caisse.note.ajoutePar', { nom: ligne.ajouteePar })}`
      : ''
  if (ligne.statut === 'BROUILLON') return `${t('caisse.note.aEnvoyer')}${auteur}`
  const service =
    ligne.servieLe === undefined
      ? []
      : [t('caisse.service.serviA', { heure: heure(ligne.servieLe) })]
  return (
    [t('caisse.note.envoyeA', { heure: heure(ligne.envoyeeLe) }), ...service].join(', ') + auteur
  )
}

/** « Offert », « −10 % » ou « −500 F ». */
function badgeDeRemise(ligne: LigneNote, devise: Devise, t: TFunction) {
  if (ligne.offert) return t('caisse.note.offert')
  const remise =
    ligne.tauxRemise === undefined
      ? formaterMontant({ unitesMineures: ligne.remise, devise }, { forme: 'courte' })
      : formaterTaux(ligne.tauxRemise)
  return `−${remise}`
}

function LigneDeNote({
  ligne,
  serveur,
  devise,
  fuseauHoraire,
  modifiable,
  rupture,
  peutServir,
  surModifier,
  surOuvrir,
  surServir,
}: Readonly<{
  ligne: LigneNote
  serveur: string
  devise: Devise
  fuseauHoraire: string
  modifiable: boolean
  rupture: Rupture | undefined
  peutServir: boolean
  surModifier: (demande: DemandeLigne) => void
  surOuvrir: () => void
  surServir: () => void
}>) {
  const { t } = useTranslation()
  const produit = ligne.nomProduit
  const note = ligne.note === undefined ? {} : { note: ligne.note }
  const annulee = ligne.statut === 'ANNULEE'
  const brouillon = ligne.statut === 'BROUILLON'
  const statut = statutDeLigne(ligne, serveur, fuseauHoraire, t)
  const barre = annulee && 'text-attenue line-through'
  const motifRemise = libelleMotif(
    ligne.motifRemise ?? 'AUTRE',
    ligne.detailRemise,
    t,
    'caisse.motifsRemise',
  )
  const badgeRemise = badgeDeRemise(ligne, devise, t)
  const motifEtValidation =
    ligne.remiseValideePar === undefined
      ? motifRemise
      : t('caisse.note.motifValide', { motif: motifRemise, nom: ligne.remiseValideePar })
  const description = (
    <>
      <span className="flex items-center gap-1.5">
        <span className={clsx('text-corps-fort text-encre', barre)}>{produit}</span>
        {rupture !== undefined && (
          <BadgeStatut ton="danger">
            {t(rupture === 'EPUISE' ? 'caisse.note.badgeEpuise' : 'caisse.note.badgeRetire')}
          </BadgeStatut>
        )}
      </span>
      {ligne.note !== undefined && (
        <span className="text-legende text-encre">« {ligne.note} »</span>
      )}
      <span
        className={
          brouillon ? 'text-legende font-semibold text-encre' : 'text-legende text-attenue'
        }
      >
        {statut}
      </span>
      {!annulee && (ligne.offert || ligne.remise > 0) && (
        <span className="flex flex-wrap items-center gap-1.5">
          <BadgeStatut ton="info">{badgeRemise}</BadgeStatut>
          <span className="text-legende text-attenue">{motifEtValidation}</span>
        </span>
      )}
    </>
  )
  return (
    <li className="grid min-h-16 grid-cols-[40px_minmax(0,1fr)_auto_96px] items-center gap-2 border-b border-trait py-2 last:border-b-0">
      <span
        className={clsx(
          'chiffres flex size-9 items-center justify-center rounded-normal bg-accent-doux text-montant-ligne text-encre',
          barre,
        )}
      >
        {ligne.quantite}
        <span className="sr-only">×</span>
      </span>
      {modifiable && !annulee ? (
        <button
          type="button"
          aria-label={t('caisse.ligne.actions', { produit })}
          onClick={surOuvrir}
          className="flex min-h-cible-min flex-col items-start gap-0.5 text-left"
        >
          {description}
        </button>
      ) : (
        <span className="flex flex-col gap-0.5">{description}</span>
      )}
      <span className="flex flex-col items-end">
        {!annulee && ligne.remise > 0 && (
          <span className="chiffres text-legende text-attenue line-through">
            {formaterMontant({ unitesMineures: ligne.montantBrut, devise }, { forme: 'nombre' })}
          </span>
        )}
        <span className={clsx('chiffres text-montant-ligne text-encre', barre)}>
          {formaterMontant({ unitesMineures: ligne.montant, devise }, { forme: 'nombre' })}
        </span>
      </span>
      <span className="flex justify-end gap-1">
        {peutServir && ligne.statut === 'ENVOYEE' && ligne.servieLe === undefined && (
          <Bouton
            aria-label={t('caisse.service.serviPour', { produit })}
            className="px-3"
            onClick={surServir}
          >
            {t('caisse.service.servi')}
          </Bouton>
        )}
        {modifiable && brouillon && (
          <>
            <Bouton
              aria-label={t('caisse.note.uneDeMoins', { produit })}
              className="w-11 px-0"
              onClick={() => {
                surModifier({ quantite: ligne.quantite - 1, ...note })
              }}
            >
              −
            </Bouton>
            <Bouton
              aria-label={t('caisse.note.uneDePlus', { produit })}
              className="w-11 px-0"
              onClick={() => {
                surModifier({ quantite: ligne.quantite + 1, ...note })
              }}
            >
              +
            </Bouton>
          </>
        )}
      </span>
    </li>
  )
}
