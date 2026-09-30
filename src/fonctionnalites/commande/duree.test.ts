import { describe, expect, it } from 'vitest'
import { dureeDepuis } from './duree'

describe('dureeDepuis', () => {
  it('donne le temps passé à table en heures et minutes', () => {
    expect(dureeDepuis('2026-09-29T18:55:00Z', new Date('2026-09-29T20:41:30Z'))).toBe('1 h 46')
  })

  it('complète les minutes sur deux chiffres', () => {
    expect(dureeDepuis('2026-09-29T20:30:00Z', new Date('2026-09-29T20:34:00Z'))).toBe('0 h 04')
  })

  it('ne donne jamais une durée négative (horloge de la tablette en retard)', () => {
    expect(dureeDepuis('2026-09-29T20:30:00Z', new Date('2026-09-29T20:29:00Z'))).toBe('0 h 00')
  })
})
