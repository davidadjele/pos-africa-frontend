import { ErreurApi } from '../api/ErreurApi'
import { i18n } from './i18n'

/** Message à montrer à l'utilisateur : traduction du code, sinon message public du serveur. */
export function messageErreur(erreur: unknown): string {
  if (!(erreur instanceof ErreurApi)) return i18n.t('erreurs.ERREUR_INTERNE')
  const secondes = erreur.reessayerApresSecondes
  const cleAvecDelai = `erreursAvecDelai.${erreur.code}`
  if (secondes !== undefined && i18n.exists(cleAvecDelai)) {
    return i18n.t(cleAvecDelai, { duree: formaterDelai(secondes) })
  }
  const cle = `erreurs.${erreur.code}`
  return i18n.exists(cle) ? i18n.t(cle) : erreur.reponse.message
}

function formaterDelai(secondes: number): string {
  if (secondes < 60) return i18n.t('duree.secondes', { nombre: secondes })
  return i18n.t('duree.minutes', { nombre: Math.ceil(secondes / 60) })
}
