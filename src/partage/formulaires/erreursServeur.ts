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
    // Le champ visé par le code garde le message traduit, pas le texte du serveur (en français seulement).
    if (nom === champDuCode) continue
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

/** Message du serveur pour ce champ (ReponseErreur.champs), s'il y en a un : à afficher sous le champ. */
export function messageDuChamp(erreur: unknown, champ: string): string | undefined {
  if (!(erreur instanceof ErreurApi)) return undefined
  return erreur.reponse.champs?.find((invalide) => invalide.champ === champ)?.message
}

/** Vrai si chaque erreur de champ a trouvé sa place : le bandeau général n'a alors rien à ajouter. */
export function toutSousLesChamps(erreur: unknown, champs: readonly string[]): boolean {
  if (!(erreur instanceof ErreurApi) || erreur.reponse.champs === undefined) return false
  return erreur.reponse.champs.every((invalide) => champs.includes(invalide.champ))
}
