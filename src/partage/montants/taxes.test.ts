import { describe, expect, it } from 'vitest'
import { formaterTaux, lireTaux, taxeIncluse } from './taxes'

describe('taxeIncluse', () => {
  it('déduit la TVA d’un prix TTC, arrondie à l’unité', () => {
    expect(taxeIncluse(1000, 1800)).toBe(153)
    expect(taxeIncluse(11_800, 1800)).toBe(1800)
    expect(taxeIncluse(4500, 1800)).toBe(686)
  })

  it('vaut zéro sans taxe', () => {
    expect(taxeIncluse(1000, 0)).toBe(0)
  })

  it('reste exacte sur de très grands montants', () => {
    expect(taxeIncluse(1_000_000_000_000, 1800)).toBe(152_542_372_881)
  })
})

describe('formaterTaux', () => {
  it('affiche des points de base en pourcentage, avec une espace insécable', () => {
    expect(formaterTaux(1800)).toBe('18\u00a0%')
    expect(formaterTaux(1925)).toBe('19,25\u00a0%')
    expect(formaterTaux(250)).toBe('2,5\u00a0%')
  })
})

describe('lireTaux', () => {
  it('lit un pourcentage saisi, virgule ou point', () => {
    expect(lireTaux('18')).toBe(1800)
    expect(lireTaux('19,25')).toBe(1925)
    expect(lireTaux(' 2.5 ')).toBe(250)
  })

  it('refuse ce qui n’est pas un taux entre 0 et 100 à deux décimales au plus', () => {
    expect(lireTaux('')).toBeNull()
    expect(lireTaux('101')).toBeNull()
    expect(lireTaux('18,125')).toBeNull()
    expect(lireTaux('dix')).toBeNull()
  })
})
