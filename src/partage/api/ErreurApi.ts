import type { ReponseErreur } from './ReponseErreur'

/** Toute erreur d'un appel API, normalisée au format ReponseErreur quelle que soit sa cause. */
export class ErreurApi extends Error {
  override readonly name = 'ErreurApi'
  readonly reponse: ReponseErreur

  constructor(reponse: ReponseErreur) {
    super(reponse.message)
    this.reponse = reponse
  }

  get statut(): number {
    return this.reponse.statut
  }

  get code(): string {
    return this.reponse.code
  }
}
