import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router'
import type { RechercheProduits } from '../fonctionnalites/catalogue/PageProduits'
import {
  exigerChoixEntreprise,
  exigerInscriptionOuverte,
  exigerMotDePasseTemporaire,
  exigerPortee,
  exigerTablette,
  exigerTabletteCuisine,
  redirigerSiSessionOuverte,
  redirigerSiTabletteEnregistree,
} from './gardes'
import { useTranslation } from 'react-i18next'
import { Chargement } from '../partage/ui/Chargement'
import { PageErreur } from './PageErreur'
import { PageIntrouvable } from './PageIntrouvable'

export interface ContexteRouteur {
  clientRequetes: QueryClient
}

/**
 * Un morceau de code par espace, chargé à la demande : une tablette de caisse ne télécharge ni la gestion, ni la
 * plateforme, ni le manuel. Le routeur charge le morceau avant d'afficher la page ; passé une seconde, il le dit.
 */
const espaces = {
  public: () => import('./espaces/public'),
  caisse: () => import('./espaces/caisse'),
  cuisine: () => import('./espaces/cuisine'),
  gestion: () => import('./espaces/gestion'),
  plateforme: () => import('./espaces/plateforme'),
  aide: () => import('./espaces/aide'),
}

function PageEnChargement() {
  const { t } = useTranslation()
  return <Chargement texte={t('commun.chargement')} />
}

const racine = createRootRouteWithContext<ContexteRouteur>()({
  component: Outlet,
  notFoundComponent: PageIntrouvable,
  errorComponent: PageErreur,
})

const accueil = createRoute({
  getParentRoute: () => racine,
  path: '/',
  beforeLoad: async ({ context }) => {
    await redirigerSiSessionOuverte(context.clientRequetes)
    throw redirect({ to: '/connexion', replace: true })
  },
})

export interface RechercheConnexion {
  /** Le mot de passe vient d'être changé : toutes les sessions sont fermées, on le dit. */
  motDePasseChange?: boolean
}

const connexion = createRoute({
  getParentRoute: () => racine,
  path: '/connexion',
  validateSearch: (recherche: Record<string, unknown>): RechercheConnexion =>
    recherche.motDePasseChange === true ? { motDePasseChange: true } : {},
  beforeLoad: ({ context }) => redirigerSiSessionOuverte(context.clientRequetes),
  component: lazyRouteComponent(espaces.public, 'RouteConnexion'),
})

const changerMotDePasse = createRoute({
  getParentRoute: () => racine,
  path: '/changer-mot-de-passe',
  beforeLoad: ({ context }) => exigerMotDePasseTemporaire(context.clientRequetes),
  component: lazyRouteComponent(espaces.public, 'PageChangerMotDePasse'),
})

const choixEntreprise = createRoute({
  getParentRoute: () => racine,
  path: '/choix-entreprise',
  beforeLoad: ({ context }) => exigerChoixEntreprise(context.clientRequetes),
  component: lazyRouteComponent(espaces.public, 'PageChoixEntreprise'),
})

const inscription = createRoute({
  getParentRoute: () => racine,
  path: '/inscription',
  beforeLoad: ({ context }) => exigerInscriptionOuverte(context.clientRequetes),
  component: lazyRouteComponent(espaces.public, 'PageInscription'),
})

const caisse = createRoute({
  getParentRoute: () => racine,
  path: '/caisse',
  beforeLoad: ({ context }) => exigerTablette(context.clientRequetes),
  component: lazyRouteComponent(espaces.caisse, 'MiseEnPageCaisse'),
})

const cuisine = createRoute({
  getParentRoute: () => racine,
  path: '/cuisine',
  beforeLoad: ({ context }) => exigerTabletteCuisine(context.clientRequetes),
  component: lazyRouteComponent(espaces.cuisine, 'EcranCuisine'),
})

const enregistrementTablette = createRoute({
  getParentRoute: () => racine,
  path: '/enregistrement-tablette',
  beforeLoad: ({ context }) => redirigerSiTabletteEnregistree(context.clientRequetes),
  component: lazyRouteComponent(espaces.public, 'PageEnregistrementTablette'),
})

const caisseAccueil = createRoute({
  getParentRoute: () => caisse,
  path: '/',
  component: lazyRouteComponent(espaces.caisse, 'EcranPlan'),
})

const caisseEncaissement = createRoute({
  getParentRoute: () => caisse,
  path: '/notes/$commandeId/encaisser',
  component: lazyRouteComponent(espaces.caisse, 'RouteEncaissement'),
})

const caisseTiroir = createRoute({
  getParentRoute: () => caisse,
  path: '/tiroir',
  component: lazyRouteComponent(espaces.caisse, 'EcranTiroir'),
})

const caisseNote = createRoute({
  getParentRoute: () => caisse,
  path: '/notes/$commandeId',
  component: lazyRouteComponent(espaces.caisse, 'RouteNote'),
})

const gestion = createRoute({
  getParentRoute: () => racine,
  path: '/gestion',
  beforeLoad: ({ context }) => exigerPortee(context.clientRequetes, 'ENTREPRISE'),
  component: lazyRouteComponent(espaces.gestion, 'MiseEnPageGestion'),
})

