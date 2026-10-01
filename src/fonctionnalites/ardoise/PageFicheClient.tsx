import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { EcritureArdoise } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterDateHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { useEtablissementChoisi } from '../etablissements/useEtablissementChoisi'
import { Chiffre } from './Chiffre'
import { DialogueClient } from './DialogueClient'
import { Anciennete } from './PageArdoises'
import { auteurEcriture, TONS_ECRITURE } from './presentation'
import { requeteFicheClient } from './requetes'

/** Un client, ce qu'il doit et chaque mouvement de son ardoise, jamais modifié. */
export function PageFicheClient({
  clientId,
  etablissement: etablissementId,
}: Readonly<{ clientId: string; etablissement?: string }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { moi } = useSession()
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const { etablissements, etablissement } = useEtablissementChoisi(etablissementId)
  const fiche = useQuery({
    ...requeteFicheClient(etablissement?.id ?? '', clientId),
    enabled: etablissement !== undefined,
  })
  const [ouvert, setOuvert] = useState<'modifier' | 'fermer' | null>(null)
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

  async function basculer(action: 'desactivation' | 'reactivation', message: string) {
    if (etablissement === undefined) return
    setEnCours(true)
    setErreur(null)
    try {
      await appelerApi(`/etablissements/${etablissement.id}/clients/${clientId}/${action}`, {
        methode: 'POST',
      })
      await apres(message)
    } catch (echec) {
      setErreur(echec)
      setOuvert(null)
    } finally {
      setEnCours(false)
    }
  }

  if (etablissements.isPending || (etablissement !== undefined && fiche.isPending)) {
    return <Chargement texte={t('ardoise.chargement')} />
  }
  if (etablissements.isError || fiche.isError) {
    return (
      <AlerteErreur
        erreur={etablissements.error ?? fiche.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void fiche.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  }
  if (etablissement === undefined || fiche.data === undefined) return null
  const { client, ecritures } = fiche.data

  const colonnes: ColonneTableau<EcritureArdoise>[] = [
    {
      cle: 'date',
      entete: t('ardoise.fiche.colonnes.date'),
      rendu: (ecriture) => (
        <span className="text-corps text-attenue">
          {formaterDateHeure(ecriture.le, etablissement.fuseauHoraire)}
        </span>
      ),
    },
    {
      cle: 'mouvement',
      entete: t('ardoise.fiche.colonnes.mouvement'),
      rendu: (ecriture) => (
        <span className="flex flex-wrap items-center gap-2">
          <BadgeStatut ton={TONS_ECRITURE[ecriture.type]}>
            {t(`ardoise.ecritures.${ecriture.type}`)}
          </BadgeStatut>
          <span className="flex flex-col">
            {ecriture.detail !== undefined && (
              <span className="text-corps text-encre">{ecriture.detail}</span>
            )}
            <span className="text-legende text-attenue">{auteurEcriture(ecriture, t)}</span>
          </span>
        </span>
      ),
    },
    {
      cle: 'montant',
      entete: t('ardoise.fiche.colonnes.montant'),
      numerique: true,
      rendu: (ecriture) => (
        <span className="chiffres text-montant-ligne text-encre">
          {ecriture.montant > 0 ? '+' : '−'}
          {formaterMontant(
            { unitesMineures: Math.abs(ecriture.montant), devise },
            { forme: 'nombre' },
          )}
        </span>
      ),
    },
    {
      cle: 'apres',
      entete: t('ardoise.fiche.colonnes.apres'),
      numerique: true,
      rendu: (ecriture) => (
        <span className="chiffres text-corps text-attenue">
          {formaterMontant({ unitesMineures: ecriture.soldeApres, devise }, { forme: 'nombre' })}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/gestion/ardoises"
        search={{ etablissement: etablissement.id }}
        className="flex min-h-cible-min w-fit items-center gap-2 text-corps text-encre"
      >
        <ArrowLeft aria-hidden="true" size={18} />
        {t('ardoise.titre')}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 flex flex-wrap items-center gap-2 text-titre-page text-encre">
            {client.nom}
            {!client.actif && <BadgeStatut ton="neutre">{t('ardoise.fermeeBadge')}</BadgeStatut>}
          </h1>
          <p className="m-0 mt-1 text-corps text-attenue">
            {[client.telephone, etablissement.nom].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto">
          {client.actif && client.solde === 0 && (
            <Bouton
              onClick={() => {
                setOuvert('fermer')
              }}
            >
              {t('ardoise.fermer')}
            </Bouton>
          )}
          {!client.actif && (
            <Bouton
              enCours={enCours}
              onClick={() =>
                void basculer('reactivation', t('ardoise.rouverte', { nom: client.nom }))
              }
            >
              {t('ardoise.rouvrir')}
            </Bouton>
          )}
          <Bouton
            icone={Pencil}
            onClick={() => {
              setOuvert('modifier')
            }}
          >
            {t('ardoise.client.modifier')}
          </Bouton>
        </div>
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
      {erreur !== null && <AlerteErreur erreur={erreur} />}

      <section
        aria-label={t('ardoise.fiche.resume', { nom: client.nom })}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <Chiffre
          libelle={t('ardoise.fiche.doit')}
          valeur={courte(client.solde)}
          sous={
            client.plafond === undefined
              ? t('ardoise.sansPlafond')
              : t('ardoise.fiche.surPlafond', { plafond: courte(client.plafond) })
          }
        />
        <Chiffre
          libelle={t('ardoise.fiche.plusAncienne')}
          valeur={<Anciennete client={client} />}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-moyen border border-trait bg-surface px-4 py-3">
          <span className="text-legende font-semibold text-attenue">
            {t('ardoise.client.note')}
          </span>
          <span className="text-corps text-encre">
            {client.note ?? t('ardoise.fiche.sansNote')}
          </span>
        </div>
      </section>

      <h2 className="m-0 mt-2 text-titre-section text-encre">{t('ardoise.fiche.mouvements')}</h2>
      {ecritures.length === 0 ? (
        <p className="m-0 text-corps text-attenue">{t('ardoise.fiche.aucun')}</p>
      ) : (
        <Tableau
          libelle={t('ardoise.fiche.mouvements')}
          colonnes={colonnes}
          lignes={ecritures}
          cleLigne={(ecriture) => ecriture.id}
        />
      )}
      <p className="m-0 text-legende text-attenue">{t('ardoise.fiche.definitif')}</p>

      {ouvert === 'modifier' && (
        <DialogueClient
          devise={devise}
          client={{
            nom: client.nom,
            telephone: client.telephone,
            plafond: client.plafond,
            note: client.note,
          }}
          surFermer={() => {
            setOuvert(null)
          }}
          surEnregistrer={async (demande) => {
            await appelerApi(`/etablissements/${etablissement.id}/clients/${clientId}`, {
              methode: 'PUT',
              corps: demande,
            })
            await apres(t('ardoise.client.modifie', { nom: demande.nom }))
          }}
        />
      )}
      {ouvert === 'fermer' && (
        <Dialogue
          titre={t('ardoise.fermerTitre', { nom: client.nom })}
          consequence={t('ardoise.fermerPhrase')}
          libelleAnnuler={t('commun.annuler')}
          libelleConfirmer={t('ardoise.fermer')}
          tonConfirmation="danger"
          enCours={enCours}
          surAnnuler={() => {
            setOuvert(null)
          }}
          surConfirmer={() =>
            void basculer('desactivation', t('ardoise.fermee', { nom: client.nom }))
          }
        />
      )}
    </div>
  )
}
