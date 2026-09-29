import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { effacerJetonCaisse } from '../src/partage/api/jetonCaisse'
import { reinitialiserSession } from '../src/partage/auth/session'
import '../src/partage/i18n/i18n'
import { serveurMsw } from './serveurMsw'

// jsdom n'implémente pas le défilement, appelé par la restauration de défilement du routeur.
window.scrollTo = () => undefined

beforeAll(() => {
  serveurMsw.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  serveurMsw.resetHandlers()
  // La session vit dans des variables de module : chaque test repart d'une application neuve.
  reinitialiserSession()
  effacerJetonCaisse()
})

afterAll(() => {
  serveurMsw.close()
})
