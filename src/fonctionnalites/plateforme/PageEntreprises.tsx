import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Plus, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RechercheEntreprises } from '../../app/routeur'
import type { EntreprisePlateforme } from '../../partage/api/contrat'
import { formaterDate } from '../../partage/dates/formaterDate'
import { nomPays } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton, classesBouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { Pagination, Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { FUSEAU_APPAREIL, requeteEntreprises, TAILLE_PAGE } from './requetes'
import { signalEntreprise } from './signaux'

export function PageEntreprises({ recherche }: Readonly<{ recherche: RechercheEntreprises }>) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(0)
  const [saisie, setSaisie] = useState('')
  const [cherche, setCherche] = useState('')
  const requete = useQuery(requeteEntreprises(page, cherche))
  const maintenant = new Date()
  const cleConfirmation =
    recherche.compteExistant === true
      ? 'plateforme.entreprises.creeeCompteExistant'
      : 'plateforme.entreprises.creee'
  const confirmation =
    recherche.creee === undefined ? null : t(cleConfirmation, { nom: recherche.creee })

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
      rendu: (e) => (
        <>
          {nomPays(e.pays, i18n.language)}
          <span className="text-attenue">, {e.devise}</span>
        </>
      ),
      masqueeSurTelephone: true,
    },
    {
      cle: 'etablissements',
      entete: t('plateforme.entreprises.colonnes.etablissements'),
      rendu: (e) => e.nombreEtablissements,
      numerique: true,
    },
    {
      cle: 'vente',
      entete: t('plateforme.entreprises.colonnes.derniereVente'),
      rendu: (e) => {
        const signal = signalEntreprise(e, maintenant)
        return (
          <span className="flex flex-wrap items-center gap-2">
            {e.derniereVenteLe === undefined ? (
              <span className="text-attenue">{t('plateforme.entreprises.aucuneVente')}</span>
            ) : (
              formaterDate(e.derniereVenteLe, FUSEAU_APPAREIL)
            )}
            {signal !== null && (
              <BadgeStatut ton={signal === 'SANS_VENTE' ? 'alerte' : 'neutre'}>
                {t(`plateforme.entreprises.signaux.${signal}`)}
              </BadgeStatut>
            )}
          </span>
        )
      },
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
      rendu: (e) => (
        <Link
          to="/plateforme/entreprises/$entrepriseId"
          params={{ entrepriseId: e.id }}
          aria-label={t('plateforme.entreprises.ouvrirNomme', { nom: e.nom })}
          className={classesBouton('secondaire')}
        >
          {t('plateforme.entreprises.ouvrir')}
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
      ),
    },
  ]

  const liste = requete.data
  const vide = liste?.total === 0 && cherche === ''
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

      <form
        role="search"
        className="max-w-md"
        onSubmit={(evenement) => {
          evenement.preventDefault()
          setPage(0)
          setCherche(saisie.trim())
        }}
      >
        <ChampSaisie
          type="search"
          libelle={t('plateforme.entreprises.rechercher')}
          placeholder={t('plateforme.entreprises.rechercherExemple')}
          value={saisie}
          onChange={(evenement) => {
            setSaisie(evenement.target.value)
          }}
        />
      </form>

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

      {liste?.total === 0 && cherche !== '' && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            titre={t('plateforme.entreprises.aucunResultat.titre')}
            phrase={t('plateforme.entreprises.aucunResultat.phrase', { recherche: cherche })}
          />
        </section>
      )}

      {liste !== undefined && liste.total > 0 && (
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
    </div>
  )
}
