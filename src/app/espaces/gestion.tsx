// Le back-office : le plus gros espace, chargé seulement par qui gère l'établissement.
import { getRouteApi } from '@tanstack/react-router'
import { PageArdoises } from '../../fonctionnalites/ardoise/PageArdoises'
import { PageFicheClient } from '../../fonctionnalites/ardoise/PageFicheClient'
import { PageFicheProduit } from '../../fonctionnalites/catalogue/PageFicheProduit'
import { PageProduits } from '../../fonctionnalites/catalogue/PageProduits'
import { PageDetailCaisse } from '../../fonctionnalites/rapports/PageDetailCaisse'
import { PageVentes } from '../../fonctionnalites/rapports/PageVentes'
import { PageInventaireStock } from '../../fonctionnalites/stock/PageInventaireStock'
import { PageReceptionStock } from '../../fonctionnalites/stock/PageReceptionStock'
import { PageStock } from '../../fonctionnalites/stock/PageStock'

export { MiseEnPageGestion } from '../mises-en-page/MiseEnPageGestion'
export { TableauDeBord } from '../../fonctionnalites/gestion/TableauDeBord'
export { PageActivite } from '../../fonctionnalites/activite/PageActivite'
export { PageCarteEtablissement } from '../../fonctionnalites/catalogue/PageCarteEtablissement'
export { PageOptions } from '../../fonctionnalites/catalogue/PageOptions'
export { PageTaxes } from '../../fonctionnalites/catalogue/PageTaxes'
export { PageEntreprise } from '../../fonctionnalites/etablissements/PageEntreprise'
export { PageEtablissements } from '../../fonctionnalites/etablissements/PageEtablissements'
export { PagePersonnel } from '../../fonctionnalites/personnel/PagePersonnel'
export { PageCaisses } from '../../fonctionnalites/rapports/PageCaisses'
export { PageSalles } from '../../fonctionnalites/salles/PageSalles'
export { PageTablettes } from '../../fonctionnalites/tablette/PageTablettes'

export function RouteProduits() {
  const recherche = getRouteApi('/gestion/produits').useSearch()
  // La clé remonte la page à chaque enregistrement : la confirmation part de l'état initial.
  return <PageProduits key={recherche.enregistre ?? ''} recherche={recherche} />
}

export function RouteNouveauProduit() {
  return <PageFicheProduit />
}

export function RouteFicheProduit() {
  const { produitId } = getRouteApi('/gestion/produits/$produitId').useParams()
  return <PageFicheProduit key={produitId} produitId={produitId} />
}

export function RouteStock() {
  const recherche = getRouteApi('/gestion/stock').useSearch()
  // La clé repart d'un état propre à chaque retour d'action : le message s'affiche une fois.
  return (
    <PageStock key={`${recherche.etablissement ?? ''}${recherche.fait ?? ''}`} {...recherche} />
  )
}

export function RouteReceptionStock() {
  const { etablissement } = getRouteApi('/gestion/stock/reception').useSearch()
  return (
    <PageReceptionStock
      {...(etablissement === undefined ? {} : { etablissementId: etablissement })}
    />
  )
}

export function RouteInventaireStock() {
  const { etablissement } = getRouteApi('/gestion/stock/inventaire').useSearch()
  return (
    <PageInventaireStock
      {...(etablissement === undefined ? {} : { etablissementId: etablissement })}
    />
  )
}

export function RouteVentes() {
  const recherche = getRouteApi('/gestion/ventes').useSearch()
  return <PageVentes key={JSON.stringify(recherche)} {...recherche} />
}

export function RouteDetailCaisse() {
  const { ouvertureId } = getRouteApi('/gestion/caisses/$ouvertureId').useParams()
  return <PageDetailCaisse ouvertureId={ouvertureId} />
}

export function RouteArdoises() {
  const { etablissement } = getRouteApi('/gestion/ardoises').useSearch()
  return (
    <PageArdoises
      key={etablissement ?? ''}
      {...(etablissement === undefined ? {} : { etablissement })}
    />
  )
}

export function RouteFicheClient() {
  const api = getRouteApi('/gestion/ardoises/$clientId')
  const { clientId } = api.useParams()
  const { etablissement } = api.useSearch()
  return (
    <PageFicheClient
      key={clientId}
      clientId={clientId}
      {...(etablissement === undefined ? {} : { etablissement })}
    />
  )
}
