import type { ReponseErreur } from './ReponseErreur'

/** Toute erreur d'un appel API, normalisée au format ReponseErreur quelle que soit sa cause. */
export class ErreurApi extends Error {
  override readonly name = 'ErreurApi'
  readonly reponse: ReponseErreur
  /** Délai imposé par l'en-tête Retry-After (trop de tentatives), en secondes. */
  readonly reessayerApresSecondes: number | undefined

  constructor(reponse: ReponseErreur, reessayerApresSecondes?: number) {
    super(reponse.message)
    this.reponse = reponse
    this.reessayerApresSecondes = reessayerApresSecondes
  }

  get statut(): number {
    return this.reponse.statut
  }

  get code(): string {
    return this.reponse.code
  }
}
