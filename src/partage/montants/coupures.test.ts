import { describe, expect, it } from 'vitest'
import { coupuresDe, totalCompte } from './coupures'

describe('coupures', () => {
  it('donne les billets et les pièces du franc CFA, les plus gros d’abord', () => {
    expect(coupuresDe('XOF')).toEqual({
      billets: [10_000, 5000, 2000, 1000],
      pieces: [500, 250, 200, 100, 50, 25, 10, 5],
    })
  })

  it('ne propose pas de grille pour une devise inconnue : on saisit le total', () => {
    expect(coupuresDe('EUR')).toBeNull()
  })

  it('additionne un comptage par coupure, en entiers', () => {
    expect(totalCompte({ 10_000: 6, 5000: 7, 500: 6, 25: 0 })).toBe(98_000)
  })
})
