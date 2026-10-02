import { describe, expect, it } from 'vitest'
import { i18n } from '../../partage/i18n/i18n'
import { joursDepuis, libelleEcriture } from './presentation'

describe('joursDepuis', () => {
  const maintenant = new Date('2026-10-01T20:00:00Z').getTime()

  it('compte les jours entiers écoulés', () => {
    expect(joursDepuis('2026-10-01T08:00:00Z', maintenant)).toBe(0)
    expect(joursDepuis('2026-09-30T19:00:00Z', maintenant)).toBe(1)
    expect(joursDepuis('2026-08-17T20:00:00Z', maintenant)).toBe(45)
  })
})

describe('libelleEcriture', () => {
  const t = i18n.getFixedT('fr')

  it('dit comment le client a réglé, et la référence s’il y en a une', () => {
    const reglement = {
      id: 'e1',
      type: 'REGLEMENT' as const,
      montant: -5000,
      soldeApres: 13_000,
      mode: 'MOBILE_MONEY' as const,
      detail: '8KQ21',
      par: 'Yawa T.',
      le: '2026-10-01T20:00:00Z',
    }
    expect(libelleEcriture(reglement, t)).toBe('Règlement, Mobile Money, 8KQ21')
    const enEspeces = {
      id: 'e2',
      type: 'REGLEMENT' as const,
      montant: -5000,
      soldeApres: 8000,
      mode: 'ESPECES' as const,
      par: 'Yawa T.',
      le: '2026-10-01T21:00:00Z',
    }
    expect(libelleEcriture(enEspeces, t)).toBe('Règlement, espèces')
  })
})
