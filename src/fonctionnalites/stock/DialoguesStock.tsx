import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DemandePerteStock,
  DemandeSeuilStock,
  EtatStock,
  LigneStock,
  MotifStock,
} from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterDateHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { EtatsListe } from '../../partage/ui/EtatsListe'
import { Dialogue } from '../../partage/ui/Dialogue'
import { detailMouvement, quantiteSignee, TONS_MOUVEMENT } from './presentation'
import { requeteHistoriqueStock } from './requetes'

const MOTIFS_PERTE: MotifStock[] = ['CASSE', 'PERIME', 'CONSOMME_PERSONNEL', 'AUTRE']

/** Lit un entier positif saisi au clavier ; null sinon. */
export function lireQuantite(saisie: string): number | null {
  const nettoyee = saisie.replace(/\s/gu, '')
  return /^\d{1,6}$/u.test(nettoyee) ? Number(nettoyee) : null
}

export function DialoguePerte({
  etablissementId,
  lignes,
  surFermer,
  surFait,
}: Readonly<{
  etablissementId: string
  lignes: LigneStock[]
  surFermer: () => void
  surFait: (etat: EtatStock, message: string) => void
}>) {
  const { t } = useTranslation()
  const [produitId, setProduitId] = useState('')
  const [quantite, setQuantite] = useState('')
  const [motif, setMotif] = useState<MotifStock | null>(null)
  const [detail, setDetail] = useState('')
  const [essaye, setEssaye] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const nombre = lireQuantite(quantite)
  const produit = lignes.find((ligne) => ligne.produitId === produitId)
  const manques = {
    produit: produit === undefined,
    quantite: nombre === null || nombre === 0,
    motif: motif === null,
    detail: motif === 'AUTRE' && detail.trim() === '',
  }

  async function retirer() {
    setEssaye(true)
    if (
      produit === undefined ||
      nombre === null ||
      nombre === 0 ||
      motif === null ||
      manques.detail
    ) {
      return
    }
    setEnCours(true)
    setErreur(null)
    const demande: DemandePerteStock = {
      produitId: produit.produitId,
      quantite: nombre,
      motif,
      ...(motif === 'AUTRE' ? { detail: detail.trim() } : {}),
    }
    try {
      surFait(
        await appelerApi<EtatStock>(`/etablissements/${etablissementId}/stock/pertes`, {
          methode: 'POST',
          corps: demande,
        }),
        t('stock.perte.fait', { count: nombre, nom: produit.nom }),
      )
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={t('stock.perte.titre')}
      consequence={t('stock.perte.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={
        nombre === null || nombre === 0
          ? t('stock.perte.retirerSans')
          : t('stock.perte.retirer', { count: nombre })
      }
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void retirer()}
    >
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <ChampSelection
        libelle={t('stock.perte.produit')}
        obligatoire
        options={[
          { valeur: '', libelle: t('stock.perte.choisir') },
          ...lignes.map((ligne) => ({ valeur: ligne.produitId, libelle: ligne.nom })),
        ]}
        value={produitId}
        erreur={essaye && manques.produit ? t('stock.perte.manques.produit') : undefined}
        onChange={(evenement) => {
          setProduitId(evenement.target.value)
        }}
      />
      <ChampSaisie
        libelle={t('stock.perte.quantite')}
        obligatoire
        inputMode="numeric"
        value={quantite}
        erreur={essaye && manques.quantite ? t('stock.perte.manques.quantite') : undefined}
        onChange={(evenement) => {
          setQuantite(evenement.target.value.replace(/\D/gu, ''))
        }}
      />
      <div role="radiogroup" aria-label={t('stock.perte.motif')} className="grid grid-cols-2 gap-2">
        {MOTIFS_PERTE.map((candidat) => (
          <button
            key={candidat}
            type="button"
            role="radio"
            aria-checked={motif === candidat}
            onClick={() => {
              setMotif(candidat)
            }}
            className={clsx(
              'min-h-cible-min rounded-normal bg-surface px-3 text-left text-corps text-encre',
              motif === candidat ? 'border-2 border-accent font-bold' : 'border border-trait',
            )}
          >
            {t(`stock.motifs.${candidat}`)}
          </button>
        ))}
      </div>
      {essaye && manques.motif && (
        <p className="m-0 text-legende text-danger">{t('stock.perte.manques.motif')}</p>
      )}
      {motif === 'AUTRE' && (
        <ChampSaisie
          libelle={t('stock.perte.detail')}
          obligatoire
          maxLength={120}
          value={detail}
          erreur={essaye && manques.detail ? t('stock.perte.manques.detail') : undefined}
          onChange={(evenement) => {
            setDetail(evenement.target.value)
          }}
        />
      )}
    </Dialogue>
  )
}

export function DialogueSeuil({
  etablissementId,
  ligne,
  surFermer,
  surFait,
}: Readonly<{
  etablissementId: string
  ligne: LigneStock
  surFermer: () => void
  surFait: (etat: EtatStock, message: string) => void
}>) {
  const { t } = useTranslation()
  const [seuil, setSeuil] = useState(String(ligne.seuil))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const nombre = lireQuantite(seuil)

  async function enregistrer() {
    if (nombre === null) return
    setEnCours(true)
    setErreur(null)
    try {
      surFait(
        await appelerApi<EtatStock>(
          `/etablissements/${etablissementId}/stock/${ligne.produitId}/seuil`,
          { methode: 'PUT', corps: { seuil: nombre } satisfies DemandeSeuilStock },
        ),
        t('stock.seuil.fait', { nom: ligne.nom, seuil: nombre }),
      )
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={t('stock.seuil.titre', { nom: ligne.nom })}
      consequence={t('stock.seuil.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('commun.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void enregistrer()}
    >
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <ChampSaisie
        libelle={t('stock.seuil.champ')}
        inputMode="numeric"
        value={seuil}
        erreur={nombre === null ? t('stock.seuil.invalide') : undefined}
        onChange={(evenement) => {
          setSeuil(evenement.target.value.replace(/\D/gu, ''))
        }}
      />
    </Dialogue>
  )
}

export function DialogueHistorique({
  etablissementId,
  fuseauHoraire,
  ligne,
  surFermer,
}: Readonly<{
  etablissementId: string
  fuseauHoraire: string
  ligne: LigneStock
  surFermer: () => void
}>) {
  const { t } = useTranslation()
  const { moi } = useSession()
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const historique = useQuery(requeteHistoriqueStock(etablissementId, ligne.produitId))
  return (
    <Dialogue
      titre={t('stock.historique.titre', { nom: ligne.nom })}
      consequence={
        ligne.quantite === undefined
          ? t('stock.historique.aCompter')
          : t('stock.historique.phrase', { quantite: quantiteSignee(ligne.quantite) })
      }
      libelleConfirmer={t('commun.fermer')}
      surConfirmer={surFermer}
    >
      <EtatsListe
        requete={historique}
        chargement={t('stock.historique.chargement')}
        vide={t('stock.historique.vide')}
      />
      {historique.data !== undefined && historique.data.length > 0 && (
        <ul
          aria-label={t('stock.historique.liste')}
          className="m-0 flex max-h-[50vh] list-none flex-col overflow-y-auto p-0"
        >
          {historique.data.map((mouvement) => (
            <li
              key={mouvement.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-trait py-2 last:border-b-0"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <BadgeStatut ton={TONS_MOUVEMENT[mouvement.type]}>
                    {t(`stock.mouvements.${mouvement.type}`)}
                  </BadgeStatut>
                  <span className="truncate text-corps text-encre">
                    {[
                      detailMouvement(mouvement, t),
                      mouvement.coutUnitaire === undefined
                        ? ''
                        : t('stock.historique.coutUnitaire', {
                            cout: formaterMontant(
                              { unitesMineures: mouvement.coutUnitaire, devise },
                              { forme: 'courte' },
                            ),
                          }),
                    ]
                      .filter((partie) => partie !== '')
                      .join(', ')}
                  </span>
                </span>
                <span className="text-legende text-attenue">
                  {formaterDateHeure(mouvement.le, fuseauHoraire)}, {mouvement.par}
                </span>
              </span>
              <span className="chiffres text-montant-ligne text-encre">
                {quantiteSignee(mouvement.quantite, true)}
              </span>
              <span className="chiffres w-14 text-right text-corps text-attenue">
                {quantiteSignee(mouvement.quantiteApres)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Dialogue>
  )
}