const gestionAccueil = createRoute({
  getParentRoute: () => gestion,
  path: '/',
  component: lazyRouteComponent(espaces.gestion, 'TableauDeBord'),
})

const etablissements = createRoute({
  getParentRoute: () => gestion,
  path: '/etablissements',
  component: lazyRouteComponent(espaces.gestion, 'PageEtablissements'),
})

const personnel = createRoute({
  getParentRoute: () => gestion,
  path: '/personnel',
  component: lazyRouteComponent(espaces.gestion, 'PagePersonnel'),
})

const tablettes = createRoute({
  getParentRoute: () => gestion,
  path: '/tablettes',
  component: lazyRouteComponent(espaces.gestion, 'PageTablettes'),
})

const produits = createRoute({
  getParentRoute: () => gestion,
  path: '/produits',
  validateSearch: (recherche: Record<string, unknown>): RechercheProduits =>
    typeof recherche.enregistre === 'string' ? { enregistre: recherche.enregistre } : {},
  component: lazyRouteComponent(espaces.gestion, 'RouteProduits'),
})

const nouveauProduit = createRoute({
  getParentRoute: () => gestion,
  path: '/produits/nouveau',
  component: lazyRouteComponent(espaces.gestion, 'RouteNouveauProduit'),
})

const ficheProduit = createRoute({
  getParentRoute: () => gestion,
  path: '/produits/$produitId',
  component: lazyRouteComponent(espaces.gestion, 'RouteFicheProduit'),
})

const carteEtablissement = createRoute({
  getParentRoute: () => gestion,
  path: '/carte-etablissement',
  component: lazyRouteComponent(espaces.gestion, 'PageCarteEtablissement'),
})

const activite = createRoute({
  getParentRoute: () => gestion,
  path: '/activite',
  component: lazyRouteComponent(espaces.gestion, 'PageActivite'),
})

const salles = createRoute({
  getParentRoute: () => gestion,
  path: '/salles',
  component: lazyRouteComponent(espaces.gestion, 'PageSalles'),
})

/** L'établissement choisi, et le message d'une action qui ramène à la liste. */
export interface RechercheStock {
  etablissement?: string
  fait?: string
}

function lireRechercheStock(recherche: Record<string, unknown>): RechercheStock {
  return {
    ...(typeof recherche.etablissement === 'string'
      ? { etablissement: recherche.etablissement }
      : {}),
    ...(typeof recherche.fait === 'string' ? { fait: recherche.fait } : {}),
  }
}

const stock = createRoute({
  getParentRoute: () => gestion,
  path: '/stock',
  validateSearch: lireRechercheStock,
  component: lazyRouteComponent(espaces.gestion, 'RouteStock'),
})

const receptionStock = createRoute({
  getParentRoute: () => gestion,
  path: '/stock/reception',
  validateSearch: lireRechercheStock,
  component: lazyRouteComponent(espaces.gestion, 'RouteReceptionStock'),
})

const inventaireStock = createRoute({
  getParentRoute: () => gestion,
  path: '/stock/inventaire',
  validateSearch: lireRechercheStock,
  component: lazyRouteComponent(espaces.gestion, 'RouteInventaireStock'),
})

interface RechercheVentes {
  du?: string
  au?: string
  etablissement?: string
}

function lireRechercheVentes(recherche: Record<string, unknown>): RechercheVentes {
  const journee = (valeur: unknown) =>
    typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur)
  return {
    ...(journee(recherche.du) ? { du: recherche.du as string } : {}),
    ...(journee(recherche.au) ? { au: recherche.au as string } : {}),
    ...(typeof recherche.etablissement === 'string'
      ? { etablissement: recherche.etablissement }
      : {}),
  }
}

const ventes = createRoute({
  getParentRoute: () => gestion,
  path: '/ventes',
  validateSearch: lireRechercheVentes,
  component: lazyRouteComponent(espaces.gestion, 'RouteVentes'),
})

const caisses = createRoute({
  getParentRoute: () => gestion,
  path: '/caisses',
  component: lazyRouteComponent(espaces.gestion, 'PageCaisses'),
})

const detailCaisse = createRoute({
  getParentRoute: () => gestion,
  path: '/caisses/$ouvertureId',
  component: lazyRouteComponent(espaces.gestion, 'RouteDetailCaisse'),
})

const ardoises = createRoute({
  getParentRoute: () => gestion,
  path: '/ardoises',
  validateSearch: lireRechercheStock,
  component: lazyRouteComponent(espaces.gestion, 'RouteArdoises'),
})

const ficheClient = createRoute({
  getParentRoute: () => gestion,
  path: '/ardoises/$clientId',
  validateSearch: lireRechercheStock,
  component: lazyRouteComponent(espaces.gestion, 'RouteFicheClient'),
})

const entreprise = createRoute({
  getParentRoute: () => gestion,
  path: '/entreprise',
  component: lazyRouteComponent(espaces.gestion, 'PageEntreprise'),
})

