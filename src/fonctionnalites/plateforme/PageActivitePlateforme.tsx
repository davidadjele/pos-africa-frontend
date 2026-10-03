import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntreeActivitePlateforme } from '../../partage/api/contrat'
import { formaterDateHeure } from '../../partage/dates/formaterDate'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { Pagination, Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { detailActivite, tonActivite, TYPES_ACTIVITE } from './activite'
import {
  FUSEAU_APPAREIL,
  requeteActivite,
  requeteEquipe,
  TAILLE_PAGE,
  type FiltresActivite,
} from './requetes'

/** Ce que l'équipe plateforme a fait, et qui l'a fait : rien ne s'efface. */
export function PageActivitePlateforme({ entrepriseId }: Readonly<{ entrepriseId?: string }>) {
  const { t } = useTranslation()
  const [type, setType] = useState('')
  const [auteur, setAuteur] = useState('')
  const [saisie, setSaisie] = useState('')
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(0)
  const filtres: FiltresActivite = {
    ...(type === '' ? {} : { type }),
    ...(auteur === '' ? {} : { auteur }),
    ...(entrepriseId === undefined ? {} : { entrepriseId }),
    ...(recherche === '' ? {} : { recherche }),
  }
  const activite = useQuery(requeteActivite(filtres, page))
  const equipe = useQuery(requeteEquipe())

  const colonnes: ColonneTableau<EntreeActivitePlateforme>[] = [
    {
      cle: 'quand',
      entete: t('plateforme.activite.colonnes.quand'),
      rendu: (e) => (
        <span className="whitespace-nowrap">{formaterDateHeure(e.le, FUSEAU_APPAREIL)}</span>
      ),
    },
    {
      cle: 'membre',
      entete: t('plateforme.activite.colonnes.membre'),
      rendu: (e) => (
        <span className="font-semibold">{e.auteurNom ?? t('plateforme.activite.sansNom')}</span>
      ),
    },
    {
      cle: 'action',
      entete: t('plateforme.activite.colonnes.action'),
      rendu: (e) => (
        <BadgeStatut ton={tonActivite(e.type)}>
          {t(`plateforme.activite.types.${e.type}`)}
        </BadgeStatut>
      ),
    },
    {
      cle: 'entreprise',
      entete: t('plateforme.activite.colonnes.entreprise'),
      rendu: (e) =>
        e.entrepriseId === undefined || e.entrepriseNom === undefined ? (
          <span className="text-attenue">{t('plateforme.activite.equipe')}</span>
        ) : (
          <Link
            to="/plateforme/entreprises/$entrepriseId"
            params={{ entrepriseId: e.entrepriseId }}
            className="font-semibold text-encre underline"
          >
            {e.entrepriseNom}
          </Link>
        ),
    },
    {
      cle: 'detail',
      entete: t('plateforme.activite.colonnes.detail'),
      masqueeSurTelephone: true,
      rendu: (e) => detailActivite(e, t),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-titre-page text-encre">{t('plateforme.activite.titre')}</h1>
        <p className="m-0 mt-1 text-legende text-attenue">{t('plateforme.activite.phrase')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-60">
          <ChampSelection
            libelle={t('plateforme.activite.filtres.action')}
            options={[
              { valeur: '', libelle: t('plateforme.activite.filtres.toutes') },
              ...TYPES_ACTIVITE.map((valeur) => ({
                valeur,
                libelle: t(`plateforme.activite.types.${valeur}`),
              })),
            ]}
            value={type}
            onChange={(evenement) => {
              setType(evenement.target.value)
              setPage(0)
            }}
          />
        </div>
        <div className="w-60">
          <ChampSelection
            libelle={t('plateforme.activite.filtres.membre')}
            options={[
              { valeur: '', libelle: t('plateforme.activite.filtres.toute') },
              ...(equipe.data ?? []).map((membre) => ({
                valeur: membre.compteId,
                libelle: `${membre.prenom} ${membre.nom}`.trim(),
              })),
            ]}
            value={auteur}
            onChange={(evenement) => {
              setAuteur(evenement.target.value)
              setPage(0)
            }}
          />
        </div>
        {entrepriseId === undefined && (
          <form
            role="search"
            className="w-72"
            onSubmit={(evenement) => {
              evenement.preventDefault()
              setRecherche(saisie.trim())
              setPage(0)
            }}
          >
            <ChampSaisie
              type="search"
              libelle={t('plateforme.activite.filtres.entreprise')}
              placeholder={t('plateforme.activite.filtres.entrepriseExemple')}
              value={saisie}
              onChange={(evenement) => {
                setSaisie(evenement.target.value)
              }}
            />
          </form>
        )}
      </div>

      {activite.isPending && <Chargement texte={t('plateforme.activite.chargement')} />}
      {activite.isError && (
        <AlerteErreur
          erreur={activite.error}
          action={
            <Bouton icone={RotateCw} onClick={() => void activite.refetch()}>
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {activite.data?.total === 0 && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            titre={t('plateforme.activite.vide.titre')}
            phrase={t('plateforme.activite.vide.phrase')}
          />
        </section>
      )}
      {activite.data !== undefined && activite.data.total > 0 && (
        <>
          <Tableau
            libelle={t('plateforme.activite.titre')}
            colonnes={colonnes}
            lignes={activite.data.elements}
            cleLigne={(e) => e.id}
          />
          <Pagination
            page={page}
            taille={TAILLE_PAGE}
            total={activite.data.total}
            surChangerPage={setPage}
          />
        </>
      )}
    </div>
  )
}
