import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  CaisseResume,
  DetailCaisse,
  HistoriqueCaisses,
  RapportVentes,
  TableauDeBord,
} from '../../partage/api/contrat'
import type { Periode } from './periodes'

function parametres(
  periode: Periode,
  etablissementId: string,
  autres: Record<string, string> = {},
) {
  const recherche = new URLSearchParams({ du: periode.du, au: periode.au, ...autres })
  if (etablissementId !== '') recherche.set('etablissementId', etablissementId)
  return recherche.toString()
}

export function requeteVentes(periode: Periode, etablissementId: string) {
  const recherche = parametres(periode, etablissementId)
  return queryOptions({
    queryKey: ['rapports', 'ventes', recherche],
    queryFn: ({ signal }) => appelerApi<RapportVentes>(`/rapports/ventes?${recherche}`, { signal }),
    // On garde l'écran précédent pendant le calcul : changer de période ne fait pas clignoter la page.
    placeholderData: keepPreviousData,
  })
}

export function requeteCaisses(periode: Periode, etablissementId: string, ecartsSeulement = false) {
  const recherche = parametres(periode, etablissementId, {
    ecartsSeulement: String(ecartsSeulement),
  })
  return queryOptions({
    queryKey: ['rapports', 'caisses', recherche],
    queryFn: ({ signal }) =>
      appelerApi<HistoriqueCaisses>(`/rapports/caisses?${recherche}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function requeteDetailCaisse(ouvertureId: string) {
  return queryOptions({
    queryKey: ['rapports', 'caisses', ouvertureId],
    queryFn: ({ signal }) =>
      appelerApi<DetailCaisse>(`/rapports/caisses/${ouvertureId}`, { signal }),
  })
}

export function requeteTableauDeBord(etablissementId: string) {
  const recherche = etablissementId === '' ? '' : `?etablissementId=${etablissementId}`
  return queryOptions({
    queryKey: ['rapports', 'tableau-de-bord', etablissementId],
    queryFn: ({ signal }) =>
      appelerApi<TableauDeBord>(`/rapports/tableau-de-bord${recherche}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

export const requeteCaissesOuvertes = queryOptions({
  queryKey: ['rapports', 'caisses', 'ouvertes'],
  queryFn: ({ signal }) => appelerApi<CaisseResume[]>('/rapports/caisses/ouvertes', { signal }),
})
