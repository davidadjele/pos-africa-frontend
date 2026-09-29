import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialogue } from './Dialogue'

function Exemple({ confirmer = vi.fn() }: { confirmer?: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOuvert(true)
        }}
      >
        Suspendre
      </button>
      {ouvert && (
        <Dialogue
          titre="Suspendre Maquis Chez Tanti ?"
          consequence="Plus personne ne pourra s’y connecter."
          libelleAnnuler="Garder l’entreprise active"
          libelleConfirmer="Suspendre l’entreprise"
          tonConfirmation="danger"
          surAnnuler={() => {
            setOuvert(false)
          }}
          surConfirmer={confirmer}
        />
      )}
    </>
  )
}

describe('Dialogue', () => {
  it('pose la question et sa conséquence dans une fenêtre modale nommée', async () => {
    render(<Exemple />)
    await userEvent.click(screen.getByRole('button', { name: 'Suspendre' }))

    const dialogue = screen.getByRole('dialog', { name: 'Suspendre Maquis Chez Tanti ?' })
    expect(dialogue).toHaveAttribute('aria-modal', 'true')
    expect(dialogue).toHaveAccessibleDescription('Plus personne ne pourra s’y connecter.')
  })

  it('met le focus sur l’action sûre, et peint l’action destructrice en danger plein', async () => {
    render(<Exemple />)
    await userEvent.click(screen.getByRole('button', { name: 'Suspendre' }))

    expect(screen.getByRole('button', { name: 'Garder l’entreprise active' })).toHaveFocus()
    const confirmer = screen.getByRole('button', { name: 'Suspendre l’entreprise' })
    expect(confirmer).toHaveClass('bg-danger')
    expect(confirmer).not.toHaveClass('bg-accent')
  })

  it('confirme par le bouton explicite', async () => {
    const confirmer = vi.fn()
    render(<Exemple confirmer={confirmer} />)
    await userEvent.click(screen.getByRole('button', { name: 'Suspendre' }))

    await userEvent.click(screen.getByRole('button', { name: 'Suspendre l’entreprise' }))

    expect(confirmer).toHaveBeenCalledOnce()
  })

  it('se ferme sans agir avec Échap et rend le focus à l’élément d’origine', async () => {
    const confirmer = vi.fn()
    render(<Exemple confirmer={confirmer} />)
    const origine = screen.getByRole('button', { name: 'Suspendre' })
    await userEvent.click(origine)

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmer).not.toHaveBeenCalled()
    expect(origine).toHaveFocus()
  })

  it('garde le focus dans le dialogue', async () => {
    render(<Exemple />)
    await userEvent.click(screen.getByRole('button', { name: 'Suspendre' }))

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Suspendre l’entreprise' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Garder l’entreprise active' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Suspendre l’entreprise' })).toHaveFocus()
  })

  it('empêche une double confirmation pendant l’action', () => {
    render(
      <Dialogue
        titre="Réactiver Maquis Chez Tanti ?"
        consequence="Ses utilisateurs pourront de nouveau se connecter."
        libelleAnnuler="Annuler"
        libelleConfirmer="Réactiver l’entreprise"
        enCours
        surAnnuler={vi.fn()}
        surConfirmer={vi.fn()}
      >
        <p>Erreur éventuelle</p>
      </Dialogue>,
    )

    expect(screen.getByRole('button', { name: 'Réactiver l’entreprise' })).toBeDisabled()
    expect(screen.getByText('Erreur éventuelle')).toBeInTheDocument()
  })

  it('sans action d’annulation, n’offre qu’un bouton et ne se ferme pas sur Échap', async () => {
    const noter = vi.fn()
    render(
      <Dialogue
        titre="Nouveau PIN de Kossi Agbeko"
        consequence="Ce PIN temporaire ne sera plus affiché."
        libelleConfirmer="J’ai noté le PIN"
        surConfirmer={noter}
      >
        <p>730 264</p>
      </Dialogue>,
    )

    const seulBouton = screen.getByRole('button')
    expect(seulBouton).toHaveAccessibleName('J’ai noté le PIN')
    expect(seulBouton).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(noter).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(seulBouton)
    expect(noter).toHaveBeenCalledOnce()
  })
})
