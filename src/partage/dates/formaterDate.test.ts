import { describe, expect, it } from 'vitest'
import { formaterDate } from './formaterDate'

describe('formaterDate', () => {
  it('écrit une date de tableau en jour, mois, année', () => {
    expect(formaterDate('2026-09-28T19:41:00Z', 'Africa/Lome')).toBe('28/09/2026')
  })

  it('suit le fuseau demandé plutôt que celui de l’appareil', () => {
    expect(formaterDate('2026-09-28T23:30:00Z', 'Africa/Douala')).toBe('29/09/2026')
  })
})
