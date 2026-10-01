import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { DemandeInventaire, EcartInventaire } from '../../partage/api/contrat'
import { BE_KPOTA, EAU, FLAG, STOCK } from './fixtures'

const ECARTS: EcartInventaire[] = [
  {
    produitId: FLAG.produitId,
    nom: 'Flag 65 cl',
    initial: false,
    attendu: 3,
    compte: 1,
    ecart: -2,
  },
  { produitId: EAU.produitId, nom: 'Eau minérale 1,5 L', initial: true, compte: 30 },
]

describe('PageInventaireStock', () => {
  it('compte à l’aveugle, fait justifier les écarts, puis valide', async () => {
    const comptages: DemandeInventaire[] = []
    const inventaires: DemandeInventaire[] = []
    serveurMsw.use(
      http.get(`${API}/etablissements`, () =>
        HttpResponse.json({ elements: [BE_KPOTA], page: 0, taille: 100, total: 1 }),
      ),
      http.get(`${API}/etablissements/:id/stock`, () => HttpResponse.json(STOCK)),
      http.get(`${API}/stock/a-traiter`, () => HttpResponse.json({ nombre: 0 })),
      http.post(`${API}/etablissements/:id/stock/inventaires/ecarts`, async ({ request }) => {
        comptages.push((await request.json()) as DemandeInventaire)
        return HttpResponse.json(ECARTS)
      }),
      http.post(`${API}/etablissements/:id/stock/inventaires`, async ({ request }) => {
        inventaires.push((await request.json()) as DemandeInventaire)
        return HttpResponse.json(STOCK)
      }),
    )
    sessionOuverte({ ...MOI_TANTI, permissions: [...MOI_TANTI.permissions, 'STOCK_AJUSTER'] })
    ouvrir(`/gestion/stock/inventaire?etablissement=${BE_KPOTA.id}`)

    const comptage = await screen.findByRole('list', { name: 'Produits à compter' })
    // À l'aveugle : le stock enregistré n'apparaît pas pendant le comptage.
    expect(comptage).not.toHaveTextContent('Stock faible')
    await userEvent.type(
      within(comptage).getByRole('textbox', { name: 'Compté : Flag 65 cl' }),
      '1',
    )
    await userEvent.type(
      within(comptage).getByRole('textbox', { name: 'Compté : Eau minérale 1,5 L' }),
      '30',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Voir les écarts' }))

    const ecarts = await screen.findByRole('table', { name: 'Écarts de l’inventaire' })
    expect(ecarts).toHaveTextContent('Flag 65 cl31−2')
    expect(ecarts).toHaveTextContent('Premier comptage')
    // Un manque ne s'explique pas par une livraison oubliée : seuls les motifs plausibles sont proposés.
    const motifs = within(ecarts).getByRole('combobox', { name: 'Motif de l’écart : Flag 65 cl' })
    expect(within(motifs).getByRole('option', { name: 'Casse' })).toBeInTheDocument()
    expect(
      within(motifs).getByRole('option', { name: 'Consommé par le personnel' }),
    ).toBeInTheDocument()
    expect(
      within(motifs).queryByRole('option', { name: 'Livraison non saisie' }),
    ).not.toBeInTheDocument()
    const valider = screen.getByRole('button', { name: 'Valider l’inventaire' })
    expect(valider).toBeDisabled()
    await userEvent.selectOptions(
      within(ecarts).getByRole('combobox', { name: 'Motif de l’écart : Flag 65 cl' }),
      'CASSE',
    )
    await userEvent.click(valider)

    expect(
      await screen.findByText('Inventaire enregistré : 1 écart, 1 premier comptage.'),
    ).toBeVisible()
    expect(comptages).toEqual([
      {
        lignes: [
          { produitId: FLAG.produitId, compte: 1 },
          { produitId: EAU.produitId, compte: 30 },
        ],
      },
    ])
    expect(inventaires).toEqual([
      {
        lignes: [
          { produitId: FLAG.produitId, compte: 1, motif: 'CASSE' },
          { produitId: EAU.produitId, compte: 30 },
        ],
      },
    ])
  })
})
