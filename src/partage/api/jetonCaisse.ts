import { useSyncExternalStore } from 'react'

// Jeton de la session de caisse (PIN), distinct de celui du back-office : en mémoire seulement,
// comme jetonAcces. Un rechargement de la tablette ramène à « Qui prend la caisse ? ».
let jeton: string | null = null
const ecouteurs = new Set<() => void>()

export function lireJetonCaisse(): string | null {
  return jeton
}

export function definirJetonCaisse(nouveauJeton: string): void {
  changer(nouveauJeton)
}

/** Changement d'utilisateur, verrouillage après inactivité, ou session refusée par le serveur. */
export function effacerJetonCaisse(): void {
  changer(null)
}

function abonner(ecouteur: () => void): () => void {
  ecouteurs.add(ecouteur)
  return () => {
    ecouteurs.delete(ecouteur)
  }
}

export function useJetonCaisse(): string | null {
  return useSyncExternalStore(abonner, lireJetonCaisse)
}

function changer(nouveau: string | null): void {
  if (nouveau === jeton) return
  jeton = nouveau
  for (const ecouteur of ecouteurs) ecouteur()
}
