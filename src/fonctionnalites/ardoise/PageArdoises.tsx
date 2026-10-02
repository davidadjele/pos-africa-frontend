import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Eye, Pencil, RotateCw, Undo2, UserPlus, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { ClientArdoise } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterDateHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { PAYS_PAR_DEFAUT } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { BarreFiltres } from '../../partage/ui/BarreFiltres'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions, type ActionMenu } from '../../partage/ui/MenuActions'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { SelecteurEtablissement } from '../etablissements/SelecteurEtablissement'
import { useEtablissementChoisi } from '../etablissements/useEtablissementChoisi'
import { Chiffre } from './Chiffre'
import { DialogueClient } from './DialogueClient'
import { JOURS_RELANCE, joursDepuis, libelleEcriture } from './presentation'
import { requeteArdoises } from './requetes'
import { useActionsArdoise } from './useActionsArdoise'

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
  const naviguer = useNavigate()
  const { moi } = useSession()
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const pays = moi?.entrepriseCourante?.pays ?? PAYS_PAR_DEFAUT.pays
  const { etablissements, etablissement } = useEtablissementChoisi(etablissementId)
  const ardoises = useQuery({
    ...requeteArdoises(etablissement?.id ?? ''),
    enabled: etablissement !== undefined,
  })
  const [filtre, setFiltre] = useState<Filtre>('doivent')
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<Ouvert>(null)
  const { confirmation, setConfirmation, enCours, erreur, apres, basculer } = useActionsArdoise(
    etablissement?.id,
    () => {
      setOuvert(null)
    },
  )
  const courte = (montant: number) =>
    formaterMontant({ unitesMineures: montant, devise }, { forme: 'courte' })

  const fermer = (client: ClientArdoise) =>
    basculer(client.id, 'desactivation', t('ardoise.fermee', { nom: client.nom }))
  const rouvrir = (client: ClientArdoise) =>
    basculer(client.id, 'reactivation', t('ardoise.rouverte', { nom: client.nom }))

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

      <SelecteurEtablissement
        etablissements={etablissements.data?.elements}
        valeur={etablissement?.id ?? ''}
        libelle={t('ardoise.etablissement')}
        surChoisir={(id) => {
          setConfirmation(null)
          void naviguer({ to: '/gestion/ardoises', search: { etablissement: id } })
        }}
      />

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
              <BarreFiltres
                filtres={FILTRES.map((cle) => ({
                  cle,
                  libelle: t(`ardoise.filtres.${cle}`),
                  nombre: nombres[cle],
                }))}
                actif={filtre}
                surChoisir={setFiltre}
                recherche={{
                  libelle: t('ardoise.rechercher'),
                  valeur: recherche,
                  surChanger: setRecherche,
                }}
              />
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
            pays={pays}
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
