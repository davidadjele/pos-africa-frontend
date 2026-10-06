import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router'
import { PageActivite } from '../fonctionnalites/activite/PageActivite'
import { PageCarteEtablissement } from '../fonctionnalites/catalogue/PageCarteEtablissement'
import { PageFicheProduit } from '../fonctionnalites/catalogue/PageFicheProduit'
import { PageProduits, type RechercheProduits } from '../fonctionnalites/catalogue/PageProduits'
import { PageOptions } from '../fonctionnalites/catalogue/PageOptions'
import { PageTaxes } from '../fonctionnalites/catalogue/PageTaxes'
import { PageSalles } from '../fonctionnalites/salles/PageSalles'
import { PageArdoises } from '../fonctionnalites/ardoise/PageArdoises'
import { PageEntreprise } from '../fonctionnalites/etablissements/PageEntreprise'
import { PageFicheClient } from '../fonctionnalites/ardoise/PageFicheClient'
import { PageInventaireStock } from '../fonctionnalites/stock/PageInventaireStock'
import { PageReceptionStock } from '../fonctionnalites/stock/PageReceptionStock'
import { PageStock } from '../fonctionnalites/stock/PageStock'
import { EcranNote } from '../fonctionnalites/commande/EcranNote'
import { EcranPlan } from '../fonctionnalites/commande/EcranPlan'
import { EcranEncaissement } from '../fonctionnalites/encaissement/EcranEncaissement'
import { EcranTiroir } from '../fonctionnalites/encaissement/EcranTiroir'
import { PageChangerMotDePasse } from '../fonctionnalites/connexion/PageChangerMotDePasse'
import { PageChoixEntreprise } from '../fonctionnalites/connexion/PageChoixEntreprise'
import { PageConnexion } from '../fonctionnalites/connexion/PageConnexion'
import { PageEtablissements } from '../fonctionnalites/etablissements/PageEtablissements'
import { TableauDeBord } from '../fonctionnalites/gestion/TableauDeBord'
import { PageInscription } from '../fonctionnalites/inscription/PageInscription'
import { PagePersonnel } from '../fonctionnalites/personnel/PagePersonnel'
import { PageEntreprises } from '../fonctionnalites/plateforme/PageEntreprises'
import { PageActivitePlateforme } from '../fonctionnalites/plateforme/PageActivitePlateforme'
import { PageEquipe } from '../fonctionnalites/plateforme/PageEquipe'
import { PageFicheEntreprise } from '../fonctionnalites/plateforme/PageFicheEntreprise'
import { PageNouvelleEntreprise } from '../fonctionnalites/plateforme/PageNouvelleEntreprise'
import { PageSupport } from '../fonctionnalites/plateforme/PageSupport'
import { PageTableauDeBordPlateforme } from '../fonctionnalites/plateforme/PageTableauDeBordPlateforme'
import { PageRecu } from '../fonctionnalites/recu/PageRecu'
import { PageAide } from '../fonctionnalites/manuel/PageAide'
import { PageGuide } from '../fonctionnalites/manuel/PageGuide'
import { PageCaisses } from '../fonctionnalites/rapports/PageCaisses'
import { PageDetailCaisse } from '../fonctionnalites/rapports/PageDetailCaisse'
import { PageVentes } from '../fonctionnalites/rapports/PageVentes'
import { EcranCuisine } from '../fonctionnalites/cuisine/EcranCuisine'
import { PageEnregistrementTablette } from '../fonctionnalites/tablette/PageEnregistrementTablette'
import { PageTablettes } from '../fonctionnalites/tablette/PageTablettes'
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
import { MiseEnPageCaisse } from './mises-en-page/MiseEnPageCaisse'
import { MiseEnPageGestion } from './mises-en-page/MiseEnPageGestion'
import { MiseEnPagePlateforme } from './mises-en-page/MiseEnPagePlateforme'
import { PageErreur } from './PageErreur'
import { PageIntrouvable } from './PageIntrouvable'

export interface ContexteRouteur {
  clientRequetes: QueryClient
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
  component: function RouteConnexion() {
    const { motDePasseChange } = connexion.useSearch()
    return <PageConnexion motDePasseChange={motDePasseChange === true} />
  },
})

const changerMotDePasse = createRoute({
  getParentRoute: () => racine,
  path: '/changer-mot-de-passe',
  beforeLoad: ({ context }) => exigerMotDePasseTemporaire(context.clientRequetes),
  component: PageChangerMotDePasse,
})

const choixEntreprise = createRoute({
  getParentRoute: () => racine,
  path: '/choix-entreprise',
  beforeLoad: ({ context }) => exigerChoixEntreprise(context.clientRequetes),
  component: PageChoixEntreprise,
})

