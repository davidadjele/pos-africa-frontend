import { vi } from 'vitest'

/** Le navigateur simulé : l'API Fullscreen standard, présente ou non, qui peut refuser. */
export function simulerPleinEcran({ disponible = true, refuse = false } = {}) {
  let element: Element | null = null
  const changer = (suivant: Element | null) => {
    element = suivant
    document.dispatchEvent(new Event('fullscreenchange'))
  }
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: disponible })
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element })
  const demander = vi.fn(() => {
    if (refuse) return Promise.reject(new TypeError('Permissions check failed'))
    changer(document.documentElement)
    return Promise.resolve()
  })
  const quitter = vi.fn(() => {
    changer(null)
    return Promise.resolve()
  })
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: demander,
  })
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: quitter })
  return {
    demander,
    quitter,
    sortirParEchap: () => {
      changer(null)
    },
  }
}

/** Rend au document de test son état d'origine : jsdom n'a pas d'API Fullscreen. */
export function oublierPleinEcran() {
  for (const cle of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen'] as const) {
    Reflect.deleteProperty(document, cle)
  }
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen')
}
