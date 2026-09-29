import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVerrouillageInactivite } from './useVerrouillageInactivite'

describe('useVerrouillageInactivite', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('verrouille après le délai sans activité', () => {
    const verrouiller = vi.fn()
    renderHook(() => {
      useVerrouillageInactivite(3, verrouiller)
    })

    act(() => {
      vi.advanceTimersByTime(3 * 60_000 - 1)
    })
    expect(verrouiller).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(verrouiller).toHaveBeenCalledOnce()
  })

  it('repart de zéro à chaque toucher', () => {
    const verrouiller = vi.fn()
    renderHook(() => {
      useVerrouillageInactivite(1, verrouiller)
    })

    act(() => {
      vi.advanceTimersByTime(50_000)
      window.dispatchEvent(new Event('pointerdown'))
      vi.advanceTimersByTime(50_000)
    })

    expect(verrouiller).not.toHaveBeenCalled()
  })
})