const inscription = createRoute({
  getParentRoute: () => racine,
  path: '/inscription',
  beforeLoad: ({ context }) => exigerInscriptionOuverte(context.clientRequetes),
  component: PageInscription,
})

const caisse = createRoute({
  getParentRoute: () => racine,
  path: '/caisse',
  beforeLoad: ({ context }) => exigerTablette(context.clientRequetes),
  component: MiseEnPageCaisse,
})

const cuisine = createRoute({
  getParentRoute: () => racine,
  path: '/cuisine',
  beforeLoad: ({ context }) => exigerTabletteCuisine(context.clientRequetes),
  component: EcranCuisine,
})

const enregistrementTablette = createRoute({
  getParentRoute: () => racine,
  path: '/enregistrement-tablette',
  beforeLoad: ({ context }) => redirigerSiTabletteEnregistree(context.clientRequetes),
  component: PageEnregistrementTablette,
})

const caisseAccueil = createRoute({
  getParentRoute: () => caisse,
  path: '/',
  component: EcranPlan,
})

const caisseEncaissement = createRoute({
  getParentRoute: () => caisse,
  path: '/notes/$commandeId/encaisser',
  component: function RouteEncaissement() {
    const { commandeId } = caisseEncaissement.useParams()
    return <EcranEncaissement key={commandeId} commandeId={commandeId} />
  },
})

const caisseTiroir = createRoute({
  getParentRoute: () => caisse,
  path: '/tiroir',
  component: EcranTiroir,
})

const caisseNote = createRoute({
  getParentRoute: () => caisse,
  path: '/notes/$commandeId',
  component: function RouteNote() {
    const { commandeId } = caisseNote.useParams()
    // Une note par clé : passer d'une note à l'autre repart d'un écran propre (alerte, dialogue).
    return <EcranNote key={commandeId} commandeId={commandeId} />
  },
})

const gestion = createRoute({
  getParentRoute: () => racine,
  path: '/gestion',
  beforeLoad: ({ context }) => exigerPortee(context.clientRequetes, 'ENTREPRISE'),
  component: MiseEnPageGestion,
})

const gestionAccueil = createRoute({
  getParentRoute: () => gestion,
  path: '/',
  component: TableauDeBord,
})

const etablissements = createRoute({
  getParentRoute: () => gestion,
  path: '/etablissements',
  component: PageEtablissements,
})

const personnel = createRoute({
  getParentRoute: () => gestion,
  path: '/personnel',
  component: PagePersonnel,
})

const tablettes = createRoute({
  getParentRoute: () => gestion,
  path: '/tablettes',
  component: PageTablettes,
})

const produits = createRoute({
  getParentRoute: () => gestion,
  path: '/produits',
  validateSearch: (recherche: Record<string, unknown>): RechercheProduits =>
    typeof recherche.enregistre === 'string' ? { enregistre: recherche.enregistre } : {},
  component: function RouteProduits() {
    const recherche = produits.useSearch()
    // La clé remonte la page à chaque enregistrement : la confirmation part de l'état initial.
    return <PageProduits key={recherche.enregistre ?? ''} recherche={recherche} />
  },
})

const nouveauProduit = createRoute({
  getParentRoute: () => gestion,
  path: '/produits/nouveau',
  component: function RouteNouveauProduit() {
    return <PageFicheProduit />
  },
})

const ficheProduit = createRoute({
  getParentRoute: () => gestion,
  path: '/produits/$produitId',
  component: function RouteFicheProduit() {
    const { produitId } = ficheProduit.useParams()
    return <PageFicheProduit key={produitId} produitId={produitId} />
  },
})

const carteEtablissement = createRoute({
  getParentRoute: () => gestion,
  path: '/carte-etablissement',
  component: PageCarteEtablissement,
})

const activite = createRoute({
  getParentRoute: () => gestion,
  path: '/activite',
  component: PageActivite,
})

const salles = createRoute({
  getParentRoute: () => gestion,
  path: '/salles',
  component: PageSalles,
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
  component: function RouteStock() {
    const recherche = stock.useSearch()
    // La clé repart d'un état propre à chaque retour d'action : le message s'affiche une fois.
    return (
      <PageStock key={`${recherche.etablissement ?? ''}${recherche.fait ?? ''}`} {...recherche} />
    )
  },
})

const receptionStock = createRoute({
  getParentRoute: () => gestion,
  path: '/stock/reception',
  validateSearch: lireRechercheStock,
  component: function RouteReceptionStock() {
    const { etablissement } = receptionStock.useSearch()
    return (
      <PageReceptionStock
        {...(etablissement === undefined ? {} : { etablissementId: etablissement })}
      />
    )
  },
})

