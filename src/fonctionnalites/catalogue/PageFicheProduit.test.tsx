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

  it('attache des groupes d’options au produit, dans l’ordre de la caisse', async () => {
    backendSimule()
    const cuisson = {
      id: '90000000-0000-4000-8000-000000000001',
      nom: 'Cuisson',
      choixMultiple: false,
      obligatoire: true,
      nbProduits: 1,
      version: 0,
      choix: [{ id: 'c1', nom: 'À point', supplement: 0 }],
    }
    const supplements = {
      ...cuisson,
      id: '90000000-0000-4000-8000-000000000002',
      nom: 'Suppléments',
      choixMultiple: true,
      obligatoire: false,
    }
    const attaches: unknown[] = []
    serveurMsw.use(
      http.get(`${API}/produits/:id`, () =>
        HttpResponse.json({ ...FLAG, groupesOptionIds: [cuisson.id] }),
      ),
      http.get(`${API}/groupes-options`, () => HttpResponse.json([cuisson, supplements])),
      http.put(`${API}/produits/:id/options`, async ({ request }) => {
        const corps = (await request.json()) as { groupeIds: string[] }
        attaches.push(corps)
        return HttpResponse.json({ ...FLAG, groupesOptionIds: corps.groupeIds })
      }),
    )
    await ouvrirFiche(`/gestion/produits/${FLAG.id}`)

    const section = await screen.findByRole('region', { name: 'Options' })
    expect(within(section).getByRole('list')).toHaveTextContent('Cuisson')
    await userEvent.selectOptions(
      within(section).getByLabelText(/^Ajouter un groupe/),
      'Suppléments',
    )
    await waitFor(() => {
      expect(attaches).toEqual([{ groupeIds: [cuisson.id, supplements.id] }])
    })
    await userEvent.click(within(section).getByRole('button', { name: 'Monter Suppléments' }))
    await userEvent.click(within(section).getByRole('button', { name: 'Retirer Cuisson' }))
    await waitFor(() => {
      expect(attaches.slice(1)).toEqual([
        { groupeIds: [supplements.id, cuisson.id] },
        { groupeIds: [supplements.id] },
      ])
    })
  })

  it('ajoute et modifie les variantes d’un produit', async () => {
    backendSimule()
    const demi = {
      id: 'b0000000-0000-4000-8000-0000000000d1',
      libelle: 'Demi',
      prix: 3000,
      actif: true,
      coutRevient: 1400,
      version: 0,
    }
    const envois: { methode: string; chemin: string; corps: unknown }[] = []
    serveurMsw.use(
      http.get(`${API}/produits/:id`, () => HttpResponse.json({ ...FLAG, variantes: [demi] })),
      http.get(`${API}/groupes-options`, () => HttpResponse.json([])),
      http.post(`${API}/produits/:id/variantes`, async ({ request }) => {
        envois.push({ methode: 'POST', chemin: 'variantes', corps: await request.json() })
        return HttpResponse.json({ ...FLAG, variantes: [demi] }, { status: 201 })
      }),
      http.put(`${API}/produits/:id/variantes/:variante`, async ({ request, params }) => {
        envois.push({
          methode: 'PUT',
          chemin: `variantes/${String(params.variante)}`,
          corps: await request.json(),
        })
        return HttpResponse.json({ ...FLAG, variantes: [demi] })
      }),
    )
    await ouvrirFiche(`/gestion/produits/${FLAG.id}`)

    const section = await screen.findByRole('region', { name: 'Variantes' })
    expect(within(section).getByRole('row', { name: /Demi/ })).toHaveTextContent(/3\s000/)
    await userEvent.type(within(section).getByLabelText(/^Nouvelle variante/), 'Entier')
    await userEvent.type(within(section).getByLabelText(/^Prix de la variante/), '5500')
    await userEvent.click(within(section).getByRole('button', { name: 'Ajouter la variante' }))
    await userEvent.click(within(section).getByRole('button', { name: 'Modifier Demi' }))
    const dialogue = screen.getByRole('dialog', { name: 'Modifier la variante « Demi »' })
    const prix = within(dialogue).getByLabelText(/^Prix TTC/)
    await userEvent.clear(prix)
    await userEvent.type(prix, '3200')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(envois).toEqual([
        { methode: 'POST', chemin: 'variantes', corps: { libelle: 'Entier', prix: 5500 } },
        {
          methode: 'PUT',
          chemin: `variantes/${demi.id}`,
          corps: { libelle: 'Demi', prix: 3200, coutRevient: 1400, version: 0 },
        },
      ])
    })
  })

  it('renvoie à la fiche du parent pour modifier une variante', async () => {
    backendSimule()
    serveurMsw.use(
      http.get(`${API}/produits/:id`, () =>
        HttpResponse.json({
          ...FLAG,
          nom: 'Flag 65 cl, Grande',
          parentId: 'b0000000-0000-4000-8000-0000000000aa',
          libelleVariante: 'Grande',
        }),
      ),
    )
    sessionOuverte({ ...MOI_TANTI, permissions: [...PERMISSIONS] })
    ouvrir(`/gestion/produits/${FLAG.id}`)

    expect(
      await screen.findByText('Une variante se modifie depuis la fiche de son produit.'),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ouvrir le produit' })).toHaveAttribute(
      'href',
      '/gestion/produits/b0000000-0000-4000-8000-0000000000aa',
    )
    expect(screen.queryByLabelText(/^Prix TTC/)).toBeNull()
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