const options = createRoute({
  getParentRoute: () => gestion,
  path: '/options',
  component: lazyRouteComponent(espaces.gestion, 'PageOptions'),
})

const taxes = createRoute({
  getParentRoute: () => gestion,
  path: '/taxes',
  component: lazyRouteComponent(espaces.gestion, 'PageTaxes'),
})

const plateforme = createRoute({
  getParentRoute: () => racine,
  path: '/plateforme',
  beforeLoad: ({ context }) => exigerPortee(context.clientRequetes, 'PLATEFORME'),
  component: lazyRouteComponent(espaces.plateforme, 'MiseEnPagePlateforme'),
})

export interface RechercheEntreprises {
  /** Nom de l'entreprise tout juste créée, pour le confirmer. */
  creee?: string
  compteExistant?: boolean
}

const plateformeAccueil = createRoute({
  getParentRoute: () => plateforme,
  path: '/',
  validateSearch: (recherche: Record<string, unknown>): RechercheEntreprises => ({
    ...(typeof recherche.creee === 'string' ? { creee: recherche.creee } : {}),
    ...(recherche.compteExistant === true ? { compteExistant: true } : {}),
  }),
  component: lazyRouteComponent(espaces.plateforme, 'RouteEntreprises'),
})

const nouvelleEntreprise = createRoute({
  getParentRoute: () => plateforme,
  path: '/entreprises/nouvelle',
  component: lazyRouteComponent(espaces.plateforme, 'PageNouvelleEntreprise'),
})

const tableauDeBordPlateforme = createRoute({
  getParentRoute: () => plateforme,
  path: '/tableau-de-bord',
  component: lazyRouteComponent(espaces.plateforme, 'PageTableauDeBordPlateforme'),
})

const equipe = createRoute({
  getParentRoute: () => plateforme,
  path: '/equipe',
  component: lazyRouteComponent(espaces.plateforme, 'PageEquipe'),
})

const activitePlateforme = createRoute({
  getParentRoute: () => plateforme,
  path: '/activite',
  validateSearch: (recherche: Record<string, unknown>): { entrepriseId?: string } =>
    typeof recherche.entrepriseId === 'string' ? { entrepriseId: recherche.entrepriseId } : {},
  component: lazyRouteComponent(espaces.plateforme, 'RouteActivitePlateforme'),
})

const support = createRoute({
  getParentRoute: () => plateforme,
  path: '/support',
  component: lazyRouteComponent(espaces.plateforme, 'PageSupport'),
})

const ficheEntreprise = createRoute({
  getParentRoute: () => plateforme,
  path: '/entreprises/$entrepriseId',
  component: lazyRouteComponent(espaces.plateforme, 'RouteFicheEntreprise'),
})

const recu = createRoute({
  getParentRoute: () => racine,
  path: '/r/$jeton',
  component: lazyRouteComponent(espaces.public, 'RouteRecu'),
})

/** L'aide se lit sans session : un employé l'ouvre depuis la caisse, la cuisine ou son téléphone. */
const aide = createRoute({
  getParentRoute: () => racine,
  path: '/aide',
  // L'écran d'où l'on vient : l'accueil de l'aide propose son guide en tête.
  validateSearch: (recherche: Record<string, unknown>): { depuis?: string } =>
    typeof recherche.depuis === 'string' ? { depuis: recherche.depuis } : {},
  component: lazyRouteComponent(espaces.aide, 'RouteAide'),
})

const aideGuide = createRoute({
  getParentRoute: () => racine,
  path: '/aide/$guide',
  component: lazyRouteComponent(espaces.aide, 'RouteGuide'),
})

const arbre = racine.addChildren([
  accueil,
  connexion,
  changerMotDePasse,
  choixEntreprise,
  inscription,
  caisse.addChildren([caisseAccueil, caisseTiroir, caisseNote, caisseEncaissement]),
  enregistrementTablette,
  cuisine,
  gestion.addChildren([
    gestionAccueil,
    etablissements,
    personnel,
    tablettes,
    produits,
    nouveauProduit,
    ficheProduit,
    carteEtablissement,
    taxes,
    options,
    activite,
    salles,
    stock,
    receptionStock,
    inventaireStock,
    ardoises,
    ventes,
    caisses,
    detailCaisse,
    entreprise,
    ficheClient,
  ]),
  plateforme.addChildren([
    tableauDeBordPlateforme,
    plateformeAccueil,
    nouvelleEntreprise,
    ficheEntreprise,
    activitePlateforme,
    equipe,
    support,
  ]),
  recu,
  aide,
  aideGuide,
])

export function creerRouteur({
  clientRequetes,
  historique,
}: {
  clientRequetes: QueryClient
  historique?: RouterHistory
}) {
  return createRouter({
    routeTree: arbre,
    context: { clientRequetes },
    // Une adresse inconnue affiche la page introuvable complète, jamais dans une mise en page d'espace.
    notFoundMode: 'root',
    defaultPendingComponent: PageEnChargement,
    ...(historique ? { history: historique } : {}),
  })
}

export type Routeur = ReturnType<typeof creerRouteur>

declare module '@tanstack/react-router' {
  interface Register {
    router: Routeur
  }
}
