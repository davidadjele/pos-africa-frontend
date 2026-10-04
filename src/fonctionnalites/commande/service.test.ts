import { describe, expect, it } from 'vitest'
import { FLAG_ENVOYE } from '../../../tests/commandes'
import { pasEncorePret } from './service'

describe('pasEncorePret', () => {
  it('ne retient que ce que la cuisine prépare encore', () => {
    const enCuisine = { ...FLAG_ENVOYE, enCuisine: true }
    expect(pasEncorePret(enCuisine)).toBe(true)
    expect(pasEncorePret(FLAG_ENVOYE)).toBe(false)
    expect(pasEncorePret({ ...enCuisine, preteLe: '2026-09-29T19:10:00Z' })).toBe(false)
    expect(pasEncorePret({ ...enCuisine, servieLe: '2026-09-29T19:10:00Z' })).toBe(false)
    expect(pasEncorePret({ ...enCuisine, statut: 'ANNULEE' })).toBe(false)
  })
})
