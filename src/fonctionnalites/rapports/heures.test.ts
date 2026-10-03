import { describe, expect, it } from 'vitest'
import { heuresDeLaJournee } from './heures'

const vente = (heure: number, total: number) => ({
  heure,
  notes: 1,
  total,
  especes: total,
  mobileMoney: 0,
  carte: 0,
  ardoise: 0,
})

describe('heures de la journée de caisse', () => {
  it('suit la journée de 4 h à 3 h : après minuit, on est encore dans la soirée', () => {
    const heures = heuresDeLaJournee([vente(1, 500), vente(12, 3000), vente(22, 2000)])

    expect(heures.map((heure) => heure.heure)).toEqual([
      12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1,
    ])
    expect(heures.at(-1)?.total).toBe(500)
  })

  it('montre les heures creuses à 0, sans aller au-delà de la première et de la dernière vente', () => {
    const heures = heuresDeLaJournee([vente(18, 1500), vente(20, 4000)])

    expect(heures).toEqual([vente(18, 1500), { ...vente(19, 0), notes: 0 }, vente(20, 4000)])
  })

  it('ne dessine rien sans vente', () => {
    expect(heuresDeLaJournee([])).toEqual([])
  })
})
