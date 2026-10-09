// L'espace de l'équipe plateforme : un outil interne, jamais chargé par un restaurant.
import { getRouteApi } from '@tanstack/react-router'
import { PageActivitePlateforme } from '../../fonctionnalites/plateforme/PageActivitePlateforme'
import { PageEntreprises } from '../../fonctionnalites/plateforme/PageEntreprises'
import { PageFicheEntreprise } from '../../fonctionnalites/plateforme/PageFicheEntreprise'

export { MiseEnPagePlateforme } from '../mises-en-page/MiseEnPagePlateforme'
export { PageEquipe } from '../../fonctionnalites/plateforme/PageEquipe'
export { PageNouvelleEntreprise } from '../../fonctionnalites/plateforme/PageNouvelleEntreprise'
export { PageSupport } from '../../fonctionnalites/plateforme/PageSupport'
export { PageTableauDeBordPlateforme } from '../../fonctionnalites/plateforme/PageTableauDeBordPlateforme'

export function RouteEntreprises() {
  const recherche = getRouteApi('/plateforme/').useSearch()
  return <PageEntreprises recherche={recherche} />
}

export function RouteActivitePlateforme() {
  const { entrepriseId } = getRouteApi('/plateforme/activite').useSearch()
  return entrepriseId === undefined ? (
    <PageActivitePlateforme />
  ) : (
    <PageActivitePlateforme key={entrepriseId} entrepriseId={entrepriseId} />
  )
}

export function RouteFicheEntreprise() {
  const { entrepriseId } = getRouteApi('/plateforme/entreprises/$entrepriseId').useParams()
  return <PageFicheEntreprise key={entrepriseId} entrepriseId={entrepriseId} />
}
