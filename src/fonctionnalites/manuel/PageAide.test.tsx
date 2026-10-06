import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ouvrir, sessionAbsente } from '../../../tests/application'

describe('Aide', () => {
  it('s’ouvre sans session, par rôle, avec le premier jour dans l’ordre', async () => {
    sessionAbsente()
    ouvrir('/aide')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Comment pouvons-nous vous aider ?' }),
    ).toBeVisible()
    const caisse = screen.getByRole('region', { name: 'Je suis en caisse' })
    expect(within(caisse).getByRole('link', { name: 'Encaisser une note' })).toHaveAttribute(
      'href',
      '/aide/encaisser',
    )
    const premierJour = screen.getByRole('region', { name: 'Premier jour : prêt à vendre' })
    expect(within(premierJour).getAllByRole('listitem')[0]).toHaveTextContent('Vos établissements')
    expect(
      within(premierJour).getByRole('link', { name: '1. Vos établissements' }),
    ).toHaveAttribute('href', '/aide/premier-jour#etape-1')
  })

  it('cherche un geste et dit quand rien ne correspond', async () => {
    sessionAbsente()
    ouvrir('/aide')
    const recherche = await screen.findByRole('searchbox', { name: 'Rechercher dans l’aide' })

    await userEvent.type(recherche, 'espèces')
    const resultats = screen.getByRole('region', { name: 'Résultats' })
    expect(within(resultats).getByRole('link', { name: /Encaisser une note/ })).toBeVisible()
    expect(within(resultats).queryByRole('link', { name: /écran cuisine/ })).toBeNull()

    await userEvent.clear(recherche)
    await userEvent.type(recherche, 'xyz')
    expect(screen.getByText('Aucun guide ne correspond à « xyz ».')).toBeVisible()
  })

  it('montre un guide : exemple, étapes numérotées avec leur capture, guide suivant', async () => {
    sessionAbsente()
    ouvrir('/aide/encaisser')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Encaisser une note' }),
    ).toBeVisible()
    expect(screen.getByRole('region', { name: 'Exemple' })).toHaveTextContent('4 500 F CFA')
    const etapes = screen.getByRole('list', { name: 'Étapes' })
    expect(within(etapes).getAllByRole('listitem').length).toBeGreaterThan(2)
    const capture = within(etapes).getAllByRole('img')[0]
    expect(capture).toHaveAttribute('src', expect.stringMatching(/^\/manuel\/encaisser\/.+\.jpg$/))
    expect(capture).toHaveAccessibleName()
    // Le libellé du bouton à toucher ressort en gras.
    expect(within(etapes).getAllByText('Encaisser', { selector: 'strong' }).length).toBeGreaterThan(
      0,
    )
    const guides = screen.getByRole('navigation', { name: 'Guides' })
    expect(within(guides).getByRole('link', { name: 'Encaisser une note' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('dit qu’un guide n’existe pas, et ramène à l’accueil de l’aide', async () => {
    sessionAbsente()
    ouvrir('/aide/inconnu')

    expect(await screen.findByRole('heading', { name: 'Ce guide n’existe pas' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Accueil de l’aide' })).toHaveAttribute('href', '/aide')
  })
})
