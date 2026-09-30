import { describe, expect, it } from 'vitest'
import { remiseEnPourcentage, tauxDe } from './remises'

describe('remises', () => {
  it('calcule une remise en pourcentage, arrondie à l’unité la plus proche comme le serveur', () => {
    expect(remiseEnPourcentage(3600, 1000)).toBe(360)
    expect(remiseEnPourcentage(1250, 1000)).toBe(125)
    expect(remiseEnPourcentage(1255, 1000)).toBe(126)
  })

  it('donne le taux réel d’une remise en montant, arrondi au-dessus', () => {
    expect(tauxDe(360, 3600)).toBe(1000)
    expect(tauxDe(361, 3600)).toBe(1003)
    expect(tauxDe(0, 0)).toBe(0)
  })
})
