import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CodeSecret } from './CodeSecret'

describe('CodeSecret', () => {
  it('groupe un PIN par trois chiffres, sans espace réel dans le texte copié', () => {
    render(<CodeSecret libelle="PIN de caisse temporaire" code="482915" />)

    const code = screen.getByText('482', { exact: false }).closest('[data-code]')
    expect(code).toHaveTextContent(/^482915$/)
    expect(screen.getByText('482')).toBeVisible()
    expect(screen.getByText('915')).toBeVisible()
    expect(screen.getByText('PIN de caisse temporaire')).toBeVisible()
  })

  it('groupe un mot de passe par quatre signes, en chiffres tabulaires', () => {
    render(<CodeSecret libelle="Mot de passe temporaire" code="kp7mzr4qtx9w" />)

    expect(screen.getByText('zr4q')).toHaveClass('chiffres')
  })

  it('copie le code exact, sans les espaces de l’affichage, et le confirme', async () => {
    const utilisateur = userEvent.setup()
    render(<CodeSecret libelle="Mot de passe temporaire" code="kp7mzr4qtx9w" />)

    const bouton = screen.getByRole('button', { name: 'Copier' })
    expect(bouton).toHaveAccessibleDescription('Mot de passe temporaire')
    await utilisateur.click(bouton)

    expect(await navigator.clipboard.readText()).toBe('kp7mzr4qtx9w')
    expect(bouton).toHaveAccessibleName('Copié')
  })
})