const inventaireStock = createRoute({
  getParentRoute: () => gestion,
  path: '/stock/inventaire',
  validateSearch: lireRechercheStock,
  component: function RouteInventaireStock() {
    const { etablissement } = inventaireStock.useSearch()
    return (
      <PageInventaireStock
        {...(etablissement === undefined ? {} : { etablissementId: etablissement })}
      />
    )
  },
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
  component: function RouteVentes() {
    const recherche = ventes.useSearch()
    return <PageVentes key={JSON.stringify(recherche)} {...recherche} />
  },
})

const caisses = createRoute({
  getParentRoute: () => gestion,
  path: '/caisses',
  component: PageCaisses,
})

const detailCaisse = createRoute({
  getParentRoute: () => gestion,
  path: '/caisses/$ouvertureId',
  component: function RouteDetailCaisse() {
    const { ouvertureId } = detailCaisse.useParams()
    return <PageDetailCaisse ouvertureId={ouvertureId} />
  },
})

const ardoises = createRoute({
  getParentRoute: () => gestion,
  path: '/ardoises',
  validateSearch: lireRechercheStock,
  component: function RouteArdoises() {
    const { etablissement } = ardoises.useSearch()
    return (
      <PageArdoises
        key={etablissement ?? ''}
        {...(etablissement === undefined ? {} : { etablissement })}
      />
    )
  },
})

const ficheClient = createRoute({
  getParentRoute: () => gestion,
  path: '/ardoises/$clientId',
  validateSearch: lireRechercheStock,
  component: function RouteFicheClient() {
    const { clientId } = ficheClient.useParams()
    const { etablissement } = ficheClient.useSearch()
    return (
      <PageFicheClient
        key={clientId}
        clientId={clientId}
        {...(etablissement === undefined ? {} : { etablissement })}
      />
    )
  },
})

const entreprise = createRoute({
  getParentRoute: () => gestion,
  path: '/entreprise',
  component: PageEntreprise,
})

const options = createRoute({
  getParentRoute: () => gestion,
  path: '/options',
  component: PageOptions,
})

const taxes = createRoute({
  getParentRoute: () => gestion,
  path: '/taxes',
  component: PageTaxes,
})

const plateforme = createRoute({
  getParentRoute: () => racine,
  path: '/plateforme',
  beforeLoad: ({ context }) => exigerPortee(context.clientRequetes, 'PLATEFORME'),
  component: MiseEnPagePlateforme,
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
  component: function RouteEntreprises() {
    const recherche = plateformeAccueil.useSearch()
    return <PageEntreprises recherche={recherche} />
  },
})

const nouvelleEntreprise = createRoute({
  getParentRoute: () => plateforme,
  path: '/entreprises/nouvelle',
  component: PageNouvelleEntreprise,
})

const tableauDeBordPlateforme = createRoute({
  getParentRoute: () => plateforme,
  path: '/tableau-de-bord',
  component: PageTableauDeBordPlateforme,
})

const equipe = createRoute({
  getParentRoute: () => plateforme,
  path: '/equipe',
  component: PageEquipe,
})

const activitePlateforme = createRoute({
  getParentRoute: () => plateforme,
  path: '/activite',
  validateSearch: (recherche: Record<string, unknown>): { entrepriseId?: string } =>
    typeof recherche.entrepriseId === 'string' ? { entrepriseId: recherche.entrepriseId } : {},
  component: function RouteActivitePlateforme() {
    const { entrepriseId } = activitePlateforme.useSearch()
    return entrepriseId === undefined ? (
      <PageActivitePlateforme />
    ) : (
      <PageActivitePlateforme key={entrepriseId} entrepriseId={entrepriseId} />
    )
  },
})

const support = createRoute({
  getParentRoute: () => plateforme,
  path: '/support',
  component: PageSupport,
})

const ficheEntreprise = createRoute({
  getParentRoute: () => plateforme,
  path: '/entreprises/$entrepriseId',
  component: function RouteFicheEntreprise() {
    const { entrepriseId } = ficheEntreprise.useParams()
    return <PageFicheEntreprise key={entrepriseId} entrepriseId={entrepriseId} />
  },
})

const recu = createRoute({
  getParentRoute: () => racine,
  path: '/r/$jeton',
  component: function RouteRecu() {
    const { jeton } = recu.useParams()
    return <PageRecu jeton={jeton} />
  },
})

/** L'aide se lit sans session : un employé l'ouvre depuis la caisse, la cuisine ou son téléphone. */
const aide = createRoute({
  getParentRoute: () => racine,
  path: '/aide',
  component: PageAide,
})

const aideGuide = createRoute({
  getParentRoute: () => racine,
  path: '/aide/$guide',
  component: function RouteGuide() {
    const { guide } = aideGuide.useParams()
    return <PageGuide id={guide} />
  },
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
    ...(historique ? { history: historique } : {}),
  })
}

export type Routeur = ReturnType<typeof creerRouteur>

declare module '@tanstack/react-router' {
  interface Register {
    router: Routeur
  }
}
