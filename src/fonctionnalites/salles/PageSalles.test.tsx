import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { EtablissementResume, SalleResume } from '../../partage/api/contrat'

const BE_KPOTA: EtablissementResume = {
  id: '9a1f0c2e-0000-4b8e-8f6a-000000000001',
  code: 'BE',
  nom: 'Bè Kpota',
  fuseauHoraire: 'Africa/Lome',
  delaiVerrouillageMinutes: 3,
  actif: true,
  version: 0,
}
const table = (numero: number, places: number, active = true) => ({
  id: `7ab00000-0000-4000-8000-00000000000${String(numero)}`,
  nom: `T${String(numero)}`,
  places,
  ordre: numero,
  active,
  version: 0,
})
const TERRASSE: SalleResume = {
  id: '5a100000-0000-4000-8000-000000000001',
  nom: 'Terrasse',
  ordre: 1,
  active: true,
  version: 0,
  tables: [table(1, 4), table(2, 4), table(3, 6, false)],
}
const BAR: SalleResume = {
  id: '5a100000-0000-4000-8000-000000000002',
  nom: 'Bar',
  ordre: 2,
  active: true,
  version: 0,
  tables: [],
}

function backendSimule() {
  const envois: { methode: string; chemin: string; corps: unknown }[] = []
  const enregistrer = async (request: Request, chemin: string) => {
    envois.push({
      methode: request.method,
      chemin,
      corps: request.method === 'GET' ? null : await request.json().catch(() => null),
    })
  }
  serveurMsw.use(
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: [BE_KPOTA], page: 0, taille: 50, total: 1 }),
    ),
    http.get(`${API}/etablissements/:id/salles`, () => HttpResponse.json([TERRASSE, BAR])),
    http.post(`${API}/etablissements/:id/salles`, async ({ request }) => {
      await enregistrer(request, '/salles')
      return HttpResponse.json({ ...BAR, id: 'nouvelle', nom: 'Salle' }, { status: 201 })
    }),
    http.put(`${API}/etablissements/:id/salles/ordre`, async ({ request }) => {
      await enregistrer(request, '/salles/ordre')
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API}/salles/:id/tables/lot`, async ({ request }) => {
      await enregistrer(request, '/tables/lot')
      return HttpResponse.json([table(4, 4)], { status: 201 })
    }),
    http.put(`${API}/tables/:id`, async ({ request }) => {
      await enregistrer(request, '/tables')
      return HttpResponse.json(table(1, 8))
    }),
    http.post(`${API}/tables/:id/:action`, async ({ request, params }) => {
      await enregistrer(request, `/tables/${String(params.action)}`)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return envois
}

async function ouvrirSalles(permissions = [...MOI_TANTI.permissions, 'SALLE_GERER']) {
  sessionOuverte({ ...MOI_TANTI, permissions })
  ouvrir('/gestion/salles')
  return screen.findByRole('tablist', { name: 'Salles' })
}

describe('PageSalles', () => {
  it('présente les salles en onglets et leurs tables, désactivées grisées', async () => {
    backendSimule()
    const onglets = await ouvrirSalles()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Salles et tables de Bè Kpota' }),
    ).toBeVisible()
    expect(within(onglets).getByRole('tab', { name: /Terrasse/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(within(onglets).getByRole('tab', { name: /Terrasse/ })).toHaveTextContent('2')
    const grille = screen.getByRole('list', { name: 'Tables de Terrasse' })
    expect(within(grille).getByRole('listitem', { name: 'T1' })).toHaveTextContent('4 places')
    expect(within(grille).getByRole('listitem', { name: 'T3' })).toHaveTextContent('Désactivée')

    await userEvent.click(within(onglets).getByRole('tab', { name: /Bar/ }))
    expect(await screen.findByText('Aucune table dans cette salle.')).toBeVisible()
  })

  it('ajoute des tables en lot à la suite des existantes, avec un aperçu', async () => {
    const envois = backendSimule()
    await ouvrirSalles()

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter des tables' }))
    const dialogue = await screen.findByRole('dialog', {
      name: 'Ajouter des tables à « Terrasse »',
    })
    expect(within(dialogue).getByLabelText(/^Premier nom/)).toHaveValue('T4')
    const nombre = within(dialogue).getByLabelText(/^Nombre/)
    await userEvent.clear(nombre)
    await userEvent.type(nombre, '3')
    expect(within(dialogue).getByRole('status')).toHaveTextContent(
      'Seront créées : T4, T5, T6, de 4 places.',
    )
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ajouter 3 tables' }))

    await waitFor(() => {
      expect(envois).toEqual([
        {
          methode: 'POST',
          chemin: '/tables/lot',
          corps: { nombre: 3, premierNom: 'T4', places: 4 },
        },
      ])
    })
  })

  it('signale avant l’envoi les noms de tables déjà pris et propose un nom libre', async () => {
    const envois = backendSimule()
    await ouvrirSalles()

    await userEvent.click(screen.getByRole('tab', { name: /Bar/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter des tables' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Ajouter des tables à « Bar »' })
    const premier = within(dialogue).getByLabelText(/^Premier nom/)
    await userEvent.clear(premier)
    await userEvent.type(premier, 'T1')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ajouter 4 tables' }))

    expect(premier).toHaveAccessibleDescription(
      'T1, T2, T3 existent déjà dans Bè Kpota. Essayez T4.',
    )
    expect(within(dialogue).queryByRole('alert')).not.toBeInTheDocument()
    expect(envois).toEqual([])
  })

  it('place sous le champ le refus du serveur pour un nom pris entre-temps', async () => {
    backendSimule()
    serveurMsw.use(
      http.post(`${API}/salles/:id/tables/lot`, () =>
        HttpResponse.json(
          {
            statut: 400,
            code: 'REQUETE_INVALIDE',
            message: 'x',
            champs: [
              { champ: 'premierNom', message: 'Déjà utilisés dans cet établissement : T4.' },
            ],
          },
          { status: 400 },
        ),
      ),
    )
    await ouvrirSalles()

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter des tables' }))
    const dialogue = await screen.findByRole('dialog', {
      name: 'Ajouter des tables à « Terrasse »',
    })
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ajouter 4 tables' }))

    const premier = within(dialogue).getByLabelText(/^Premier nom/)
    await waitFor(() => {
      expect(premier).toHaveAccessibleDescription('Déjà utilisés dans cet établissement : T4.')
    })
    expect(within(dialogue).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('modifie une table, puis réordonne les salles', async () => {
    const envois = backendSimule()
    await ouvrirSalles()

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour T1' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Modifier' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Modifier T1' })
    const places = within(dialogue).getByLabelText(/^Places/)
    await userEvent.clear(places)
    await userEvent.type(places, '8')
    await userEvent.selectOptions(within(dialogue).getByLabelText(/^Salle/), 'Bar')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    await userEvent.click(
      screen.getByRole('button', { name: 'Plus d’actions pour la salle Terrasse' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Descendre' }))

    await waitFor(() => {
      expect(envois).toEqual([
        {
          methode: 'PUT',
          chemin: '/tables',
          corps: { nom: 'T1', places: 8, salleId: BAR.id, version: 0 },
        },
        { methode: 'PUT', chemin: '/salles/ordre', corps: { ids: [BAR.id, TERRASSE.id] } },
      ])
    })
  })

  it('désactive une table sans la supprimer', async () => {
    const envois = backendSimule()
    await ouvrirSalles()

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour T2' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Désactiver' }))

    await waitFor(() => {
      expect(envois.map((envoi) => envoi.chemin)).toEqual(['/tables/desactivation'])
    })
    expect(await screen.findByText('« T2 » est désactivée.')).toBeVisible()
  })
})
