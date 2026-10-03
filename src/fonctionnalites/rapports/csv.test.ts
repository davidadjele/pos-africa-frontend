import { describe, expect, it } from 'vitest'
import { montantCsv, versCsv } from './csv'

describe('export CSV', () => {
  it('sépare par des points-virgules, protège les champs et ouvre juste dans un tableur français', () => {
    expect(
      versCsv([
        ['Produit', 'Montant'],
        ['Flag; 65 cl', 494400],
        ['Dit "le gros"', 0],
      ]),
    ).toBe('﻿Produit;Montant\r\n"Flag; 65 cl";494400\r\n"Dit ""le gros""";0\r\n')
  })

  it('écrit les montants en unités, sans espace ni symbole', () => {
    expect(montantCsv(1_284_500, 'XOF')).toBe('1284500')
    expect(montantCsv(-1205, 'EUR')).toBe('-12,05')
    expect(montantCsv(7, 'EUR')).toBe('0,07')
  })
})
