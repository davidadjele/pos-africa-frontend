import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { Eye, Pencil, RotateCw, Undo2, UserPlus, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { ClientArdoise } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterDateHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions, type ActionMenu } from '../../partage/ui/MenuActions'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { useEtablissementChoisi } from '../etablissements/useEtablissementChoisi'
import { Chiffre } from './Chiffre'
import { DialogueClient } from './DialogueClient'
import { JOURS_RELANCE, joursDepuis, libelleEcriture } from './presentation'
import { requeteArdoises } from './requetes'

type Filtre = 'doivent' | 'aRelancer' | 'tous'
const FILTRES: Filtre[] = ['doivent', 'aRelancer', 'tous']

type Ouvert =
  | { type: 'nouveau' }
  | { type: 'modifier'; client: ClientArdoise }
  | { type: 'fermer'; client: ClientArdoise }
  | null

function aRelancer(client: ClientArdoise): boolean {
  return client.detteDepuis !== undefined && joursDepuis(client.detteDepuis) > JOURS_RELANCE
}

const RETENUS: Record<Filtre, (client: ClientArdoise) => boolean> = {
  doivent: (client) => client.solde > 0,
  aRelancer,
  tous: () => true,
}

/** Les ardoises d'un établissement : ce qui est à recevoir, la plus ancienne dette en tête. */
export function PageArdoises({
  etablissement: etablissementId,
}: Readonly<{ etablissement?: string }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const naviguer = useNavigate()
  const { moi } = useSession()
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const { etablissements, etablissement } = useEtablissementChoisi(etablissementId)
  const ardoises = useQuery({
    ...requeteArdoises(etablissement?.id ?? ''),
    enabled: etablissement !== undefined,
  })
  const [filtre, setFiltre] = useState<Filtre>('doivent')
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<Ouvert>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const courte = (montant: number) =>
    formaterMontant({ unitesMineures: montant, devise }, { forme: 'courte' })

  async function apres(message: string) {
    if (etablissement === undefined) return
    await clientRequetes.invalidateQueries({ queryKey: ['ardoises', etablissement.id] })
    setOuvert(null)
    setConfirmation(message)
  }

  async function fermer(client: ClientArdoise) {
    if (etablissement === undefined) return
    setEnCours(true)
    setErreur(null)
    try {
      await appelerApi(`/etablissements/${etablissement.id}/clients/${client.id}/desactivation`, {
        methode: 'POST',
      })
      await apres(t('ardoise.fermee', { nom: client.nom }))
    } catch (echec) {
      setErreur(echec)
      setOuvert(null)
    } finally {
      setEnCours(false)
    }
  }

  async function rouvrir(client: ClientArdoise) {
    if (etablissement === undefined) return
    setErreur(null)
    try {
      await appelerApi(`/etablissements/${etablissement.id}/clients/${client.id}/reactivation`, {
        methode: 'POST',
      })
      await apres(t('ardoise.rouverte', { nom: client.nom }))
    } catch (echec) {
      setErreur(echec)
    }
  }

  const colonnes: ColonneTableau<ClientArdoise>[] = [
    {
      cle: 'client',
      entete: t('ardoise.colonnes.client'),
      rendu: (client) => (
        <>
          <Link
            to="/gestion/ardoises/$clientId"
            params={{ clientId: client.id }}
            search={etablissement === undefined ? {} : { etablissement: etablissement.id }}
            className="block font-semibold text-encre underline-offset-2 hover:underline"
          >
            {client.nom}
          </Link>
          {client.telephone !== undefined && (
            <span className="block text-legende text-attenue">{client.telephone}</span>
          )}
          {!client.actif && (
            <span className="mt-1 block">
              <BadgeStatut ton="neutre">{t('ardoise.fermeeBadge')}</BadgeStatut>
            </span>
          )}
          {/* Sur téléphone, la colonne de l'ancienneté est masquée : elle passe sous le client. */}
          {client.actif && (
            <span className="mt-1 block md:hidden">
              <Anciennete client={client} />
            </span>
          )}
        </>
      ),
    },
    {
      cle: 'solde',
      entete: t('ardoise.colonnes.doit'),
      numerique: true,
      rendu: (client) => (
        <span className="chiffres text-montant-ligne text-encre">
          {formaterMontant({ unitesMineures: client.solde, devise }, { forme: 'nombre' })}
        </span>
      ),
    },
    {
      cle: 'plafond',
      entete: t('ardoise.colonnes.plafond'),
      numerique: true,
      masqueeSurTelephone: true,
      rendu: (client) => (
        <span className="chiffres text-corps text-attenue">
          {client.plafond === undefined
            ? t('ardoise.sansPlafond')
            : formaterMontant({ unitesMineures: client.plafond, devise }, { forme: 'nombre' })}
        </span>
      ),
    },
    {
      cle: 'anciennete',
      entete: t('ardoise.colonnes.anciennete'),
      masqueeSurTelephone: true,
      rendu: (client) => <Anciennete client={client} />,
    },
    {
      cle: 'mouvement',
      entete: t('ardoise.colonnes.mouvement'),
      masqueeSurTelephone: true,
      rendu: (client) =>
        client.dernierMouvement === undefined || etablissement === undefined ? (
          <span className="text-legende text-attenue">{t('ardoise.aucunMouvement')}</span>
        ) : (
          <span className="flex flex-col">
            <span className="text-corps text-encre">
              {libelleEcriture(client.dernierMouvement, t)}
            </span>
            <span className="text-legende text-attenue">
              {formaterDateHeure(client.dernierMouvement.le, etablissement.fuseauHoraire)}
            </span>
          </span>
        ),
    },
    {
      cle: 'actions',
      entete: t('ardoise.colonnes.actions'),
      rendu: (client) => {
        const actions: ActionMenu[] = [
          {
            libelle: t('ardoise.voirFiche'),
            icone: Eye,
            surChoisir: () => {
              if (etablissement === undefined) return
              void naviguer({
                to: '/gestion/ardoises/$clientId',
                params: { clientId: client.id },
                search: { etablissement: etablissement.id },
              })
            },
          },
          {
            libelle: t('ardoise.client.modifier'),
            icone: Pencil,
            surChoisir: () => {
              setOuvert({ type: 'modifier', client })
            },
          },
        ]
        if (client.actif && client.solde === 0) {
          actions.push({
            libelle: t('ardoise.fermer'),
            icone: XCircle,
            ton: 'danger',
            surChoisir: () => {
              setOuvert({ type: 'fermer', client })
            },
          })
        }
        if (!client.actif) {
          actions.push({
            libelle: t('ardoise.rouvrir'),
            icone: Undo2,
            surChoisir: () => void rouvrir(client),
          })
        }
        return (
          <div className="flex justify-end">
            <MenuActions
              libelle={t('ardoise.plusDActions', { nom: client.nom })}
              actions={actions}
            />
          </div>
        )
      },
    },
  ]

  const clients = ardoises.data?.clients ?? []
  const motif = recherche.trim().toLowerCase()
  const nombres: Record<Filtre, number> = {
    doivent: clients.filter(RETENUS.doivent).length,
    aRelancer: clients.filter(aRelancer).length,
    tous: clients.length,
  }
  const visibles = clients
    .filter(
      (client) =>
        motif === '' ||
        client.nom.toLowerCase().includes(motif) ||
        (client.telephone ?? '').includes(motif),
    )
    .filter(RETENUS[filtre])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="m-0 text-titre-page text-encre">{t('ardoise.titre')}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('ardoise.phrase')}</p>
        </div>
        {etablissement !== undefined && (
          <Bouton
            variante="principal"
            icone={UserPlus}
            className="w-full sm:w-auto"
            onClick={() => {
              setOuvert({ type: 'nouveau' })
            }}
          >
            {t('ardoise.client.nouveau')}
          </Bouton>
        )}
      </div>

      {etablissements.data !== undefined && etablissements.data.elements.length > 1 && (
        <div className="w-60">
          <ChampSelection
            libelle={t('ardoise.etablissement')}
            options={etablissements.data.elements.map((candidat) => ({
              valeur: candidat.id,
              libelle: candidat.nom,
            }))}
            value={etablissement?.id ?? ''}
            onChange={(evenement) => {
              setConfirmation(null)
              void naviguer({
                to: '/gestion/ardoises',
                search: { etablissement: evenement.target.value },
              })
            }}
          />
        </div>
      )}

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      {(etablissements.isError || ardoises.isError) && (
        <AlerteErreur
          erreur={etablissements.error ?? ardoises.error}
          action={
            <Bouton
              icone={RotateCw}
              onClick={() => {
                void etablissements.refetch()
                void ardoises.refetch()
              }}
            >
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {(etablissements.isPending || (etablissement !== undefined && ardoises.isPending)) && (
        <Chargement texte={t('ardoise.chargement')} />
      )}

      {ardoises.data !== undefined && etablissement !== undefined && (
        <>
          <section aria-label={t('ardoise.resume')} className="flex flex-col gap-3 sm:flex-row">
            <Chiffre
              libelle={t('ardoise.aRecevoir')}
              valeur={courte(ardoises.data.aRecevoir)}
              sous={t('ardoise.clients', { count: ardoises.data.debiteurs })}
            />
            <Chiffre
              libelle={t('ardoise.aRelancer')}
              valeur={courte(ardoises.data.aRelancer)}
              sous={t('ardoise.aRelancerSous', {
                count: ardoises.data.clientsARelancer,
                jours: JOURS_RELANCE,
              })}
            />
          </section>
          {clients.length === 0 ? (
            <section className="rounded-moyen border border-trait bg-surface p-6">
              <EtatVide titre={t('ardoise.vide.titre')} phrase={t('ardoise.vide.phrase')} />
            </section>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {FILTRES.map((candidat) => (
                  <button
                    key={candidat}
                    type="button"
                    aria-pressed={filtre === candidat}
                    onClick={() => {
                      setFiltre(candidat)
                    }}
                    className={clsx(
                      'flex min-h-cible-min items-center gap-1.5 rounded-normal px-3 text-libelle font-bold',
                      filtre === candidat
                        ? 'border border-accent bg-accent text-accent-texte'
                        : 'border border-trait bg-surface text-encre',
                    )}
                  >
                    {t(`ardoise.filtres.${candidat}`)}
                    <span className="chiffres opacity-70">{nombres[candidat]}</span>
                  </button>
                ))}
                <span className="flex-1" />
                <input
                  type="search"
                  aria-label={t('ardoise.rechercher')}
                  placeholder={t('ardoise.rechercher')}
                  value={recherche}
                  onChange={(evenement) => {
                    setRecherche(evenement.target.value)
                  }}
                  className="min-h-cible-min w-full rounded-normal border border-bordure-controle bg-surface px-3 text-corps text-encre sm:w-64"
                />
              </div>
              {visibles.length === 0 ? (
                <section className="rounded-moyen border border-trait bg-surface p-6">
                  <EtatVide titre={t('ardoise.aucun.titre')} phrase={t('ardoise.aucun.phrase')} />
                </section>
              ) : (
                <Tableau
                  libelle={t('ardoise.tableau', { etablissement: etablissement.nom })}
                  colonnes={colonnes}
                  lignes={visibles}
                  cleLigne={(client) => client.id}
                />
              )}
            </>
          )}
        </>
      )}

      {etablissement !== undefined &&
        (ouvert?.type === 'nouveau' || ouvert?.type === 'modifier') && (
          <DialogueClient
            devise={devise}
            {...(ouvert.type === 'modifier'
              ? {
                  client: {
                    nom: ouvert.client.nom,
                    telephone: ouvert.client.telephone,
                    plafond: ouvert.client.plafond,
                    note: ouvert.client.note,
                  },
                }
              : {})}
            surFermer={() => {
              setOuvert(null)
            }}
            surEnregistrer={async (demande) => {
              const modifie = ouvert.type === 'modifier'
              const clients = `/etablissements/${etablissement.id}/clients`
              await appelerApi(modifie ? `${clients}/${ouvert.client.id}` : clients, {
                methode: modifie ? 'PUT' : 'POST',
                corps: demande,
              })
              await apres(
                t(modifie ? 'ardoise.client.modifie' : 'ardoise.client.ouvert', {
                  nom: demande.nom,
                }),
              )
            }}
          />
        )}
      {ouvert?.type === 'fermer' && (
        <Dialogue
          titre={t('ardoise.fermerTitre', { nom: ouvert.client.nom })}
          consequence={t('ardoise.fermerPhrase')}
          libelleAnnuler={t('commun.annuler')}
          libelleConfirmer={t('ardoise.fermer')}
          tonConfirmation="danger"
          enCours={enCours}
          surAnnuler={() => {
            setOuvert(null)
          }}
          surConfirmer={() => void fermer(ouvert.client)}
        />
      )}
    </div>
  )
}

/** « Depuis 45 jours » : marqué au-delà du délai de relance ; « Rien à payer » sans dette. */
export function Anciennete({ client }: Readonly<{ client: ClientArdoise }>) {
  const { t } = useTranslation()
  if (client.detteDepuis === undefined) {
    return <span className="text-legende text-attenue">{t('ardoise.rienAPayer')}</span>
  }
  const jours = joursDepuis(client.detteDepuis)
  return (
    <BadgeStatut ton={jours > JOURS_RELANCE ? 'alerte' : 'neutre'}>
      {t('ardoise.depuis', { count: jours })}
    </BadgeStatut>
  )
}
