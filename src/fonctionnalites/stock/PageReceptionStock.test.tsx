import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { DemandeReceptionStock } from '../../partage/api/contrat'
import { BE_KPOTA, CASTEL, FLAG, STOCK } from './fixtures'

describe('PageReceptionStock', () => {
  it('réceptionne plusieurs produits avec le bon de livraison, puis revient au stock', async () => {
    const recues: DemandeReceptionStock[] = []
    serveurMsw.use(
      http.get(`${API}/etablissements`, () =>
        HttpResponse.json({ elements: [BE_KPOTA], page: 0, taille: 100, total: 1 }),
      ),
      http.get(`${API}/etablissements/:id/stock`, () => HttpResponse.json(STOCK)),
      http.get(`${API}/stock/a-traiter`, () => HttpResponse.json({ nombre: 0 })),
      http.post(`${API}/etablissements/:id/stock/receptions`, async ({ request }) => {
        recues.push((await request.json()) as DemandeReceptionStock)
        return HttpResponse.json(STOCK)
      }),
    )
    sessionOuverte({ ...MOI_TANTI, permissions: [...MOI_TANTI.permissions, 'STOCK_RECEPTIONNER'] })
    ouvrir(`/gestion/stock/reception?etablissement=${BE_KPOTA.id}`)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Réceptionner une livraison' }),
    ).toBeVisible()
    const ajout = screen.getByRole('combobox', { name: 'Ajouter un produit' })
    await userEvent.selectOptions(ajout, CASTEL.produitId)
    await userEvent.selectOptions(ajout, FLAG.produitId)
    await userEvent.type(
      screen.getByRole('textbox', { name: /^N° du bon de livraison/ }),
      'BL 2240',
    )
    const lignes = screen.getByRole('list', { name: 'Produits reçus' })
    await userEvent.type(
      within(lignes).getByRole('textbox', { name: 'Quantité de Castel 65 cl' }),
      '48',
    )
    await userEvent.type(
      within(lignes).getByRole('textbox', { name: 'Coût unitaire de Castel 65 cl' }),
      '650',
    )
    await userEvent.type(
      within(lignes).getByRole('textbox', { name: 'Quantité de Flag 65 cl' }),
      '24',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Enregistrer : 2 produits, 72 unités' }),
    )

    expect(await screen.findByText('Réception enregistrée : 2 produits, 72 unités.')).toBeVisible()
    expect(screen.getByRole('table', { name: 'Stock de Bè Kpota' })).toBeVisible()
    expect(recues).toEqual([
      {
        reference: 'BL 2240',
        lignes: [
          { produitId: CASTEL.produitId, quantite: 48, coutUnitaire: 650 },
          { produitId: FLAG.produitId, quantite: 24 },
        ],
      },
    ])
  })
})
