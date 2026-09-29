import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Bouton } from './Bouton'
import { EtatVide } from './EtatVide'

describe('EtatVide', () => {
  it('nomme ce qui manque et explique l’étape suivante', () => {
    render(
      <EtatVide
        titre="Aucun produit"
        phrase="Ajoutez votre premier produit pour commencer à vendre."
      />,
    )

    expect(screen.getByRole('heading', { name: 'Aucun produit' })).toBeInTheDocument()
    expect(screen.getByText('Ajoutez votre premier produit pour commencer à vendre.')).toHaveClass(
      'text-attenue',
    )
  })

  it('offre l’unique action qui permet d’en sortir', () => {
    render(
      <EtatVide
        titre="Aucun produit"
        phrase="Ajoutez votre premier produit pour commencer à vendre."
        action={<Bouton variante="principal">Ajouter un produit</Bouton>}
      />,
    )

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Ajouter un produit' })).toBeInTheDocument()
  })

  it('respecte le niveau de titre de la page qui l’accueille', () => {
    render(<EtatVide niveauTitre={1} titre="Page introuvable" phrase="Vérifiez le lien." />)

    expect(screen.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeInTheDocument()
  })
})
