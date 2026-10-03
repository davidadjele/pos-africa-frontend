import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import { BIERES, FLAG, GRILLADES, TVA } from './fixtures'

const PERMISSIONS = [...MOI_TANTI.permissions, 'CATALOGUE_GERER', 'PRIX_MODIFIER'] as const

function backendSimule(reponse: () => Response = () => HttpResponse.json(FLAG)) {
  const envois: { methode: string; corps: unknown }[] = []
  serveurMsw.use(
    http.get(`${API}/categories`, () => HttpResponse.json([GRILLADES, BIERES])),
    http.get(`${API}/taxes`, () => HttpResponse.json([TVA])),
    http.get(`${API}/produits/:id`, () => HttpResponse.json(FLAG)),
    http.get(`${API}/produits`, () =>
      HttpResponse.json({ elements: [FLAG], page: 0, taille: 50, total: 1 }),
    ),
    http.post(`${API}/produits`, async ({ request }) => {
      envois.push({ methode: 'POST', corps: await request.json() })
      return reponse()
    }),
    http.put(`${API}/produits/:id`, async ({ request }) => {
      envois.push({ methode: 'PUT', corps: await request.json() })
      return HttpResponse.json({ ...FLAG, prix: 1100, version: 3 })
    }),
  )
  return envois
}

async function ouvrirFiche(chemin: string, permissions: readonly string[] = PERMISSIONS) {
  sessionOuverte({ ...MOI_TANTI, permissions: [...permissions] })
  const application = ouvrir(chemin)
  await screen.findByLabelText(/^Prix TTC/)
  return application
}

describe('PageFicheProduit', () => {
  it('crée une boisson suivie en stock et calcule la TVA comprise dans le prix', async () => {
    const envois = backendSimule()
    const { routeur } = await ouvrirFiche('/gestion/produits/nouveau')

    await userEvent.type(screen.getByLabelText(/^Nom/), 'Flag 65 cl')
    await userEvent.selectOptions(screen.getByLabelText(/^Catégorie/), 'Bières')
    await userEvent.click(screen.getByRole('radio', { name: 'Boisson' }))
    expect(screen.getByRole('checkbox', { name: /Suivre le stock/ })).toBeChecked()
    await userEvent.type(screen.getByLabelText(/^Prix TTC/), '1 000')
    expect(screen.getByLabelText(/^Taxe/)).toHaveValue(TVA.id)
    expect(screen.getByText('Dont TVA : 153 F par unité.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le produit' }))

    await waitFor(() => {
      expect(envois).toEqual([
        {
          methode: 'POST',
          corps: {
            nom: 'Flag 65 cl',
            categorieId: BIERES.id,
            type: 'BOISSON',
            prix: 1000,
            taxeId: TVA.id,
            suiviStock: true,
          },
        },
      ])
    })
    await waitFor(() => {
      expect(routeur.state.location.pathname).toBe('/gestion/produits')
    })
    expect(await screen.findByText('« Flag 65 cl » est enregistré.')).toBeVisible()
  })

  it('crée un plat avec son coût de revient, et montre la marge par plat', async () => {
    const envois = backendSimule()
    await ouvrirFiche('/gestion/produits/nouveau')

    await userEvent.type(screen.getByLabelText(/^Nom/), 'Poulet braisé')
    await userEvent.selectOptions(screen.getByLabelText(/^Catégorie/), 'Grillades')
    await userEvent.type(screen.getByLabelText(/^Prix TTC/), '4500')
    await userEvent.type(screen.getByLabelText(/^Coût de revient/), '2300')
    // 4 500 TTC à 18 % font 3 814 HT : la TVA revient à l'État.
    expect(
      screen.getByText(/Marge par plat : 1\s514\sF, soit 40 % du prix hors taxe/),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le produit' }))

    await waitFor(() => {
      expect(envois[0]?.corps).toMatchObject({ type: 'PLAT', suiviStock: false, coutRevient: 2300 })
    })
  })

  it('ne demande pas de coût de revient pour une boisson suivie en stock', async () => {
    backendSimule()
    await ouvrirFiche('/gestion/produits/nouveau')

    await userEvent.click(screen.getByRole('radio', { name: 'Boisson' }))

    expect(screen.queryByLabelText(/^Coût de revient/)).not.toBeInTheDocument()
  })

  it('modifie le prix d’un produit en envoyant sa version', async () => {
    const envois = backendSimule()
    await ouvrirFiche(`/gestion/produits/${FLAG.id}`)

    const prix = screen.getByLabelText(/^Prix TTC/)
    // Espace fine insécable, comme dans tout montant affiché.
    expect(prix).toHaveValue('1\u202f000')
    await userEvent.clear(prix)
    await userEvent.type(prix, '1100')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    await waitFor(() => {
      expect(envois[0]).toMatchObject({ methode: 'PUT', corps: { prix: 1100, version: 2 } })
    })
  })

  it('réserve le changement de prix à qui en a le droit', async () => {
    backendSimule()
    await ouvrirFiche(`/gestion/produits/${FLAG.id}`, [...MOI_TANTI.permissions, 'CATALOGUE_GERER'])

    expect(screen.getByLabelText(/^Prix TTC/)).toBeDisabled()
    expect(
      screen.getByText('Seul un propriétaire ou un administrateur change les prix.'),
    ).toBeVisible()
  })

  it('place sous le champ un nom déjà pris et refuse un prix illisible', async () => {
    const envois = backendSimule(() =>
      HttpResponse.json(
        {
          statut: 400,
          code: 'REQUETE_INVALIDE',
          message: 'x',
          champs: [{ champ: 'nom', message: 'Un produit porte déjà ce nom.' }],
        },
        { status: 400 },
      ),
    )
    await ouvrirFiche('/gestion/produits/nouveau')

    await userEvent.type(screen.getByLabelText(/^Nom/), 'Flag 65 cl')
    await userEvent.selectOptions(screen.getByLabelText(/^Catégorie/), 'Bières')
    await userEvent.type(screen.getByLabelText(/^Prix TTC/), 'mille')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le produit' }))
    expect(await screen.findByText('Saisissez un prix, par exemple 1 000.')).toBeVisible()
    expect(envois).toEqual([])

    await userEvent.clear(screen.getByLabelText(/^Prix TTC/))
    await userEvent.type(screen.getByLabelText(/^Prix TTC/), '1000')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le produit' }))
    const nom = screen.getByLabelText(/^Nom/)
    await waitFor(() => {
      expect(nom).toHaveAccessibleDescription('Un produit porte déjà ce nom.')
    })
    expect(within(screen.getByRole('main')).queryByRole('alert')).not.toBeInTheDocument()
  })
})
