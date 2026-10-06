import { describe, expect, it } from 'vitest'
import { journeeCourante, journeeLaPlusAvancee, nombreDeJours, periodeDe, variation } from './periodes'

describe('périodes des rapports', () => {
  it('compte une heure du matin dans la journée de la veille, comme la caisse', () => {
    expect(journeeCourante('Africa/Lome', new Date('2026-10-02T01:30:00Z'))).toBe('2026-10-01')
    expect(journeeCourante('Africa/Lome', new Date('2026-10-02T04:00:00Z'))).toBe('2026-10-02')
    expect(journeeCourante('Africa/Douala', new Date('2026-10-02T03:30:00Z'))).toBe('2026-10-02')
  })

  it('prend la journée la plus avancée des établissements, pour ne laisser aucune note payée hors période', () => {
    // 3 h 11 à Conakry (veille), 4 h 11 à Porto-Novo (nouvelle journée).
    const maintenant = new Date('2026-10-06T03:11:00Z')
    expect(journeeLaPlusAvancee(['Africa/Conakry', 'Africa/Porto-Novo'], maintenant)).toBe('2026-10-06')
    expect(journeeLaPlusAvancee(['Africa/Conakry'], maintenant)).toBe('2026-10-05')
  })

  it('calcule chaque période à partir de la journée en cours', () => {
    expect(periodeDe('AUJOURDHUI', '2026-10-01')).toEqual({ du: '2026-10-01', au: '2026-10-01' })
    expect(periodeDe('HIER', '2026-10-01')).toEqual({ du: '2026-09-30', au: '2026-09-30' })
    expect(periodeDe('SEPT_JOURS', '2026-10-01')).toEqual({ du: '2026-09-25', au: '2026-10-01' })
    expect(periodeDe('CE_MOIS', '2026-10-01')).toEqual({ du: '2026-10-01', au: '2026-10-01' })
    expect(periodeDe('MOIS_DERNIER', '2026-03-15')).toEqual({ du: '2026-02-01', au: '2026-02-28' })
    expect(periodeDe('MOIS_DERNIER', '2026-01-10')).toEqual({ du: '2025-12-01', au: '2025-12-31' })
  })

  it('compte les jours d’une période, bornes comprises', () => {
    expect(nombreDeJours({ du: '2026-09-25', au: '2026-10-01' })).toBe(7)
  })

  it('donne la variation en pour cent, sans en inventer une quand rien n’était vendu avant', () => {
    expect(variation(1_284_500, 1_146_900)).toBe(12)
    expect(variation(900, 1000)).toBe(-10)
    expect(variation(500, 0)).toBeNull()
  })
})
