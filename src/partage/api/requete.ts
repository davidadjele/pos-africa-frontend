import { ErreurApi } from './ErreurApi'
import { estReponseErreur } from './ReponseErreur'

export type MethodeHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface OptionsAppel {
  methode?: MethodeHttp
  corps?: unknown
  signal?: AbortSignal
}

// Toujours la même origine : Vite (dev) et Vercel (production) relaient /api vers le backend.
// La CSP reste « connect-src 'self' » et le cookie SameSite=Strict de /auth est bien envoyé.
export const PREFIXE_API = '/api'

const MESSAGE_RESEAU = 'Le serveur est injoignable. Vérifiez la connexion et réessayez.'
const MESSAGE_INTERNE = 'Une erreur inattendue est survenue. Réessayez.'

/**
 * Routes authentifiées par cookie et non par jeton d'accès : la session (/auth) et la tablette
 * (/appareil, pas /appareils du back-office). Elles portent l'en-tête anti-CSRF, et un refus 401 n'y
 * déclenche pas de rafraîchissement de session.
 */
export function estRouteAuthentification(chemin: string): boolean {
  return chemin.startsWith('/auth/') || chemin === '/appareil' || chemin.startsWith('/appareil/')
}

/** Un appel HTTP brut, sans nouvel essai : les erreurs sont normalisées en ErreurApi. */
export async function envoyer<T>(
  chemin: string,
  options: OptionsAppel,
  jeton: string | null,
): Promise<T> {
  const { methode = 'GET', corps, signal } = options
  const entetes = new Headers({ Accept: 'application/json' })
  if (jeton !== null) entetes.set('Authorization', `Bearer ${jeton}`)
  if (corps !== undefined) entetes.set('Content-Type', 'application/json')
  const routeAuthentification = estRouteAuthentification(chemin)
  // Protection anti-CSRF exigée par le backend sur les routes authentifiées par cookie.
  if (routeAuthentification) entetes.set('X-Demande-Tonti', '1')

  let reponse: Response
  try {
    reponse = await fetch(new URL(PREFIXE_API + chemin, window.location.origin), {
      method: methode,
      headers: entetes,
      body: corps === undefined ? null : JSON.stringify(corps),
      credentials: routeAuthentification ? 'include' : 'same-origin',
      signal: signal ?? null,
    })
  } catch (erreur) {
    // L'annulation (changement d'écran, TanStack Query) n'est pas une panne : on la laisse passer.
    if (signal?.aborted === true) throw erreur
    throw new ErreurApi({ statut: 0, code: 'RESEAU_INDISPONIBLE', message: MESSAGE_RESEAU })
  }

  if (reponse.status === 204) return undefined as T

  const contenu = await lireJson(reponse)
  if (reponse.ok && contenu.lisible) return contenu.valeur as T
  if (!reponse.ok && contenu.lisible && estReponseErreur(contenu.valeur)) {
    throw new ErreurApi(contenu.valeur, lireDelai(reponse))
  }
  // Proxy, passerelle ou page HTML : la réponse ne suit pas le contrat de l'API.
  throw new ErreurApi({ statut: reponse.status, code: 'ERREUR_INTERNE', message: MESSAGE_INTERNE })
}

function lireDelai(reponse: Response): number | undefined {
  const valeur = reponse.headers.get('Retry-After')
  if (valeur === null || !/^\d+$/.test(valeur)) return undefined
  return Number(valeur)
}

async function lireJson(
  reponse: Response,
): Promise<{ lisible: true; valeur: unknown } | { lisible: false }> {
  try {
    return { lisible: true, valeur: await reponse.json() }
  } catch {
    return { lisible: false }
  }
}
