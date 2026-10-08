import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  oublierPleinEcran,
  simulerPleinEcran as simulerNavigateur,
} from '../../../tests/pleinEcran'
import { usePleinEcran } from './usePleinEcran'

afterEach(oublierPleinEcran)

describe('plein écran', () => {
  it('est indisponible quand le navigateur ne le propose pas, comme sur iPhone', () => {
    simulerNavigateur({ disponible: false })
    const { result } = renderHook(() => usePleinEcran())
    expect(result.current.disponible).toBe(false)
  })

  it('entre puis sort du plein écran', async () => {
    const { demander, quitter } = simulerNavigateur()
    const { result } = renderHook(() => usePleinEcran())
    expect(result.current).toMatchObject({ disponible: true, actif: false })

    await act(() => result.current.basculer())
    expect(demander).toHaveBeenCalledOnce()
    expect(result.current.actif).toBe(true)

    await act(() => result.current.basculer())
    expect(quitter).toHaveBeenCalledOnce()
    expect(result.current.actif).toBe(false)
  })

  it('suit une sortie par Échap ou par le geste du système', async () => {
    const { sortirParEchap } = simulerNavigateur()
    const { result } = renderHook(() => usePleinEcran())
    await act(() => result.current.basculer())

    act(() => {
      sortirParEchap()
    })
    expect(result.current.actif).toBe(false)
  })

  it('reste hors plein écran, sans erreur, si le navigateur refuse', async () => {
    simulerNavigateur({ refuse: true })
    const { result } = renderHook(() => usePleinEcran())

    await act(() => result.current.basculer())
    expect(result.current.actif).toBe(false)
  })
})
