import { ErreurApi } from './ErreurApi'
import { effacerJetonCaisse, lireJetonCaisse } from './jetonCaisse'
import { envoyer, type OptionsAppel } from './requete'

/**
 * Appel de l'API avec le jeton de caisse. Pas de rafraîchissement : un refus 401 (tablette révoquée,
 * PIN réinitialisé, employé désactivé) ferme la session et ramène à « Qui prend la caisse ? ».
 */
export async function appelerCaisse<T>(chemin: string, options: OptionsAppel = {}): Promise<T> {
  const jeton = lireJetonCaisse()
  try {
    return await envoyer<T>(chemin, options, jeton)
  } catch (erreur) {
    // PIN_INCORRECT : le code d'un gérant qui valide est faux, la session de l'employé tient toujours.
    if (
      erreur instanceof ErreurApi &&
      erreur.statut === 401 &&
      erreur.code !== 'PIN_INCORRECT' &&
      lireJetonCaisse() === jeton
    ) {
      effacerJetonCaisse()
    }
    throw erreur
  }
}
