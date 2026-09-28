import { describe, expect, it } from 'vitest'
import { formaterMontant } from './formaterMontant'

// Espace fine insécable entre les milliers, espace insécable avant la devise, vrai signe moins.
const FINE = ' '
const INSECABLE = ' '
const MOINS = '−'

describe('formaterMontant', () => {
  it('sépare les milliers par une espace fine insécable et suffixe FCFA pour le franc CFA', () => {
    expect(formaterMontant({ unitesMineures: 13500, devise: 'XOF' })).toBe(
      `13${FINE}500${INSECABLE}FCFA`,
    )
  })

  it('utilise aussi FCFA pour le franc CFA d’Afrique centrale', () => {
    expect(formaterMontant({ unitesMineures: 2500, devise: 'XAF' })).toBe(
      `2${FINE}500${INSECABLE}FCFA`,
    )
  })

  it('abrège la devise en F dans la forme courte', () => {
    expect(formaterMontant({ unitesMineures: 13500, devise: 'XOF' }, { forme: 'courte' })).toBe(
      `13${FINE}500${INSECABLE}F`,
    )
  })

  it('n’affiche que le nombre dans la forme sans devise, pour les tuiles et les tableaux', () => {
    expect(formaterMontant({ unitesMineures: 4500, devise: 'XOF' }, { forme: 'nombre' })).toBe(
      `4${FINE}500`,
    )
  })

  it('écrit un montant négatif avec le vrai signe moins', () => {
    expect(formaterMontant({ unitesMineures: -2, devise: 'XOF' }, { forme: 'nombre' })).toBe(
      `${MOINS}2`,
    )
    expect(formaterMontant({ unitesMineures: -500, devise: 'XOF' })).toBe(
      `${MOINS}500${INSECABLE}FCFA`,
    )
  })

  it('groupe les grands montants par milliers', () => {
    expect(formaterMontant({ unitesMineures: 1_234_567_890, devise: 'XOF' })).toBe(
      `1${FINE}234${FINE}567${FINE}890${INSECABLE}FCFA`,
    )
  })

  it('n’ajoute pas de séparateur sous mille et affiche zéro sans signe', () => {
    expect(formaterMontant({ unitesMineures: 950, devise: 'XOF' })).toBe(`950${INSECABLE}FCFA`)
    expect(formaterMontant({ unitesMineures: 0, devise: 'XOF' })).toBe(`0${INSECABLE}FCFA`)
    expect(formaterMontant({ unitesMineures: -0, devise: 'XOF' })).toBe(`0${INSECABLE}FCFA`)
  })

  it('affiche deux décimales avec une virgule pour les devises qui ont des centimes', () => {
    expect(formaterMontant({ unitesMineures: 1_250_075, devise: 'NGN' })).toBe(
      `12${FINE}500,75${INSECABLE}₦`,
    )
    expect(formaterMontant({ unitesMineures: 5, devise: 'GHS' })).toBe(`0,05${INSECABLE}GH₵`)
    expect(formaterMontant({ unitesMineures: -1999, devise: 'EUR' })).toBe(
      `${MOINS}19,99${INSECABLE}€`,
    )
  })

  it('reste exact au-delà de la précision d’un calcul flottant sur les décimales', () => {
    expect(formaterMontant({ unitesMineures: Number.MAX_SAFE_INTEGER, devise: 'EUR' })).toBe(
      `90${FINE}071${FINE}992${FINE}547${FINE}409,91${INSECABLE}€`,
    )
  })

  it('refuse un montant qui n’est pas un entier sûr', () => {
    expect(() => formaterMontant({ unitesMineures: 12.5, devise: 'XOF' })).toThrow(RangeError)
    expect(() => formaterMontant({ unitesMineures: Number.NaN, devise: 'XOF' })).toThrow(RangeError)
    expect(() =>
      formaterMontant({ unitesMineures: Number.MAX_SAFE_INTEGER + 1, devise: 'XOF' }),
    ).toThrow(RangeError)
  })
})
