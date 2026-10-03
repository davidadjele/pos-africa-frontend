import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Download } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { IndicateursVentes, RapportVentes } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut, type TonStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { requeteEtablissements } from '../etablissements/requetes'
import { ASurveiller } from './ASurveiller'
import { ChoixPeriode } from './ChoixPeriode'
import { fondCategorie, FOND_MODE } from './couleurs'
import { montantCsv, telechargerCsv, versCsv } from './csv'
import {
  BarreModes,
  Carre,
  HistogrammeHeures,
  HistogrammeJours,
  LegendeModes,
  signe,
} from './Graphiques'
import { journeeCourante, periodeDe, variation, type ClePeriode, type Periode } from './periodes'
import { requeteVentes } from './requetes'
import { pointsDeVigilance, type PointVigilance } from './vigilance'

const PERIODES: ClePeriode[] = [
  'AUJOURDHUI',
  'HIER',
  'SEPT_JOURS',
  'CE_MOIS',
  'MOIS_DERNIER',
  'DATES',
]

/** La période reconnue parmi les raccourcis, sinon des dates choisies. */
function cleDe(periode: Periode, journee: string): ClePeriode {
  const raccourci = PERIODES.find((cle) => {
    if (cle === 'DATES') return false
    const candidate = periodeDe(cle, journee)
    return candidate.du === periode.du && candidate.au === periode.au
  })
  return raccourci ?? 'DATES'
}

/**
 * Ce que l'entreprise a vendu sur une période, par journée de caisse : indicateurs comparés à la période d'avant,
 * jours empilés par mode, produits, serveurs, et ce qui mérite l'attention.
 */
export function PageVentes({
  du,
  au,
  etablissement,
}: Readonly<{
  du?: string | undefined
  au?: string | undefined
  etablissement?: string | undefined
}>) {
  const { t } = useTranslation()
  const { moi } = useSession()
  const fuseauHoraire = moi?.entrepriseCourante?.fuseauHoraire ?? 'Africa/Lome'
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const journee = journeeCourante(fuseauHoraire)
  const [periode, setPeriode] = useState<Periode>(
    du !== undefined && au !== undefined ? { du, au } : periodeDe('SEPT_JOURS', journee),
  )
  const [cle, setCle] = useState<ClePeriode>(() => cleDe(periode, journee))
  const [etablissementId, setEtablissementId] = useState(etablissement ?? '')
  const [vue, setVue] = useState<'jours' | 'heures'>('jours')
  const [regroupement, setRegroupement] = useState<'produits' | 'categories'>('produits')
  const etablissements = useQuery(requeteEtablissements(0))
  const ventes = useQuery(requeteVentes(periode, etablissementId))
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })

  const listeEtablissements = etablissements.data?.elements ?? []
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-titre-page text-encre">{t('rapports.ventes.titre')}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('rapports.ventes.phrase')}</p>
        </div>
        <Bouton
          icone={Download}
          disabled={ventes.data === undefined}
          onClick={() => {
            if (ventes.data !== undefined) exporter(ventes.data, devise, t)
          }}
        >
          {t('rapports.exporter')}
        </Bouton>
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
        <div>
          <ChoixPeriode
            cles={PERIODES}
            cle={cle}
            periode={periode}
            journee={journee}
            surChanger={(nouvelle, nouvellePeriode) => {
              setCle(nouvelle)
              setPeriode(nouvellePeriode)
            }}
          />
        </div>
      </div>
      {ventes.isPending && <Chargement texte={t('rapports.ventes.chargement')} />}
      {ventes.isError && <AlerteErreur erreur={ventes.error} />}
      {ventes.data !== undefined && (
        <Rapport
          rapport={ventes.data}
          points={pointsDeVigilance(ventes.data)}
          vue={vue}
          surVue={setVue}
          regroupement={regroupement}
          surRegroupement={setRegroupement}
          nombre={nombre}
          courte={courte}
        />
      )}
    </div>
  )
}

