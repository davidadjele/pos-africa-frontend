import { describe, expect, it } from 'vitest'
import { cleCoupure, coupuresDe, totalCompte } from './coupures'

describe('coupures', () => {
  it('donne les billets et les pièces du franc CFA (BCEAO), les plus gros d’abord', () => {
    expect(coupuresDe('XOF')).toEqual({
      billets: [10_000, 5000, 2000, 1000, 500],
      pieces: [500, 250, 200, 100, 50, 25, 10, 5, 1],
    })
  })

  it('décrit les monnaies d’Afrique de l’Ouest, en unités mineures', () => {
    expect(coupuresDe('GNF')?.billets).toContain(100)
    expect(coupuresDe('GNF')?.pieces).toEqual([50, 25, 10, 5, 1])
    // Cedi et naira ont des centimes : 1 GH₵ = 100 pesewas, 1 ₦ = 100 kobo.
    expect(coupuresDe('GHS')?.billets).toContain(20_000)
    expect(coupuresDe('GHS')?.pieces).toEqual([200, 100, 50, 20, 10, 5, 1])
    expect(coupuresDe('NGN')?.billets[0]).toBe(100_000)
  })

  it('ne propose pas de grille pour une devise hors Afrique : on saisit le total', () => {
    expect(coupuresDe('EUR')).toBeNull()
  })

  it('compte à part le billet et la pièce de même valeur', () => {
    expect(
      totalCompte({
        [cleCoupure('billet', 500)]: 2,
        [cleCoupure('piece', 500)]: 3,
        [cleCoupure('billet', 10_000)]: 6,
      }),
    ).toBe(62_500)
    expect(totalCompte({})).toBe(0)
  })
})
