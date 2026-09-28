import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router'
import { EcranCaisse } from '../fonctionnalites/caisse/EcranCaisse'
import { TableauDeBord } from '../fonctionnalites/gestion/TableauDeBord'
import { PageRecu } from '../fonctionnalites/recu/PageRecu'
import { MiseEnPageCaisse } from './mises-en-page/MiseEnPageCaisse'
import { MiseEnPageGestion } from './mises-en-page/MiseEnPageGestion'
import { PageIntrouvable } from './PageIntrouvable'

const racine = createRootRoute({
  component: Outlet,
  notFoundComponent: PageIntrouvable,
})

const accueil = createRoute({
  getParentRoute: () => racine,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/caisse', replace: true })
  },
})

const caisse = createRoute({
  getParentRoute: () => racine,
  path: '/caisse',
  component: MiseEnPageCaisse,
})

const caisseAccueil = createRoute({
  getParentRoute: () => caisse,
  path: '/',
  component: EcranCaisse,
})

const gestion = createRoute({
  getParentRoute: () => racine,
  path: '/gestion',
  component: MiseEnPageGestion,
})

const gestionAccueil = createRoute({
  getParentRoute: () => gestion,
  path: '/',
  component: TableauDeBord,
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
  caisse.addChildren([caisseAccueil]),
  gestion.addChildren([gestionAccueil]),
  recu,
])

export function creerRouteur(historique?: RouterHistory) {
  return createRouter({
    routeTree: arbre,
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
