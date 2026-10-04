import { describe, expect, it } from 'vitest'
import { FLAG, FLAG_ENVOYE, POULET, POULET_A_ENVOYER } from '../../../tests/commandes'
import { envoiVersLaCuisine, pasEncorePret } from './service'

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

describe('envoiVersLaCuisine', () => {
  const flagABrouillon = { ...FLAG_ENVOYE, statut: 'BROUILLON' as const }

  it('ne part pas en cuisine quand tout se sert au bar', () => {
    expect(envoiVersLaCuisine([flagABrouillon], [FLAG, POULET])).toBe(false)
    expect(envoiVersLaCuisine([flagABrouillon, POULET_A_ENVOYER], [FLAG, POULET])).toBe(true)
  })

  it('garde le libellé habituel tant que la carte n’est pas chargée', () => {
    expect(envoiVersLaCuisine([flagABrouillon], undefined)).toBe(true)
  })
})
