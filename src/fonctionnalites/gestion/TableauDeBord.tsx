import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { Ban, Clock, NotebookPen, Package, Undo2, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CaisseResume, EtablissementDuJour } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { requeteARelancer } from '../ardoise/requetes'
import { requeteEtablissements } from '../etablissements/requetes'
import { Carre, signe } from '../rapports/Graphiques'
import { ListePoints, type ElementPoint } from '../rapports/ListePoints'
import { formaterJournee, variation } from '../rapports/periodes'
import { useJourneeCourante } from '../rapports/useJourneeCourante'
import { requeteCaisses, requeteCaissesOuvertes, requeteTableauDeBord } from '../rapports/requetes'
import { requeteStockATraiter } from '../stock/requetes'
import {
  duree,
  pointsATraiter,
  type CleATraiter,
  type Destination,
  type PointATraiter,
} from './aTraiter'

/** Le tableau de bord vit : il se relit toutes les minutes, sans recharger la page. */
const RAFRAICHIR = 60_000

const ICONES: Record<CleATraiter, LucideIcon> = {
  caisseOubliee: Clock,
  ecart: Wallet,
  stockNegatif: Package,
  rupture: Ban,
  noteAncienne: Clock,
  annulations: Undo2,
  stockFaible: Package,
  ardoises: NotebookPen,
}

/**
 * L'accueil du propriétaire : ce qu'il doit traiter maintenant, et ce qui se passe dans chaque établissement. Le
 * détail des ventes, lui, est dans l'écran Ventes.
 */
