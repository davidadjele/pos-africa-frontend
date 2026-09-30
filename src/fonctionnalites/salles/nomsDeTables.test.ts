import { describe, expect, it } from 'vitest'
import { nomsDeTables, suivantDe } from './nomsDeTables'

describe('nomsDeTables', () => {
  it('reprend la règle du serveur : suite numérotée, ou suffixe', () => {
    expect(nomsDeTables('T9', 4)).toEqual(['T9', 'T10', 'T11', 'T12'])
    expect(nomsDeTables('Terrasse', 3)).toEqual(['Terrasse 1', 'Terrasse 2', 'Terrasse 3'])
    expect(nomsDeTables('Comptoir', 1)).toEqual(['Comptoir'])
  })
})

describe('suivantDe', () => {
  it('propose le nom qui suit les tables existantes', () => {
    expect(suivantDe(['T1', 'T2', 'T8'])).toBe('T9')
    expect(suivantDe([])).toBe('T1')
    expect(suivantDe(['Comptoir'])).toBe('T1')
  })
})
