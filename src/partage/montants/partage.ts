/**
 * Addition partagée, calculée comme le serveur (PartageAddition) : chaque montant part de ce qui est déjà payé,
 * pour que la somme des paiements retombe exactement sur le total.
 */

/** Les parts qui restent à payer : le reste divisé par les parts restantes, l'arrondi sur la dernière. */
export function partsAVenir(reste: number, parts: number, partsPayees: number): number[] {
  const montants: number[] = []
  let restant = reste
  for (let restantes = parts - partsPayees; restantes > 0; restantes--) {
    const part = Math.floor(restant / restantes)
    montants.push(part)
    restant -= part
  }
  return montants
}

export interface ArticlePartageable {
  /** Ce que coûte la ligne au client, toutes remises déduites. */
  montant: number
  quantite: number
  payees: number
  paye: number
}

/** Ce que coûtent `choisies` unités de plus d'une ligne, sachant ce qui en est déjà payé. */
export function montantArticles(article: ArticlePartageable, choisies: number): number {
  if (choisies <= 0) return 0
  return (
    Math.floor((article.montant * (article.payees + choisies)) / article.quantite) - article.paye
  )
}

export function totalSelection(
  articles: readonly (ArticlePartageable & { ligneId: string })[],
  selection: Readonly<Record<string, number>>,
): number {
  return articles.reduce(
    (somme, article) => somme + montantArticles(article, selection[article.ligneId] ?? 0),
    0,
  )
}
