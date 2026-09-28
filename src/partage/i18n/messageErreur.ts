import { ErreurApi } from '../api/ErreurApi'
import { i18n } from './i18n'

/** Message à montrer à l'utilisateur : traduction du code, sinon message public du serveur. */
export function messageErreur(erreur: unknown): string {
  if (!(erreur instanceof ErreurApi)) return i18n.t('erreurs.ERREUR_INTERNE')
  const cle = `erreurs.${erreur.code}`
  return i18n.exists(cle) ? i18n.t(cle) : erreur.reponse.message
}
