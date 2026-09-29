import { ErreurApi } from './ErreurApi'
import { lireJetonAcces } from './jetonAcces'
import { rafraichirJeton } from './rafraichissement'
import { envoyer, estRouteAuthentification, type OptionsAppel } from './requete'

export type { MethodeHttp, OptionsAppel } from './requete'

/**
 * Appel de l'API avec le jeton d'accès en mémoire. Un jeton expiré (401) est rafraîchi une fois,
 * puis la requête est rejouée une seule fois.
 */
export async function appelerApi<T>(chemin: string, options: OptionsAppel = {}): Promise<T> {
  const jetonEnvoye = lireJetonAcces()
  try {
    return await envoyer<T>(chemin, options, jetonEnvoye)
  } catch (erreur) {
    if (!doitRafraichir(erreur, chemin, jetonEnvoye)) throw erreur
    // Un autre appel a peut-être déjà renouvelé le jeton pendant cette requête.
    if (lireJetonAcces() === jetonEnvoye) await rafraichirJeton()
    return envoyer<T>(chemin, options, lireJetonAcces())
  }
}

function doitRafraichir(erreur: unknown, chemin: string, jetonEnvoye: string | null): boolean {
  return (
    erreur instanceof ErreurApi &&
    erreur.statut === 401 &&
    jetonEnvoye !== null &&
    !estRouteAuthentification(chemin)
  )
}
