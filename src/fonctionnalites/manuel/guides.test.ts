import { describe, expect, it } from 'vitest'
import { chercherGuides, guideDe, GUIDES, trouverGuide } from './guides'

/** Les captures présentes : `npm run manuel:captures` les régénère depuis le parcours réel. */
const FICHIERS = Object.keys(import.meta.glob('../../../public/manuel/**/*.jpg')).map((chemin) =>
  chemin.replace('../../../public/manuel/', '').replace(/\.jpg$/, ''),
)

const capturesCitees = GUIDES.flatMap((guide) =>
  guide.etapes.flatMap((etape) => (etape.capture === undefined ? [] : [etape.capture.fichier])),
)

describe('guides du manuel', () => {
  it('a des identifiants uniques et des guides suivants qui existent', () => {
    const ids = GUIDES.map((guide) => guide.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const guide of GUIDES) {
      if (guide.suivant !== undefined) expect(ids).toContain(guide.suivant)
    }
  })

  it('a une capture pour chaque image citée, et aucune capture oubliée', () => {
    expect(FICHIERS.length).toBeGreaterThan(0)
    for (const fichier of capturesCitees) expect(FICHIERS).toContain(fichier)
    for (const fichier of FICHIERS) expect(capturesCitees).toContain(fichier)
  })

  it('donne une légende à chaque capture, lue par les lecteurs d’écran', () => {
    for (const guide of GUIDES) {
      for (const etape of guide.etapes) {
        if (etape.capture !== undefined) expect(etape.capture.legende.trim()).not.toBe('')
      }
    }
  })

  it('relie chaque écran à son guide, fiches et sous-pages comprises', () => {
    expect(guideDe('/caisse')).toBe('prendre-une-commande')
    expect(guideDe('/caisse/notes/7a00')).toBe('prendre-une-commande')
    expect(guideDe('/caisse/notes/7a00/encaisser')).toBe('encaisser')
    expect(guideDe('/cuisine')).toBe('ecran-cuisine')
    expect(guideDe('/gestion/produits/7a00')).toBe(guideDe('/gestion/produits'))
    expect(trouverGuide(guideDe('/gestion/ventes'))).toBeDefined()
  })

  it('cherche dans les titres et les étapes, sans tenir compte des accents ni de la casse', () => {
    expect(chercherGuides('especes').map((guide) => guide.id)).toContain('encaisser')
    expect(chercherGuides('  CUISINE ').map((guide) => guide.id)).toContain('ecran-cuisine')
    expect(chercherGuides('xyz introuvable')).toEqual([])
    expect(chercherGuides('')).toEqual(GUIDES)
  })
})
