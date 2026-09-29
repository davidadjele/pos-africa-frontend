import type { ReponseRafraichissement } from './contrat'
import { ErreurApi } from './ErreurApi'
import { definirJetonAcces, effacerJetonAcces } from './jetonAcces'
import { envoyer } from './requete'

// Le backend fait tourner le cookie à chaque usage : deux rafraîchissements simultanés
// présenteraient le même cookie et le second passerait pour une réutilisation.
let enCours: Promise<ReponseRafraichissement> | null = null

/**
 * Échange le cookie de rafraîchissement contre un jeton d'accès, pour l'entreprise courante
 * ou pour celle demandée (changement d'entreprise). Un seul échange à la fois.
 */
export function rafraichirJeton(entrepriseId?: string): Promise<ReponseRafraichissement> {
  if (enCours !== null && entrepriseId === undefined) return enCours
  const precedent = enCours
  const promesse = (async () => {
    if (precedent !== null) await precedent.catch(() => undefined)
    return echanger(entrepriseId)
  })()
  enCours = promesse
  void promesse
    .finally(() => {
      if (enCours === promesse) enCours = null
    })
    .catch(() => undefined)
  return promesse
}

async function echanger(entrepriseId: string | undefined): Promise<ReponseRafraichissement> {
  try {
    const reponse = await envoyer<ReponseRafraichissement>(
      '/auth/rafraichir',
      { methode: 'POST', ...(entrepriseId === undefined ? {} : { corps: { entrepriseId } }) },
      null,
    )
    if (reponse.jetonAcces === undefined) effacerJetonAcces()
    else definirJetonAcces(reponse.jetonAcces)
    return reponse
  } catch (erreur) {
    // Session finie : le jeton en mémoire ne vaut plus rien. Un refus (403, entreprise suspendue
    // ou étrangère) laisse la session intacte, et une coupure réseau ne dit rien de la session.
    if (erreur instanceof ErreurApi && erreur.statut === 401) {
      effacerJetonAcces()
    }
    throw erreur
  }
}

/** Pour les tests : repart d'un état sans échange en cours. */
export function oublierRafraichissementEnCours(): void {
  enCours = null
}