function Rapport({
  rapport,
  points,
  vue,
  surVue,
  regroupement,
  surRegroupement,
  nombre,
  courte,
}: Readonly<{
  rapport: RapportVentes
  points: PointVigilance[]
  vue: 'jours' | 'heures'
  surVue: (vue: 'jours' | 'heures') => void
  regroupement: 'produits' | 'categories'
  surRegroupement: (regroupement: 'produits' | 'categories') => void
  nombre: (valeur: number) => string
  courte: (valeur: number) => string
}>) {
  const { t } = useTranslation()
  const { indicateurs, precedent } = rapport
  const formater = (point: PointVigilance) => {
    const valeurs: Record<string, string | number> = { ...point.valeurs }
    for (const cleMontant of ['montant'] as const) {
      const montant = point.valeurs[cleMontant]
      if (typeof montant === 'number') {
        valeurs[cleMontant] = nombre(Math.abs(montant))
      }
    }
    for (const clePart of ['part', 'partAvant'] as const) {
      const part = point.valeurs[clePart]
      if (typeof part === 'number')
        valeurs[clePart] = part.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
    }
    return valeurs
  }
  return (
    <>
      <Indicateurs
        indicateurs={indicateurs}
        precedent={precedent}
        nombre={nombre}
        courte={courte}
      />
      {indicateurs.notes === 0 ? (
        <div className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            titre={t('rapports.ventes.vide.titre')}
            phrase={t('rapports.ventes.vide.phrase')}
          />
        </div>
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Carte
              titre={vue === 'jours' ? t('rapports.ventes.parJour') : t('rapports.ventes.parHeure')}
              actions={
                <Bascule
                  options={[
                    ['jours', t('rapports.ventes.jours')],
                    ['heures', t('rapports.ventes.heures')],
                  ]}
                  valeur={vue}
                  surChoisir={surVue}
                />
              }
            >
              {vue === 'jours' ? (
                <>
                  <HistogrammeJours jours={rapport.parJour} />
                  <LegendeModes />
                </>
              ) : (
                <>
                  <HistogrammeHeures heures={rapport.parHeure} />
                  <LegendeModes />
                </>
              )}
            </Carte>
            <ASurveiller points={points} formater={formater} />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Carte
              titre={t('rapports.ventes.parProduit')}
              actions={
                <Bascule
                  options={[
                    ['produits', t('rapports.ventes.produits')],
                    ['categories', t('rapports.ventes.categories')],
                  ]}
                  valeur={regroupement}
                  surChoisir={surRegroupement}
                />
              }
              sansMarge
            >
              <TableauProduits
                lignes={
                  regroupement === 'produits'
                    ? rapport.parProduit.map((produit) => ({
                        cle: produit.produitId,
                        nom: produit.nom,
                        detail: produit.categorie,
                        couleur: produit.couleur,
                        quantite: produit.quantite,
                        montant: produit.montant,
                      }))
                    : rapport.parCategorie.map((categorie) => ({
                        cle: categorie.categorieId,
                        nom: categorie.nom,
                        couleur: categorie.couleur,
                        quantite: categorie.quantite,
                        montant: categorie.montant,
                      }))
                }
                total={indicateurs.chiffreAffaires}
                nombre={nombre}
              />
              {rapport.remisesSurNotes > 0 && (
                <p className="m-0 px-4 py-2.5 text-legende text-attenue">
                  {t('rapports.ventes.remisesSurNotes', {
                    montant: nombre(rapport.remisesSurNotes),
                  })}
                </p>
              )}
            </Carte>
            <div className="flex flex-col gap-4">
              <Carte titre={t('rapports.ventes.parMode')}>
                <ParMode rapport={rapport} nombre={nombre} />
              </Carte>
              <Carte titre={t('rapports.ventes.parServeur')} sansMarge>
                <TableauSimple
                  libelle={t('rapports.ventes.parServeur')}
                  entetes={[
                    t('rapports.ventes.serveur'),
                    t('rapports.ventes.notes'),
                    t('rapports.ventes.montant'),
                  ]}
                  lignes={rapport.parServeur.map((serveur) => ({
                    cle: serveur.serveurId,
                    cellules: [serveur.nom, String(serveur.notes), nombre(serveur.montant)],
                  }))}
                />
              </Carte>
              {rapport.parEtablissement.length > 1 && (
                <Carte titre={t('rapports.ventes.parEtablissement')} sansMarge>
                  <TableauSimple
                    libelle={t('rapports.ventes.parEtablissement')}
                    entetes={[
                      t('rapports.etablissement'),
                      t('rapports.ventes.notes'),
                      t('rapports.ventes.montant'),
                    ]}
                    lignes={rapport.parEtablissement.map((ligne) => ({
                      cle: ligne.etablissementId,
                      cellules: [ligne.nom, String(ligne.notes), nombre(ligne.montant)],
                    }))}
                  />
                </Carte>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function Indicateurs({
  indicateurs,
  precedent,
  nombre,
  courte,
}: Readonly<{
  indicateurs: IndicateursVentes
  precedent: IndicateursVentes
  nombre: (valeur: number) => string
  courte: (valeur: number) => string
}>) {
  const { t } = useTranslation()
  const tendance = (actuel: number, avant: number) => {
    const pourcent = variation(actuel, avant)
    if (pourcent === null) return null
    return {
      texte: `${signe(pourcent, String)} %`,
      ton: (pourcent >= 0 ? 'succes' : 'alerte') as TonStatut,
    }
  }
  const part = (remises: number, chiffre: number) =>
    chiffre === 0 ? 0 : Math.round((remises / chiffre) * 1000) / 10
  const tuiles: {
    libelle: string
    valeur: string
    badge: { texte: string; ton: TonStatut } | null
    detail: string
  }[] = [
    {
      libelle: t('rapports.indicateurs.chiffreAffaires'),
      valeur: courte(indicateurs.chiffreAffaires),
      badge: tendance(indicateurs.chiffreAffaires, precedent.chiffreAffaires),
      detail: t('rapports.indicateurs.avant', { valeur: nombre(precedent.chiffreAffaires) }),
    },
    {
      libelle: t('rapports.indicateurs.notes'),
      valeur: String(indicateurs.notes),
      badge: tendance(indicateurs.notes, precedent.notes),
      detail: t('rapports.indicateurs.avant', { valeur: String(precedent.notes) }),
    },
    {
      libelle: t('rapports.indicateurs.panierMoyen'),
      valeur: nombre(indicateurs.panierMoyen),
      badge: tendance(indicateurs.panierMoyen, precedent.panierMoyen),
      detail: t('rapports.indicateurs.avant', { valeur: nombre(precedent.panierMoyen) }),
    },
    {
      libelle: t('rapports.indicateurs.remises'),
      valeur: indicateurs.remises === 0 ? '0' : `−${nombre(indicateurs.remises)}`,
      badge: null,
      detail: t('rapports.indicateurs.partDesVentes', {
        part: part(indicateurs.remises, indicateurs.chiffreAffaires).toLocaleString('fr-FR'),
      }),
    },
    {
      libelle: t('rapports.indicateurs.remboursements'),
      valeur: indicateurs.remboursements === 0 ? '0' : `−${nombre(indicateurs.remboursements)}`,
      badge:
        indicateurs.notesRemboursees > 0
          ? {
              texte: t('rapports.indicateurs.notesRemboursees', {
                count: indicateurs.notesRemboursees,
              }),
              ton: 'danger',
            }
          : null,
      detail: t('rapports.indicateurs.avant', { valeur: nombre(precedent.remboursements) }),
    },
  ]
  return (
    <ul
      aria-label={t('rapports.indicateurs.titre')}
      className="m-0 grid list-none grid-cols-2 overflow-hidden rounded-moyen border border-trait bg-surface p-0 md:grid-cols-5"
    >
      {tuiles.map((tuile, rang) => (
        <li
          key={tuile.libelle}
          className={clsx(
            'flex flex-col gap-1 border-trait px-4 py-3',
            rang > 0 && 'md:border-l',
            rang === 0 && 'col-span-2 border-b md:col-span-1 md:border-b-0',
          )}
        >
          <span className="text-legende text-attenue">{tuile.libelle}</span>
          <span className="chiffres text-montant-total text-encre">{tuile.valeur}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-legende text-attenue">
            {tuile.badge !== null && (
              <BadgeStatut ton={tuile.badge.ton}>{tuile.badge.texte}</BadgeStatut>
            )}
            {tuile.detail}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ParMode({
  rapport,
  nombre,
}: Readonly<{ rapport: RapportVentes; nombre: (valeur: number) => string }>) {
  const { t } = useTranslation()
  const total = rapport.parMode.reduce((somme, mode) => somme + mode.montant, 0)
  return (
    <div className="flex flex-col gap-1">
      <BarreModes parMode={rapport.parMode} />
      <ul aria-label={t('rapports.ventes.parMode')} className="m-0 list-none p-0">
        {rapport.parMode.map((mode) => (
          <li key={mode.mode} className="border-b border-trait py-2 last:border-b-0">
            <span className="flex items-center justify-between gap-3 text-corps text-encre">
              <span className="flex items-center gap-2">
                <Carre fond={FOND_MODE[mode.mode]} />
                {t(`encaissement.modes.${mode.mode}`)}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="chiffres text-montant-ligne">{nombre(mode.montant)}</span>
                <span className="chiffres w-10 text-right text-legende text-attenue">
                  {total === 0 ? '' : `${String(Math.round((mode.montant / total) * 100))} %`}
                </span>
              </span>
            </span>
            {mode.operateurs.map((operateur) => (
              <span
                key={operateur.operateur}
                className="flex justify-between gap-3 pt-1 pl-5 pr-12 text-legende text-attenue"
              >
                <span>
                  {t('rapports.ventes.dont', { nom: libelleOperateur(operateur.operateur) })}
                </span>
                <span className="chiffres">{nombre(operateur.montant)}</span>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** « FLOOZ » se lit « Flooz » : les libellés complets viennent de la caisse, inutiles ici. */
function libelleOperateur(code: string): string {
  return code
    .split('_')
    .map((mot) => mot.charAt(0) + mot.slice(1).toLowerCase())
    .join(' ')
}

function TableauProduits({
  lignes,
  total,
  nombre,
}: Readonly<{
  lignes: {
    cle: string
    nom: string
    detail?: string
    couleur: string
    quantite: number
    montant: number
  }[]
  total: number
  nombre: (valeur: number) => string
}>) {
  const { t } = useTranslation()
  const plusHaut = Math.max(1, ...lignes.map((ligne) => ligne.montant))
  return (
    <div className="overflow-x-auto">
      <table
        aria-label={t('rapports.ventes.parProduit')}
        className="w-full border-collapse text-corps"
      >
        <thead>
          <tr className="bg-fond text-left text-legende font-bold uppercase tracking-wide text-attenue">
            <th className="px-4 py-2">{t('rapports.ventes.produit')}</th>
            <th className="px-4 py-2 text-right">{t('rapports.ventes.quantite')}</th>
            <th className="px-4 py-2 text-right">{t('rapports.ventes.montant')}</th>
            <th className="hidden px-4 py-2 sm:table-cell">
              <span className="sr-only">{t('rapports.ventes.part')}</span>
            </th>
            <th className="px-4 py-2 text-right">{t('rapports.ventes.part')}</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne.cle} className="border-t border-trait">
              <td className="px-4 py-2">
                <span className="block text-corps-fort text-encre">{ligne.nom}</span>
                {ligne.detail !== undefined && (
                  <span className="flex items-center gap-1.5 text-legende text-attenue">
                    <Carre fond={fondCategorie(ligne.couleur)} />
                    {ligne.detail}
                  </span>
                )}
              </td>
              <td className="chiffres px-4 py-2 text-right">{ligne.quantite}</td>
              <td className="chiffres px-4 py-2 text-right">{nombre(ligne.montant)}</td>
              <td className="hidden w-32 px-4 py-2 sm:table-cell">
                <span className="block h-2 overflow-hidden rounded-petit bg-accent-doux">
                  <span
                    className={clsx('block h-full', fondCategorie(ligne.couleur))}
                    style={{ width: `${String((ligne.montant / plusHaut) * 100)}%` }}
                  />
                </span>
              </td>
              <td className="chiffres px-4 py-2 text-right text-attenue">
                {total === 0 ? '' : `${String(Math.round((ligne.montant / total) * 100))} %`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TableauSimple({
  libelle,
  entetes,
  lignes,
}: Readonly<{
  libelle: string
  entetes: string[]
  lignes: { cle: string; cellules: string[] }[]
}>) {
  return (
    <table aria-label={libelle} className="w-full border-collapse text-corps">
      <thead>
        <tr className="bg-fond text-legende font-bold uppercase tracking-wide text-attenue">
          {entetes.map((entete, rang) => (
            <th key={entete} className={clsx('px-4 py-2', rang === 0 ? 'text-left' : 'text-right')}>
              {entete}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((ligne) => (
          <tr key={ligne.cle} className="border-t border-trait">
            {ligne.cellules.map((cellule, rang) => (
              <td
                key={`${ligne.cle}-${String(rang)}`}
                className={clsx('px-4 py-2', rang === 0 ? 'text-encre' : 'chiffres text-right')}
              >
                {cellule}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Carte({
  titre,
  actions,
  sansMarge = false,
  children,
}: Readonly<{ titre: string; actions?: ReactNode; sansMarge?: boolean; children: ReactNode }>) {
  return (
    <section
      aria-label={titre}
      className={clsx(
        'flex min-w-0 flex-col gap-3 overflow-hidden rounded-moyen border border-trait bg-surface',
        !sansMarge && 'px-4 py-3',
      )}
    >
      <div
        className={clsx(
          'flex flex-wrap items-center justify-between gap-2',
          sansMarge && 'px-4 pt-3',
        )}
      >
        <h2 className="m-0 text-titre-carte text-encre">{titre}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

function Bascule<V extends string>({
  options,
  valeur,
  surChoisir,
}: Readonly<{ options: [V, string][]; valeur: V; surChoisir: (valeur: V) => void }>) {
  return (
    <div className="flex gap-1.5">
      {options.map(([option, libelle]) => (
        <button
          key={option}
          type="button"
          aria-pressed={valeur === option}
          onClick={() => {
            surChoisir(option)
          }}
          className={clsx(
            'min-h-9 rounded-normal border px-2.5 text-legende font-bold',
            valeur === option
              ? 'border-accent bg-accent text-accent-texte'
              : 'border-trait bg-surface text-encre',
          )}
        >
          {libelle}
        </button>
      ))}
    </div>
  )
}

/** Deux tableaux à la suite, les jours puis les produits : ce que le comptable reprend. */
function exporter(rapport: RapportVentes, devise: Devise, t: (cle: string) => string) {
  const lignes: (string | number)[][] = [
    [
      t('rapports.csv.journee'),
      t('rapports.csv.total'),
      t('encaissement.modes.ESPECES'),
      t('encaissement.modes.MOBILE_MONEY'),
      t('encaissement.modes.CARTE'),
      t('encaissement.modes.ARDOISE'),
    ],
    ...rapport.parJour.map((jour) => [
      jour.journee,
      montantCsv(jour.total, devise),
      montantCsv(jour.especes, devise),
      montantCsv(jour.mobileMoney, devise),
      montantCsv(jour.carte, devise),
      montantCsv(jour.ardoise, devise),
    ]),
    [],
    [
      t('rapports.ventes.produit'),
      t('rapports.csv.categorie'),
      t('rapports.ventes.quantite'),
      t('rapports.ventes.montant'),
    ],
    ...rapport.parProduit.map((produit) => [
      produit.nom,
      produit.categorie,
      produit.quantite,
      montantCsv(produit.montant, devise),
    ]),
  ]
  telechargerCsv(`ventes-${rapport.du}-${rapport.au}.csv`, versCsv(lignes))
}
