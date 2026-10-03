import { describe, expect, it } from 'vitest'
import { RAPPORT } from './fixtures'
import { pointsDeVigilance } from './vigilance'

describe('À surveiller', () => {
  it('signale remboursements, annulations, remises en hausse et ardoise, du plus grave au moins grave', () => {
    expect(pointsDeVigilance(RAPPORT).map((point) => [point.cle, point.ton])).toEqual([
      ['remboursements', 'danger'],
      ['annulations', 'alerte'],
      ['remises', 'alerte'],
      ['ardoise', 'info'],
    ])
  })

  it('ne dit rien d’une période sans incident', () => {
    const calme = {
      ...RAPPORT,
      indicateurs: { ...RAPPORT.indicateurs, remises: 0, remboursements: 0, notesRemboursees: 0 },
      annulations: { articles: 0, montant: 0, articlesDuServeur: 0 },
      ardoise: { montant: 0, clients: 0 },
    }
    expect(pointsDeVigilance(calme)).toEqual([])
  })

  it('ne parle des remises que si leur part monte de plus d’un point', () => {
    const stable = {
      ...RAPPORT,
      indicateurs: { ...RAPPORT.indicateurs, remises: 18_000 },
      precedent: { ...RAPPORT.precedent, remises: 16_000 },
    }
    expect(pointsDeVigilance(stable).map((point) => point.cle)).not.toContain('remises')
  })
})
