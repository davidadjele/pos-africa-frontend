import { describe, expect, it } from 'vitest'
import type { Permission } from '../../partage/auth/useSession'
import { SECTIONS, ongletsVisibles, sectionDe, sectionsVisibles } from './navigationGestion'

const tout = () => true
const seulement =
  (...permissions: Permission[]) =>
  (permission: Permission) =>
    permissions.includes(permission)

describe('navigation de la gestion', () => {
  it('tient en sept entrées', () => {
    expect(SECTIONS.map((section) => section.cle)).toEqual([
      'tableauDeBord',
      'caisse',
      'ventes',
      'carte',
      'stock',
      'activite',
      'reglages',
    ])
  })

  it('retrouve la section d’une page, fiches et sous-pages comprises', () => {
    expect(sectionDe('/gestion')?.cle).toBe('tableauDeBord')
    expect(sectionDe('/gestion/produits/7a00')?.cle).toBe('carte')
    expect(sectionDe('/gestion/taxes')?.cle).toBe('carte')
    expect(sectionDe('/gestion/caisses/c0de')?.cle).toBe('ventes')
    expect(sectionDe('/gestion/ardoises/42')?.cle).toBe('ventes')
    expect(sectionDe('/gestion/stock/reception')?.cle).toBe('stock')
    expect(sectionDe('/gestion/salles')?.cle).toBe('reglages')
  })

  it('n’affiche que les onglets permis, et mène la section à son premier onglet visible', () => {
    const ventes = SECTIONS.find((section) => section.cle === 'ventes')
    if (ventes === undefined) throw new Error('section ventes')
    expect(
      ongletsVisibles(ventes, seulement('CLIENT_CREDIT')).map((onglet) => onglet.vers),
    ).toEqual(['/gestion/ardoises'])
    expect(
      sectionsVisibles(seulement('CLIENT_CREDIT')).find((section) => section.cle === 'ventes')
        ?.vers,
    ).toBe('/gestion/ardoises')
  })

  it('masque une section dont aucun onglet n’est permis', () => {
    const cles = sectionsVisibles(seulement()).map((section) => section.cle)
    expect(cles).not.toContain('reglages')
    expect(cles).not.toContain('ventes')
    expect(cles).toContain('carte')
    expect(sectionsVisibles(tout)).toHaveLength(7)
  })
})
