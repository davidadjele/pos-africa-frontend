import type { TFunction } from 'i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type {
  CommandeDetail,
  DemandeAnnulation,
  DemandeLigne,
  DemandeOffert,
  DemandeRemise,
  LigneCarteEtablissement,
  LigneNote,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import type { Devise } from '../../partage/montants/formaterMontant'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { useSessionCaisse } from '../caisse/requetes'
import { requeteAppareil } from '../tablette/requetes'
import { DialogueValidationGerant } from '../validation/DialogueValidationGerant'
import { ActionsNote } from './ActionsNote'
import { libelleMotif } from './ChoixMotif'
import {
  type ActionLigne,
  DialogueActionsLigne,
  DialogueOffrir,
  DialogueRemise,
  droitsDe,
  libelleRemise,
} from './DialoguesRemise'
import { useValidation } from './useValidation'
import { CarteCaisse } from './CarteCaisse'
import { DialogueAnnulation, DialogueLigne } from './DialoguesLigne'
import { ouEstLaNote, PanneauNote, type Rupture } from './PanneauNote'
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
  const session = useSessionCaisse()
  const peutCommander = session?.permissions.includes('COMMANDE_CREER') ?? false
  const peutEncaisser = session?.permissions.includes('PAIEMENT_ENCAISSER') ?? false
  const note = useQuery(requeteCommande(commandeId))
  const carte = useQuery(requeteCarteCaisse)
  const [erreur, setErreur] = useState<unknown>(null)
  const [refus, setRefus] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [ligneOuverte, setLigneOuverte] = useState<LigneNote | null>(null)
  const [aAnnuler, setAAnnuler] = useState<LigneNote | null>(null)
  const [aValider, setAValider] = useState<{ ligne: LigneNote; demande: DemandeAnnulation } | null>(
    null,
  )
  const [ligneActions, setLigneActions] = useState<LigneNote | null>(null)
  const [aRemiser, setARemiser] = useState<LigneNote | null>(null)
  const [aOffrir, setAOffrir] = useState<LigneNote | null>(null)
  const validation = useValidation()

  function retenir(reponse: CommandeDetail) {
    // Deux gestes rapides : la réponse la plus ancienne ne doit pas écraser la plus récente.
    clientRequetes.setQueryData<CommandeDetail>(requeteCommande(commandeId).queryKey, (actuelle) =>
      actuelle !== undefined && actuelle.version > reponse.version ? actuelle : reponse,
    )
  }

  function effacerMessages() {
    setErreur(null)
    setRefus(null)
    setConfirmation(null)
  }

  /** Relit la carte après un refus : elle dit qui a déclaré la rupture et quand. */
  async function carteAJour(): Promise<LigneCarteEtablissement[]> {
    await clientRequetes.refetchQueries({ queryKey: requeteCarteCaisse.queryKey })
    return clientRequetes.getQueryData<LigneCarteEtablissement[]>(requeteCarteCaisse.queryKey) ?? []
  }

  async function agir(action: () => Promise<CommandeDetail>) {
    effacerMessages()
    try {
      retenir(await action())
    } catch (echec) {
      setErreur(echec)
    }
  }

  async function ajouter(produit: LigneCarteEtablissement) {
    effacerMessages()
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
        const aJour = (await carteAJour()).find((ligne) => ligne.produitId === produit.produitId)
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

  async function envoyer(nombre: number) {
    effacerMessages()
    setEnCours(true)
    try {
      const reponse = await appelerCaisse<CommandeDetail>(`/caisse/commandes/${commandeId}/envoi`, {
        methode: 'POST',
      })
      retenir(reponse)
      const derniers = reponse.lignes
        .map((ligne) => ligne.envoyeeLe ?? '')
        .sort()
        .at(-1)
      setConfirmation(
        t('caisse.note.envoye', {
          count: nombre,
          heure:
            derniers === undefined || derniers === '' ? '' : formaterHeure(derniers, fuseauHoraire),
        }),
      )
      void clientRequetes.invalidateQueries({ queryKey: requetePlan.queryKey })
    } catch (echec) {
      if (
        echec instanceof ErreurApi &&
        (echec.code === 'PRODUIT_EPUISE' || echec.code === 'PRODUIT_INDISPONIBLE')
      ) {
        const carteRelue = await carteAJour()
        const bloquante = note.data?.lignes.find(
          (ligne) =>
            ligne.statut === 'BROUILLON' &&
            rupturesDe(carteRelue, note.data.lignes).has(ligne.produitId),
        )
        const aJour = carteRelue.find((ligne) => ligne.produitId === bloquante?.produitId)
        setRefus(messageRefusEnvoi(bloquante?.nomProduit ?? '', aJour, fuseauHoraire, t))
      } else {
        setErreur(echec)
      }
    } finally {
      setEnCours(false)
    }
  }

  async function annuler(ligne: LigneNote, demande: DemandeAnnulation) {
    effacerMessages()
    setEnCours(true)
    try {
      retenir(
        await appelerCaisse<CommandeDetail>(
          `/caisse/commandes/${commandeId}/lignes/${ligne.id}/annulation`,
          { methode: 'POST', corps: demande },
        ),
      )
      setAValider(null)
    } catch (echec) {
      // Sans le droit d'annuler : un gérant présent valide par son PIN, puis l'annulation repart.
      if (
        echec instanceof ErreurApi &&
        echec.code === 'VALIDATION_REQUISE' &&
        demande.validationId === undefined
      ) {
        setAValider({ ligne, demande })
      } else {
        setAValider(null)
        setErreur(echec)
      }
    } finally {
      setAAnnuler(null)
      setEnCours(false)
    }
  }

  /** Action sensible sur la note : le PIN d'un gérant est demandé si le serveur l'exige. */
  async function avecValidation(
    appel: (validationId?: string) => Promise<CommandeDetail>,
    demande: Parameters<typeof validation.executer>[1],
  ) {
    effacerMessages()
    setEnCours(true)
    try {
      const reponse = await validation.executer(appel, demande)
      if (reponse !== undefined) retenir(reponse)
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  function appeler(chemin: string, methode: 'POST' | 'PUT', corps: object) {
    return (validationId?: string) =>
      appelerCaisse<CommandeDetail>(`/caisse/commandes/${commandeId}/${chemin}`, {
        methode,
        corps: validationId === undefined ? corps : { ...corps, validationId },
      })
  }

  function contexteRemise(motif: string, detail: string | undefined) {
    return t('caisse.remise.validationContexte', {
      ou: note.data === undefined ? '' : ouEstLaNote(note.data, t),
      demandeur: session?.nomCourt ?? '',
      motif: libelleMotif(motif, detail, t, 'caisse.motifsRemise'),
    })
  }

  function remiserLigne(ligne: LigneNote, demande: DemandeRemise) {
    setARemiser(null)
    void avecValidation(appeler(`lignes/${ligne.id}/remise`, 'PUT', demande), {
      permission: 'REMISE_AU_DELA_PLAFOND',
      objetId: ligne.id,
      titre: t('caisse.remise.validationTitre', {
        remise: libelleRemise(demande, devise),
        objet: ligne.nomProduit,
      }),
      contexte: contexteRemise(demande.motif, demande.detail),
    })
  }

  function offrir(ligne: LigneNote, demande: DemandeOffert) {
    setAOffrir(null)
    void avecValidation(appeler(`lignes/${ligne.id}/offert`, 'POST', demande), {
      permission: 'ARTICLE_OFFRIR',
      objetId: ligne.id,
      titre: t('caisse.offert.validationTitre', {
        count: demande.quantite,
        produit: ligne.nomProduit,
      }),
      contexte: contexteRemise(demande.motif, demande.detail),
    })
  }

  function retirerRemise(objetId: string, chemin: string, objet: string) {
    void avecValidation(appeler(chemin, 'POST', {}), {
      permission: 'REMISE_AU_DELA_PLAFOND',
      objetId,
      titre: t('caisse.remise.retraitTitre', { objet }),
      contexte: t('caisse.remise.retraitContexte', {
        ou: note.data === undefined ? '' : ouEstLaNote(note.data, t),
        demandeur: session?.nomCourt ?? '',
      }),
    })
  }

  function choisirPourLaLigne(ligne: LigneNote, action: ActionLigne) {
    setLigneActions(null)
    if (action === 'consigne') setLigneOuverte(ligne)
    else if (action === 'remise') setARemiser(ligne)
    else if (action === 'offrir') setAOffrir(ligne)
    else if (action === 'annuler') setAAnnuler(ligne)
    else if (action === 'retirer') void modifier(ligne, { quantite: 0 })
    else retirerRemise(ligne.id, `lignes/${ligne.id}/remise/retrait`, ligne.nomProduit)
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

  // Une note entamée par un paiement ne se modifie plus : on l'encaisse jusqu'au bout.
  const modifiable = peutCommander && note.data.totalPaye === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {refus !== null && <Alerte ton="danger">{refus}</Alerte>}
        {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
        {erreur !== null && <AlerteErreur erreur={erreur} />}
        {carte.isPending && <Chargement texte={t('caisse.carte.chargement')} />}
        {carte.isError && <AlerteErreur erreur={carte.error} />}
        {carte.data && (
          <CarteCaisse
            carte={carte.data}
            devise={devise}
            surChoisir={(produit) => {
              if (modifiable) void ajouter(produit)
            }}
          />
        )}
      </div>
      <PanneauNote
        note={note.data}
        devise={devise}
        fuseauHoraire={fuseauHoraire}
        modifiable={modifiable}
        peutEncaisser={peutEncaisser}
        peutServir={peutCommander && note.data.statut !== 'ANNULEE'}
        surServir={(ligne) =>
          void agir(() =>
            appelerCaisse<CommandeDetail>(
              `/caisse/commandes/${commandeId}/lignes/${ligne.id}/service`,
              { methode: 'POST' },
            ),
          )
        }
        surServirTout={() =>
          void agir(() =>
            appelerCaisse<CommandeDetail>(`/caisse/commandes/${commandeId}/service`, {
              methode: 'POST',
            }),
          )
        }
        surEncaisser={() =>
          void naviguer({ to: '/caisse/notes/$commandeId/encaisser', params: { commandeId } })
        }
        ruptures={rupturesDe(carte.data, note.data.lignes)}
        envoiEnCours={enCours && aAnnuler === null && aValider === null}
        actions={
          modifiable ? (
            <ActionsNote
              note={note.data}
              devise={devise}
              fuseauHoraire={fuseauHoraire}
              peutTransferer={session?.permissions.includes('TABLE_TRANSFERER') ?? false}
              plafond={droitsDe(session).plafond}
              moi={{ id: session?.utilisateurId ?? '', nom: session?.nomCourt ?? '' }}
              surNote={retenir}
              surErreur={(echec) => {
                effacerMessages()
                setErreur(echec)
              }}
            />
          ) : null
        }
        surRetirerAddition={() =>
          void agir(() =>
            appelerCaisse<CommandeDetail>(`/caisse/commandes/${commandeId}/addition`, {
              methode: 'DELETE',
            }),
          )
        }
        surRevenir={() => void revenirAuPlan()}
        surEnvoyer={(nombre) => void envoyer(nombre)}
        surModifier={(ligne, demande) => void modifier(ligne, demande)}
        surOuvrirLigne={setLigneActions}
      />
      {ligneActions !== null && (
        <DialogueActionsLigne
          ligne={ligneActions}
          devise={devise}
          fuseauHoraire={fuseauHoraire}
          session={session}
          surFermer={() => {
            setLigneActions(null)
          }}
          surChoisir={(action) => {
            choisirPourLaLigne(ligneActions, action)
          }}
        />
      )}
      {aRemiser !== null && (
        <DialogueRemise
          titre={t('caisse.remise.titreLigne', { produit: aRemiser.nomProduit })}
          phrase={t('caisse.remise.phrase', { ou: ouEstLaNote(note.data, t) })}
          base={aRemiser.montantBrut}
          devise={devise}
          plafond={droitsDe(session).plafond}
          enCours={enCours}
          surFermer={() => {
            setARemiser(null)
          }}
          surAppliquer={(demande) => {
            remiserLigne(aRemiser, demande)
          }}
        />
      )}
      {aOffrir !== null && (
        <DialogueOffrir
          ligne={aOffrir}
          ou={ouEstLaNote(note.data, t)}
          enCours={enCours}
          surFermer={() => {
            setAOffrir(null)
          }}
          surOffrir={(demande) => {
            offrir(aOffrir, demande)
          }}
        />
      )}
      {validation.dialogue}
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
      {aAnnuler !== null && (
        <DialogueAnnulation
          ligne={aAnnuler}
          ou={ouEstLaNote(note.data, t)}
          fuseauHoraire={fuseauHoraire}
          enCours={enCours}
          surFermer={() => {
            setAAnnuler(null)
          }}
          surAnnuler={(demande) => void annuler(aAnnuler, demande)}
        />
      )}
      {aValider !== null && (
        <DialogueValidationGerant
          titre={t('caisse.note.annulation.validationTitre', {
            count: aValider.demande.quantite,
            produit: aValider.ligne.nomProduit,
          })}
          contexte={t('caisse.note.annulation.validationContexte', {
            ou: ouEstLaNote(note.data, t),
            demandeur: session?.nomCourt ?? '',
            motif:
              aValider.demande.motif === 'AUTRE' && aValider.demande.detail !== undefined
                ? aValider.demande.detail
                : t(`caisse.motifs.${aValider.demande.motif}`),
          })}
          permission="LIGNE_ANNULER_APRES_ENVOI"
          objetId={aValider.ligne.id}
          libelleAnnuler={t('caisse.note.annulation.garder')}
          surValide={(validation) =>
            void annuler(aValider.ligne, { ...aValider.demande, validationId: validation.id })
          }
          surAnnuler={() => {
            setAValider(null)
          }}
        />
      )}
    </div>
  )
}

/** Articles à envoyer qui ne se vendent plus d'après la carte : épuisés, ou retirés de la carte. */
function rupturesDe(
  carte: LigneCarteEtablissement[] | undefined,
  lignes: LigneNote[],
): Map<string, Rupture> {
  const ruptures = new Map<string, Rupture>()
  if (carte === undefined) return ruptures
  const parProduit = new Map(carte.map((ligne) => [ligne.produitId, ligne]))
  for (const ligne of lignes) {
    if (ligne.statut !== 'BROUILLON') continue
    const produit = parProduit.get(ligne.produitId)
    if (produit === undefined) ruptures.set(ligne.produitId, 'RETIRE')
    else if (produit.epuise) ruptures.set(ligne.produitId, 'EPUISE')
  }
  return ruptures
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

function messageRefusEnvoi(
  produit: string,
  aJour: LigneCarteEtablissement | undefined,
  fuseauHoraire: string,
  t: TFunction,
): string {
  if (aJour === undefined) return t('caisse.note.refusEnvoiRetire', { produit })
  if (aJour.epuisePar !== undefined && aJour.epuiseLe !== undefined) {
    return t('caisse.note.refusEnvoi', {
      produit,
      qui: aJour.epuisePar,
      heure: formaterHeure(aJour.epuiseLe, fuseauHoraire),
    })
  }
  return t('caisse.note.refusEnvoiSansDetail', { produit })
}
