import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ArrowRightLeft, Ban, Percent, Receipt, UserRoundPen, Users } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type {
  CommandeDetail,
  DemandeAnnulationNote,
  DemandeRemise,
  MotifAnnulation,
  ProfilCaisse,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { MenuActions, type ActionMenu } from '../../partage/ui/MenuActions'
import { usePiegeFocus } from '../../partage/ui/usePiegeFocus'
import { DialogueValidationGerant } from '../validation/DialogueValidationGerant'
import { ChoixMotif, libelleMotif, useChoixMotif } from './ChoixMotif'
import { ChoixRetourStock, retourParDefaut } from './DialoguesLigne'
import { DialogueRemise, libelleRemise } from './DialoguesRemise'
import { requetePlan, requeteStockCaisse, stockDuProduit } from './requetes'
import { useValidation } from './useValidation'

const MOTIFS_NOTE: MotifAnnulation[] = [
  'ERREUR_SAISIE',
  'CLIENT_PARTI',
  'CLIENT_CHANGE_AVIS',
  'AUTRE',
]

type Dialogues = 'transfert' | 'serveur' | 'couverts' | 'annulation' | 'remise'

/**
 * Actions sur la note entière, rares, derrière un menu pour ne pas se toucher par erreur : table,
 * serveur, couverts, addition demandée, annulation.
 */
export function ActionsNote({
  note,
  devise,
  fuseauHoraire,
  peutTransferer,
  plafond,
  moi,
  surNote,
  surErreur,
}: Readonly<{
  note: CommandeDetail
  devise: Devise
  fuseauHoraire: string
  peutTransferer: boolean
  /** Remise que l'employé accorde seul, en points de base. */
  plafond: number
  /** L'employé qui tient la caisse. */
  moi: { id: string; nom: string }
  surNote: (note: CommandeDetail) => void
  surErreur: (erreur: unknown) => void
}>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const naviguer = useNavigate()
  const [dialogue, setDialogue] = useState<Dialogues | null>(null)
  const [aValider, setAValider] = useState<DemandeAnnulationNote | null>(null)
  const [enCours, setEnCours] = useState(false)
  const chemin = `/caisse/commandes/${note.id}`
  const validation = useValidation()
  const nom = note.table?.nom ?? t('caisse.note.numero', { numero: note.numero })

  async function agir(suffixe: string, methode: 'POST' | 'PUT' | 'DELETE', corps?: unknown) {
    setEnCours(true)
    surErreur(null)
    try {
      surNote(
        await appelerCaisse<CommandeDetail>(`${chemin}/${suffixe}`, {
          methode,
          ...(corps === undefined ? {} : { corps }),
        }),
      )
      void clientRequetes.invalidateQueries({ queryKey: requetePlan.queryKey })
    } catch (echec) {
      surErreur(echec)
      // Table prise entre-temps : le plan relu la montre occupée.
      void clientRequetes.invalidateQueries({ queryKey: requetePlan.queryKey })
    } finally {
      setEnCours(false)
      setDialogue(null)
    }
  }

  async function remiser(demande: DemandeRemise) {
    setDialogue(null)
    surErreur(null)
    setEnCours(true)
    try {
      const reponse = await validation.executer(
        (validationId) =>
          appelerCaisse<CommandeDetail>(`${chemin}/remise`, {
            methode: 'PUT',
            corps: validationId === undefined ? demande : { ...demande, validationId },
          }),
        {
          permission: 'REMISE_AU_DELA_PLAFOND',
          objetId: note.id,
          titre: t('caisse.remise.validationTitre', {
            remise: libelleRemise(demande, devise),
            objet: t('caisse.remise.laNote'),
          }),
          contexte: t('caisse.remise.validationContexte', {
            ou: nom,
            demandeur: moi.nom,
            motif: libelleMotif(demande.motif, demande.detail, t, 'caisse.motifsRemise'),
          }),
        },
      )
      if (reponse !== undefined) surNote(reponse)
    } catch (echec) {
      surErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  async function retirerRemise() {
    surErreur(null)
    setEnCours(true)
    try {
      const reponse = await validation.executer(
        (validationId) =>
          appelerCaisse<CommandeDetail>(`${chemin}/remise/retrait`, {
            methode: 'POST',
            corps: validationId === undefined ? {} : { validationId },
          }),
        {
          permission: 'REMISE_AU_DELA_PLAFOND',
          objetId: note.id,
          titre: t('caisse.remise.retraitTitre', { objet: t('caisse.remise.laNote') }),
          contexte: t('caisse.remise.retraitContexte', { ou: nom, demandeur: moi.nom }),
        },
      )
      if (reponse !== undefined) surNote(reponse)
    } catch (echec) {
      surErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  async function annuler(demande: DemandeAnnulationNote) {
    setEnCours(true)
    surErreur(null)
    try {
      await appelerCaisse(`${chemin}/annulation`, { methode: 'POST', corps: demande })
      await clientRequetes.invalidateQueries({ queryKey: requetePlan.queryKey })
      await naviguer({ to: '/caisse' })
    } catch (echec) {
      // Des articles sont partis en préparation : un gérant présent valide par son PIN.
      if (
        echec instanceof ErreurApi &&
        echec.code === 'VALIDATION_REQUISE' &&
        demande.validationId === undefined
      ) {
        setAValider(demande)
      } else {
        setAValider(null)
        surErreur(echec)
      }
    } finally {
      setEnCours(false)
      setDialogue(null)
    }
  }

  const actions: ActionMenu[] = [
    ...(peutTransferer && note.table !== undefined
      ? [
          {
            libelle: t('caisse.note.actions.transferer'),
            icone: ArrowRightLeft,
            surChoisir: () => {
              setDialogue('transfert')
            },
          },
        ]
      : []),
    ...(peutTransferer
      ? [
          {
            libelle: t('caisse.note.actions.serveur'),
            icone: UserRoundPen,
            surChoisir: () => {
              setDialogue('serveur')
            },
          },
        ]
      : []),
    ...(note.table === undefined
      ? []
      : [
          {
            libelle: t('caisse.note.actions.couverts'),
            icone: Users,
            surChoisir: () => {
              setDialogue('couverts')
            },
          },
        ]),
    ...(note.additionDemandeeLe === undefined
      ? [
          {
            libelle: t('caisse.note.actions.addition'),
            icone: Receipt,
            surChoisir: () => void agir('addition', 'POST'),
          },
        ]
      : []),
    note.remiseNote === undefined
      ? {
          libelle: t('caisse.note.actions.remise'),
          icone: Percent,
          surChoisir: () => {
            setDialogue('remise')
          },
        }
      : {
          libelle: t('caisse.note.retirerRemiseNote'),
          icone: Percent,
          surChoisir: () => void retirerRemise(),
        },
    {
      libelle: t('caisse.note.actions.annuler'),
      icone: Ban,
      ton: 'danger' as const,
      surChoisir: () => {
        setDialogue('annulation')
      },
    },
  ]

  const envoyees = note.lignes.filter((ligne) => ligne.statut === 'ENVOYEE')
  const montantEnvoye = envoyees.reduce((somme, ligne) => somme + ligne.montant, 0)

  return (
    <>
      <MenuActions libelle={t('caisse.note.actions.titre')} actions={actions} />
      {dialogue === 'transfert' && (
        <DialogueTransfert
          note={note}
          devise={devise}
          enCours={enCours}
          surFermer={() => {
            setDialogue(null)
          }}
          surTransferer={(tableId) => void agir('transfert', 'POST', { tableId })}
        />
      )}
      {dialogue === 'serveur' && (
        <DialogueServeur
          note={note}
          moi={moi}
          surFermer={() => {
            setDialogue(null)
          }}
          surConfier={(serveurId) => void agir('serveur', 'POST', { serveurId })}
        />
      )}
      {dialogue === 'couverts' && (
        <DialogueCouverts
          nom={nom}
          initial={note.couverts ?? 1}
          enCours={enCours}
          surFermer={() => {
            setDialogue(null)
          }}
          surEnregistrer={(couverts) => void agir('couverts', 'PUT', { couverts })}
        />
      )}
      {dialogue === 'remise' && (
        <DialogueRemise
          titre={t('caisse.remise.titreNote')}
          phrase={t('caisse.remise.phrase', { ou: nom })}
          base={note.total}
          devise={devise}
          plafond={plafond}
          enCours={enCours}
          surFermer={() => {
            setDialogue(null)
          }}
          surAppliquer={(demande) => void remiser(demande)}
        />
      )}
      {validation.dialogue}
      {dialogue === 'annulation' && (
        <DialogueAnnulationNote
          note={note}
          nom={nom}
          devise={devise}
          fuseauHoraire={fuseauHoraire}
          enCours={enCours}
          surFermer={() => {
            setDialogue(null)
          }}
          surAnnuler={(demande) => void annuler(demande)}
        />
      )}
      {aValider !== null && (
        <DialogueValidationGerant
          titre={t('caisse.note.annulationNote.titre', { ou: nom })}
          contexte={t('caisse.note.annulationNote.validationContexte', {
            numero: t('caisse.note.numero', { numero: note.numero }),
            montant: formaterMontant(
              { unitesMineures: montantEnvoye, devise },
              { forme: 'courte' },
            ),
            demandeur: moi.nom,
            motif: libelleMotif(aValider.motif, aValider.detail, t),
          })}
          permission="LIGNE_ANNULER_APRES_ENVOI"
          objetId={note.id}
          libelleAnnuler={t('caisse.note.annulationNote.garder')}
          surValide={(validation) => void annuler({ ...aValider, validationId: validation.id })}
          surAnnuler={() => {
            setAValider(null)
          }}
        />
      )}
    </>
  )
}

function DialogueTransfert({
  note,
  devise,
  enCours,
  surFermer,
  surTransferer,
}: Readonly<{
  note: CommandeDetail
  devise: Devise
  enCours: boolean
  surFermer: () => void
  surTransferer: (tableId: string) => void
}>) {
  const { t } = useTranslation()
  const plan = useQuery(requetePlan)
  const [salleId, setSalleId] = useState<string | null>(null)
  const [choisie, setChoisie] = useState<{ id: string; nom: string } | null>(null)
  const salles = plan.data?.salles ?? []
  const salle = salles.find((candidate) => candidate.id === salleId) ?? salles[0]
  const libres = (salle?.tables ?? []).filter((table) => table.note === undefined)

  return (
    <Dialogue
      titre={t('caisse.note.transfert.titre', { table: note.table?.nom ?? '' })}
      consequence={t('caisse.note.transfert.phrase', {
        numero: t('caisse.note.numero', { numero: note.numero }),
        montant: formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' }),
      })}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={
        choisie === null
          ? t('caisse.note.transfert.choisir')
          : t('caisse.note.transfert.confirmer', { table: choisie.nom })
      }
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => {
        if (choisie !== null) surTransferer(choisie.id)
      }}
    >
      {plan.isPending && <Chargement texte={t('caisse.plan.chargement')} />}
      {salles.length > 1 && (
        <div
          role="tablist"
          aria-label={t('caisse.plan.salles')}
          className="flex flex-wrap gap-0.5 self-start rounded-moyen bg-trait p-0.5"
        >
          {salles.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={candidate.id === salle?.id}
              onClick={() => {
                setSalleId(candidate.id)
              }}
              className={clsx(
                'min-h-cible-min rounded-normal px-3.5 text-corps font-semibold text-encre',
                candidate.id === salle?.id && 'bg-surface font-bold',
              )}
            >
              {candidate.nom}
            </button>
          ))}
        </div>
      )}
      {plan.data !== undefined && libres.length === 0 ? (
        <p className="m-0 text-corps text-attenue">{t('caisse.note.transfert.aucune')}</p>
      ) : (
        <ul
          aria-label={t('caisse.note.transfert.tables')}
          className="m-0 grid list-none grid-cols-3 gap-2.5 p-0 sm:grid-cols-4"
        >
          {libres.map((table) => (
            <li key={table.id}>
              <button
                type="button"
                aria-pressed={choisie?.id === table.id}
                onClick={() => {
                  setChoisie({ id: table.id, nom: table.nom })
                }}
                className={clsx(
                  'flex h-20 w-full flex-col items-start justify-between rounded-normal bg-surface p-2.5 text-left text-encre',
                  choisie?.id === table.id
                    ? 'border-2 border-accent'
                    : 'border border-bordure-controle',
                )}
              >
                <span className="text-titre-carte font-bold">{table.nom}</span>
                <span className="text-legende text-attenue">
                  {t('caisse.plan.places', { count: table.places })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialogue>
  )
}

/** Toucher un nom confie la note : un seul geste, à la relève comme en plein service. */
function DialogueServeur({
  note,
  moi,
  surFermer,
  surConfier,
}: Readonly<{
  note: CommandeDetail
  moi: { id: string; nom: string }
  surFermer: () => void
  surConfier: (serveurId: string) => void
}>) {
  const { t } = useTranslation()
  const id = useId()
  const cadre = useRef<HTMLElement>(null)
  const boutonFermer = useRef<HTMLButtonElement>(null)
  usePiegeFocus(cadre, boutonFermer, surFermer)
  // Les employés qui prennent des commandes ici, sauf celui qui tient la caisse.
  const collegues = useQuery({
    queryKey: ['caisse', 'validateurs', 'COMMANDE_CREER'],
    queryFn: ({ signal }) =>
      appelerCaisse<ProfilCaisse[]>('/caisse/validateurs?permission=COMMANDE_CREER', { signal }),
    staleTime: 0,
  })
  const candidats = (collegues.data ?? []).filter((profil) => profil.nomCourt !== note.serveur)

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
          {t('caisse.note.serveur.titre')}
        </h2>
        <p id={`${id}-phrase`} className="m-0 text-corps text-attenue">
          {t('caisse.note.serveur.phrase')}
        </p>
        {collegues.isPending && <Chargement texte={t('commun.chargement')} />}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {!note.mienne && (
            <li>
              <BoutonPersonne
                libelle={t('caisse.note.serveur.moi', { nom: moi.nom })}
                surChoisir={() => {
                  surConfier(moi.id)
                }}
              />
            </li>
          )}
          {candidats.map((profil) => (
            <li key={profil.utilisateurId}>
              <BoutonPersonne
                libelle={profil.nomCourt}
                detail={t(`roles.${profil.role}`)}
                surChoisir={() => {
                  surConfier(profil.utilisateurId)
                }}
              />
            </li>
          ))}
        </ul>
        {collegues.data !== undefined && candidats.length === 0 && note.mienne && (
          <p className="m-0 text-corps text-attenue">{t('caisse.note.serveur.aucun')}</p>
        )}
        <Bouton ref={boutonFermer} className="self-end" onClick={surFermer}>
          {t('commun.annuler')}
        </Bouton>
      </section>
    </div>
  )
}

function BoutonPersonne({
  libelle,
  detail,
  surChoisir,
}: Readonly<{ libelle: string; detail?: string; surChoisir: () => void }>) {
  return (
    <button
      type="button"
      onClick={surChoisir}
      className="flex min-h-cible-caisse w-full items-center justify-between gap-3 rounded-normal border border-bordure-controle bg-surface px-4 text-left text-corps-fort text-encre hover:bg-fond"
    >
      {libelle}
      {detail !== undefined && <span className="text-legende text-attenue">{detail}</span>}
    </button>
  )
}

function DialogueCouverts({
  nom,
  initial,
  enCours,
  surFermer,
  surEnregistrer,
}: Readonly<{
  nom: string
  initial: number
  enCours: boolean
  surFermer: () => void
  surEnregistrer: (couverts: number) => void
}>) {
  const { t } = useTranslation()
  const [couverts, setCouverts] = useState(initial)
  return (
    <Dialogue
      titre={t('caisse.note.couverts.titre', { table: nom })}
      consequence={t('caisse.note.couverts.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('caisse.note.ligne.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => {
        surEnregistrer(couverts)
      }}
    >
      <div className="flex items-center gap-3">
        <Bouton
          aria-label={t('caisse.ouverture.moins')}
          disabled={couverts <= 1}
          className="h-16 w-16 text-titre-section"
          onClick={() => {
            setCouverts(couverts - 1)
          }}
        >
          −
        </Bouton>
        <output className="chiffres flex-1 text-center text-montant-total">{couverts}</output>
        <Bouton
          aria-label={t('caisse.ouverture.plus')}
          disabled={couverts >= 99}
          className="h-16 w-16 text-titre-section"
          onClick={() => {
            setCouverts(couverts + 1)
          }}
        >
          +
        </Bouton>
      </div>
    </Dialogue>
  )
}

function DialogueAnnulationNote({
  note,
  nom,
  devise,
  fuseauHoraire,
  enCours,
  surFermer,
  surAnnuler,
}: Readonly<{
  note: CommandeDetail
  nom: string
  devise: Devise
  fuseauHoraire: string
  enCours: boolean
  surFermer: () => void
  surAnnuler: (demande: DemandeAnnulationNote) => void
}>) {
  const { t } = useTranslation()
  const choix = useChoixMotif<MotifAnnulation>()
  const stock = useQuery(requeteStockCaisse)
  const suiviEnStock = note.lignes.some(
    (ligne) =>
      ligne.statut === 'ENVOYEE' && stockDuProduit(stock.data, ligne.produitId) !== undefined,
  )
  const [retour, setRetour] = useState<boolean | null>(null)
  const revient = retour ?? (choix.motif !== null && retourParDefaut(choix.motif))
  const somme = (statut: 'ENVOYEE' | 'BROUILLON') => {
    const lignes = note.lignes.filter((ligne) => ligne.statut === statut)
    return {
      quantite: lignes.reduce((total, ligne) => total + ligne.quantite, 0),
      montant: formaterMontant(
        { unitesMineures: lignes.reduce((total, ligne) => total + ligne.montant, 0), devise },
        { forme: 'courte' },
      ),
    }
  }
  const envoyes = somme('ENVOYEE')
  const aEnvoyer = somme('BROUILLON')

  return (
    <Dialogue
      titre={t('caisse.note.annulationNote.titre', { ou: nom })}
      consequence={t('caisse.note.annulationNote.phrase', {
        numero: t('caisse.note.numero', { numero: note.numero }),
        heure: formaterHeure(note.ouverteLe, fuseauHoraire),
        serveur: note.serveur,
      })}
      libelleAnnuler={t('caisse.note.annulationNote.garder')}
      libelleConfirmer={t('caisse.note.annulationNote.confirmer')}
      tonConfirmation="danger"
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => {
        const motif = choix.valider()
        if (motif !== null) {
          surAnnuler({ ...motif, ...(suiviEnStock ? { retourEnStock: revient } : {}) })
        }
      }}
    >
      {envoyes.quantite + aEnvoyer.quantite > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 rounded-normal bg-fond px-3.5 py-3 text-libelle">
          {envoyes.quantite > 0 && (
            <li className="flex justify-between gap-3 text-encre">
              <span>{t('caisse.note.annulationNote.envoyes', { count: envoyes.quantite })}</span>
              <span className="chiffres">{envoyes.montant}</span>
            </li>
          )}
          {aEnvoyer.quantite > 0 && (
            <li className="flex justify-between gap-3 text-attenue">
              <span>{t('caisse.note.annulationNote.aEnvoyer', { count: aEnvoyer.quantite })}</span>
              <span className="chiffres">{aEnvoyer.montant}</span>
            </li>
          )}
        </ul>
      )}
      <ChoixMotif motifs={MOTIFS_NOTE} choix={choix} />
      {suiviEnStock && choix.motif !== null && (
        <ChoixRetourStock
          libelle={t('caisse.stock.articles')}
          revient={revient}
          surChoisir={setRetour}
        />
      )}
    </Dialogue>
  )
}
