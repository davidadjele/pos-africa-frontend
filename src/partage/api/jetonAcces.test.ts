import { afterEach, describe, expect, it, vi } from 'vitest'
import { abonnerJeton, definirJetonAcces, effacerJetonAcces, lireJetonAcces } from './jetonAcces'

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

  it('prévient les abonnés quand le jeton change, et plus après le désabonnement', () => {
    const ecouteur = vi.fn()
    const desabonner = abonnerJeton(ecouteur)

    definirJetonAcces('eyJ.jeton.court')
    effacerJetonAcces()
    expect(ecouteur).toHaveBeenCalledTimes(2)

    desabonner()
    definirJetonAcces('eyJ.autre')
    expect(ecouteur).toHaveBeenCalledTimes(2)
  })

  it('ne prévient personne quand le jeton ne change pas', () => {
    const ecouteur = vi.fn()
    abonnerJeton(ecouteur)

    effacerJetonAcces()

    expect(ecouteur).not.toHaveBeenCalled()
  })
})
