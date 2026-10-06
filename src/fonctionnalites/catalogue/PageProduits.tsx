import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { History, Pencil, Plus, Power, RotateCw, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { ProduitResume } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { formaterTaux } from '../../partage/montants/taxes'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton, classesBouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions, type ActionMenu } from '../../partage/ui/MenuActions'
import { Pagination, Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { CarreCategorie, DialogueCategories } from './DialogueCategories'
import { DialogueHistoriquePrix } from './DialogueHistoriquePrix'
import {
  requeteCategories,
  requeteProduits,
  TAILLE_PAGE_PRODUITS,
  type FiltresProduits,
} from './requetes'

export interface RechercheProduits {
  /** Nom du produit tout juste enregistré depuis sa fiche, pour le confirmer. */
  enregistre?: string
}

/** La carte commune : filtre par catégorie, recherche, actifs ou désactivés. */
export function PageProduits({ recherche }: Readonly<{ recherche: RechercheProduits }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { moi, aLaPermission } = useSession()
  const peutGerer = aLaPermission('CATALOGUE_GERER')
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const [filtres, setFiltres] = useState<FiltresProduits>({
    categorieId: null,
    actifs: true,
    recherche: '',
    page: 0,
  })
  const categories = useQuery(requeteCategories)
  const produits = useQuery({ ...requeteProduits(filtres), placeholderData: keepPreviousData })
  const [categoriesOuvertes, setCategoriesOuvertes] = useState(false)
  const [historique, setHistorique] = useState<ProduitResume | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(
    recherche.enregistre === undefined
      ? null
      : t('produits.fiche.modifie', { nom: recherche.enregistre }),
  )
  const [erreur, setErreur] = useState<unknown>(null)

  function filtrer(changement: Partial<FiltresProduits>) {
    setFiltres((actuels) => ({ ...actuels, page: 0, ...changement }))
  }

  async function basculer(produit: ProduitResume) {
    setErreur(null)
    try {
      await appelerApi(
        `/produits/${produit.id}/${produit.actif ? 'desactivation' : 'reactivation'}`,
        { methode: 'POST' },
      )
      setConfirmation(
        t(produit.actif ? 'produits.desactive' : 'produits.reactive', { nom: produit.nom }),
      )
      await clientRequetes.invalidateQueries({ queryKey: ['catalogue'] })
    } catch (refus) {
      setErreur(refus)
    }
  }

  const colonnes: ColonneTableau<ProduitResume>[] = [
    {
      cle: 'produit',
      entete: t('produits.colonnes.produit'),
      rendu: (produit) => (
        <>
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {produit.nom}
            {produit.parentId !== undefined && (
              <BadgeStatut ton="neutre">{t('variantes.badge')}</BadgeStatut>
            )}
          </span>
          <span className="text-legende text-attenue">
            {t(`typesProduit.${produit.type}`)}
            {/* Sur téléphone, la colonne Catégorie est masquée : elle passe sous le nom. */}
            <span className="md:hidden">, {produit.categorie.nom}</span>
          </span>
        </>
      ),
    },
    {
      cle: 'categorie',
      entete: t('produits.colonnes.categorie'),
      masqueeSurTelephone: true,
      rendu: (produit) => (
        <span className="flex items-center gap-2">
          <CarreCategorie couleur={produit.categorie.couleur} />
          {produit.categorie.nom}
        </span>
      ),
    },
    {
      cle: 'prix',
      entete: t('produits.colonnes.prix'),
      numerique: true,
      rendu: (produit) => (
        <span className="chiffres text-montant-ligne">
          {/* Un produit à variantes se vend au prix de chacune : la moins chère d'abord. */}
          {produit.variantes[0] === undefined
            ? formaterMontant({ unitesMineures: produit.prix, devise }, { forme: 'courte' })
            : t('variantes.des', {
                prix: formaterMontant(
                  { unitesMineures: produit.variantes[0].prix, devise },
                  { forme: 'courte' },
                ),
              })}
        </span>
      ),
    },
    {
      cle: 'taxe',
      entete: t('produits.colonnes.taxe'),
      masqueeSurTelephone: true,
      rendu: (produit) =>
        produit.taxe === undefined
          ? t('produits.aucuneTaxe')
          : `${produit.taxe.nom} ${formaterTaux(produit.taxe.tauxPointsDeBase)}`,
    },
    {
      cle: 'stock',
      entete: t('produits.colonnes.stock'),
      masqueeSurTelephone: true,
      rendu: (produit) =>
        produit.suiviStock ? t('produits.stock.suivi') : t('produits.stock.nonSuivi'),
    },
    {
      cle: 'statut',
      entete: t('produits.colonnes.statut'),
      masqueeSurTelephone: true,
      rendu: (produit) => (
        <BadgeStatut ton={produit.actif ? 'succes' : 'neutre'}>
          {produit.actif ? t('produits.statut.actif') : t('produits.statut.desactive')}
        </BadgeStatut>
      ),
    },
  ]
  const voitHistorique = aLaPermission('ACTIVITE_CONSULTER')
  // Un gérant ne modifie pas la carte, mais consulte l'historique des prix.
  if (peutGerer || voitHistorique) {
    colonnes.push({
      cle: 'actions',
      entete: t('produits.colonnes.actions'),
      rendu: (produit) => {
        const actions: ActionMenu[] = []
        if (voitHistorique) {
          actions.push({
            libelle: t('produits.historiquePrix'),
            icone: History,
            surChoisir: () => {
              setHistorique(produit)
            },
          })
        }
        if (peutGerer) {
          actions.push({
            libelle: produit.actif ? t('produits.desactiver') : t('produits.reactiver'),
            icone: Power,
            ...(produit.actif ? { ton: 'danger' as const } : {}),
            surChoisir: () => void basculer(produit),
          })
        }
        return (
          <div className="flex justify-end gap-2">
            {peutGerer && (
              <Link
                to="/gestion/produits/$produitId"
                // Une variante se modifie depuis la fiche de son produit.
                params={{ produitId: produit.parentId ?? produit.id }}
                aria-label={t('produits.modifierNomme', { nom: produit.nom })}
                className={classesBouton('secondaire')}
              >
                <Pencil aria-hidden="true" size={18} />
                <span className="hidden md:inline">{t('produits.modifier')}</span>
              </Link>
            )}
            <MenuActions
              libelle={t('produits.plusDActions', { nom: produit.nom })}
              actions={actions}
            />
          </div>
        )
      },
    })
  }

  const listeCategories = categories.data?.filter((categorie) => categorie.active) ?? []
  const liste = produits.data
  const carteVide =
    categories.data !== undefined &&
    liste?.total === 0 &&
    filtres.categorieId === null &&
    filtres.actifs &&
    filtres.recherche.trim() === ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="m-0 text-titre-page text-encre">{t('produits.titre')}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('produits.phrase')}</p>
        </div>
        {peutGerer && (
          <div className="flex flex-wrap gap-2">
            <Bouton
              onClick={() => {
                setCategoriesOuvertes(true)
              }}
            >
              {t('produits.gererCategories')}
            </Bouton>
            {listeCategories.length > 0 && (
              <Link to="/gestion/produits/nouveau" className={classesBouton('principal')}>
                <Plus aria-hidden="true" size={18} />
                {t('produits.ajouter')}
              </Link>
            )}
          </div>
        )}
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      {(categories.isError || produits.isError) && (
        <AlerteErreur
          erreur={categories.error ?? produits.error}
          action={
            <Bouton
              icone={RotateCw}
              onClick={() => {
                void categories.refetch()
                void produits.refetch()
              }}
            >
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {(categories.isPending || produits.isPending) && (
        <Chargement texte={t('produits.chargement')} />
      )}

      {carteVide && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            titre={t('produits.vide.titre')}
            phrase={peutGerer ? t('produits.vide.phrase') : t('produits.vide.phraseSansDroit')}
          />
        </section>
      )}

      {!carteVide && liste !== undefined && categories.data !== undefined && (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <nav
            aria-label={t('produits.categories')}
            className="flex gap-1 overflow-x-auto rounded-moyen border border-trait bg-surface p-2 md:w-56 md:shrink-0 md:flex-col"
          >
            <BoutonCategorie
              actif={filtres.categorieId === null}
              libelle={t('produits.touteLaCarte')}
              nombre={listeCategories.reduce((total, categorie) => total + categorie.nbProduits, 0)}
              surChoisir={() => {
                filtrer({ categorieId: null })
              }}
            />
            {listeCategories.map((categorie) => (
              <BoutonCategorie
                key={categorie.id}
                actif={filtres.categorieId === categorie.id}
                libelle={categorie.nom}
                nombre={categorie.nbProduits}
                repere={<CarreCategorie couleur={categorie.couleur} />}
                surChoisir={() => {
                  filtrer({ categorieId: categorie.id })
                }}
              />
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-cible-min w-full max-w-xs items-center gap-2 rounded-normal border border-bordure-controle bg-surface px-3 text-attenue">
                <Search aria-hidden="true" size={16} />
                <input
                  type="search"
                  aria-label={t('produits.recherche')}
                  placeholder={t('produits.recherche')}
                  value={filtres.recherche}
                  onChange={(evenement) => {
                    filtrer({ recherche: evenement.target.value })
                  }}
                  className="min-w-0 flex-1 border-0 bg-transparent text-corps text-encre outline-none"
                />
              </label>
              <span className="flex-1" />
              {[true, false].map((actifs) => (
                <button
                  key={String(actifs)}
                  type="button"
                  aria-pressed={filtres.actifs === actifs}
                  onClick={() => {
                    filtrer({ actifs })
                  }}
                  className={clsx(
                    'min-h-cible-min rounded-normal border px-3 text-libelle font-semibold',
                    filtres.actifs === actifs
                      ? 'border-accent bg-accent text-accent-texte'
                      : 'border-trait bg-surface text-encre',
                  )}
                >
                  {actifs ? t('produits.actifs') : t('produits.desactives')}
                </button>
              ))}
            </div>
            {liste.total === 0 ? (
              <p className="m-0 rounded-moyen border border-trait bg-surface p-6 text-corps text-attenue">
                {t('produits.aucunResultat')}
              </p>
            ) : (
              <>
                <Tableau
                  libelle={t('produits.tableau')}
                  colonnes={colonnes}
                  lignes={liste.elements}
                  cleLigne={(produit) => produit.id}
                />
                <Pagination
                  page={filtres.page}
                  taille={TAILLE_PAGE_PRODUITS}
                  total={liste.total}
                  surChangerPage={(page) => {
                    setFiltres((actuels) => ({ ...actuels, page }))
                  }}
                />
              </>
            )}
            <p className="m-0 text-legende text-attenue">{t('produits.note')}</p>
          </div>
        </div>
      )}

      {historique !== null && (
        <DialogueHistoriquePrix
          produitId={historique.id}
          nom={historique.nom}
          contexte={{
            devise,
            fuseauHoraire: moi?.entrepriseCourante?.fuseauHoraire ?? 'Africa/Lome',
            etablissements: new Map(),
          }}
          surFermer={() => {
            setHistorique(null)
          }}
        />
      )}

      {categoriesOuvertes && (
        <DialogueCategories
          surFermer={() => {
            setCategoriesOuvertes(false)
          }}
        />
      )}
    </div>
  )
}

function BoutonCategorie({
  actif,
  libelle,
  nombre,
  repere,
  surChoisir,
}: Readonly<{
  actif: boolean
  libelle: string
  nombre: number
  repere?: React.ReactNode
  surChoisir: () => void
}>) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={surChoisir}
      className={clsx(
        'flex min-h-cible-min shrink-0 items-center gap-2.5 whitespace-nowrap rounded-normal px-3 text-left text-corps text-encre',
        actif ? 'bg-accent-doux font-semibold text-accent-lisible' : 'hover:bg-fond',
      )}
    >
      {repere ?? <span aria-hidden="true" className="size-3 shrink-0" />}
      <span className="flex-1">{libelle}</span>
      <span className="chiffres text-legende text-attenue">{nombre}</span>
    </button>
  )
}
