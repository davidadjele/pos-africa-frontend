import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ChevronRight, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TableauDeBordPlateforme } from '../../partage/api/contrat'
import { formaterDate } from '../../partage/dates/formaterDate'
import { nomPays } from '../../partage/referentiel/pays'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut, type TonStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { FUSEAU_APPAREIL, requeteTableauDeBordPlateforme } from './requetes'

const nombre = (valeur: number) => valeur.toLocaleString('fr-FR')

/** Variation entière en %, ou rien sans base de comparaison. */
function variation(actuel: number, avant: number): number | null {
  return avant === 0 ? null : Math.round(((actuel - avant) / avant) * 100)
}

/**
 * Le tableau de bord de l'équipe plateforme : des comptes et des dates, jamais un montant ; les chiffres d'affaires
 * restent aux clients.
 */
export function PageTableauDeBordPlateforme() {
  const { t } = useTranslation()
  const tableau = useQuery(requeteTableauDeBordPlateforme())

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-titre-page text-encre">{t('plateforme.tableau.titre')}</h1>
        <p className="m-0 mt-1 text-legende text-attenue">{t('plateforme.tableau.phrase')}</p>
      </div>
      {tableau.isPending && <Chargement texte={t('plateforme.tableau.chargement')} />}
      {tableau.isError && (
        <AlerteErreur
          erreur={tableau.error}
          action={
            <Bouton icone={RotateCw} onClick={() => void tableau.refetch()}>
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {tableau.data !== undefined && (
        <>
          <Indicateurs tableau={tableau.data} />
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <NotesParJour tableau={tableau.data} />
            <ARelancer tableau={tableau.data} />
          </div>
          <Nouvelles tableau={tableau.data} />
        </>
      )}
    </div>
  )
}

function Indicateurs({ tableau }: Readonly<{ tableau: TableauDeBordPlateforme }>) {
  const { t } = useTranslation()
  const { indicateurs } = tableau
  const ecart = variation(indicateurs.notesHier, indicateurs.notesSemaineAvant)
  const tuiles: {
    libelle: string
    valeur: number
    detail?: { texte: string; ton?: TonStatut } | undefined
    lien?: '/plateforme/support'
  }[] = [
    {
      libelle: t('plateforme.tableau.actives'),
      valeur: indicateurs.actives,
      detail:
        indicateurs.nouvellesSemaine > 0
          ? {
              texte: t('plateforme.tableau.nouvellesSemaine', {
                count: indicateurs.nouvellesSemaine,
              }),
              ton: 'succes',
            }
          : undefined,
    },
    { libelle: t('plateforme.tableau.suspendues'), valeur: indicateurs.suspendues },
    { libelle: t('plateforme.tableau.etablissements'), valeur: indicateurs.etablissements },
    { libelle: t('plateforme.tableau.tablettes'), valeur: indicateurs.tablettes },
    {
      libelle: t('plateforme.tableau.notesHier'),
      valeur: indicateurs.notesHier,
      detail:
        ecart === null
          ? undefined
          : {
              texte: t('plateforme.tableau.variation', {
                signe: ecart >= 0 ? '+' : '−',
                valeur: Math.abs(ecart),
              }),
              ton: ecart >= 0 ? 'succes' : 'alerte',
            },
    },
    {
      libelle: t('plateforme.tableau.erreurs'),
      valeur: indicateurs.erreursInternes24h,
      detail:
        indicateurs.erreursInternes24h > 0
          ? { texte: t('plateforme.tableau.erreursDetail'), ton: 'danger' }
          : undefined,
      lien: '/plateforme/support',
    },
  ]
  return (
    <ul
      aria-label={t('plateforme.tableau.indicateurs')}
      className="m-0 grid list-none grid-cols-2 gap-px overflow-hidden rounded-moyen border border-trait bg-trait p-0 md:grid-cols-3 xl:grid-cols-6"
    >
      {tuiles.map((tuile) => {
        const contenu = (
          <>
            <span className="text-legende text-attenue">{tuile.libelle}</span>
            <span className="chiffres text-montant-total text-encre">{nombre(tuile.valeur)}</span>
            {tuile.detail !== undefined && (
              <span className="self-start">
                <BadgeStatut ton={tuile.detail.ton ?? 'neutre'}>{tuile.detail.texte}</BadgeStatut>
              </span>
            )}
          </>
        )
        return (
          <li key={tuile.libelle} className="bg-surface">
            {tuile.lien === undefined ? (
              <div className="flex h-full flex-col gap-1 p-4">{contenu}</div>
            ) : (
              <Link
                to={tuile.lien}
                className="flex h-full flex-col gap-1 p-4 text-encre hover:bg-fond"
              >
                {contenu}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function NotesParJour({ tableau }: Readonly<{ tableau: TableauDeBordPlateforme }>) {
  const { t } = useTranslation()
  const jours = tableau.parJour
  const plusHaut = Math.max(1, ...jours.map((jour) => jour.notes))
  const premier = jours.at(0)
  const dernier = jours.at(-1)
  const total = jours.reduce((somme, jour) => somme + jour.notes, 0)
  return (
    <section className="flex flex-col gap-3 rounded-moyen border border-trait bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-titre-section text-encre">{t('plateforme.tableau.parJour')}</h2>
        <span className="text-legende text-attenue">{t('plateforme.tableau.parJourPhrase')}</span>
      </div>
      <div
        role="img"
        aria-label={t('plateforme.tableau.parJourResume', { total: nombre(total) })}
        className="flex h-40 items-end gap-0.5 border-b border-trait"
      >
        {jours.map((jour, rang) => (
          <span
            key={jour.jour}
            title={`${jour.jour} : ${nombre(jour.notes)}`}
            className={clsx(
              'flex-1 rounded-t-petit',
              rang === jours.length - 1 ? 'bg-accent' : 'bg-graphique-carte',
            )}
            style={{ height: `${String((jour.notes / plusHaut) * 100)}%` }}
          />
        ))}
      </div>
      {premier !== undefined && dernier !== undefined && (
        <div className="flex justify-between text-legende text-attenue">
          <span>{formaterJourCourt(premier.jour)}</span>
          <span>{formaterJourCourt(dernier.jour)}</span>
        </div>
      )}
    </section>
  )
}

/** « 2026-09-04 » → « 04/09 » : une date de journée de caisse, sans fuseau. */
function formaterJourCourt(jour: string): string {
  const [, mois = '', quantieme = ''] = jour.split('-')
  return `${quantieme}/${mois}`
}

function ARelancer({ tableau }: Readonly<{ tableau: TableauDeBordPlateforme }>) {
  const { t, i18n } = useTranslation()
  return (
    <section
      aria-labelledby="tableau-relancer"
      className="flex flex-col gap-2 rounded-moyen border border-trait bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="tableau-relancer" className="m-0 text-titre-section text-encre">
          {t('plateforme.tableau.aRelancer')}
        </h2>
        <BadgeStatut ton={tableau.aRelancer.length > 0 ? 'alerte' : 'succes'}>
          {String(tableau.aRelancer.length)}
        </BadgeStatut>
      </div>
      <p className="m-0 text-legende text-attenue">{t('plateforme.tableau.aRelancerPhrase')}</p>
      {tableau.aRelancer.length === 0 && (
        <p className="m-0 text-corps text-attenue">{t('plateforme.tableau.aRelancerVide')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {tableau.aRelancer.map((entreprise) => (
          <li
            key={entreprise.id}
            aria-label={entreprise.nom}
            className="flex items-center gap-3 border-trait py-2 not-first:border-t"
          >
            <span className="flex min-w-0 grow flex-col">
              <span className="font-semibold text-encre">
                {entreprise.nom}{' '}
                <span className="text-legende font-normal text-attenue">
                  {nomPays(entreprise.pays, i18n.language)}
                </span>
              </span>
              <span className="text-legende text-attenue">
                {entreprise.derniereVenteLe === undefined
                  ? t('plateforme.entreprises.aucuneVente')
                  : t('plateforme.tableau.derniereVente', {
                      date: formaterDate(entreprise.derniereVenteLe, FUSEAU_APPAREIL),
                    })}
              </span>
              {entreprise.proprietaire !== undefined && (
                <span className="text-legende text-attenue">
                  {[entreprise.proprietaire, entreprise.telephone ?? entreprise.email]
                    .filter((partie) => partie !== undefined)
                    .join(', ')}
                </span>
              )}
            </span>
            <Link
              to="/plateforme/entreprises/$entrepriseId"
              params={{ entrepriseId: entreprise.id }}
              aria-label={t('plateforme.entreprises.ouvrirNomme', { nom: entreprise.nom })}
              className="inline-flex min-h-cible-min shrink-0 items-center gap-1 text-libelle text-encre"
            >
              <span className="hidden sm:inline">{t('plateforme.entreprises.ouvrir')}</span>
              <ChevronRight aria-hidden="true" size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Nouvelles({ tableau }: Readonly<{ tableau: TableauDeBordPlateforme }>) {
  const { t, i18n } = useTranslation()
  return (
    <section
      aria-labelledby="tableau-nouvelles"
      className="flex max-w-3xl flex-col gap-2 rounded-moyen border border-trait bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="tableau-nouvelles" className="m-0 text-titre-section text-encre">
          {t('plateforme.tableau.nouvelles')}
        </h2>
        <span className="text-legende text-attenue">{t('plateforme.tableau.nouvellesPhrase')}</span>
      </div>
      {tableau.nouvelles.length === 0 && (
        <p className="m-0 text-corps text-attenue">{t('plateforme.tableau.nouvellesVide')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {tableau.nouvelles.map((entreprise) => (
          <li
            key={entreprise.id}
            className="flex flex-wrap items-baseline justify-between gap-2 border-trait py-2 not-first:border-t"
          >
            <span>
              <Link
                to="/plateforme/entreprises/$entrepriseId"
                params={{ entrepriseId: entreprise.id }}
                className="font-semibold text-encre underline"
              >
                {entreprise.nom}
              </Link>{' '}
              <span className="text-legende text-attenue">
                {nomPays(entreprise.pays, i18n.language)},{' '}
                {formaterDate(entreprise.creeLe, FUSEAU_APPAREIL)}
              </span>
            </span>
            <span
              className={clsx(
                'text-legende',
                entreprise.premiereVenteLe === undefined ? 'text-alerte' : 'text-attenue',
              )}
            >
              {entreprise.premiereVenteLe === undefined
                ? t('plateforme.entreprises.aucuneVente')
                : t('plateforme.tableau.premiereVente', {
                    date: formaterDate(entreprise.premiereVenteLe, FUSEAU_APPAREIL),
                  })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
