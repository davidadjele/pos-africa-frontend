import { queryOptions } from '@tanstack/react-query'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type {
  EtatCaisse,
  EtatEncaissement,
  EtatRemboursement,
  NoteEncaissee,
  RecuCaisse,
  SituationCaisse,
} from '../../partage/api/contrat'

/** La caisse de cette tablette : ouverte ou non, et les opérateurs Mobile Money du pays. */
export const requeteOuvertureCaisse = queryOptions({
  queryKey: ['caisse', 'ouverture'],
  queryFn: ({ signal }) => appelerCaisse<EtatCaisse>('/caisse/ouverture', { signal }),
})

export function requeteEncaissement(commandeId: string) {
  return queryOptions({
    queryKey: ['caisse', 'encaissement', commandeId],
    queryFn: ({ signal }) =>
      appelerCaisse<EtatEncaissement>(`/caisse/commandes/${commandeId}/encaissement`, { signal }),
  })
}

/** Les notes encaissées de la journée en cours, les plus récentes d'abord. */
export const requeteNotesEncaissees = queryOptions({
  queryKey: ['caisse', 'notes-encaissees'],
  queryFn: ({ signal }) => appelerCaisse<NoteEncaissee[]>('/caisse/notes-encaissees', { signal }),
})

export function requeteRemboursement(commandeId: string) {
  return queryOptions({
    queryKey: ['caisse', 'remboursement', commandeId],
    queryFn: ({ signal }) =>
      appelerCaisse<EtatRemboursement>(`/caisse/commandes/${commandeId}/remboursement`, { signal }),
  })
}

/** La caisse en cours (rapport X) ; une caisse fermée répond une erreur, sans relance. */
export const requeteSituation = {
  queryKey: ['caisse', 'situation'],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    appelerCaisse<SituationCaisse>('/caisse/situation', { signal }),
  retry: false,
}

/** Le reçu d'une note encaissée. */
export function requeteRecu(commandeId: string) {
  return queryOptions({
    queryKey: ['caisse', 'recu', commandeId],
    queryFn: ({ signal }) =>
      appelerCaisse<RecuCaisse>(`/caisse/commandes/${commandeId}/recu`, { signal }),
  })
}
