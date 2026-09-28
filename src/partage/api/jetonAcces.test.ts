import { afterEach, describe, expect, it } from 'vitest'
import { definirJetonAcces, effacerJetonAcces, lireJetonAcces } from './jetonAcces'

describe('jetonAcces', () => {
  afterEach(() => {
    effacerJetonAcces()
  })

  it('n’a aucun jeton au démarrage', () => {
    expect(lireJetonAcces()).toBeNull()
  })

  it('garde le jeton défini et l’oublie une fois effacé', () => {
    definirJetonAcces('eyJ.jeton.court')
    expect(lireJetonAcces()).toBe('eyJ.jeton.court')

    effacerJetonAcces()
    expect(lireJetonAcces()).toBeNull()
  })

  it('ne l’écrit jamais dans le stockage du navigateur', () => {
    definirJetonAcces('eyJ.jeton.court')

    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
