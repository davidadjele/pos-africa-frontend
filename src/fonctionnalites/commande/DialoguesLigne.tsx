import { clsx } from 'clsx'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  DemandeAnnulation,
  DemandeLigne,
  LigneNote,
  MotifAnnulation,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Dialogue } from '../../partage/ui/Dialogue'
import { ChoixQuantite } from './ChoixQuantite'
import { ChoixMotif, useChoixMotif } from './ChoixMotif'

const MOTIFS: MotifAnnulation[] = [
  'ERREUR_SAISIE',
  'CLIENT_CHANGE_AVIS',
  'NON_SERVIE',
  'PLAT_REFUSE',
  'EPUISE_CUISINE',
  'AUTRE',
]

/** Ligne pas encore envoyée : une consigne pour la préparation, ou la retirer de la note. */
export function DialogueLigne({
  ligne,
  surFermer,
  surEnregistrer,
}: Readonly<{
  ligne: LigneNote
  surFermer: () => void
  surEnregistrer: (demande: DemandeLigne) => void
}>) {
  const { t } = useTranslation()
  const [note, setNote] = useState(ligne.note ?? '')
  return (
    <Dialogue
      titre={ligne.nomProduit}
      consequence={t('caisse.note.ligne.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('caisse.note.ligne.enregistrer')}
      surAnnuler={surFermer}
      surConfirmer={() => {
        const nette = note.trim()
        surEnregistrer(
          nette === '' ? { quantite: ligne.quantite } : { quantite: ligne.quantite, note: nette },
        )
      }}
    >
      <ChampSaisie
        libelle={t('caisse.note.ligne.note')}
        aide={t('caisse.note.ligne.aide')}
        maxLength={120}
        value={note}
        onChange={(evenement) => {
          setNote(evenement.target.value)
        }}
      />
      <Bouton
        variante="danger"
        className="self-start"
        onClick={() => {
          surEnregistrer({ quantite: 0 })
        }}
      >
        {t('caisse.note.ligne.retirer')}
      </Bouton>
    </Dialogue>
  )
}

/** Ligne envoyée : combien en annuler et pourquoi. Le motif part dans l'activité du gérant. */
/** Un article jamais servi ou saisi par erreur revient intact ; les autres motifs supposent une perte. */
const REVIENNENT_EN_STOCK = new Set<MotifAnnulation>([
  'ERREUR_SAISIE',
  'CLIENT_CHANGE_AVIS',
  'NON_SERVIE',
  'EPUISE_CUISINE',
])

/** Un plat que la cuisine a commencé ne revient pas intact : il est perdu par défaut. */
export function retourParDefaut(motif: MotifAnnulation, commence = false): boolean {
  return !commence && REVIENNENT_EN_STOCK.has(motif)
}

export function estCommencee(ligne: LigneNote): boolean {
  return ligne.commenceeLe !== undefined || ligne.preteLe !== undefined
}

export function DialogueAnnulation({
  ligne,
  suiviEnStock = false,
  ou,
  fuseauHoraire,
  enCours,
  surFermer,
  surAnnuler,
}: Readonly<{
  ligne: LigneNote
  /** Article suivi en stock : on demande s'il revient en stock ou s'il est perdu. */
  suiviEnStock?: boolean
  ou: string
  fuseauHoraire: string
  enCours: boolean
  surFermer: () => void
  surAnnuler: (demande: DemandeAnnulation) => void
}>) {
  const { t } = useTranslation()
  const [quantite, setQuantite] = useState(1)
  const choix = useChoixMotif<MotifAnnulation>()
  const [retour, setRetour] = useState<boolean | null>(null)
  const commencee = estCommencee(ligne)
  const revient = retour ?? (choix.motif !== null && retourParDefaut(choix.motif, commencee))

  return (
    <Dialogue
      titre={t('caisse.note.annulation.titre', { produit: ligne.nomProduit })}
      consequence={t('caisse.note.annulation.phrase', {
        ou,
        heure: ligne.envoyeeLe === undefined ? '' : formaterHeure(ligne.envoyeeLe, fuseauHoraire),
      })}
      libelleAnnuler={t('caisse.note.annulation.garder')}
      libelleConfirmer={t('caisse.note.annulation.confirmer', { count: quantite })}
      tonConfirmation="danger"
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => {
        const motif = choix.valider()
        if (motif !== null) {
          surAnnuler({ quantite, ...motif, ...(suiviEnStock ? { retourEnStock: revient } : {}) })
        }
      }}
    >
      {ligne.quantite > 1 && (
        <ChoixQuantite
          question={t('caisse.note.annulation.combien')}
          libelleMoins={t('caisse.note.annulation.moins')}
          libellePlus={t('caisse.note.annulation.plus')}
          quantite={quantite}
          maximum={ligne.quantite}
          surChanger={setQuantite}
        />
      )}
      <ChoixMotif motifs={MOTIFS} choix={choix} />
      {suiviEnStock && choix.motif !== null && (
        <ChoixRetourStock
          libelle={t('caisse.stock.article')}
          revient={revient}
          commence={commencee}
          surChoisir={setRetour}
        />
      )}
    </Dialogue>
  )
}

/** Revient en stock ou perdu : proposé d'après le motif, l'employé le corrige s'il le faut. */
export function ChoixRetourStock({
  libelle,
  revient,
  commence = false,
  surChoisir,
}: Readonly<{
  libelle: string
  revient: boolean
  /** La cuisine a commencé : on dit pourquoi « Perdu » est proposé. */
  commence?: boolean
  surChoisir: (revient: boolean) => void
}>) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-label={libelle} className="flex flex-col gap-2">
      <span className="text-libelle text-encre">{libelle}</span>
      {commence && <span className="text-legende text-attenue">{t('caisse.stock.commence')}</span>}
      <div className="grid grid-cols-2 gap-2">
        {([true, false] as const).map((valeur) => (
          <button
            key={String(valeur)}
            type="button"
            role="radio"
            aria-checked={revient === valeur}
            onClick={() => {
              surChoisir(valeur)
            }}
            className={clsx(
              'flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-normal bg-surface px-3 py-1.5 text-left text-encre',
              revient === valeur ? 'border-2 border-accent' : 'border border-trait',
            )}
          >
            <span className="text-corps-fort">
              {t(valeur ? 'caisse.stock.revient' : 'caisse.stock.perdu')}
            </span>
            <span className="text-legende text-attenue">
              {t(valeur ? 'caisse.stock.revientAide' : 'caisse.stock.perduAide')}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
