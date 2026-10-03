import { describe, expect, it } from 'vitest'
import { signalEntreprise } from './signaux'

const MAINTENANT = new Date('2026-10-03T12:00:00Z')

describe('signalEntreprise', () => {
  it('signale une entreprise active sans vente depuis plus de 7 jours', () => {
    expect(
      signalEntreprise(
        {
          statut: 'ACTIVE',
          creeLe: '2026-09-01T10:00:00Z',
          derniereVenteLe: '2026-09-25T20:00:00Z',
        },
        MAINTENANT,
      ),
    ).toBe('SANS_VENTE')
  })

  it('signale une entreprise de plus de 7 jours qui n’a jamais vendu', () => {
    expect(signalEntreprise({ statut: 'ACTIVE', creeLe: '2026-09-20T10:00:00Z' }, MAINTENANT)).toBe(
      'SANS_VENTE',
    )
  })

  it('présente comme nouvelle une entreprise créée il y a moins de 7 jours', () => {
    expect(signalEntreprise({ statut: 'ACTIVE', creeLe: '2026-10-01T10:00:00Z' }, MAINTENANT)).toBe(
      'NOUVELLE',
    )
  })

  it('ne dit rien d’une entreprise qui vend, ni d’une entreprise suspendue', () => {
    expect(
      signalEntreprise(
        {
          statut: 'ACTIVE',
          creeLe: '2026-09-01T10:00:00Z',
          derniereVenteLe: '2026-10-02T21:00:00Z',
        },
        MAINTENANT,
      ),
    ).toBeNull()
    expect(
      signalEntreprise({ statut: 'SUSPENDUE', creeLe: '2026-09-01T10:00:00Z' }, MAINTENANT),
    ).toBeNull()
  })
})
