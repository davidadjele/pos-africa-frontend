import type { TFunction } from 'i18next'
import { clsx } from 'clsx'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  DemandeOffert,
  DemandeRemise,
  LigneNote,
  MotifRemise,
  SessionCaisseCourante,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, symboleDe, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { remiseEnPourcentage } from '../../partage/montants/remises'
import { formaterTaux, lireTaux } from '../../partage/montants/taxes'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Dialogue } from '../../partage/ui/Dialogue'
import { usePiegeFocus } from '../../partage/ui/usePiegeFocus'
import { ChoixQuantite } from './ChoixQuantite'
import { ChoixMotif, useChoixMotif } from './ChoixMotif'

export const MOTIFS_REMISE: MotifRemise[] = [
  'CLIENT_FIDELE',
  'GESTE_COMMERCIAL',
  'RECLAMATION',
  'REPAS_PERSONNEL',
  'AUTRE',
]
const TAUX_RAPIDES = [500, 1000, 1500, 2000]
const PREFIXE_MOTIFS = 'caisse.motifsRemise'

export type ActionLigne = 'consigne' | 'remise' | 'retirerRemise' | 'offrir' | 'retirer' | 'annuler'

/** « 10 % » ou « 500 F » : ce que la remise demandée retire. */
export function libelleRemise(demande: DemandeRemise, devise: Devise): string {
  return demande.taux === undefined
    ? formaterMontant({ unitesMineures: demande.montant ?? 0, devise }, { forme: 'courte' })
    : formaterTaux(demande.taux)
}

/** Ce que l'employé peut faire seul, pour annoncer les actions qui demanderont un gérant. */
export function droitsDe(session: SessionCaisseCourante | undefined) {
  const permissions = session?.permissions ?? []
  return {
    plafond: permissions.includes('REMISE_APPLIQUER') ? (session?.plafondRemise ?? 0) : 0,
    offrir: permissions.includes('ARTICLE_OFFRIR'),
    annuler: permissions.includes('LIGNE_ANNULER_APRES_ENVOI'),
  }
}

interface ActionProposee {
  action: ActionLigne
  libelle: string
  /** Ce qu'il faudra : « jusqu'à 10 % », ou la validation d'un gérant. */
  indice?: string
  danger?: boolean
}

/** Les actions d'une ligne : consigne, remise ou offert, puis retirer (brouillon) ou annuler (envoyée). */
function actionsDeLigne(
  ligne: LigneNote,
  droits: ReturnType<typeof droitsDe>,
  t: TFunction,
): ActionProposee[] {
  const brouillon = ligne.statut === 'BROUILLON'
  const validation = t('caisse.ligne.validation')
  const consigne: ActionProposee[] = brouillon
    ? [{ action: 'consigne', libelle: t('caisse.ligne.consigne') }]
    : []
  const fin: ActionProposee = brouillon
    ? { action: 'retirer', libelle: t('caisse.ligne.retirer'), danger: true }
    : {
        action: 'annuler',
        libelle: t('caisse.ligne.annuler'),
        danger: true,
        ...(droits.annuler ? {} : { indice: validation }),
      }
  if (ligne.offert) {
    return [...consigne, { action: 'retirerRemise', libelle: t('caisse.ligne.retirerOffert') }, fin]
  }
  const indiceRemise =
    droits.plafond > 0
      ? t('caisse.ligne.jusqua', { taux: formaterTaux(droits.plafond) })
      : validation
  const remise: ActionProposee =
    ligne.remise > 0
      ? { action: 'retirerRemise', libelle: t('caisse.ligne.retirerRemise') }
      : { action: 'remise', libelle: t('caisse.ligne.remise'), indice: indiceRemise }
  const offrir: ActionProposee = {
    action: 'offrir',
    libelle: t('caisse.ligne.offrir'),
    ...(droits.offrir ? {} : { indice: validation }),
  }
  return [...consigne, remise, offrir, fin]
}

