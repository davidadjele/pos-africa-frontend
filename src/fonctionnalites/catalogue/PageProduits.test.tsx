import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import { BIERES, FLAG, GRILLADES, POULET } from './fixtures'

function backendSimule() {
  const requetes: string[] = []
  const envois: { chemin: string; corps: unknown }[] = []
  serveurMsw.use(
    http.get(`${API}/categories`, () => HttpResponse.json([GRILLADES, BIERES])),
    http.get(`${API}/produits`, ({ request }) => {
      const url = new URL(request.url)
      requetes.push(url.search)
      const categorie = url.searchParams.get('categorieId')
      const recherche = url.searchParams.get('recherche')?.toLowerCase()
      const elements = [POULET, FLAG].filter(
        (produit) =>
          (categorie === null || produit.categorie.id === categorie) &&
          (recherche === undefined || produit.nom.toLowerCase().includes(recherche)),
      )
      return HttpResponse.json({ elements, page: 0, taille: 50, total: elements.length })
    }),
    http.post(`${API}/produits/:id/desactivation`, ({ params }) => {
      envois.push({ chemin: `/produits/${String(params.id)}/desactivation`, corps: null })
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API}/categories`, async ({ request }) => {
      envois.push({ chemin: '/categories', corps: await request.json() })
      return HttpResponse.json(GRILLADES, { status: 201 })
    }),
    http.put(`${API}/categories/ordre`, async ({ request }) => {
      envois.push({ chemin: '/categories/ordre', corps: await request.json() })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { requetes, envois }
}

async function ouvrirProduits(permissions = [...MOI_TANTI.permissions, 'CATALOGUE_GERER']) {
  sessionOuverte({ ...MOI_TANTI, permissions })
  ouvrir('/gestion/produits')
  return screen.findByRole('table', { name: 'Produits de la carte' })
}

describe('PageProduits', () => {
  it('liste la carte avec la catégorie, le prix TTC et la taxe de chaque produit', async () => {
    backendSimule()
    const tableau = await ouvrirProduits()

    const flag = within(tableau).getByRole('row', { name: /Flag 65 cl/ })
    expect(flag).toHaveTextContent('Bières')
    expect(flag).toHaveTextContent('1 000 F')
    expect(flag).toHaveTextContent('TVA 18 %')
    expect(flag).toHaveTextContent('Suivi')
    expect(within(tableau).getByRole('row', { name: /Poulet braisé/ })).toHaveTextContent(
      'Non suivi',
    )
  })

  it('filtre par catégorie, par recherche et par statut', async () => {
    const { requetes } = backendSimule()
    const tableau = await ouvrirProduits()

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Catégories' })).getByRole('button', {
        name: /Bières/,
      }),
    )
    await waitFor(() => {
      expect(within(tableau).queryByText('Poulet braisé')).not.toBeInTheDocument()
    })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un produit' }), 'flag')
    await userEvent.click(screen.getByRole('button', { name: 'Désactivés' }))

    await waitFor(() => {
      expect(requetes.at(-1)).toBe(
        `?actifs=false&page=0&taille=50&categorieId=${BIERES.id}&recherche=flag`,
      )
    })
  })

  it('désactive un produit sans le supprimer', async () => {
    const { envois } = backendSimule()
    await ouvrirProduits()

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Désactiver' }))

    await waitFor(() => {
      expect(envois.map((envoi) => envoi.chemin)).toEqual([`/produits/${FLAG.id}/desactivation`])
    })
    expect(
      await screen.findByText('« Flag 65 cl » est désactivé : il n’apparaît plus sur la caisse.'),
    ).toBeVisible()
  })

  it('ajoute une catégorie avec sa couleur et réordonne les catégories', async () => {
    const { envois } = backendSimule()
    await ouvrirProduits()

    await userEvent.click(screen.getByRole('button', { name: 'Gérer les catégories' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Catégories de la carte' })
    await userEvent.click(
      await within(dialogue).findByRole('button', { name: 'Descendre Grillades' }),
    )
    const formulaire = within(dialogue).getByRole('form', { name: 'Nouvelle catégorie' })
    await userEvent.type(within(formulaire).getByLabelText(/^Nom/), 'Vins et spiritueux')
    await userEvent.click(within(formulaire).getByRole('radio', { name: 'Prune' }))
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Ajouter la catégorie' }))

    await waitFor(() => {
      expect(envois).toEqual([
        { chemin: '/categories/ordre', corps: { ids: [BIERES.id, GRILLADES.id] } },
        { chemin: '/categories', corps: { nom: 'Vins et spiritueux', couleur: 'PRUNE' } },
      ])
    })
  })

  it('explique pourquoi une catégorie qui a des produits ne se désactive pas', async () => {
    backendSimule()
    serveurMsw.use(
      http.post(`${API}/categories/:id/desactivation`, () =>
        HttpResponse.json(
          { statut: 409, code: 'CATEGORIE_EN_USAGE', message: 'x', traceId: 't' },
          { status: 409 },
        ),
      ),
    )
    await ouvrirProduits()

    await userEvent.click(screen.getByRole('button', { name: 'Gérer les catégories' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Catégories de la carte' })
    await userEvent.click(
      await within(dialogue).findByRole('button', { name: 'Plus d’actions pour Bières' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Désactiver' }))

    expect(await within(dialogue).findByRole('alert')).toHaveTextContent(
      '« Bières » contient encore 1 produit actif : déplacez-le vers une autre catégorie ou désactivez-le d’abord.',
    )
  })

  it('laisse consulter la carte sans permettre de la modifier', async () => {
    backendSimule()
    const tableau = await ouvrirProduits(MOI_TANTI.permissions)

    expect(within(tableau).getByText('Flag 65 cl')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Ajouter un produit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gérer les catégories' })).not.toBeInTheDocument()
  })
})
