import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Banknote } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Bouton } from './Bouton'

describe('Bouton', () => {
  it('est un vrai bouton qui ne soumet pas de formulaire par défaut', () => {
    render(<Bouton>Changer de table</Bouton>)

    const bouton = screen.getByRole('button', { name: 'Changer de table' })
    expect(bouton.tagName).toBe('BUTTON')
    expect(bouton).toHaveAttribute('type', 'button')
  })

  it('déclenche l’action au clic', async () => {
    const encaisser = vi.fn()
    render(
      <Bouton variante="principal" onClick={encaisser}>
        Encaisser
      </Bouton>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Encaisser' }))

    expect(encaisser).toHaveBeenCalledOnce()
  })

  it('peint l’action principale avec l’accent et son texte contrasté', () => {
    render(<Bouton variante="principal">Encaisser</Bouton>)

    const bouton = screen.getByRole('button', { name: 'Encaisser' })
    expect(bouton).toHaveClass('bg-accent', 'text-accent-texte', 'min-h-cible-caisse')
  })

  it('dessine le secondaire en surface avec un contour de contrôle', () => {
    render(<Bouton>Diviser</Bouton>)

    expect(screen.getByRole('button', { name: 'Diviser' })).toHaveClass(
      'bg-surface',
      'border-bordure-controle',
      'text-encre',
      'min-h-cible-min',
    )
  })

  it('signale le danger par le contour et le texte, jamais par un fond plein', () => {
    render(<Bouton variante="danger">Annuler la ligne</Bouton>)

    const bouton = screen.getByRole('button', { name: 'Annuler la ligne' })
    expect(bouton).toHaveClass('bg-surface', 'border-danger', 'text-danger')
    expect(bouton).not.toHaveClass('bg-danger')
  })

  it('désactivé, n’agit plus et prend l’apparence éteinte quelle que soit sa variante', async () => {
    const envoyer = vi.fn()
    render(
      <Bouton variante="principal" disabled onClick={envoyer}>
        Tout est envoyé
      </Bouton>,
    )

    const bouton = screen.getByRole('button', { name: 'Tout est envoyé' })
    await userEvent.click(bouton)

    expect(bouton).toBeDisabled()
    expect(envoyer).not.toHaveBeenCalled()
    expect(bouton).toHaveClass('bg-fond', 'text-attenue', 'border-trait')
    expect(bouton).not.toHaveClass('bg-accent')
  })

  it('accompagne le libellé d’une icône décorative, sans changer son nom accessible', () => {
    render(
      <Bouton variante="principal" icone={Banknote}>
        Encaisser
      </Bouton>,
    )

    const bouton = screen.getByRole('button', { name: 'Encaisser' })
    const icone = bouton.querySelector('svg')
    expect(icone).not.toBeNull()
    expect(icone).toHaveAttribute('aria-hidden', 'true')
  })
  it('en cours, reste à sa couleur mais n’agit plus et l’annonce', async () => {
    const connecter = vi.fn()
    render(
      <Bouton variante="principal" type="submit" enCours onClick={connecter}>
        Se connecter
      </Bouton>,
    )

    const bouton = screen.getByRole('button', { name: 'Se connecter' })
    await userEvent.click(bouton)

    expect(connecter).not.toHaveBeenCalled()
    expect(bouton).toBeDisabled()
    expect(bouton).toHaveAttribute('aria-busy', 'true')
    expect(bouton).toHaveClass('bg-accent')
  })

  it('confirme une action destructrice en danger plein, jamais en navy', () => {
    render(<Bouton variante="confirmationDanger">Suspendre l’entreprise</Bouton>)

    const bouton = screen.getByRole('button', { name: 'Suspendre l’entreprise' })
    expect(bouton).toHaveClass('bg-danger', 'text-surface')
    expect(bouton).not.toHaveClass('bg-accent')
  })
})
