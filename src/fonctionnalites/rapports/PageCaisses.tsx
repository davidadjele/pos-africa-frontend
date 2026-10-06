import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CaisseResume } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { requeteEtablissements } from '../etablissements/requetes'
import { ChoixPeriode } from './ChoixPeriode'
import { Carre, EcartsParJour, signe } from './Graphiques'
import {
  formaterJournee,
  periodeDe,
  type ClePeriode,
  type Periode,
} from './periodes'
import { requeteCaisses } from './requetes'
import { useJourneeCourante } from './useJourneeCourante'
import { BadgeEcart } from './BadgeEcart'

const PERIODES: ClePeriode[] = ['SEPT_JOURS', 'CE_MOIS', 'MOIS_DERNIER', 'DATES']

/** Chaque ouverture de caisse et son rapport Z : d'abord les écarts, qui sont de l'argent. */
export function PageCaisses() {
  const { t } = useTranslation()
  const { moi } = useSession()
  const fuseauHoraire = moi?.entrepriseCourante?.fuseauHoraire ?? 'Africa/Lome'
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const [etablissementId, setEtablissementId] = useState('')
  const journee = useJourneeCourante(etablissementId)
  const [dates, setDates] = useState<Periode>(periodeDe('SEPT_JOURS', journee))
  const [cle, setCle] = useState<ClePeriode>('SEPT_JOURS')
  const periode = cle === 'DATES' ? dates : periodeDe(cle, journee)
  const [ecartsSeulement, setEcartsSeulement] = useState(false)
  const etablissements = useQuery(requeteEtablissements(0))
  const caisses = useQuery(requeteCaisses(periode, etablissementId, ecartsSeulement))
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })
  const listeEtablissements = etablissements.data?.elements ?? []

  const colonnes: ColonneTableau<CaisseResume>[] = [
    {
      cle: 'rapport',
      entete: t('rapports.caisses.rapport'),
      rendu: (caisse) =>
        caisse.numeroZ === undefined ? (
          <BadgeStatut ton="info">{t('rapports.caisses.enCours')}</BadgeStatut>
        ) : (
          <span className="chiffres text-montant-ligne font-bold">
            {t('rapports.caisses.z', { numero: caisse.numeroZ })}
          </span>
        ),
    },
    {
      cle: 'caisse',
      entete: t('rapports.caisses.caisse'),
      rendu: (caisse) => (
        <span className="flex flex-col">
          <span className="text-corps-fort text-encre">{caisse.caisse}</span>
          <span className="text-legende text-attenue">{caisse.etablissement}</span>
        </span>
      ),
    },
    {
      cle: 'periode',
      entete: t('rapports.caisses.periode'),
      masqueeSurTelephone: true,
      rendu: (caisse) =>
        caisse.clotureeLe === undefined
          ? t('rapports.caisses.ouverteLe', {
              jour: formaterJournee(caisse.journee),
              heure: formaterHeure(caisse.ouverteLe, fuseauHoraire),
            })
          : t('rapports.caisses.de', {
              jour: formaterJournee(caisse.journee),
              ouverture: formaterHeure(caisse.ouverteLe, fuseauHoraire),
              cloture: formaterHeure(caisse.clotureeLe, fuseauHoraire),
            }),
    },
    {
      cle: 'par',
      entete: t('rapports.caisses.par'),
      masqueeSurTelephone: true,
      rendu: (caisse) => caisse.clotureePar ?? caisse.ouvertePar,
    },
    {
      cle: 'ventes',
      entete: t('rapports.caisses.ventes'),
      numerique: true,
      // Sur téléphone, l'écart passe avant les ventes : c'est lui qu'on vient chercher.
      masqueeSurTelephone: true,
      rendu: (caisse) =>
        caisse.ventes === undefined ? (
          <span className="text-legende text-attenue">{t('rapports.caisses.enCours')}</span>
        ) : (
          <span className="chiffres">{nombre(caisse.ventes)}</span>
        ),
    },
    {
      cle: 'ecart',
      entete: t('rapports.caisses.ecart'),
      rendu: (caisse) =>
        caisse.ecart === undefined ? null : <BadgeEcart ecart={caisse.ecart} nombre={nombre} />,
    },
    {
      cle: 'voir',
      entete: '',
      rendu: (caisse) => (
        <Link
          to="/gestion/caisses/$ouvertureId"
          params={{ ouvertureId: caisse.id }}
          aria-label={t('rapports.caisses.voir', { caisse: caisse.caisse })}
          className="text-libelle font-bold text-accent-lisible"
        >
          {t('rapports.caisses.voirCourt')}
        </Link>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-titre-page text-encre">{t('rapports.caisses.titre')}</h1>
        <p className="m-0 mt-1 text-corps text-attenue">{t('rapports.caisses.phrase')}</p>
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {listeEtablissements.length > 1 && (
          <div className="w-60">
            <ChampSelection
              libelle={t('rapports.etablissement')}
              options={[
                { valeur: '', libelle: t('rapports.tousEtablissements') },
                ...listeEtablissements.map((candidat) => ({
                  valeur: candidat.id,
                  libelle: candidat.nom,
                })),
              ]}
              value={etablissementId}
              onChange={(evenement) => {
                setEtablissementId(evenement.target.value)
              }}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ChoixPeriode
            cles={PERIODES}
            cle={cle}
            periode={periode}
            journee={journee}
            surChanger={(nouvelle, nouvellePeriode) => {
              setCle(nouvelle)
              setDates(nouvellePeriode)
            }}
          />
          <label className="flex min-h-cible-min items-center gap-2 text-libelle font-bold text-encre">
            <input
              type="checkbox"
              checked={ecartsSeulement}
              onChange={(evenement) => {
                setEcartsSeulement(evenement.target.checked)
              }}
              className="size-5 accent-accent"
            />
            {t('rapports.caisses.ecartsSeulement')}
          </label>
        </div>
      </div>
      {caisses.isPending && <Chargement texte={t('rapports.caisses.chargement')} />}
      {caisses.isError && <AlerteErreur erreur={caisses.error} />}
      {caisses.data !== undefined && (
        <>
          <ul
            aria-label={t('rapports.caisses.synthese')}
            className="m-0 grid list-none grid-cols-3 overflow-hidden rounded-moyen border border-trait bg-surface p-0"
          >
            <li className="flex flex-col gap-1 px-4 py-3">
              <span className="text-legende text-attenue">{t('rapports.caisses.cloturees')}</span>
              <span className="chiffres text-montant-total text-encre">
                {caisses.data.synthese.cloturees}
              </span>
            </li>
            <li className="flex flex-col gap-1 border-l border-trait px-4 py-3">
              <span className="text-legende text-attenue">{t('rapports.caisses.ecarts')}</span>
              <span
                className={clsx(
                  'chiffres text-montant-total',
                  caisses.data.synthese.ecartCumule < 0 ? 'text-danger' : 'text-encre',
                )}
              >
                {signe(caisses.data.synthese.ecartCumule, nombre)}
              </span>
              <span className="text-legende text-attenue">
                {t('rapports.caisses.avecEcart', { count: caisses.data.synthese.avecEcart })}
              </span>
            </li>
            <li className="flex flex-col gap-1 border-l border-trait px-4 py-3">
              <span className="text-legende text-attenue">{t('rapports.caisses.ouvertes')}</span>
              <span className="chiffres text-montant-total text-encre">
                {caisses.data.synthese.ouvertes}
              </span>
            </li>
          </ul>
          <section
            aria-label={t('rapports.caisses.ecartsParJour')}
            className="flex flex-col gap-2 rounded-moyen border border-trait bg-surface px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-titre-carte text-encre">
                {t('rapports.caisses.ecartsParJour')}
              </h2>
              <span className="flex flex-wrap gap-3 text-legende text-attenue">
                <span className="flex items-center gap-1.5">
                  <Carre fond="bg-graphique-manque" />
                  {t('rapports.caisses.manque')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Carre fond="bg-graphique-surplus" />
                  {t('rapports.caisses.surplus')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Carre fond="bg-graphique-juste" />
                  {t('rapports.caisses.juste')}
                </span>
              </span>
            </div>
            <EcartsParJour jours={caisses.data.parJour.slice(-14)} nombre={nombre} />
          </section>
          {caisses.data.caisses.length === 0 ? (
            <div className="rounded-moyen border border-trait bg-surface p-6">
              <EtatVide
                titre={t('rapports.caisses.vide.titre')}
                phrase={t('rapports.caisses.vide.phrase')}
              />
            </div>
          ) : (
            <Tableau
              libelle={t('rapports.caisses.liste')}
              colonnes={colonnes}
              lignes={caisses.data.caisses}
              cleLigne={(caisse) => caisse.id}
            />
          )}
          <p className="m-0 text-legende text-attenue">{t('rapports.caisses.lecture')}</p>
        </>
      )}
    </div>
  )
}
