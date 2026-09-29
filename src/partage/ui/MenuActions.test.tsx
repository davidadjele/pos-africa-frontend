import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KeyRound, UserX } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { MenuActions } from './MenuActions'

function ouvrirMenu(surPin = vi.fn(), surDesactiver = vi.fn()) {
  render(
    <>
      <MenuActions
        libelle="Plus d’actions pour Kossi Agbeko"
        actions={[
          { libelle: 'Réinitialiser le PIN', icone: KeyRound, surChoisir: surPin },
          { libelle: 'Désactiver', icone: UserX, ton: 'danger', surChoisir: surDesactiver },
        ]}
      />
      <button type="button">Ailleurs</button>
    </>,
  )
  return { surPin, surDesactiver }
}

describe('MenuActions', () => {
  it('ouvre un menu dont la première action reçoit le focus', async () => {
    ouvrirMenu()
    const bouton = screen.getByRole('button', { name: 'Plus d’actions pour Kossi Agbeko' })
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.click(bouton)

    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Plus d’actions pour Kossi Agbeko' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Réinitialiser le PIN' })).toHaveFocus()
  })

  it('se parcourt aux flèches et se ferme sur Échap en rendant le focus au bouton', async () => {
    ouvrirMenu()
    const bouton = screen.getByRole('button', { name: 'Plus d’actions pour Kossi Agbeko' })
    await userEvent.click(bouton)

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Désactiver' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Réinitialiser le PIN' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(bouton).toHaveFocus()
  })

  it('lance l’action choisie puis se ferme', async () => {
    const { surDesactiver } = ouvrirMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour Kossi Agbeko' }))

    await userEvent.click(screen.getByRole('menuitem', { name: 'Désactiver' }))

    expect(surDesactiver).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('se ferme sur un clic à l’extérieur', async () => {
    ouvrirMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour Kossi Agbeko' }))

    await userEvent.click(screen.getByRole('button', { name: 'Ailleurs' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
