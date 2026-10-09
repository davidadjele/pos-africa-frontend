// Le manuel : ses guides ne se chargent qu'en ouvrant l'aide.
import { getRouteApi } from '@tanstack/react-router'
import { PageAide } from '../../fonctionnalites/manuel/PageAide'
import { PageGuide } from '../../fonctionnalites/manuel/PageGuide'

export function RouteAide() {
  const { depuis } = getRouteApi('/aide').useSearch()
  return <PageAide {...(depuis === undefined ? {} : { depuis })} />
}

export function RouteGuide() {
  const { guide } = getRouteApi('/aide/$guide').useParams()
  return <PageGuide id={guide} />
}
