// La caisse d'une tablette : un seul morceau de code, chargé à l'ouverture de la caisse.
import { getRouteApi } from '@tanstack/react-router'
import { EcranNote } from '../../fonctionnalites/commande/EcranNote'
import { EcranEncaissement } from '../../fonctionnalites/encaissement/EcranEncaissement'

export { MiseEnPageCaisse } from '../mises-en-page/MiseEnPageCaisse'
export { EcranPlan } from '../../fonctionnalites/commande/EcranPlan'
export { EcranTiroir } from '../../fonctionnalites/encaissement/EcranTiroir'

export function RouteNote() {
  const { commandeId } = getRouteApi('/caisse/notes/$commandeId').useParams()
  // Une note par clé : passer d'une note à l'autre repart d'un écran propre (alerte, dialogue).
  return <EcranNote key={commandeId} commandeId={commandeId} />
}

export function RouteEncaissement() {
  const { commandeId } = getRouteApi('/caisse/notes/$commandeId/encaisser').useParams()
  return <EcranEncaissement key={commandeId} commandeId={commandeId} />
}
