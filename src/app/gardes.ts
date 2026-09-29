import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { appelerApi } from '../partage/api/appelerApi'
import type { ConfigurationPublique, Portee, ReponseMoi } from '../partage/api/contrat'
import { ErreurApi } from '../partage/api/ErreurApi'
import { effacerJetonAcces } from '../partage/api/jetonAcces'
import { demarrerSession } from '../partage/auth/session'
import { requeteMoi } from '../partage/auth/useSession'

// Les gardes choisissent l'écran à montrer ; la sécurité reste celle du backend, qui refuse tout
// appel hors de la portée du jeton.

export const requeteConfiguration = queryOptions({
  queryKey: ['public', 'configuration'],
  queryFn: ({ signal }) => appelerApi<ConfigurationPublique>('/public/configuration', { signal }),
  staleTime: 5 * 60_000,
})

export function accueilDe(portee: Portee): '/plateforme' | '/gestion' {
  return portee === 'PLATEFORME' ? '/plateforme' : '/gestion'
}

async function chargerMoi(clientRequetes: QueryClient): Promise<ReponseMoi> {
  try {
    return await clientRequetes.query(requeteMoi)
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 401) {
      effacerJetonAcces()
      throw redirect({ to: '/connexion', replace: true })
    }
    throw erreur
  }
}

/** Mot de passe temporaire : le serveur ne permet rien d'autre que le remplacer, l'interface non plus. */
function exigerMotDePasseChoisi(moi: ReponseMoi): void {
  if (moi.compte.motDePasseAChanger) throw redirect({ to: '/changer-mot-de-passe', replace: true })
}

/** Espace réservé à une portée : entreprise (gestion, caisse) ou plateforme. */
export async function exigerPortee(clientRequetes: QueryClient, portee: Portee): Promise<void> {
  const etat = await demarrerSession()
  if (etat.statut === 'choixEntreprise') throw redirect({ to: '/choix-entreprise', replace: true })
  if (etat.statut !== 'connectee') throw redirect({ to: '/connexion', replace: true })
  const moi = await chargerMoi(clientRequetes)
  exigerMotDePasseChoisi(moi)
  if (moi.portee !== portee) throw redirect({ to: accueilDe(moi.portee), replace: true })
}

/** Changement obligatoire : seulement pour une session ouverte avec un mot de passe temporaire. */
export async function exigerMotDePasseTemporaire(clientRequetes: QueryClient): Promise<void> {
  const etat = await demarrerSession()
  if (etat.statut === 'choixEntreprise') throw redirect({ to: '/choix-entreprise', replace: true })
  if (etat.statut !== 'connectee') throw redirect({ to: '/connexion', replace: true })
  const moi = await chargerMoi(clientRequetes)
  if (!moi.compte.motDePasseAChanger) throw redirect({ to: accueilDe(moi.portee), replace: true })
}

/** Écrans d'entrée (connexion, inscription) : une session ouverte mène directement à son espace. */
export async function redirigerSiSessionOuverte(clientRequetes: QueryClient): Promise<void> {
  const etat = await demarrerSession()
  if (etat.statut === 'choixEntreprise') throw redirect({ to: '/choix-entreprise', replace: true })
  if (etat.statut === 'connectee') {
    const moi = await chargerMoi(clientRequetes)
    exigerMotDePasseChoisi(moi)
    throw redirect({ to: accueilDe(moi.portee), replace: true })
  }
}

export async function exigerChoixEntreprise(clientRequetes: QueryClient): Promise<void> {
  const etat = await demarrerSession()
  if (etat.statut === 'choixEntreprise') return
  await redirigerSiSessionOuverte(clientRequetes)
  throw redirect({ to: '/connexion', replace: true })
}

export async function exigerInscriptionOuverte(clientRequetes: QueryClient): Promise<void> {
  await redirigerSiSessionOuverte(clientRequetes)
  const configuration = await clientRequetes.query(requeteConfiguration)
  if (!configuration.inscriptionOuverte) throw redirect({ to: '/connexion', replace: true })
}
