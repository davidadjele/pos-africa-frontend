import { describe, expect, it } from 'vitest'
import { joursDepuis } from './presentation'

describe('joursDepuis', () => {
  const maintenant = new Date('2026-10-01T20:00:00Z').getTime()

  it('compte les jours entiers écoulés', () => {
    expect(joursDepuis('2026-10-01T08:00:00Z', maintenant)).toBe(0)
    expect(joursDepuis('2026-09-30T19:00:00Z', maintenant)).toBe(1)
    expect(joursDepuis('2026-08-17T20:00:00Z', maintenant)).toBe(45)
  })
})
