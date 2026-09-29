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
    if (erreur instanceof ErreurApi && erreur.statut === 401 && lireJetonCaisse() === jeton) {
      effacerJetonCaisse()
    }
    throw erreur
  }
}
