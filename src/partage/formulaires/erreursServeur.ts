import { ErreurApi } from '../api/ErreurApi'
import type { ChampInvalide } from '../api/ReponseErreur'
import { messageErreur } from '../i18n/messageErreur'

type DefinirErreur<C extends string> = (champ: C, erreur: { type: string; message: string }) => void

/**
 * Place sous les champs du formulaire les erreurs de l'API (ReponseErreur.champs, ou une erreur
 * métier qui vise un champ). Renvoie celles qui ne correspondent à aucun champ affiché.
 */
export function placerErreursServeur<C extends string>(
  erreur: unknown,
  definirErreur: DefinirErreur<C>,
  {
    champs,
    codesParChamp = {},
    alias = {},
  }: {
    champs: readonly C[]
    /** Code d'erreur métier qui vise un champ (CODE_ETABLISSEMENT_DEJA_UTILISE → code). */
    codesParChamp?: Record<string, C>
    /** Champ de l'API nommé autrement dans le formulaire. */
    alias?: Record<string, C>
  },
): ChampInvalide[] {
  if (!(erreur instanceof ErreurApi)) return []
  const champDuCode = codesParChamp[erreur.code]
  if (champDuCode !== undefined) {
    definirErreur(champDuCode, { type: 'serveur', message: messageErreur(erreur) })
  }
  const restants: ChampInvalide[] = []
  for (const invalide of erreur.reponse.champs ?? []) {
    const nom = alias[invalide.champ] ?? invalide.champ
    const champ = champs.find((connu) => connu === nom)
    if (champ === undefined) restants.push(invalide)
    else definirErreur(champ, { type: 'serveur', message: invalide.message })
  }
  return restants
}

/** Un champ facultatif laissé vide n'est pas envoyé (plutôt qu'une chaîne vide). */
export function texteOptionnel(valeur: string): string | undefined {
  const nettoyee = valeur.trim()
  return nettoyee === '' ? undefined : nettoyee
}
