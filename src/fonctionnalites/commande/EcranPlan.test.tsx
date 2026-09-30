import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import { FLAG, NOTE_T4, NOTE_VIDE, PLAN, POULET, T1_ID } from '../../../tests/commandes'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { DemandeOuverture, PlanDeSalle } from '../../partage/api/contrat'

function planServi(plan: PlanDeSalle = PLAN) {
  serveurMsw.use(
    http.get(`${API}/caisse/plan`, () => HttpResponse.json(plan)),
    http.get(`${API}/caisse/carte`, () => HttpResponse.json([FLAG, POULET])),
    http.get(`${API}/caisse/commandes/${NOTE_T4.id}`, () => HttpResponse.json(NOTE_T4)),
  )
}

/** Retient le corps de chaque ouverture de note et répond par la note donnée. */
function ouvertures(reponse = NOTE_VIDE) {
  const recues: DemandeOuverture[] = []
  serveurMsw.use(
    http.post(`${API}/caisse/commandes`, async ({ request }) => {
      recues.push((await request.json()) as DemandeOuverture)
      return HttpResponse.json(reponse, { status: 201 })
    }),
    http.get(`${API}/caisse/commandes/${reponse.id}`, () => HttpResponse.json(reponse)),
  )
  return recues
}

describe('EcranPlan', () => {
  it('montre les tables de la salle, libres ou avec leur note', async () => {
    planServi()
    caisseOuverte('/caisse')

    const tables = await screen.findByRole('list', { name: 'Tables' })
    expect(within(tables).getByRole('button', { name: /T1, libre/ })).toHaveTextContent('4 places')
    const t4 = within(tables).getByRole('button', { name: /T4, note de 13\s500/ })
    expect(t4).toHaveTextContent('Ma table')
    expect(t4).toHaveTextContent('Kossi A., 3 couverts')
    expect(within(tables).getByRole('button', { name: /T7/ })).not.toHaveTextContent('Ma table')

    const salles = screen.getByRole('tablist', { name: 'Salles' })
    expect(within(salles).getByRole('tab', { name: /Terrasse/ })).toHaveTextContent('2/3')
    await userEvent.click(within(salles).getByRole('tab', { name: /Bar/ }))
    expect(within(tables).getByRole('button', { name: /B1, libre/ })).toBeVisible()
  })

  it('résume les notes ouvertes et liste celles sans table', async () => {
    planServi()
    caisseOuverte('/caisse')

    const resume = await screen.findByRole('region', { name: 'Notes ouvertes, toutes salles' })
    expect(resume).toHaveTextContent('19 000 FCFA')
    expect(resume).toHaveTextContent('3 notes ouvertes')
    expect(resume).toHaveTextContent('2 tables occupées sur 4')
    expect(within(resume).getByRole('link', { name: /n°43, Comptoir/ })).toHaveTextContent(
      'Essi D., ouverte à 20:37',
    )
  })

  it('filtre sur mes tables', async () => {
    planServi()
    caisseOuverte('/caisse')

    await userEvent.click(await screen.findByRole('button', { name: /Mes tables/ }))

    const tables = screen.getByRole('list', { name: 'Tables' })
    expect(
      within(tables)
        .getAllByRole('button')
        .map((table) => table.textContent),
    ).toEqual([expect.stringContaining('T4')])
  })

  it('ouvre une note sur une table libre avec le nombre de couverts', async () => {
    planServi()
    const recues = ouvertures()
    caisseOuverte('/caisse')

    await userEvent.click(await screen.findByRole('button', { name: /T1, libre/ }))
    const dialogue = screen.getByRole('dialog', { name: 'Ouvrir une note sur T1' })
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Un couvert de plus' }))
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ouvrir la note' }))

    expect(await screen.findByRole('region', { name: 'Note en cours' })).toBeVisible()
    expect(recues).toEqual([{ canal: 'SUR_PLACE', tableId: T1_ID, couverts: 3 }])
  })

  it('rouvre la note d’une table occupée', async () => {
    planServi()
    caisseOuverte('/caisse')

    await userEvent.click(await screen.findByRole('button', { name: /T4, note de/ }))

    const note = await screen.findByRole('region', { name: 'Note en cours' })
    expect(within(note).getByRole('heading', { name: /T4/ })).toBeVisible()
  })

  it('prévient quand un collègue vient d’ouvrir la même table', async () => {
    planServi()
    serveurMsw.use(
      http.post(`${API}/caisse/commandes`, () =>
        HttpResponse.json({ statut: 409, code: 'TABLE_OCCUPEE', message: 'x' }, { status: 409 }),
      ),
    )
    caisseOuverte('/caisse')

    await userEvent.click(await screen.findByRole('button', { name: /T1, libre/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la note' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette table a déjà une note ouverte',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ouvre une vente au comptoir sans rien demander', async () => {
    planServi()
    const recues = ouvertures()
    caisseOuverte('/caisse')

    await userEvent.click(await screen.findByRole('button', { name: 'Vente au comptoir' }))

    expect(await screen.findByRole('region', { name: 'Note en cours' })).toBeVisible()
    expect(recues).toEqual([{ canal: 'COMPTOIR' }])
  })

  it('demande un nom facultatif pour une vente à emporter', async () => {
    planServi()
    const recues = ouvertures({ ...NOTE_VIDE, canal: 'EMPORTER', clientNom: 'Yao' })
    caisseOuverte('/caisse')

    await userEvent.click(await screen.findByRole('button', { name: 'À emporter' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom du client' }), 'Yao')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la note' }))

    expect(await screen.findByRole('region', { name: 'Note en cours' })).toHaveTextContent(
      'pour Yao',
    )
    expect(recues).toEqual([{ canal: 'EMPORTER', clientNom: 'Yao' }])
  })

  it('laisse consulter le plan sans prendre de commande (cuisine)', async () => {
    planServi()
    caisseOuverte('/caisse', { permissions: [] })

    expect(
      await screen.findByText('Consultation seulement : votre rôle ne prend pas de commande.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Vente au comptoir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /T1, libre/ })).not.toBeInTheDocument()
  })

  it('garde la vente au comptoir quand l’établissement n’a pas de table', async () => {
    planServi({ salles: [], sansTable: [] })
    caisseOuverte('/caisse')

    expect(
      await screen.findByRole('heading', { name: 'Aucune table dans cet établissement' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Vente au comptoir' })).toBeVisible()
  })
})
