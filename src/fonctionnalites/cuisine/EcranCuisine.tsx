import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { clsx } from 'clsx'
import { Bell, BellOff, CircleHelp, LayoutDashboard } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from '@tanstack/react-router'
import { appelerApi } from '../../partage/api/appelerApi'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type { ArticleCuisine, BonCuisine } from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { CLASSES_CONTROLE_BARRE } from '../../app/mises-en-page/MenuCompte'
import { requeteAppareil } from '../tablette/requetes'
import { jouerBip } from './bip'
import { chrono, enColonnes, nouveauxBons } from './presentation'
import { requeteEcranCuisine } from './requetes'

type Onglet = 'aPreparer' | 'prets'

const GRILLES: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 4: 'grid-cols-4' }

const CLASSES_CHRONO = {
  succes: 'bg-succes-fond text-succes',
  alerte: 'bg-alerte-fond text-alerte-texte',
  danger: 'bg-danger-fond text-danger',
} as const

/** Grand écran : quatre colonnes ; tablette en portrait : deux ; téléphone : une. */
function useNombreDeColonnes(): number {
  const calculer = () => {
    if (typeof window.matchMedia !== 'function') return 4
    if (window.matchMedia('(min-width: 1280px)').matches) return 4
    return window.matchMedia('(min-width: 768px)').matches ? 2 : 1
  }
  const [nombre, setNombre] = useState(calculer)
  useEffect(() => {
    const surRedimensionner = () => {
      setNombre(calculer())
    }
    window.addEventListener('resize', surRedimensionner)
    return () => {
      window.removeEventListener('resize', surRedimensionner)
    }
  }, [])
  return nombre
}

/** L'heure qui avance, pour les chronos des bons. */
function useMaintenant(): Date {
  const [maintenant, setMaintenant] = useState(() => new Date())
  useEffect(() => {
    const minuterie = setInterval(() => {
      setMaintenant(new Date())
    }, 1000)
    return () => {
      clearInterval(minuterie)
    }
  }, [])
  return maintenant
}

/** Sonne quand un bon arrive dans « À préparer », si le son est actif. */
function useBipDesNouveauxBons(bons: BonCuisine[] | undefined, actif: boolean) {
  const connus = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (bons === undefined) return
    const ids = bons.map((bon) => bon.envoiId)
    if (actif && nouveauxBons(connus.current, ids) > 0) jouerBip()
    connus.current = new Set(ids)
  }, [bons, actif])
}

function repereDuBon(bon: BonCuisine, t: TFunction): string {
  return bon.table ?? t('caisse.note.numero', { numero: bon.numero })
}

/**
 * L'écran cuisine d'une tablette enregistrée comme « Cuisine » : pas de PIN, les bons arrivent dans
 * l'ordre d'envoi, les plus anciens à gauche. Un toucher commence un bon, un autre le marque prêt.
 */