/** Toucher une ligne : ses actions, et celles qui demanderont la validation d'un gérant. */
export function DialogueActionsLigne({
  ligne,
  devise,
  fuseauHoraire,
  session,
  surFermer,
  surChoisir,
}: Readonly<{
  ligne: LigneNote
  devise: Devise
  fuseauHoraire: string
  session: SessionCaisseCourante | undefined
  surFermer: () => void
  surChoisir: (action: ActionLigne) => void
}>) {
  const { t } = useTranslation()
  const id = useId()
  const cadre = useRef<HTMLElement>(null)
  const boutonFermer = useRef<HTMLButtonElement>(null)
  usePiegeFocus(cadre, boutonFermer, surFermer)
  const brouillon = ligne.statut === 'BROUILLON'
  const montant = formaterMontant({ unitesMineures: ligne.montant, devise }, { forme: 'courte' })
  const actions = actionsDeLigne(ligne, droitsDe(session), t)

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-voile sm:items-center sm:p-4">
      <section
        ref={cadre}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titre`}
        aria-describedby={`${id}-phrase`}
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-t-moyen bg-surface p-6 shadow-dialogue sm:rounded-moyen"
      >
        <h2 id={`${id}-titre`} className="m-0 text-titre-section text-encre">
          {ligne.nomProduit}
        </h2>
        <p id={`${id}-phrase`} className="m-0 text-corps text-attenue">
          {brouillon
            ? t('caisse.ligne.aEnvoyer', { count: ligne.quantite, montant })
            : t('caisse.ligne.envoyes', {
                count: ligne.quantite,
                montant,
                heure:
                  ligne.envoyeeLe === undefined
                    ? ''
                    : formaterHeure(ligne.envoyeeLe, fuseauHoraire),
              })}
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {actions.map(({ action, libelle, indice, danger = false }) => (
            <li key={action}>
              <button
                type="button"
                onClick={() => {
                  surChoisir(action)
                }}
                className={clsx(
                  'flex min-h-cible-caisse w-full items-center justify-between gap-3 rounded-normal border border-trait bg-surface px-4 text-left text-corps hover:bg-fond',
                  danger ? 'text-danger' : 'text-encre',
                )}
              >
                <span>{libelle}</span>
                {indice !== undefined && (
                  <span className="text-legende text-attenue">{indice}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <Bouton ref={boutonFermer} className="self-end" onClick={surFermer}>
          {t('caisse.ligne.fermer')}
        </Bouton>
      </section>
    </div>
  )
}

/**
 * Remise sur une ligne ou sur la note : un taux (boutons rapides ou saisie) ou un montant, avec
 * l'aperçu du prix remisé et le motif. Le plafond du rôle est rappelé.
 */
export function DialogueRemise({
  titre,
  phrase,
  base,
  devise,
  plafond,
  enCours,
  surFermer,
  surAppliquer,
}: Readonly<{
  titre: string
  phrase: string
  /** Montant sur lequel porte la remise, en unités mineures. */
  base: number
  devise: Devise
  plafond: number
  enCours: boolean
  surFermer: () => void
  surAppliquer: (demande: DemandeRemise) => void
}>) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'taux' | 'montant'>('taux')
  const [taux, setTaux] = useState<number | null>(null)
  const [autreTaux, setAutreTaux] = useState(false)
  const [saisieTaux, setSaisieTaux] = useState('')
  const [saisieMontant, setSaisieMontant] = useState('')
  const [tente, setTente] = useState(false)
  const choix = useChoixMotif<MotifRemise>()
  const tauxLu = autreTaux ? lireTaux(saisieTaux) : taux
  const montantLu = lireMontant(saisieMontant, devise)
  const remiseEnTaux = tauxLu === null ? null : remiseEnPourcentage(base, tauxLu)
  const remise = mode === 'taux' ? remiseEnTaux : montantLu
  const valide = remise !== null && remise > 0 && remise <= base
  const montant = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })
  const enTaux = mode === 'taux' && tauxLu !== null
  const libelle = valide
    ? t('caisse.remise.appliquerMoins', {
        remise: enTaux ? formaterTaux(tauxLu) : montant(remise),
      })
    : t('caisse.remise.appliquer')

  return (
    <Dialogue
      titre={titre}
      consequence={phrase}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={libelle}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => {
        setTente(true)
        const motif = choix.valider()
        if (!valide || motif === null) return
        surAppliquer(enTaux ? { taux: tauxLu, ...motif } : { montant: remise, ...motif })
      }}
    >
      <div
        role="tablist"
        aria-label={t('caisse.remise.mode')}
        className="flex gap-0.5 self-start rounded-moyen bg-trait p-0.5"
      >
        {(['taux', 'montant'] as const).map((candidat) => (
          <button
            key={candidat}
            type="button"
            role="tab"
            aria-selected={mode === candidat}
            onClick={() => {
              setMode(candidat)
            }}
            className={clsx(
              'min-h-cible-min rounded-normal px-4 text-corps font-semibold text-encre',
              mode === candidat && 'bg-surface font-bold',
            )}
          >
            {t(candidat === 'taux' ? 'caisse.remise.enTaux' : 'caisse.remise.enMontant')}
          </button>
        ))}
      </div>
      {mode === 'taux' ? (
        <ChoixTaux
          taux={taux}
          autreTaux={autreTaux}
          saisieTaux={saisieTaux}
          surChoisir={(choisi) => {
            setAutreTaux(choisi === null)
            if (choisi !== null) setTaux(choisi)
          }}
          surSaisir={setSaisieTaux}
        />
      ) : (
        <ChampSaisie
          libelle={t('caisse.remise.montant')}
          inputMode="numeric"
          suffixe={symboleDe(devise)}
          value={saisieMontant}
          onChange={(evenement) => {
            setSaisieMontant(evenement.target.value)
          }}
        />
      )}
      {valide ? (
        <div className="flex items-baseline justify-between gap-3 rounded-normal bg-fond px-3.5 py-3">
          <span className="text-libelle text-encre">{t('caisse.remise.apercu')}</span>
          <span className="flex items-baseline gap-2">
            <span className="chiffres text-libelle text-attenue line-through">{montant(base)}</span>
            <span className="chiffres text-montant-ligne text-encre">{montant(base - remise)}</span>
            <span className="chiffres text-legende text-attenue">(−{montant(remise)})</span>
          </span>
        </div>
      ) : (
        tente && (
          <p className="m-0 text-legende text-danger">
            {remise !== null && remise > base
              ? t('caisse.remise.tropGrande', { montant: montant(base) })
              : t('caisse.remise.choisir')}
          </p>
        )
      )}
      <ChoixMotif motifs={MOTIFS_REMISE} choix={choix} prefixe={PREFIXE_MOTIFS} />
      <p className="m-0 text-legende text-attenue">
        {plafond > 0
          ? t('caisse.remise.plafond', { taux: formaterTaux(plafond) })
          : t('caisse.remise.sansPlafond')}
      </p>
    </Dialogue>
  )
}

/** Les taux courants d'un geste, ou un autre taux saisi (null : « Autre taux »). */
function ChoixTaux({
  taux,
  autreTaux,
  saisieTaux,
  surChoisir,
  surSaisir,
}: Readonly<{
  taux: number | null
  autreTaux: boolean
  saisieTaux: string
  surChoisir: (taux: number | null) => void
  surSaisir: (saisie: string) => void
}>) {
  const { t } = useTranslation()
  return (
    <>
      <div className="grid grid-cols-5 gap-2">
        {TAUX_RAPIDES.map((candidat) => (
          <button
            key={candidat}
            type="button"
            aria-pressed={!autreTaux && taux === candidat}
            onClick={() => {
              surChoisir(candidat)
            }}
            className={clsx(
              'chiffres min-h-cible-caisse rounded-normal bg-surface text-corps-fort text-encre',
              !autreTaux && taux === candidat ? 'border-2 border-accent' : 'border border-trait',
            )}
          >
            {formaterTaux(candidat)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={autreTaux}
          onClick={() => {
            surChoisir(null)
          }}
          className={clsx(
            'min-h-cible-caisse rounded-normal bg-surface text-corps text-encre',
            autreTaux ? 'border-2 border-accent font-bold' : 'border border-trait',
          )}
        >
          {t('caisse.remise.autreTaux')}
        </button>
      </div>
      {autreTaux && (
        <ChampSaisie
          libelle={t('caisse.remise.taux')}
          inputMode="decimal"
          suffixe="%"
          value={saisieTaux}
          onChange={(evenement) => {
            surSaisir(evenement.target.value)
          }}
        />
      )}
    </>
  )
}

/** Offrir tout ou partie d'une ligne : l'article reste sur la note à 0 F. */
export function DialogueOffrir({
  ligne,
  ou,
  enCours,
  surFermer,
  surOffrir,
}: Readonly<{
  ligne: LigneNote
  ou: string
  enCours: boolean
  surFermer: () => void
  surOffrir: (demande: DemandeOffert) => void
}>) {
  const { t } = useTranslation()
  const [quantite, setQuantite] = useState(1)
  const choix = useChoixMotif<MotifRemise>()
  return (
    <Dialogue
      titre={t('caisse.offert.titre', { produit: ligne.nomProduit })}
      consequence={t('caisse.offert.phrase', { ou })}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('caisse.offert.confirmer', { count: quantite })}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => {
        const motif = choix.valider()
        if (motif !== null) surOffrir({ quantite, ...motif })
      }}
    >
      {ligne.quantite > 1 && (
        <ChoixQuantite
          question={t('caisse.offert.combien')}
          libelleMoins={t('caisse.offert.moins')}
          libellePlus={t('caisse.offert.plus')}
          quantite={quantite}
          maximum={ligne.quantite}
          surChanger={setQuantite}
        />
      )}
      <ChoixMotif motifs={MOTIFS_REMISE} choix={choix} prefixe={PREFIXE_MOTIFS} />
    </Dialogue>
  )
}
