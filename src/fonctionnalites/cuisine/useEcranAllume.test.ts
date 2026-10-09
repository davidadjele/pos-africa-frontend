import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEcranAllume } from './useEcranAllume'

/** Le navigateur simulé : l'API Wake Lock, qui peut manquer (vieux navigateur) ou refuser (batterie faible). */
function simulerWakeLock({ refuse = false } = {}) {
  const liberer = vi.fn(() => Promise.resolve())
  const demander = vi.fn(() =>
    refuse
      ? Promise.reject(new DOMException('Not allowed', 'NotAllowedError'))
      : Promise.resolve({ release: liberer }),
  )
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: demander } })
  return { demander, liberer }
}

function rendreVisible(etat: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: etat })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock')
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('écran allumé', () => {
  it('demande au navigateur de garder l’écran allumé, et le rend en quittant l’écran', async () => {
    const { demander, liberer } = simulerWakeLock()
    const { unmount } = renderHook(() => {
      useEcranAllume()
    })

    await waitFor(() => {
      expect(demander).toHaveBeenCalledWith('screen')
    })
    unmount()
    await waitFor(() => {
      expect(liberer).toHaveBeenCalledOnce()
    })
  })

  it('redemande le verrou quand la tablette revient au premier plan', async () => {
    const { demander } = simulerWakeLock()
    renderHook(() => {
      useEcranAllume()
    })
    await waitFor(() => {
      expect(demander).toHaveBeenCalledOnce()
    })

    // Le système libère le verrou quand la page passe en arrière-plan ; au retour, il faut le redemander.
    act(() => {
      rendreVisible('hidden')
    })
    act(() => {
      rendreVisible('visible')
    })

    await waitFor(() => {
      expect(demander).toHaveBeenCalledTimes(2)
    })
  })

  it('ne fait rien, sans erreur, si le navigateur ne le propose pas ou refuse', async () => {
    expect(() =>
      renderHook(() => {
        useEcranAllume()
      }),
    ).not.toThrow()

    const { demander } = simulerWakeLock({ refuse: true })
    const { unmount } = renderHook(() => {
      useEcranAllume()
    })
    await waitFor(() => {
      expect(demander).toHaveBeenCalledOnce()
    })
    expect(() => {
      unmount()
    }).not.toThrow()
  })
})
