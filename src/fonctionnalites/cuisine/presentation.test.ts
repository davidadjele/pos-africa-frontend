import { describe, expect, it } from 'vitest'
import { chrono, enColonnes, nouveauxBons } from './presentation'

const ENVOI = '2026-10-03T21:30:00Z'

function apres(minutes: number, secondes = 0): Date {
  return new Date(new Date(ENVOI).getTime() + (minutes * 60 + secondes) * 1000)
}

describe('chrono', () => {
  it('passe du vert à l’orange à 10 minutes, puis au rouge à 20', () => {
    expect(chrono(ENVOI, apres(4, 12))).toEqual({ texte: '04:12', ton: 'succes' })
    expect(chrono(ENVOI, apres(10))).toEqual({ texte: '10:00', ton: 'alerte' })
    expect(chrono(ENVOI, apres(21, 40))).toEqual({ texte: '21:40', ton: 'danger' })
  })

  it('compte les heures au-delà de 60 minutes et jamais en négatif', () => {
    expect(chrono(ENVOI, apres(75, 3)).texte).toBe('1:15:03')
    expect(chrono(ENVOI, apres(-1)).texte).toBe('00:00')
  })
})

describe('enColonnes', () => {
  it('répartit à tour de rôle : l’ordre se lit de gauche à droite', () => {
    expect(enColonnes([1, 2, 3, 4, 5, 6, 7], 4)).toEqual([[1, 5], [2, 6], [3, 7], [4]])
    expect(enColonnes([1, 2], 4)).toEqual([[1], [2], [], []])
  })
})

describe('nouveauxBons', () => {
  it('ne signale rien au premier chargement, puis seulement les bons arrivés', () => {
    expect(nouveauxBons(null, ['a', 'b'])).toBe(0)
    expect(nouveauxBons(new Set(['a', 'b']), ['a', 'b', 'c'])).toBe(1)
    expect(nouveauxBons(new Set(['a', 'b']), ['b'])).toBe(0)
  })
})
