// Les pages lisibles sans session : chargées à part, la caisse n'embarque pas l'inscription ni le reçu en ligne.
import { getRouteApi } from '@tanstack/react-router'
import { PageConnexion } from '../../fonctionnalites/connexion/PageConnexion'
import { PageRecu } from '../../fonctionnalites/recu/PageRecu'

export { PageChangerMotDePasse } from '../../fonctionnalites/connexion/PageChangerMotDePasse'
export { PageChoixEntreprise } from '../../fonctionnalites/connexion/PageChoixEntreprise'
export { PageInscription } from '../../fonctionnalites/inscription/PageInscription'
export { PageEnregistrementTablette } from '../../fonctionnalites/tablette/PageEnregistrementTablette'

export function RouteConnexion() {
  const { motDePasseChange } = getRouteApi('/connexion').useSearch()
  return <PageConnexion motDePasseChange={motDePasseChange === true} />
}

export function RouteRecu() {
  const { jeton } = getRouteApi('/r/$jeton').useParams()
  return <PageRecu jeton={jeton} />
}
