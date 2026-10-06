import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { GroupeOptionResume } from '../../partage/api/contrat'
import { FLAG, POULET } from './fixtures'

const CUISSON: GroupeOptionResume = {
  id: '90000000-0000-4000-8000-000000000001',
  nom: 'Cuisson',
  choixMultiple: false,
  obligatoire: true,
  nbProduits: 4,
  version: 0,
  choix: [
    { id: 'c1', nom: 'Saignant', supplement: 0 },
    { id: 'c2', nom: 'À point', supplement: 0 },
  ],
}
const SUPPLEMENTS: GroupeOptionResume = {
  id: '90000000-0000-4000-8000-000000000002',
  nom: 'Suppléments',
  choixMultiple: true,
  obligatoire: false,
  maximum: 2,
  nbProduits: 0,
  version: 1,
  choix: [
    { id: 's1', nom: 'Œuf', supplement: 200, produitLieId: FLAG.id, produitLieNom: FLAG.nom },
    { id: 's2', nom: 'Piment', supplement: 0, coutRevient: 25 },
  ],
}

function backendSimule() {
  const envois: { methode: string; chemin: string; corps: unknown }[] = []
  serveurMsw.use(
    http.get(`${API}/groupes-options`, () => HttpResponse.json([CUISSON, SUPPLEMENTS])),
    http.get(`${API}/produits`, () =>
      HttpResponse.json({ elements: [POULET, FLAG], page: 0, taille: 100, total: 2 }),
    ),
    http.post(`${API}/groupes-options`, async ({ request }) => {
      const corps = await request.json()
      envois.push({ methode: 'POST', chemin: '/groupes-options', corps })
      return HttpResponse.json({ ...SUPPLEMENTS, id: 'nouveau', nom: 'Sauce' }, { status: 201 })
    }),
    http.put(`${API}/groupes-options/:id`, async ({ request, params }) => {
      envois.push({
        methode: 'PUT',
        chemin: `/groupes-options/${String(params.id)}`,
        corps: await request.json(),
      })
      return HttpResponse.json(SUPPLEMENTS)
    }),
    http.delete(`${API}/groupes-options/:id`, ({ params }) => {
      envois.push({
        methode: 'DELETE',
        chemin: `/groupes-options/${String(params.id)}`,
        corps: null,
      })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return envois
}

async function ouvrirOptions() {
  sessionOuverte({ ...MOI_TANTI, permissions: [...MOI_TANTI.permissions, 'CATALOGUE_GERER'] })
  ouvrir('/gestion/options')
  return screen.findByRole('table', { name: 'Groupes d’options' })
}

describe('PageOptions', () => {
  it('liste les groupes, leur règle, leurs choix et les produits qui les utilisent', async () => {
    backendSimule()
    const tableau = await ouvrirOptions()

    expect(
      within(screen.getByRole('navigation', { name: 'Carte' })).getByRole('link', {
        name: 'Options',
      }),
    ).toHaveAttribute('aria-current', 'page')
    const cuisson = within(tableau).getByRole('row', { name: /Cuisson/ })
    expect(cuisson).toHaveTextContent('Choix unique, obligatoire')
    expect(cuisson).toHaveTextContent('Saignant, À point')
    expect(cuisson).toHaveTextContent('4 produits')
    const supplements = within(tableau).getByRole('row', { name: /Suppléments/ })
    expect(supplements).toHaveTextContent('Choix multiple, 2 au plus')
    expect(supplements).toHaveTextContent('Œuf +200')
    expect(supplements).toHaveTextContent('1 lié au stock')
  })

  it('crée un groupe avec un choix lié à un produit et un choix à coût saisi', async () => {
    const envois = backendSimule()
    await ouvrirOptions()

    await userEvent.click(screen.getByRole('button', { name: 'Nouveau groupe' }))
    const dialogue = screen.getByRole('dialog', { name: 'Nouveau groupe d’options' })
    await userEvent.type(within(dialogue).getByLabelText(/^Nom du groupe/), 'Sauce')
    // Un seul choix : pas de maximum à régler. Il n'apparaît qu'avec plusieurs choix.
    expect(within(dialogue).queryByLabelText('Au plus')).toBeNull()
    await userEvent.click(within(dialogue).getByRole('radio', { name: /Plusieurs choix/ }))
    await userEvent.type(within(dialogue).getByLabelText('Au plus'), '2')

    const premier = within(dialogue).getByRole('group', { name: 'Choix 1' })
    await userEvent.type(within(premier).getByLabelText('Nom'), 'Œuf')
    await userEvent.click(within(premier).getByRole('button', { name: 'Lier au stock' }))
    await userEvent.selectOptions(
      within(premier).getByLabelText(/^Décompter le stock de/),
      FLAG.nom,
    )
    // Le prix en plus reprend le prix de vente du produit lié ; le coût vient du produit.
    const prix = within(premier).getByLabelText('Prix en plus')
    expect(prix).toHaveValue('1\u202f000')
    expect(within(premier).queryByLabelText(/^Coût d’achat/)).toBeNull()
    expect(premier).toHaveTextContent(`Stock : ${FLAG.nom}`)
    await userEvent.clear(prix)
    await userEvent.type(prix, '200')

    // La ligne vide du bas devient le choix suivant dès qu'on y tape.
    const second = within(dialogue).getByRole('group', { name: 'Choix 2' })
    await userEvent.type(within(second).getByLabelText('Nom'), 'Piment')
    await userEvent.click(within(second).getByRole('button', { name: 'Lier au stock' }))
    await userEvent.type(within(second).getByLabelText(/^Coût d’achat/), '25')
    expect(within(dialogue).getByRole('group', { name: 'Choix 3' })).toBeInTheDocument()
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Créer le groupe' }))

    await waitFor(() => {
      expect(envois).toEqual([
        {
          methode: 'POST',
          chemin: '/groupes-options',
          corps: {
            nom: 'Sauce',
            choixMultiple: true,
            obligatoire: false,
            maximum: 2,
            choix: [
              { nom: 'Œuf', supplement: 200, produitLieId: FLAG.id },
              { nom: 'Piment', supplement: 0, coutRevient: 25 },
            ],
          },
        },
      ])
    })
    expect(await screen.findByText('Le groupe « Sauce » est créé.')).toBeVisible()
  })

  it('modifie un groupe en gardant l’identifiant de ses choix, puis supprime un groupe inutilisé', async () => {
    const envois = backendSimule()
    await ouvrirOptions()

    await userEvent.click(screen.getByRole('button', { name: 'Modifier Suppléments' }))
    const dialogue = screen.getByRole('dialog', { name: 'Modifier « Suppléments »' })
    const premier = within(dialogue).getByRole('group', { name: 'Choix 1' })
    await userEvent.clear(within(premier).getByLabelText('Prix en plus'))
    await userEvent.type(within(premier).getByLabelText('Prix en plus'), '300')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(envois[0]?.corps).toMatchObject({
        version: 1,
        choix: [
          { id: 's1', nom: 'Œuf', supplement: 300, produitLieId: FLAG.id },
          { id: 's2', nom: 'Piment', supplement: 0, coutRevient: 25 },
        ],
      })
    })

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour Suppléments' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Supprimer « Suppléments » ?' })).getByRole(
        'button',
        { name: 'Supprimer le groupe' },
      ),
    )
    await waitFor(() => {
      expect(envois.at(-1)?.chemin).toBe(`/groupes-options/${SUPPLEMENTS.id}`)
    })
  })
})
