import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router'
import { EcranCaisse } from '../fonctionnalites/caisse/EcranCaisse'
import { PageChangerMotDePasse } from '../fonctionnalites/connexion/PageChangerMotDePasse'
import { PageChoixEntreprise } from '../fonctionnalites/connexion/PageChoixEntreprise'
import { PageConnexion } from '../fonctionnalites/connexion/PageConnexion'
import { PageEtablissements } from '../fonctionnalites/etablissements/PageEtablissements'
import { TableauDeBord } from '../fonctionnalites/gestion/TableauDeBord'
import { PageInscription } from '../fonctionnalites/inscription/PageInscription'
import { PagePersonnel } from '../fonctionnalites/personnel/PagePersonnel'
import { PageEntreprises } from '../fonctionnalites/plateforme/PageEntreprises'
import { PageNouvelleEntreprise } from '../fonctionnalites/plateforme/PageNouvelleEntreprise'
import { PageRecu } from '../fonctionnalites/recu/PageRecu'
import { PageEnregistrementTablette } from '../fonctionnalites/tablette/PageEnregistrementTablette'
import { PageTablettes } from '../fonctionnalites/tablette/PageTablettes'
import {
  exigerChoixEntreprise,
  exigerInscriptionOuverte,
  exigerMotDePasseTemporaire,
  exigerPortee,
  exigerTablette,
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

const enregistrementTablette = createRoute({
  getParentRoute: () => racine,
  path: '/enregistrement-tablette',
  beforeLoad: ({ context }) => redirigerSiTabletteEnregistree(context.clientRequetes),
  component: PageEnregistrementTablette,
})

const caisseAccueil = createRoute({
  getParentRoute: () => caisse,
  path: '/',
  component: EcranCaisse,
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

const recu = createRoute({
  getParentRoute: () => racine,
  path: '/r/$jeton',
  component: function RouteRecu() {
    const { jeton } = recu.useParams()
    return <PageRecu jeton={jeton} />
  },
})

const arbre = racine.addChildren([
  accueil,
  connexion,
  changerMotDePasse,
  choixEntreprise,
  inscription,
  caisse.addChildren([caisseAccueil]),
  enregistrementTablette,
  gestion.addChildren([gestionAccueil, etablissements, personnel, tablettes]),
  plateforme.addChildren([plateformeAccueil, nouvelleEntreprise]),
  recu,
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
