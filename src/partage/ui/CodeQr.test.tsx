import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CodeQr } from './CodeQr'

describe('CodeQr', () => {
  it('dessine le code d’un texte, à la taille demandée', () => {
    render(
      <CodeQr
        texte="https://tonti.africa/r/k3F9qL2m"
        libelle="QR code du reçu en ligne"
        taille={96}
      />,
    )

    const code = screen.getByRole('img', { name: 'QR code du reçu en ligne' })
    expect(code).toHaveAttribute('width', '96')
    expect(code.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/)
  })

  it('change de dessin quand le texte change', () => {
    const { rerender } = render(<CodeQr texte="https://tonti.africa/r/a" libelle="QR" />)
    const avant = screen.getByRole('img').querySelector('path')?.getAttribute('d')

    rerender(<CodeQr texte="https://tonti.africa/r/b" libelle="QR" />)

    expect(screen.getByRole('img').querySelector('path')?.getAttribute('d')).not.toBe(avant)
  })
})
