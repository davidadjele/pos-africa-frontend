import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { describe, expect, it, vi } from 'vitest'
import { BandeauMiseAJour } from './BandeauMiseAJour'

function simulerServiceWorker(nouvelleVersion: boolean) {
  const mettreAJour = vi.fn(() => Promise.resolve())
  vi.mocked(useRegisterSW).mockReturnValue({
    needRefresh: [nouvelleVersion, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mettreAJour,
  })
  return mettreAJour
}

describe('BandeauMiseAJour', () => {
  it('ne montre rien tant qu’aucune nouvelle version n’attend', () => {
    simulerServiceWorker(false)
    const { container } = render(<BandeauMiseAJour />)

    expect(container).toBeEmptyDOMElement()
  })

  it('propose de recharger quand une nouvelle version est prête, sans l’imposer', async () => {
    const mettreAJour = simulerServiceWorker(true)
    render(<BandeauMiseAJour />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Une nouvelle version de Tonti est disponible.',
    )
    expect(mettreAJour).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Recharger' }))

    expect(mettreAJour).toHaveBeenCalledWith(true)
  })
})
