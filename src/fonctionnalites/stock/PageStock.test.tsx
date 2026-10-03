import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { DemandePerteStock, DemandeSeuilStock } from '../../partage/api/contrat'
import { BE_KPOTA, FLAG, STOCK } from './fixtures'

const GERANTE = [...MOI_TANTI.permissions, 'STOCK_RECEPTIONNER', 'STOCK_AJUSTER']

function stockServi() {
  const pertes: DemandePerteStock[] = []
  const seuils: DemandeSeuilStock[] = []
  serveurMsw.use(
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: [BE_KPOTA], page: 0, taille: 100, total: 1 }),
    ),
    http.get(`${API}/etablissements/:id/stock`, () => HttpResponse.json(STOCK)),
    http.get(`${API}/stock/a-traiter`, () => HttpResponse.json({ nombre: 2 })),
    http.post(`${API}/etablissements/:id/stock/pertes`, async ({ request }) => {
      pertes.push((await request.json()) as DemandePerteStock)
      return HttpResponse.json(STOCK)
    }),
    http.put(`${API}/etablissements/:id/stock/:produit/seuil`, async ({ request }) => {
      seuils.push((await request.json()) as DemandeSeuilStock)
      return HttpResponse.json(STOCK)
    }),
    http.get(`${API}/etablissements/:id/stock/:produit/mouvements`, () =>
      HttpResponse.json([FLAG.dernierMouvement]),
    ),
  )
  return { pertes, seuils }
}

async function ouvrirStock(permissions = GERANTE) {
  sessionOuverte({ ...MOI_TANTI, permissions })
  ouvrir('/gestion/stock')
  return screen.findByRole('table', { name: 'Stock de Bè Kpota' })
}

describe('PageStock', () => {
  it('montre le stock, les produits à traiter en tête', async () => {
    stockServi()
    const tableau = await ouvrirStock()

    const lignes = within(tableau).getAllByRole('row').slice(1)
    expect(lignes.map((ligne) => within(ligne).getAllByRole('cell')[0]?.textContent)).toEqual([
      // L'état figure aussi sous le produit, pour le téléphone où sa colonne est masquée.
      'Castel 65 clBièresStock négatif',
      'Flag 65 clBièresStock faible',
      'Eau minérale 1,5 LEauxÀ compter',
      'Youki 35 clSucreriesEn stock',
    ])
    expect(lignes[0]).toHaveTextContent('Stock négatif')
    expect(lignes[0]).toHaveTextContent('−2')
    expect(lignes[1]).toHaveTextContent('Stock faible')
    expect(lignes[1]).toHaveTextContent('Réception, BL 2231')
    expect(lignes[1]).toHaveTextContent(/650\sF/)
    expect(lignes[0]).toHaveTextContent('non renseigné')
    expect(lignes[2]).toHaveTextContent('À compter')
    const politique = screen.getByRole('region', { name: 'Politique de stock' })
    expect(politique).toHaveTextContent('Souple')
    expect(politique).toHaveTextContent('La caisse vend même sans stock')
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(within(menu).getByRole('link', { name: /Stock/ })).toHaveTextContent('2')
  })

  it('déclare une perte', async () => {
    const { pertes } = stockServi()
    await ouvrirStock()

    await userEvent.click(screen.getByRole('button', { name: 'Déclarer une perte' }))
    const dialogue = screen.getByRole('dialog', { name: 'Déclarer une perte' })
    await userEvent.selectOptions(
      within(dialogue).getByRole('combobox', { name: /^Produit/ }),
      FLAG.produitId,
    )
    await userEvent.type(within(dialogue).getByRole('textbox', { name: /^Quantité/ }), '2')
    await userEvent.click(within(dialogue).getByRole('radio', { name: 'Casse' }))
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Retirer 2 du stock' }))

    expect(await screen.findByText('2 Flag 65 cl retirés du stock.')).toBeVisible()
    expect(pertes).toEqual([{ produitId: FLAG.produitId, quantite: 2, motif: 'CASSE' }])
  })

  it('règle le seuil d’alerte et montre l’historique d’un produit', async () => {
    const { seuils } = stockServi()
    await ouvrirStock()

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Régler le seuil d’alerte' }))
    const dialogue = screen.getByRole('dialog', { name: 'Seuil d’alerte de Flag 65 cl' })
    const champ = within(dialogue).getByRole('textbox', { name: /^Seuil/ })
    await userEvent.clear(champ)
    await userEvent.type(champ, '30')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))
    expect(seuils).toEqual([{ seuil: 30 }])

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Historique' }))
    const historique = await screen.findByRole('dialog', { name: 'Historique de Flag 65 cl' })
    expect(await within(historique).findByText(/BL 2231/)).toBeVisible()
    expect(historique).toHaveTextContent('+24')
    expect(historique).toHaveTextContent(/BL 2231, 700\sF l’unité/)
  })

  it('n’offre la réception qu’à qui en a le droit', async () => {
    stockServi()
    await ouvrirStock([...MOI_TANTI.permissions, 'STOCK_RECEPTIONNER'])

    expect(screen.getByRole('link', { name: 'Réceptionner une livraison' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Déclarer une perte' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Faire l’inventaire' })).not.toBeInTheDocument()
  })
})
