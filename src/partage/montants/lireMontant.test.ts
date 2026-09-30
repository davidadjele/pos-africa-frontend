import { describe, expect, it } from 'vitest'
import { lireMontant } from './lireMontant'

describe('lireMontant', () => {
  it('lit un prix en francs CFA, espaces tolérés', () => {
    expect(lireMontant('1000', 'XOF')).toBe(1000)
    expect(lireMontant('12 500', 'XOF')).toBe(12_500)
  })

  it('lit les décimales d’une devise qui en a', () => {
    expect(lireMontant('12,50', 'GHS')).toBe(1250)
    expect(lireMontant('12.5', 'GHS')).toBe(1250)
    expect(lireMontant('12', 'GHS')).toBe(1200)
  })

  it('refuse une saisie illisible ou trop précise', () => {
    expect(lireMontant('', 'XOF')).toBeNull()
    expect(lireMontant('12,5', 'XOF')).toBeNull()
    expect(lireMontant('12,505', 'GHS')).toBeNull()
    expect(lireMontant('abc', 'XOF')).toBeNull()
    expect(lireMontant('-5', 'XOF')).toBeNull()
  })
})