export function EcranCuisine() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { data: appareil } = useQuery(requeteAppareil)
  const ecran = useQuery(requeteEcranCuisine)
  const [onglet, setOnglet] = useState<Onglet>('aPreparer')
  const [son, setSon] = useState(true)
  const [erreur, setErreur] = useState<unknown>(null)
  const colonnes = useNombreDeColonnes()
  const maintenant = useMaintenant()
  const fuseauHoraire = appareil?.etablissement.fuseauHoraire ?? 'Africa/Lome'
  useBipDesNouveauxBons(ecran.data?.aPreparer, son)
  const naviguer = useNavigate()
  const refusee = ecran.error instanceof ErreurApi && ecran.error.statut === 403
  useEffect(() => {
    if (!refusee) return
    // Le gérant a fait de cette tablette une caisse : elle rejoint son nouvel écran.
    void clientRequetes
      .invalidateQueries({ queryKey: requeteAppareil.queryKey })
      .then(() => naviguer({ to: '/caisse', replace: true }))
  }, [refusee, clientRequetes, naviguer])

  async function agir(chemin: string) {
    setErreur(null)
    try {
      await appelerApi<undefined>(`/appareil/cuisine${chemin}`, { methode: 'POST' })
    } catch (refus) {
      setErreur(refus)
    } finally {
      await clientRequetes.invalidateQueries({ queryKey: requeteEcranCuisine.queryKey })
    }
  }

  const bons = (onglet === 'aPreparer' ? ecran.data?.aPreparer : ecran.data?.prets) ?? []
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute
        {...(appareil
          ? {
              contexte: {
                titre: appareil.entreprise.nom,
                detail: `${appareil.etablissement.nom}, ${appareil.nom}`,
              },
            }
          : {})}
      >
        <button
          type="button"
          aria-pressed={son}
          aria-label={t('cuisine.son')}
          className={CLASSES_CONTROLE_BARRE}
          onClick={() => {
            setSon(!son)
          }}
        >
          {son ? <Bell aria-hidden="true" size={18} /> : <BellOff aria-hidden="true" size={18} />}
          <span className="hidden sm:inline">
            {son ? t('cuisine.sonActif') : t('cuisine.sonCoupe')}
          </span>
        </button>
        <Link
          to="/aide"
          search={{ depuis: '/cuisine' }}
          aria-label={t('aide.lien')}
          className={CLASSES_CONTROLE_BARRE}
        >
          <CircleHelp aria-hidden="true" size={18} />
          <span className="hidden sm:inline">{t('aide.lien')}</span>
        </Link>
        <Link to="/gestion" aria-label={t('commun.gestion')} className={CLASSES_CONTROLE_BARRE}>
          <LayoutDashboard aria-hidden="true" size={18} />
          <span className="hidden sm:inline">{t('commun.gestion')}</span>
        </Link>
      </BarreHaute>
      <main className="flex flex-1 flex-col gap-3.5 p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label={t('cuisine.bons')}
            className="flex gap-0.5 rounded-moyen bg-trait p-0.5"
          >
            {(['aPreparer', 'prets'] as const).map((cle) => (
              <button
                key={cle}
                type="button"
                role="tab"
                aria-selected={onglet === cle}
                onClick={() => {
                  setOnglet(cle)
                }}
                className={clsx(
                  'flex min-h-cible-caisse items-center gap-2 rounded-normal px-4 text-corps text-encre',
                  onglet === cle ? 'bg-surface font-bold' : 'font-semibold',
                )}
              >
                {t(`cuisine.onglets.${cle}`)}
                <span className="chiffres font-medium text-attenue">
                  {ecran.data?.[cle].length ?? 0}
                </span>
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <EtatSynchronisation
            miseAJour={ecran.dataUpdatedAt}
            enEchec={ecran.isError}
            fuseauHoraire={fuseauHoraire}
          />
        </div>
        {erreur !== null && <AlerteErreur erreur={erreur} />}
        {ecran.isPending && <Chargement texte={t('cuisine.chargement')} />}
        {ecran.isError && ecran.data === undefined && <AlerteErreur erreur={ecran.error} />}
        {ecran.data !== undefined && bons.length === 0 && (
          <section className="rounded-moyen border border-trait bg-surface p-6">
            <EtatVide
              titre={t(`cuisine.vide.${onglet}.titre`)}
              phrase={t(`cuisine.vide.${onglet}.phrase`)}
            />
          </section>
        )}
        {bons.length > 0 && (
          <div className={clsx('grid items-start gap-3', GRILLES[colonnes])}>
            {/* Une colonne vide n'est pas rendue : chaque colonne prend le nom de son premier bon. */}
            {enColonnes(bons, colonnes)
              .filter((colonne) => colonne.length > 0)
              .map((colonne) => (
                <div key={colonne[0]?.envoiId} className="flex min-w-0 flex-col gap-3">
                  {colonne.map((bon) => (
                    <Bon
                      key={bon.envoiId}
                      bon={bon}
                      pret={onglet === 'prets'}
                      maintenant={maintenant}
                      fuseauHoraire={fuseauHoraire}
                      surAgir={(chemin) => void agir(chemin)}
                    />
                  ))}
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  )
}

/** « À jour à 22:47 », ou la perte de connexion : la cuisine sait si l'écran est fiable. */
function EtatSynchronisation({
  miseAJour,
  enEchec,
  fuseauHoraire,
}: Readonly<{ miseAJour: number; enEchec: boolean; fuseauHoraire: string }>) {
  const { t } = useTranslation()
  if (miseAJour === 0) return null
  const heure = formaterHeure(new Date(miseAJour).toISOString(), fuseauHoraire)
  return enEchec ? (
    <BadgeStatut ton="danger">{t('cuisine.horsLigne', { heure })}</BadgeStatut>
  ) : (
    <span role="status" className="chiffres text-legende text-attenue">
      {t('cuisine.aJour', { heure })}
    </span>
  )
}

function Bon({
  bon,
  pret,
  maintenant,
  fuseauHoraire,
  surAgir,
}: Readonly<{
  bon: BonCuisine
  /** Dans l'onglet « Prêts » : le chrono s'arrête, le bon se rappelle. */
  pret: boolean
  maintenant: Date
  fuseauHoraire: string
  surAgir: (chemin: string) => void
}>) {
  const { t } = useTranslation()
  const repere = repereDuBon(bon, t)
  const temps = chrono(bon.envoyeLe, pret && bon.preteLe ? new Date(bon.preteLe) : maintenant)
  const lieu =
    bon.canal === 'SUR_PLACE'
      ? (bon.salle ?? '')
      : [t(`caisse.canaux.${bon.canal}`), ...(bon.clientNom ? [bon.clientNom] : [])].join(', ')
  const qui =
    bon.couverts === undefined
      ? bon.serveur
      : `${bon.serveur}, ${t('caisse.plan.couverts', { count: bon.couverts })}`
  return (
    <section
      aria-label={t('cuisine.bon', { repere })}
      className="flex flex-col overflow-hidden rounded-moyen border border-trait bg-surface"
    >
      <div className="flex items-center gap-2.5 border-b border-trait px-3.5 py-3">
        <span className="text-titre-ecran">{repere}</span>
        <span className="flex min-w-0 flex-col">
          <span className="text-libelle font-semibold text-encre">{lieu}</span>
          <span className="text-legende text-attenue">{qui}</span>
        </span>
        <span
          className={clsx(
            'chiffres ml-auto rounded-normal px-2.5 py-0.5 text-titre-section',
            pret ? 'bg-fond text-attenue' : CLASSES_CHRONO[temps.ton],
          )}
        >
          {temps.texte}
        </span>
      </div>
      {!pret && bon.commenceLe !== undefined && (
        <p className="m-0 bg-accent-doux px-3.5 py-1.5 text-libelle font-bold text-encre">
          {t('cuisine.enPreparation')}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {bon.articles.map((article) => (
          <Article
            key={article.ligneId}
            article={article}
            pret={pret}
            fuseauHoraire={fuseauHoraire}
            surPret={() => {
              surAgir(`/lignes/${article.ligneId}/pret`)
            }}
          />
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-trait px-3.5 py-2.5">
        {pret ? (
          <>
            <span className="flex-1 text-libelle text-attenue">
              {bon.preteLe !== undefined &&
                // Servi par la salle sans que la cuisine l'ait marqué prêt : on ne dit pas « Prêt ».
                t(
                  bon.articles.some((article) => article.preteLe !== undefined)
                    ? 'cuisine.preteA'
                    : 'cuisine.serviA',
                  { heure: formaterHeure(bon.preteLe, fuseauHoraire) },
                )}
            </span>
            {/* Tout servi : il n'y a plus rien à rappeler en cuisine. */}
            {bon.articles.some(
              (article) => article.annuleeLe === undefined && article.servieLe === undefined,
            ) && (
              <Bouton
                className="min-h-cible-caisse"
                onClick={() => {
                  surAgir(`/bons/${bon.envoiId}/rappel`)
                }}
              >
                {t('cuisine.rappeler')}
              </Bouton>
            )}
          </>
        ) : (
          // En contour : l'écran a autant d'actions que de bons, aucune n'est « la » principale.
          <button
            type="button"
            className="inline-flex min-h-cible-caisse w-full items-center justify-center rounded-normal border-2 border-accent bg-surface px-4 text-corps-fort font-bold text-encre hover:bg-fond"
            onClick={() => {
              surAgir(`/bons/${bon.envoiId}/${bon.commenceLe === undefined ? 'debut' : 'pret'}`)
            }}
          >
            {bon.commenceLe === undefined ? t('cuisine.commencer') : t('cuisine.toutPret')}
          </button>
        )}
      </div>
    </section>
  )
}

function Article({
  article,
  pret,
  fuseauHoraire,
  surPret,
}: Readonly<{
  article: ArticleCuisine
  pret: boolean
  fuseauHoraire: string
  surPret: () => void
}>) {
  const { t } = useTranslation()
  const annule = article.annuleeLe !== undefined
  const sorti = article.preteLe !== undefined || article.servieLe !== undefined
  let etat = null
  if (article.servieLe !== undefined) {
    etat = (
      <BadgeStatut ton="succes">
        {article.serviPar === undefined
          ? t('cuisine.servi')
          : t('cuisine.serviPar', { nom: article.serviPar })}
      </BadgeStatut>
    )
  } else if (article.preteLe !== undefined) {
    etat = <BadgeStatut ton="succes">{t('cuisine.pret')}</BadgeStatut>
  } else if (!annule && !pret) {
    etat = (
      <Bouton
        className="min-h-cible-caisse shrink-0"
        aria-label={t('cuisine.articlePret', { nom: article.nom })}
        onClick={surPret}
      >
        {t('cuisine.pret')}
      </Bouton>
    )
  }
  return (
    <li className="flex items-start gap-2.5 border-t border-trait px-3.5 py-2.5 first:border-t-0">
      <span
        className={clsx(
          'chiffres flex size-9 shrink-0 items-center justify-center rounded-normal bg-accent-doux text-titre-section',
          (sorti || annule) && 'text-attenue',
        )}
      >
        {article.quantite}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={clsx(
            'text-corps-fort',
            annule && 'text-danger line-through',
            sorti && !annule && 'text-attenue',
          )}
        >
          {article.nom}
        </span>
        {article.options.length > 0 && (
          <span className={clsx('text-corps-fort text-encre', annule && 'line-through')}>
            {article.options.join(', ')}
          </span>
        )}
        {article.note !== undefined && !annule && (
          <span className="text-libelle font-semibold text-alerte-texte">{article.note}</span>
        )}
        {article.annuleeLe !== undefined && (
          <span className="text-legende font-bold text-danger">
            {t('cuisine.annuleA', { heure: formaterHeure(article.annuleeLe, fuseauHoraire) })}
          </span>
        )}
      </span>
      {etat}
    </li>
  )
}
