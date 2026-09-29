// Le jeton d'accès vit uniquement dans cette variable de module (ADR backend 0002) : un script
// injecté ne peut pas le relire depuis le stockage du navigateur, et il disparaît au rechargement,
// où le refresh silencieux (cookie HttpOnly) en obtient un nouveau.
let jeton: string | null = null
const ecouteurs = new Set<() => void>()

export function lireJetonAcces(): string | null {
  return jeton
}

export function definirJetonAcces(nouveauJeton: string): void {
  changer(nouveauJeton)
}

export function effacerJetonAcces(): void {
  changer(null)
}

/** La session apprend ainsi qu'un rafraîchissement raté a fait perdre le jeton. */
export function abonnerJeton(ecouteur: () => void): () => void {
  ecouteurs.add(ecouteur)
  return () => {
    ecouteurs.delete(ecouteur)
  }
}

function changer(nouveau: string | null): void {
  if (nouveau === jeton) return
  jeton = nouveau
  for (const ecouteur of ecouteurs) ecouteur()
}
