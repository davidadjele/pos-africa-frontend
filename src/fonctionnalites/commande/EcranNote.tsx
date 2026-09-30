import type { TFunction } from 'i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ArrowLeft, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type {
  CommandeDetail,
  DemandeLigne,
  LigneCarteEtablissement,
  LigneNote,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { formaterTaux } from '../../partage/montants/taxes'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { useSessionCaisse } from '../caisse/requetes'
import { requeteAppareil } from '../tablette/requetes'
import { CarteCaisse } from './CarteCaisse'
import { requeteCarteCaisse, requeteCommande, requetePlan } from './requetes'

/**
 * Une note ouverte : la carte à gauche, la note à droite. Chaque geste est enregistré aussitôt, pour
 * qu'un collègue voie la note à jour et qu'une tablette qui plante ne perde rien.
 */
export function EcranNote({ commandeId }: Readonly<{ commandeId: string }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const naviguer = useNavigate()
  const { data: appareil } = useQuery(requeteAppareil)
  const devise = (appareil?.entreprise.devise ?? 'XOF') as Devise
  const fuseauHoraire = appareil?.etablissement.fuseauHoraire ?? 'Africa/Lome'
  const peutCommander = useSessionCaisse()?.permissions.includes('COMMANDE_CREER') ?? false
  const note = useQuery(requeteCommande(commandeId))
  const carte = useQuery(requeteCarteCaisse)
  const [erreur, setErreur] = useState<unknown>(null)
  const [refus, setRefus] = useState<string | null>(null)
  const [ligneOuverte, setLigneOuverte] = useState<LigneNote | null>(null)

  function retenir(reponse: CommandeDetail) {
    // Deux gestes rapides : la réponse la plus ancienne ne doit pas écraser la plus récente.
    clientRequetes.setQueryData<CommandeDetail>(requeteCommande(commandeId).queryKey, (actuelle) =>
      actuelle !== undefined && actuelle.version > reponse.version ? actuelle : reponse,
    )
  }

  async function agir(action: () => Promise<CommandeDetail>) {
    setErreur(null)
    setRefus(null)
    try {
      retenir(await action())
    } catch (echec) {
      setErreur(echec)
    }
  }

  async function ajouter(produit: LigneCarteEtablissement) {
    setErreur(null)
    setRefus(null)
    try {
      retenir(
        await appelerCaisse<CommandeDetail>(`/caisse/commandes/${commandeId}/lignes`, {
          methode: 'POST',
          corps: { produitId: produit.produitId },
        }),
      )
    } catch (echec) {
      if (
        echec instanceof ErreurApi &&
        (echec.code === 'PRODUIT_EPUISE' || echec.code === 'PRODUIT_INDISPONIBLE')
      ) {
        // La carte de la tablette était en retard : relue, elle dit qui a déclaré la rupture et quand.
        await clientRequetes.refetchQueries({ queryKey: requeteCarteCaisse.queryKey })
        const aJour = clientRequetes
          .getQueryData<LigneCarteEtablissement[]>(requeteCarteCaisse.queryKey)
          ?.find((ligne) => ligne.produitId === produit.produitId)
        setRefus(messageRefus(echec.code, produit.nom, aJour, fuseauHoraire, t))
      } else {
        setErreur(echec)
      }
    }
  }

  function modifier(ligne: LigneNote, demande: DemandeLigne) {
    return agir(() =>
      appelerCaisse<CommandeDetail>(`/caisse/commandes/${commandeId}/lignes/${ligne.id}`, {
        methode: 'PUT',
        corps: demande,
      }),
    )
  }

  async function revenirAuPlan() {
    // Une note ouverte par erreur ne reste pas sur le plan : vide, elle est fermée en partant.
    if (note.data?.lignes.length === 0 && peutCommander) {
      try {
        await appelerCaisse(`/caisse/commandes/${commandeId}`, { methode: 'DELETE' })
      } catch {
        // Un article ajouté entre-temps par un collègue : la note reste ouverte, rien à signaler.
      }
    }
    await clientRequetes.invalidateQueries({ queryKey: requetePlan.queryKey })
    await naviguer({ to: '/caisse' })
  }

  if (note.isPending) return <Chargement texte={t('caisse.note.chargement')} />
  if (note.isError) {
    return (
      <AlerteErreur
        erreur={note.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void note.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {refus !== null && <Alerte ton="danger">{refus}</Alerte>}
        {erreur !== null && <AlerteErreur erreur={erreur} />}
        {carte.isPending && <Chargement texte={t('caisse.carte.chargement')} />}
        {carte.isError && <AlerteErreur erreur={carte.error} />}
        {carte.data && (
          <CarteCaisse
            carte={carte.data}
            devise={devise}
            surChoisir={(produit) => {
              if (peutCommander) void ajouter(produit)
            }}
          />
        )}
      </div>
      <PanneauNote
        note={note.data}
        devise={devise}
        fuseauHoraire={fuseauHoraire}
        modifiable={peutCommander}
        surRevenir={() => void revenirAuPlan()}
        surModifier={(ligne, demande) => void modifier(ligne, demande)}
        surOuvrirLigne={setLigneOuverte}
      />
      {ligneOuverte !== null && (
        <DialogueLigne
          ligne={ligneOuverte}
          surFermer={() => {
            setLigneOuverte(null)
          }}
          surEnregistrer={(demande) => {
            setLigneOuverte(null)
            void modifier(ligneOuverte, demande)
          }}
        />
      )}
    </div>
  )
}

function messageRefus(
  code: 'PRODUIT_EPUISE' | 'PRODUIT_INDISPONIBLE',
  produit: string,
  aJour: LigneCarteEtablissement | undefined,
  fuseauHoraire: string,
  t: TFunction,
): string {
  if (code === 'PRODUIT_INDISPONIBLE') return t('caisse.note.indisponible', { produit })
  if (aJour?.epuisePar !== undefined && aJour.epuiseLe !== undefined) {
    return t('caisse.note.epuise', {
      produit,
      qui: aJour.epuisePar,
      heure: formaterHeure(aJour.epuiseLe, fuseauHoraire),
    })
  }
  return t('caisse.note.epuiseSansDetail', { produit })
}

function PanneauNote({
  note,
  devise,
  fuseauHoraire,
  modifiable,
  surRevenir,
  surModifier,
  surOuvrirLigne,
}: Readonly<{
  note: CommandeDetail
  devise: Devise
  fuseauHoraire: string
  modifiable: boolean
  surRevenir: () => void
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
      </div>

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
              devise={devise}
              fuseauHoraire={fuseauHoraire}
              modifiable={modifiable && ligne.statut === 'BROUILLON'}
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
        <span className="flex flex-wrap justify-between gap-x-3 text-libelle text-attenue">
          <span>{t('caisse.note.articles', { count: note.articles })}</span>
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
            <Bouton disabled className="min-h-cible-caisse">
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
  devise,
  fuseauHoraire,
  modifiable,
  surModifier,
  surOuvrir,
}: Readonly<{
  ligne: LigneNote
  devise: Devise
  fuseauHoraire: string
  modifiable: boolean
  surModifier: (demande: DemandeLigne) => void
  surOuvrir: () => void
}>) {
  const { t } = useTranslation()
  const produit = ligne.nomProduit
  const note = ligne.note === undefined ? {} : { note: ligne.note }
  const statut =
    ligne.statut === 'BROUILLON'
      ? t('caisse.note.aEnvoyer')
      : ligne.statut === 'ANNULEE'
        ? t('caisse.note.annulee')
        : t('caisse.note.envoyeA', {
            heure:
              ligne.envoyeeLe === undefined ? '' : formaterHeure(ligne.envoyeeLe, fuseauHoraire),
          })
  const description = (
    <>
      <span className="text-corps-fort text-encre">{produit}</span>
      {ligne.note !== undefined && (
        <span className="text-legende text-encre">« {ligne.note} »</span>
      )}
      <span
        className={
          ligne.statut === 'BROUILLON'
            ? 'text-legende font-semibold text-encre'
            : 'text-legende text-attenue'
        }
      >
        {statut}
      </span>
    </>
  )
  return (
    <li className="grid min-h-15 grid-cols-[40px_minmax(0,1fr)_auto_96px] items-center gap-2 border-b border-trait py-1.5 last:border-b-0">
      <span className="chiffres text-montant-ligne text-encre">{ligne.quantite}×</span>
      {modifiable ? (
        <button
          type="button"
          aria-label={t('caisse.note.modifier', { produit })}
          onClick={surOuvrir}
          className="flex min-h-cible-min flex-col items-start gap-0.5 text-left"
        >
          {description}
        </button>
      ) : (
        <span className="flex flex-col gap-0.5">{description}</span>
      )}
      <span className="chiffres text-montant-ligne text-encre">
        {formaterMontant({ unitesMineures: ligne.montant, devise }, { forme: 'nombre' })}
      </span>
      <span className="flex justify-end gap-1">
        {modifiable && (
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

function DialogueLigne({
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
