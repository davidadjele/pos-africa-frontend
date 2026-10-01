import { describe, expect, it } from 'vitest'
import { montantArticles, partsAVenir, totalSelection } from './partage'

describe('partage de l’addition', () => {
  it('annonce les parts restantes, l’arrondi sur la dernière', () => {
    expect(partsAVenir(13_500, 3, 0)).toEqual([4500, 4500, 4500])
    expect(partsAVenir(10_000, 3, 0)).toEqual([3333, 3333, 3334])
    expect(partsAVenir(6667, 3, 1)).toEqual([3333, 3334])
    expect(partsAVenir(0, 2, 2)).toEqual([])
  })

  it('calcule les articles comme le serveur : la ligne retombe sur son net', () => {
    const flags = { montant: 3400, quantite: 3, payees: 0, paye: 0 }
    expect(montantArticles(flags, 1)).toBe(1133)
    expect(montantArticles({ ...flags, payees: 2, paye: 2266 }, 1)).toBe(1134)
    expect(montantArticles(flags, 0)).toBe(0)
  })

  it('additionne une sélection sur plusieurs lignes', () => {
    const articles = [
      { ligneId: 'poulet', montant: 9000, quantite: 2, payees: 1, paye: 4500 },
      { ligneId: 'flag', montant: 3600, quantite: 3, payees: 0, paye: 0 },
    ]
    expect(totalSelection(articles, { poulet: 1, flag: 1 })).toBe(5700)
    expect(totalSelection(articles, {})).toBe(0)
  })
})
