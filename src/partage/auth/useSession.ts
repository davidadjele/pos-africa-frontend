import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { appelerApi } from '../api/appelerApi'
import type { ReponseMoi } from '../api/contrat'
import {
  abonnerSession,
  choisirEntreprise as choisirEntrepriseSession,
  connecter as connecterSession,
  deconnecter as deconnecterSession,
  lireEtatSession,
  type EtatSession,
} from './session'

/** Permissions que l'interface reflète (le backend les applique dans tous les cas). */
export type Permission =
  | 'ACTIVITE_CONSULTER'
  | 'APPAREIL_GERER'
  | 'BACK_OFFICE'
  | 'CATALOGUE_GERER'
  | 'CLIENT_CREDIT'
  | 'DISPONIBILITE_GERER'
  | 'ETABLISSEMENT_GERER'
  | 'PERSONNEL_GERER'
  | 'PRIX_MODIFIER'
  | 'SALLE_GERER'
  | 'STOCK_AJUSTER'
  | 'STOCK_RECEPTIONNER'

export const requeteMoi = queryOptions({
  queryKey: ['session', 'moi'],
  queryFn: ({ signal }) => appelerApi<ReponseMoi>('/moi', { signal }),
  staleTime: 60_000,
})

export function useEtatSession(): EtatSession {
  return useSyncExternalStore(abonnerSession, lireEtatSession)
}

export function useSession() {
  const etat = useEtatSession()
  const clientRequetes = useQueryClient()
  const { data: moi } = useQuery({ ...requeteMoi, enabled: etat.statut === 'connectee' })

  // Changer de compte ou d'entreprise invalide tout le cache : aucune donnée d'une entreprise ne
  // doit rester visible sous une autre.
  const connecter = useCallback(
    async (identifiant: string, motDePasse: string) => {
      const nouvelEtat = await connecterSession(identifiant, motDePasse)
      clientRequetes.clear()
      return nouvelEtat
    },
    [clientRequetes],
  )
  const choisirEntreprise = useCallback(
    async (entrepriseId: string) => {
      const nouvelEtat = await choisirEntrepriseSession(entrepriseId)
      // Réinitialiser plutôt que vider : les écrans affichés restent abonnés à leurs requêtes et
      // se rechargent aussitôt avec le jeton de la nouvelle entreprise.
      await clientRequetes.resetQueries()
      return nouvelEtat
    },
    [clientRequetes],
  )
  const deconnecter = useCallback(async () => {
    await deconnecterSession()
    clientRequetes.clear()
  }, [clientRequetes])
  const aLaPermission = useCallback(
    (permission: Permission) => moi?.permissions.includes(permission) ?? false,
    [moi],
  )

  return { etat, moi, aLaPermission, connecter, choisirEntreprise, deconnecter }
}

export function nomAffiche(moi: ReponseMoi): string {
  if (moi.utilisateur) return `${moi.utilisateur.prenom} ${moi.utilisateur.nom}`
  return moi.compte.email ?? moi.compte.telephone ?? ''
}
