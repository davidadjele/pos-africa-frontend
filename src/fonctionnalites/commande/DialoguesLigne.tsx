import { clsx } from 'clsx'
import { useId, useState } from 'react'
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
export function DialogueAnnulation({
  ligne,
  ou,
  fuseauHoraire,
  enCours,
  surFermer,
  surAnnuler,
}: Readonly<{
  ligne: LigneNote
  ou: string
  fuseauHoraire: string
  enCours: boolean
  surFermer: () => void
  surAnnuler: (demande: DemandeAnnulation) => void
}>) {
  const { t } = useTranslation()
  const idMotif = useId()
  const [quantite, setQuantite] = useState(1)
  const [motif, setMotif] = useState<MotifAnnulation | null>(null)
  const [detail, setDetail] = useState('')
  const [tente, setTente] = useState(false)
  const detailManquant = motif === 'AUTRE' && detail.trim() === ''

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
        setTente(true)
        if (motif === null || detailManquant) return
        surAnnuler({
          quantite,
          motif,
          ...(motif === 'AUTRE' ? { detail: detail.trim() } : {}),
        })
      }}
    >
      {ligne.quantite > 1 && (
        <div className="flex items-center gap-3">
          <span className="flex-1 text-libelle text-encre">
            {t('caisse.note.annulation.combien')}
          </span>
          <Bouton
            aria-label={t('caisse.note.annulation.moins')}
            disabled={quantite <= 1}
            className="h-14 w-14 text-titre-section"
            onClick={() => {
              setQuantite(quantite - 1)
            }}
          >
            −
          </Bouton>
          <output className="chiffres w-12 text-center text-touche">{quantite}</output>
          <Bouton
            aria-label={t('caisse.note.annulation.plus')}
            disabled={quantite >= ligne.quantite}
            className="h-14 w-14 text-titre-section"
            onClick={() => {
              setQuantite(quantite + 1)
            }}
          >
            +
          </Bouton>
          <span className="text-libelle text-attenue">
            {t('caisse.note.annulation.sur', { count: ligne.quantite })}
          </span>
        </div>
      )}
      <fieldset
        className="m-0 flex flex-col gap-2 border-0 p-0"
        aria-describedby={tente && motif === null ? `${idMotif}-erreur` : undefined}
      >
        <legend className="mb-2 p-0 text-libelle text-encre">
          {t('caisse.note.annulation.motif')}
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MOTIFS.map((candidat) => (
            <label
              key={candidat}
              className={clsx(
                'flex min-h-cible-caisse cursor-pointer items-center gap-2.5 rounded-normal border bg-surface px-3 text-corps text-encre',
                motif === candidat ? 'border-2 border-accent font-bold' : 'border-trait',
              )}
            >
              <input
                type="radio"
                name={idMotif}
                value={candidat}
                checked={motif === candidat}
                onChange={() => {
                  setMotif(candidat)
                }}
              />
              {t(`caisse.motifs.${candidat}`)}
            </label>
          ))}
        </div>
        {tente && motif === null && (
          <p id={`${idMotif}-erreur`} className="m-0 text-legende text-danger">
            {t('caisse.note.annulation.choisirMotif')}
          </p>
        )}
      </fieldset>
      {motif === 'AUTRE' && (
        <ChampSaisie
          libelle={t('caisse.note.annulation.detail')}
          obligatoire
          maxLength={120}
          value={detail}
          erreur={tente && detailManquant ? t('caisse.note.annulation.detailRequis') : undefined}
          onChange={(evenement) => {
            setDetail(evenement.target.value)
          }}
        />
      )}
    </Dialogue>
  )
}
