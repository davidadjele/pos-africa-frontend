import { render, screen } from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { Fournisseurs } from './Fournisseurs'
import { creerRouteur } from './routeur'

function ouvrir(chemin: string) {
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }))
  render(<Fournisseurs routeur={routeur} />)
  return routeur
}

describe('routeur', () => {
  it('redirige l’accueil vers la caisse', async () => {
    const routeur = ouvrir('/')

    expect(
      await screen.findByRole('heading', { name: 'Aucun produit à vendre pour l’instant' }),
    ).toBeInTheDocument()
    expect(routeur.state.location.pathname).toBe('/caisse')
  })

  it('ouvre la caisse en plein écran, sous la barre de l’établissement', async () => {
    ouvrir('/caisse')

    expect(await screen.findByRole('banner')).toHaveTextContent('Maquis Chez Tanti')
    expect(screen.getByText('Lomé, Bè Kpota')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('ouvre la gestion avec sa navigation latérale et l’entrée active marquée', async () => {
    ouvrir('/gestion')

    expect(await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(navigation).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Caisse' })).not.toHaveAttribute('aria-current')
  })

  it('ouvre un reçu public avec sa référence', async () => {
    ouvrir('/r/abc')

    expect(await screen.findByText('abc')).toBeInTheDocument()
  })

  it('affiche une page introuvable qui ramène à la caisse', async () => {
    ouvrir('/cuisine/ecran')

    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument()
    expect(screen.getByText(/\/cuisine\/ecran/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revenir à la caisse' })).toHaveAttribute(
      'href',
      '/caisse',
    )
  })

  it('traite une adresse inconnue sous la gestion comme une page introuvable', async () => {
    ouvrir('/gestion/inconnue')

    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument()
    expect(screen.getAllByRole('banner')).toHaveLength(1)
  })
})
