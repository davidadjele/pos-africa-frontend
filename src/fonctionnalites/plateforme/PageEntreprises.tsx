import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RechercheEntreprises } from '../../app/routeur'
import { appelerApi } from '../../partage/api/appelerApi'
import type { EntreprisePlateforme, PageEntreprisesPlateforme } from '../../partage/api/contrat'
import { formaterDate } from '../../partage/dates/formaterDate'
import { nomPays } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton, classesBouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { Pagination, Tableau, type ColonneTableau } from '../../partage/ui/Tableau'

const TAILLE_PAGE = 50

function requeteEntreprises(page: number) {
  return queryOptions({
    queryKey: ['plateforme', 'entreprises', page],
    queryFn: ({ signal }) =>
      appelerApi<PageEntreprisesPlateforme>(
        `/plateforme/entreprises?page=${String(page)}&taille=${String(TAILLE_PAGE)}`,
        { signal },
      ),
  })
}

// L'administrateur n'a pas d'entreprise : les dates suivent le fuseau de son appareil.
const FUSEAU_APPAREIL = Intl.DateTimeFormat().resolvedOptions().timeZone

interface Changement {
  action: 'suspension' | 'reactivation'
  entreprise: EntreprisePlateforme
}

export function PageEntreprises({ recherche }: Readonly<{ recherche: RechercheEntreprises }>) {
  const { t, i18n } = useTranslation()
  const clientRequetes = useQueryClient()
  const [page, setPage] = useState(0)
  const requete = useQuery(requeteEntreprises(page))
  const [changement, setChangement] = useState<Changement | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreurChangement, setErreurChangement] = useState<unknown>(null)
  const [confirmation, setConfirmation] = useState<string | null>(() => {
    if (recherche.creee === undefined) return null
    return recherche.compteExistant === true
      ? t('plateforme.entreprises.creeeCompteExistant', { nom: recherche.creee })
      : t('plateforme.entreprises.creee', { nom: recherche.creee })
  })

  function demander(action: Changement['action'], entreprise: EntreprisePlateforme) {
    setErreurChangement(null)
    setChangement({ action, entreprise })
  }

  async function confirmer({ action, entreprise }: Changement) {
    setEnCours(true)
    try {
      await appelerApi(`/plateforme/entreprises/${entreprise.id}/${action}`, { methode: 'POST' })
      setChangement(null)
      setConfirmation(t(`plateforme.entreprises.${action}.faite`, { nom: entreprise.nom }))
      await clientRequetes.invalidateQueries({ queryKey: ['plateforme', 'entreprises'] })
    } catch (erreur) {
      setErreurChangement(erreur)
    } finally {
      setEnCours(false)
    }
  }

  const colonnes: ColonneTableau<EntreprisePlateforme>[] = [
    {
      cle: 'entreprise',
      entete: t('plateforme.entreprises.colonnes.entreprise'),
      rendu: (e) => (
        <>
          <span className="font-semibold">{e.nom}</span>
          <span className="block text-legende text-attenue">
            {t('plateforme.entreprises.creeeLe', { date: formaterDate(e.creeLe, FUSEAU_APPAREIL) })}
          </span>
        </>
      ),
    },
    {
      cle: 'pays',
      entete: t('plateforme.entreprises.colonnes.pays'),
      rendu: (e) => nomPays(e.pays, i18n.language),
      masqueeSurTelephone: true,
    },
    {
      cle: 'etablissements',
      entete: t('plateforme.entreprises.colonnes.etablissements'),
      rendu: (e) => e.nombreEtablissements,
      numerique: true,
    },
    {
      cle: 'statut',
      entete: t('plateforme.entreprises.colonnes.statut'),
      rendu: (e) => (
        <BadgeStatut ton={e.statut === 'ACTIVE' ? 'succes' : 'danger'}>
          {t(`plateforme.entreprises.statut.${e.statut}`)}
        </BadgeStatut>
      ),
    },
    {
      cle: 'actions',
      entete: t('plateforme.entreprises.colonnes.actions'),
      rendu: (e) =>
        e.statut === 'ACTIVE' ? (
          <Bouton
            variante="danger"
            aria-label={t('plateforme.entreprises.suspendreNomme', { nom: e.nom })}
            onClick={() => {
              demander('suspension', e)
            }}
          >
            {t('plateforme.entreprises.suspendre')}
          </Bouton>
        ) : (
          <Bouton
            aria-label={t('plateforme.entreprises.reactiverNomme', { nom: e.nom })}
            onClick={() => {
              demander('reactivation', e)
            }}
          >
            {t('plateforme.entreprises.reactiver')}
          </Bouton>
        ),
    },
  ]

  const liste = requete.data
  const vide = liste?.total === 0
  const lienCreation = (
    <Link to="/plateforme/entreprises/nouvelle" className={classesBouton('principal')}>
      <Plus aria-hidden="true" size={18} />
      {t('plateforme.entreprises.creer')}
    </Link>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-titre-page text-encre">{t('plateforme.entreprises.titre')}</h1>
        {liste !== undefined && !vide && lienCreation}
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}

      {requete.isPending && <Chargement texte={t('plateforme.entreprises.chargement')} />}

      {requete.isError && (
        <AlerteErreur
          erreur={requete.error}
          action={
            <Bouton icone={RotateCw} onClick={() => void requete.refetch()}>
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}

      {vide && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            titre={t('plateforme.entreprises.vide.titre')}
            phrase={t('plateforme.entreprises.vide.phrase')}
            action={lienCreation}
          />
        </section>
      )}

      {liste !== undefined && !vide && (
        <>
          <Tableau
            libelle={t('plateforme.entreprises.tableau')}
            colonnes={colonnes}
            lignes={liste.elements}
            cleLigne={(e) => e.id}
          />
          <Pagination
            page={page}
            taille={TAILLE_PAGE}
            total={liste.total}
            surChangerPage={setPage}
          />
        </>
      )}

      {changement !== null && (
        <Dialogue
          titre={t(`plateforme.entreprises.${changement.action}.titre`, {
            nom: changement.entreprise.nom,
          })}
          consequence={t(`plateforme.entreprises.${changement.action}.consequence`)}
          libelleAnnuler={t(`plateforme.entreprises.${changement.action}.annuler`)}
          libelleConfirmer={t(`plateforme.entreprises.${changement.action}.confirmer`)}
          tonConfirmation={changement.action === 'suspension' ? 'danger' : 'principal'}
          enCours={enCours}
          surAnnuler={() => {
            setChangement(null)
          }}
          surConfirmer={() => void confirmer(changement)}
        >
          {erreurChangement !== null && <AlerteErreur erreur={erreurChangement} />}
        </Dialogue>
      )}
    </div>
  )
}