export function TableauDeBord() {
  const { t } = useTranslation()
  const { moi, aLaPermission } = useSession()
  const fuseauHoraire = moi?.entrepriseCourante?.fuseauHoraire ?? 'Africa/Lome'
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const [etablissementId, setEtablissementId] = useState('')
  const ventes = aLaPermission('RAPPORT_VENTES')
  const financier = aLaPermission('RAPPORT_FINANCIER')
  const journee = useJourneeCourante(etablissementId, ventes)
  const vivant = { refetchInterval: RAFRAICHIR }
  const etablissements = useQuery({ ...requeteEtablissements(0), enabled: ventes })
  const tableau = useQuery({ ...requeteTableauDeBord(etablissementId), ...vivant, enabled: ventes })
  const ouvertes = useQuery({ ...requeteCaissesOuvertes, ...vivant, enabled: financier })
  const duJour = useQuery({
    ...requeteCaisses({ du: journee, au: journee }, etablissementId),
    ...vivant,
    enabled: financier,
  })
  const stock = useQuery({
    ...requeteStockATraiter,
    ...vivant,
    enabled: aLaPermission('STOCK_RECEPTIONNER') || aLaPermission('STOCK_AJUSTER'),
  })
  const ardoises = useQuery({
    ...requeteARelancer,
    ...vivant,
    enabled: aLaPermission('CLIENT_CREDIT'),
  })
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })

  if (!ventes) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="m-0 text-titre-page text-encre">{t('gestion.tableauDeBord.titre')}</h1>
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            titre={t('gestion.tableauDeBord.vide.titre')}
            phrase={t('gestion.tableauDeBord.vide.phrase')}
          />
        </section>
      </div>
    )
  }
  if (tableau.isPending) return <Chargement texte={t('gestion.tableauDeBord.chargement')} />
  if (tableau.isError) return <AlerteErreur erreur={tableau.error} />

  const donnees = tableau.data
  const dansLePerimetre = (caisse: CaisseResume) =>
    etablissementId === '' || caisse.etablissementId === etablissementId
  const caissesOuvertes = ouvertes.data?.filter(dansLePerimetre)
  const journees = Object.fromEntries(
    donnees.etablissements.map((etablissement) => [
      etablissement.etablissementId,
      etablissement.journee,
    ]),
  )
  const points = pointsATraiter({
    maintenant: new Date(),
    journees,
    caissesOuvertes,
    caissesDuJour: duJour.data?.caisses,
    stock: stock.data?.produits.filter(
      (produit) => etablissementId === '' || produit.etablissementId === etablissementId,
    ),
    ardoises: ardoises.data,
    etablissements: donnees.etablissements,
    annulations: donnees.annulations,
  })
  const urgents = points.filter((point) => point.ton === 'danger').length
  const aSurveiller = points.filter((point) => point.ton === 'alerte').length
  const listeEtablissements = etablissements.data?.elements ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <h1 className="m-0 text-titre-page text-encre">{t('gestion.tableauDeBord.titre')}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">
            {t('gestion.tableauDeBord.misAJour', {
              jour: formaterJournee(journee),
              heure: formaterHeure(new Date(tableau.dataUpdatedAt).toISOString(), fuseauHoraire),
            })}
          </p>
        </div>
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
      </div>
      <Vendu
        chiffre={donnees.chiffreAffaires}
        comparable={donnees.comparable}
        journee={journee}
        heure={formaterHeure(donnees.maintenant, fuseauHoraire)}
        nombre={nombre}
        courte={(valeur) =>
          formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section
          aria-label={t('gestion.tableauDeBord.aTraiter.titre')}
          className="flex flex-col rounded-moyen border border-trait bg-surface px-4 py-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-titre-carte text-encre">
              {t('gestion.tableauDeBord.aTraiter.titre')}
            </h2>
            <span className="flex gap-1.5">
              {urgents > 0 && (
                <BadgeStatut ton="danger">
                  {t('gestion.tableauDeBord.aTraiter.urgents', { count: urgents })}
                </BadgeStatut>
              )}
              {aSurveiller > 0 && (
                <BadgeStatut ton="alerte">
                  {t('gestion.tableauDeBord.aTraiter.aSurveiller', { count: aSurveiller })}
                </BadgeStatut>
              )}
            </span>
          </div>
          <ListePoints
            vide={t('gestion.tableauDeBord.aTraiter.rien')}
            points={points.map((point) => element(point, t, nombre, fuseauHoraire))}
          />
        </section>
        <div className="flex flex-col gap-3">
          <h2 className="m-0 text-titre-carte text-encre">
            {t('gestion.tableauDeBord.enCeMoment')}
          </h2>
          {donnees.etablissements.map((etablissement) => (
            <EnCeMoment
              key={etablissement.etablissementId}
              etablissement={etablissement}
              caisses={caissesOuvertes?.filter(
                (caisse) => caisse.etablissementId === etablissement.etablissementId,
              )}
              maintenant={new Date(donnees.maintenant)}
              fuseauHoraire={fuseauHoraire}
              nombre={nombre}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Vendu({
  chiffre,
  comparable,
  journee,
  heure,
  nombre,
  courte,
}: Readonly<{
  chiffre: number
  comparable: number
  journee: string
  heure: string
  nombre: (valeur: number) => string
  courte: (valeur: number) => string
}>) {
  const { t } = useTranslation()
  const pourcent = variation(chiffre, comparable)
  const jourSemaine = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${journee}T00:00:00Z`),
  )
  return (
    <section
      aria-label={t('gestion.tableauDeBord.vendu.titre')}
      className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-moyen bg-bandeau-fond px-5 py-4 text-bandeau-texte"
    >
      <div className="flex flex-col">
        <span className="text-libelle text-bandeau-attenue">
          {t('gestion.tableauDeBord.vendu.a', { heure })}
        </span>
        <span className="chiffres text-montant-total">{courte(chiffre)}</span>
      </div>
      <span className="flex flex-wrap items-center gap-2 text-legende text-bandeau-attenue">
        {pourcent !== null && (
          <span
            className={clsx(
              'rounded-petit px-2 py-0.5 font-bold',
              pourcent >= 0 ? 'bg-graphique-especes text-accent-texte' : 'bg-alerte text-encre',
            )}
          >
            {`${signe(pourcent, String)} %`}
          </span>
        )}
        {comparable === 0
          ? t('gestion.tableauDeBord.vendu.rienAvant', { jour: jourSemaine })
          : t('gestion.tableauDeBord.vendu.comparaison', {
              jour: jourSemaine,
              montant: nombre(comparable),
            })}
      </span>
      <span className="hidden flex-1 sm:block" />
      <Link
        to="/gestion/ventes"
        search={{ du: journee, au: journee }}
        className="flex min-h-cible-min items-center rounded-normal border border-bandeau-trait px-3.5 text-libelle font-bold text-bandeau-texte"
      >
        {t('gestion.tableauDeBord.vendu.voir')}
      </Link>
    </section>
  )
}

function EnCeMoment({
  etablissement,
  caisses,
  maintenant,
  fuseauHoraire,
  nombre,
}: Readonly<{
  etablissement: EtablissementDuJour
  caisses: CaisseResume[] | undefined
  maintenant: Date
  fuseauHoraire: string
  nombre: (valeur: number) => string
}>) {
  const { t } = useTranslation()
  const titre = t('gestion.tableauDeBord.etablissement', { nom: etablissement.nom })
  const calme =
    etablissement.chiffreAffaires === 0 &&
    etablissement.notesOuvertes === 0 &&
    (caisses ?? []).length === 0
  const pourcent = variation(etablissement.chiffreAffaires, etablissement.comparable)
  if (calme) {
    return (
      <section
        aria-label={titre}
        className="rounded-moyen border border-trait bg-surface px-4 py-3 text-attenue"
      >
        <div className="flex items-baseline justify-between">
          <h3 className="m-0 text-corps-fort">{etablissement.nom}</h3>
          <span className="chiffres text-montant-ligne">0</span>
        </div>
        <p className="m-0 mt-1 text-legende">{t('gestion.tableauDeBord.calme')}</p>
      </section>
    )
  }
  const depuis =
    etablissement.plusAncienneLe === undefined
      ? 0
      : Math.floor(
          (maintenant.getTime() - new Date(etablissement.plusAncienneLe).getTime()) / 60_000,
        )
  return (
    <section
      aria-label={titre}
      className="flex flex-col gap-2.5 rounded-moyen border border-trait bg-surface px-4 py-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-corps-fort text-encre">{etablissement.nom}</h3>
        <span className="flex items-baseline gap-2">
          {pourcent !== null && (
            <BadgeStatut
              ton={pourcent >= 0 ? 'succes' : 'alerte'}
            >{`${signe(pourcent, String)} %`}</BadgeStatut>
          )}
          <span className="chiffres text-montant-ligne text-encre">
            {nombre(etablissement.chiffreAffaires)}
          </span>
        </span>
      </div>
      {caisses !== undefined && (
        <div>
          <span className="text-legende font-bold uppercase tracking-wide text-attenue">
            {t('gestion.tableauDeBord.caissesOuvertes')}
          </span>
          {caisses.length === 0 ? (
            <p className="m-0 text-legende text-attenue">
              {t('gestion.tableauDeBord.aucuneCaisse')}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {caisses.map((caisse) => {
                const oubliee = caisse.journee < etablissement.journee
                return (
                  <li key={caisse.id} className="flex justify-between gap-2 py-1 text-libelle">
                    <span className="flex items-center gap-2 font-bold text-encre">
                      <Carre fond="bg-graphique-especes" />
                      {caisse.caisse}
                    </span>
                    <span className={oubliee ? 'font-bold text-danger' : 'text-attenue'}>
                      {oubliee
                        ? t('gestion.tableauDeBord.depuisLe', {
                            nom: caisse.ouvertePar,
                            jour: formaterJournee(caisse.journee),
                            heure: formaterHeure(caisse.ouverteLe, fuseauHoraire),
                          })
                        : t('gestion.tableauDeBord.depuis', {
                            nom: caisse.ouvertePar,
                            heure: formaterHeure(caisse.ouverteLe, fuseauHoraire),
                          })}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-trait pt-2 text-libelle text-encre">
        <span>
          {etablissement.notesOuvertes === 0
            ? t('gestion.tableauDeBord.aucuneNote')
            : t('gestion.tableauDeBord.notesOuvertes', { count: etablissement.notesOuvertes })}
          {etablissement.plusAncienneNote !== undefined &&
            depuis >= 1 &&
            t('gestion.tableauDeBord.plusAncienne', {
              duree: duree(depuis),
              note: etablissement.plusAncienneNote,
            })}
        </span>
        {etablissement.aEncaisser > 0 && (
          <span className="chiffres font-bold">
            {t('gestion.tableauDeBord.aEncaisser', { montant: nombre(etablissement.aEncaisser) })}
          </span>
        )}
      </div>
    </section>
  )
}

/** Un point à traiter, dit en clair, avec le lien vers l'écran où l'on agit. */
function element(
  point: PointATraiter,
  t: TFunction,
  nombre: (valeur: number) => string,
  fuseauHoraire: string,
): ElementPoint {
  const valeurs: Record<string, string | number> = { ...point.valeurs }
  for (const cle of ['montant', 'ecart', 'quantite'] as const) {
    const valeur = point.valeurs[cle]
    if (typeof valeur === 'number')
      valeurs[cle] = cle === 'montant' ? nombre(valeur) : signe(valeur, nombre)
  }
  const ouverteLe = point.valeurs.ouverteLe
  if (typeof ouverteLe === 'string') {
    valeurs.jour = formaterJournee(ouverteLe.slice(0, 10))
    valeurs.heure = formaterHeure(ouverteLe, fuseauHoraire)
  }
  const lien = lienDe(point.destination)
  return {
    identifiant: `${point.cle}-${point.identifiant}`,
    ton: point.ton,
    icone: ICONES[point.cle],
    titre: t(`gestion.tableauDeBord.points.${point.cle}.titre`, valeurs),
    detail: t(`gestion.tableauDeBord.points.${point.cle}.detail`, valeurs),
    action:
      point.destination.vers === 'aucune'
        ? undefined
        : t(`gestion.tableauDeBord.points.${point.cle}.action`),
    lien,
  }
}

function lienDe(destination: Destination): ElementPoint['lien'] {
  switch (destination.vers) {
    case 'caisse':
      return function LienCaisse(contenu, className) {
        return (
          <Link
            to="/gestion/caisses/$ouvertureId"
            params={{ ouvertureId: destination.ouvertureId }}
            className={className}
          >
            {contenu}
          </Link>
        )
      }
    case 'stock':
      return function LienStock(contenu, className) {
        return (
          <Link
            to="/gestion/stock"
            search={{ etablissement: destination.etablissementId }}
            className={className}
          >
            {contenu}
          </Link>
        )
      }
    case 'activite':
      return function LienActivite(contenu, className) {
        return (
          <Link to="/gestion/activite" className={className}>
            {contenu}
          </Link>
        )
      }
    case 'ardoises':
      return function LienArdoises(contenu, className) {
        return (
          <Link to="/gestion/ardoises" className={className}>
            {contenu}
          </Link>
        )
      }
    case 'aucune':
      return undefined
  }
}
