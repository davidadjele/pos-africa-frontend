import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarreHaute } from './BarreHaute'

describe('BarreHaute', () => {
  it('présente la marque, l’établissement et son quartier', () => {
    render(<BarreHaute contexte={{ titre: 'Maquis Chez Tanti', detail: 'Lomé, Bè Kpota' }} />)

    const barre = screen.getByRole('banner')
    expect(barre).toHaveTextContent('TONTI')
    expect(screen.getByText('Maquis Chez Tanti')).toBeInTheDocument()
    expect(screen.getByText('Lomé, Bè Kpota')).toBeInTheDocument()
    expect(barre.textContent).not.toContain('·')
  })

  it('peut ne porter qu’un titre, sans détail', () => {
    render(<BarreHaute contexte={{ titre: 'Administration de la plateforme' }} />)

    expect(screen.getByRole('banner')).toHaveTextContent(/^TONTIAdministration de la plateforme$/)
  })

  it('se contente de la marque quand aucun établissement n’est connu', () => {
    render(<BarreHaute />)

    expect(screen.getByRole('banner')).toHaveTextContent(/^TONTI$/)
  })

  it('place les éléments fournis à droite, dans la zone qui colore le focus pour le fond navy', () => {
    render(
      <BarreHaute contexte={{ titre: 'Maquis Chez Tanti', detail: 'Lomé, Bè Kpota' }}>
        <a href="/gestion">Gestion</a>
      </BarreHaute>,
    )

    const barre = screen.getByRole('banner')
    expect(barre).toHaveAttribute('data-zone', 'barre')
    expect(barre).toHaveClass('bg-barre-fond', 'text-barre-texte', 'h-barre-hauteur')
    expect(screen.getByRole('link', { name: 'Gestion' })).toBeInTheDocument()
  })
})
