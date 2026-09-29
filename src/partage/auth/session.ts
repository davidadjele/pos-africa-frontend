import { appelerApi } from '../api/appelerApi'
import type {
  EntrepriseAccessible,
  ReponseConnexion,
  ReponseRafraichissement,
} from '../api/contrat'
import {
  abonnerJeton,
  effacerJetonAcces,
  definirJetonAcces,
  lireJetonAcces,
} from '../api/jetonAcces'
import { oublierRafraichissementEnCours, rafraichirJeton } from '../api/rafraichissement'

/**
 * État de la session côté navigateur. Il ne sert qu'à choisir l'écran à montrer : chaque appel
 * reste autorisé ou refusé par le backend.
 */
export type EtatSession =
  | { statut: 'inconnue' }
  | { statut: 'anonyme' }
  | { statut: 'choixEntreprise'; entreprises: EntrepriseAccessible[] }
  | { statut: 'connectee' }

const INCONNUE: EtatSession = { statut: 'inconnue' }
const ANONYME: EtatSession = { statut: 'anonyme' }
const CONNECTEE: EtatSession = { statut: 'connectee' }

let etat: EtatSession = INCONNUE
let demarrage: Promise<void> | null = null
const ecouteurs = new Set<() => void>()

// Un rafraîchissement raté pendant un appel efface le jeton : la session est alors finie.
abonnerJeton(() => {
  if (lireJetonAcces() === null && etat.statut === 'connectee') changer(ANONYME)
})

export function lireEtatSession(): EtatSession {
  return etat
}

export function abonnerSession(ecouteur: () => void): () => void {
  ecouteurs.add(ecouteur)
  return () => {
    ecouteurs.delete(ecouteur)
  }
}

/** Rafraîchissement silencieux au démarrage, une seule fois : le cookie HttpOnly rouvre la session. */
export async function demarrerSession(): Promise<EtatSession> {
  demarrage ??= rafraichirJeton().then(appliquer, () => {
    changer(ANONYME)
  })
  await demarrage
  return etat
}

export async function connecter(identifiant: string, motDePasse: string): Promise<EtatSession> {
  try {
    const reponse = await appelerApi<ReponseConnexion>('/auth/connexion', {
      methode: 'POST',
      corps: { identifiant, motDePasse },
    })
    ouvrirSession(reponse)
    return etat
  } catch (erreur) {
    changer(ANONYME)
    throw erreur
  }
}

/** Ouvre la session à partir d'une réponse de connexion (connexion ou inscription). */
export function ouvrirSession(reponse: ReponseConnexion): void {
  appliquer(reponse)
}

export async function choisirEntreprise(entrepriseId: string): Promise<EtatSession> {
  appliquer(await rafraichirJeton(entrepriseId))
  return etat
}

export async function deconnecter(): Promise<void> {
  try {
    await appelerApi('/auth/deconnexion', { methode: 'POST' })
  } catch {
    // Même sans réponse du serveur, l'appareil ne doit plus rien pouvoir faire au nom du compte.
  } finally {
    effacerJetonAcces()
    changer(ANONYME)
  }
}

/** Pour les tests : repart d'une application qui vient de s'ouvrir. */
export function reinitialiserSession(): void {
  effacerJetonAcces()
  oublierRafraichissementEnCours()
  demarrage = null
  etat = INCONNUE
}

function appliquer(reponse: Pick<ReponseRafraichissement, 'jetonAcces' | 'entreprises'>): void {
  if (reponse.jetonAcces !== undefined) {
    definirJetonAcces(reponse.jetonAcces)
    changer(CONNECTEE)
    return
  }
  effacerJetonAcces()
  changer(
    reponse.entreprises.length > 0
      ? { statut: 'choixEntreprise', entreprises: reponse.entreprises }
      : ANONYME,
  )
}

function changer(nouvel: EtatSession): void {
  if (nouvel === etat) return
  etat = nouvel
  for (const ecouteur of ecouteurs) ecouteur()
}
