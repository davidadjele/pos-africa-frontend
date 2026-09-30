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
    ? `${t('caisse.note.numero', { numero: note.numero })}, ${t(`caisse.canaux.${note.canal}`)}`
    : `${note.table.nom}, ${note.table.salle}`
}

export function PanneauNote({
  note,
  devise,
  fuseauHoraire,
  modifiable,
  ruptures,
  envoiEnCours,
  actions,
  surRetirerAddition,
  surRetirerRemiseNote,
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
  surRetirerRemiseNote: () => void
  surRevenir: () => void
  surEnvoyer: (nombre: number) => void
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
  const aEnvoyer = note.lignes
    .filter((ligne) => ligne.statut === 'BROUILLON')
    .reduce((somme, ligne) => somme + ligne.quantite, 0)
  const total = formaterMontant({ unitesMineures: note.total, devise })
  const courte = (montant: number) =>
    formaterMontant({ unitesMineures: montant, devise }, { forme: 'courte' })

  return (
    <section
      aria-label={t('caisse.note.titre')}
      className="flex shrink-0 flex-col rounded-moyen border border-trait bg-surface lg:w-ticket-largeur"
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
      {note.additionDemandeeLe !== undefined && (
        <div className="flex items-center gap-2 border-b border-trait bg-info-fond px-4 py-2.5 text-libelle text-encre">
          <span className="flex-1">
            {t('caisse.note.addition.bandeau', {
              heure: formaterHeure(note.additionDemandeeLe, fuseauHoraire),
              nom: note.additionDemandeePar ?? '',
            })}
          </span>
          {modifiable && (
            <Bouton className="shrink-0" onClick={surRetirerAddition}>
              {t('caisse.note.addition.retirer')}
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
              <span className="flex items-center justify-between gap-3 text-libelle font-semibold text-info">
                <span>
                  {[
                    t('caisse.note.remiseNote', {
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
                    }),
                    ...(note.remiseNote.valideePar === undefined
                      ? []
                      : [t('caisse.note.valideePar', { nom: note.remiseNote.valideePar })]),
                  ].join('. ')}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {modifiable && (
                    <Bouton onClick={surRetirerRemiseNote}>
                      {t('caisse.note.retirerRemiseNote')}
                    </Bouton>
                  )}
                  <span className="chiffres">−{courte(note.remiseNote.montant)}</span>
                </span>
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
      {modifiable && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {aEnvoyer > 0 && (
            <Bouton
              className="min-h-cible-caisse border-accent text-accent-lisible"
              enCours={envoiEnCours}
              onClick={() => {
                surEnvoyer(aEnvoyer)
              }}
            >
              {t('caisse.note.envoyer', { count: aEnvoyer })}
            </Bouton>
          )}
          <Bouton
            variante="principal"
            disabled
            className="min-h-bouton-encaisser justify-between text-titre-carte"
          >
            <span>{t('caisse.note.encaisser')}</span>
            <span className="chiffres">
              {formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' })}
            </span>
          </Bouton>
        </div>
      )}
    </section>
  )
}

function LigneDeNote({
  ligne,
  serveur,
  devise,
  fuseauHoraire,
  modifiable,
  rupture,
  surModifier,
  surOuvrir,
}: Readonly<{
  ligne: LigneNote
  serveur: string
  devise: Devise
  fuseauHoraire: string
  modifiable: boolean
  rupture: Rupture | undefined
  surModifier: (demande: DemandeLigne) => void
  surOuvrir: () => void
}>) {
  const { t } = useTranslation()
  const produit = ligne.nomProduit
  const note = ligne.note === undefined ? {} : { note: ligne.note }
  const annulee = ligne.statut === 'ANNULEE'
  const brouillon = ligne.statut === 'BROUILLON'
  const heure = (instant: string | undefined) =>
    instant === undefined ? '' : formaterHeure(instant, fuseauHoraire)
  // Qui a pris quoi : utile quand un collègue ajoute sur la note d'un autre.
  const auteur =
    ligne.ajouteePar !== '' && ligne.ajouteePar !== serveur
      ? `, ${t('caisse.note.ajoutePar', { nom: ligne.ajouteePar })}`
      : ''
  const statut = annulee
    ? [
        t('caisse.note.annuleeA', {
          heure: heure(ligne.annuleeLe),
          motif:
            ligne.motifAnnulation === 'AUTRE' && ligne.detailAnnulation !== undefined
              ? ligne.detailAnnulation
              : t(`caisse.motifs.${ligne.motifAnnulation ?? 'AUTRE'}`),
        }),
        ...(ligne.annulationValideePar === undefined
          ? []
          : [t('caisse.note.valideePar', { nom: ligne.annulationValideePar })]),
      ].join(' ')
    : brouillon
      ? `${t('caisse.note.aEnvoyer')}${auteur}`
      : `${t('caisse.note.envoyeA', { heure: heure(ligne.envoyeeLe) })}${auteur}`
  const barre = annulee && 'text-attenue line-through'
  const motifRemise = libelleMotif(
    ligne.motifRemise ?? 'AUTRE',
    ligne.detailRemise,
    t,
    'caisse.motifsRemise',
  )
  const remise = [
    ligne.offert
      ? t('caisse.note.offertLigne', { motif: motifRemise })
      : t('caisse.note.remiseLigne', {
          remise:
            ligne.tauxRemise === undefined
              ? formaterMontant({ unitesMineures: ligne.remise, devise }, { forme: 'courte' })
              : formaterTaux(ligne.tauxRemise),
          motif: motifRemise,
        }),
    ...(ligne.remiseValideePar === undefined
      ? []
      : [t('caisse.note.valideePar', { nom: ligne.remiseValideePar })]),
  ].join('. ')
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
        <span className="text-legende font-semibold text-info">{remise}</span>
      )}
    </>
  )
  return (
    <li className="grid min-h-15 grid-cols-[40px_minmax(0,1fr)_auto_96px] items-center gap-2 border-b border-trait py-1.5 last:border-b-0">
      <span className={clsx('chiffres text-montant-ligne text-encre', barre)}>
        {ligne.quantite}×
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
