import { describe, expect, it } from 'vitest'
import {
  debutDuJour,
  formaterDate,
  formaterDateHeure,
  formaterHeure,
  formaterJour,
} from './formaterDate'

describe('formaterDate', () => {
  it('écrit une date de tableau en jour, mois, année', () => {
    expect(formaterDate('2026-09-28T19:41:00Z', 'Africa/Lome')).toBe('28/09/2026')
  })

  it('suit le fuseau demandé plutôt que celui de l’appareil', () => {
    expect(formaterDate('2026-09-28T23:30:00Z', 'Africa/Douala')).toBe('29/09/2026')
  })
})

describe('formaterDateHeure', () => {
  it('ajoute l’heure après une virgule, dans le fuseau de l’entreprise', () => {
    expect(formaterDateHeure('2026-09-28T20:41:00Z', 'Africa/Lome')).toBe('28/09/2026, 20:41')
    expect(formaterDateHeure('2026-09-28T20:41:00Z', 'Africa/Douala')).toBe('28/09/2026, 21:41')
  })
})

describe('formaterHeure', () => {
  it('donne l’heure dans le fuseau de l’établissement', () => {
    expect(formaterHeure('2026-09-29T19:42:00Z', 'Africa/Lome')).toBe('19:42')
    expect(formaterHeure('2026-09-29T19:42:00Z', 'Africa/Douala')).toBe('20:42')
  })
})

describe('formaterJour', () => {
  it('nomme le jour dans le fuseau de l’établissement', () => {
    expect(formaterJour('2026-09-29T23:30:00Z', 'Africa/Lome')).toBe('mardi 29 septembre')
    expect(formaterJour('2026-09-29T23:30:00Z', 'Africa/Douala')).toBe('mercredi 30 septembre')
  })
})

describe('debutDuJour', () => {
  it('donne minuit local en instant UTC', () => {
    expect(debutDuJour('Africa/Lome', new Date('2026-09-29T19:42:10Z')).toISOString()).toBe(
      '2026-09-29T00:00:00.000Z',
    )
    expect(debutDuJour('Africa/Douala', new Date('2026-09-29T23:30:00Z')).toISOString()).toBe(
      '2026-09-29T23:00:00.000Z',
    )
  })
})
