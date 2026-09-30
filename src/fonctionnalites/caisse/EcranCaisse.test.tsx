import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, CAISSE_BAR, ouvrir, tablette } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { LigneCarteEtablissement } from '../../partage/api/contrat'
import { definirJetonCaisse } from '../../partage/api/jetonCaisse'

const BIERES = {
  id: 'ca000000-0000-4000-8000-000000000002',
  nom: 'Bières',
  couleur: 'FEUILLE',
  ordre: 1,
} as const
const GRILLADES = {
  id: 'ca000000-0000-4000-8000-000000000001',
  nom: 'Grillades',
  couleur: 'OCRE',
  ordre: 2,
} as const

const FLAG: LigneCarteEtablissement = {
  produitId: 'b0000000-0000-4000-8000-000000000002',
  nom: 'Flag 65 cl',
  type: 'BOISSON',
  categorie: BIERES,
  prixBase: 1000,
  prix: 1200,
  prixPropre: true,
  nomTaxe: 'TVA',
  tauxTaxePointsDeBase: 1800,
  propose: true,
  epuise: false,
}
const POULET: LigneCarteEtablissement = {
  ...FLAG,
  produitId: 'b0000000-0000-4000-8000-000000000001',
  nom: 'Poulet braisé',
  type: 'PLAT',
  categorie: GRILLADES,
  prixBase: 4500,
  prix: 4500,
  prixPropre: false,
  epuise: true,
}

function caisseOuverte(carte: LigneCarteEtablissement[]) {
  tablette(CAISSE_BAR)
  serveurMsw.use(
    http.get(`${API}/caisse/moi`, () =>
      HttpResponse.json({
        utilisateurId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0201',
        prenom: 'Kossi',
        nomCourt: 'Kossi A.',
        role: 'SERVEUR',
        permissions: ['COMMANDE_CREER'],
      }),
    ),
    http.get(`${API}/caisse/carte`, () => HttpResponse.json(carte)),
  )
  definirJetonCaisse('eyJ.caisse')
  ouvrir('/caisse')
}

describe('EcranCaisse', () => {
  it('présente la carte de l’établissement par catégorie, au prix d’ici', async () => {
    caisseOuverte([FLAG, POULET])

    const produits = await screen.findByRole('list', { name: 'Produits' })
    expect(within(produits).getByRole('listitem', { name: /Flag 65 cl/ })).toHaveTextContent(
      '1 200',
    )
    const poulet = within(produits).getByRole('listitem', { name: /Poulet braisé/ })
    expect(poulet).toHaveTextContent('Épuisé ce jour')

    const rail = screen.getByRole('navigation', { name: 'Catégories' })
    expect(
      within(rail)
        .getAllByRole('button')
        .map((bouton) => bouton.textContent),
    ).toEqual(['Tout2', 'Bières1', 'Grillades1'])
    await userEvent.click(within(rail).getByRole('button', { name: /Grillades/ }))
    expect(within(produits).queryByText('Flag 65 cl')).not.toBeInTheDocument()
  })

  it('cherche un produit par son nom', async () => {
    caisseOuverte([FLAG, POULET])

    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Rechercher un produit' }),
      'poulet',
    )

    const produits = screen.getByRole('list', { name: 'Produits' })
    expect(within(produits).getAllByRole('listitem')).toHaveLength(1)
  })

  it('dit quand la carte de l’établissement est vide', async () => {
    caisseOuverte([])

    expect(
      await screen.findByRole('heading', { name: 'Aucun produit à vendre pour l’instant' }),
    ).toBeVisible()
  })
})
