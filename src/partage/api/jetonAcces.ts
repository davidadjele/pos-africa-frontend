// Le jeton d'accès vit uniquement dans cette variable de module (ADR backend 0002) : un script
// injecté ne peut pas le relire depuis le stockage du navigateur, et il disparaît au rechargement,
// où le refresh silencieux (cookie HttpOnly) en obtient un nouveau.
let jeton: string | null = null

export function lireJetonAcces(): string | null {
  return jeton
}

export function definirJetonAcces(nouveauJeton: string): void {
  jeton = nouveauJeton
}

export function effacerJetonAcces(): void {
  jeton = null
}
