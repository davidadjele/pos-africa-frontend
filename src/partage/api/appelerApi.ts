import { ErreurApi } from './ErreurApi'
import { lireJetonAcces } from './jetonAcces'
import { estReponseErreur } from './ReponseErreur'

export type MethodeHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface OptionsAppel {
  methode?: MethodeHttp
  corps?: unknown
  signal?: AbortSignal
}

const MESSAGE_RESEAU = 'Le serveur est injoignable. Vérifiez la connexion et réessayez.'
const MESSAGE_INTERNE = 'Une erreur inattendue est survenue. Réessayez.'

export async function appelerApi<T>(chemin: string, options: OptionsAppel = {}): Promise<T> {
  const { methode = 'GET', corps, signal } = options
  const entetes = new Headers({ Accept: 'application/json' })
  const jeton = lireJetonAcces()
  if (jeton !== null) entetes.set('Authorization', `Bearer ${jeton}`)
  if (corps !== undefined) entetes.set('Content-Type', 'application/json')

  let reponse: Response
  try {
    reponse = await fetch(`${import.meta.env.VITE_URL_API}${chemin}`, {
      method: methode,
      headers: entetes,
      body: corps === undefined ? null : JSON.stringify(corps),
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
    throw new ErreurApi(contenu.valeur)
  }
  // Proxy, passerelle ou page HTML : la réponse ne suit pas le contrat de l'API.
  throw new ErreurApi({ statut: reponse.status, code: 'ERREUR_INTERNE', message: MESSAGE_INTERNE })
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
