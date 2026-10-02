import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import {
  FLAG,
  FLAG_ENVOYE,
  NOTE_COMPTOIR,
  NOTE_T4,
  NOTE_VIDE,
  PLAN,
  POULET,
  T1_ID,
} from '../../../tests/commandes'
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
    expect(t4).toHaveTextContent('2 à envoyer')
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

  it('liste à traiter les additions demandées puis les articles à envoyer', async () => {
    const plan = structuredClone(PLAN)
    const [, t4, t7] = plan.salles[0]?.tables ?? []
    if (t4?.note !== undefined) t4.note.aEnvoyerDepuis = '2026-09-29T20:58:00Z'
    if (t7?.note !== undefined) t7.note.additionDemandeeLe = '2026-09-29T21:10:00Z'
    planServi(plan)
    caisseOuverte('/caisse')

    const aTraiter = await screen.findByRole('list', { name: 'À traiter' })
    expect(
      within(aTraiter)
        .getAllByRole('link')
        .map((lien) => lien.textContent),
    ).toEqual([expect.stringContaining('T7'), expect.stringContaining('T4')])
    expect(within(aTraiter).getByRole('link', { name: /T7/ })).toHaveTextContent(
      'Addition demandée',
    )
    expect(within(aTraiter).getByRole('link', { name: /T4/ })).toHaveTextContent('2 à envoyer')
    const tables = screen.getByRole('list', { name: 'Tables' })
    expect(within(tables).getByRole('button', { name: /T7/ })).toHaveTextContent(
      'Addition demandée',
    )
  })

  it('montre ce qui est déjà payé sur une note entamée', async () => {
    const plan = structuredClone(PLAN)
    const t4 = plan.salles[0]?.tables[1]
    if (t4?.note !== undefined) t4.note.totalPaye = 5000
    planServi(plan)
    caisseOuverte('/caisse')

    const tables = await screen.findByRole('list', { name: 'Tables' })
    expect(within(tables).getByRole('button', { name: /T4/ })).toHaveTextContent(
      'Payé 5 000 F / 13 500 F',
    )
  })

  it('suit les tables à servir et les commandes à remettre, même payées', async () => {
    const plan = structuredClone(PLAN)
    const t4 = plan.salles[0]?.tables[1]
    if (t4?.note !== undefined) t4.note.aServir = 2
    plan.enService = [
      {
        id: NOTE_T4.id,
        numero: 42,
        canal: 'SUR_PLACE',
        table: 'T4',
        serveur: 'Kossi A.',
        aServir: 2,
        aServirDepuis: '2026-09-29T19:40:00Z',
        payee: false,
      },
      {
        id: NOTE_VIDE.id,
        numero: 44,
        canal: 'EMPORTER',
        clientNom: 'Yao',
        serveur: 'Kossi A.',
        aServir: 1,
        aServirDepuis: '2026-09-29T20:39:00Z',
        payee: true,
      },
    ]
    planServi(plan)
    let remise = false
    serveurMsw.use(
      http.get(`${API}/caisse/commandes/${NOTE_VIDE.id}`, () =>
        HttpResponse.json({
          ...NOTE_VIDE,
          canal: 'EMPORTER',
          clientNom: 'Yao',
          lignes: [FLAG_ENVOYE],
        }),
      ),
      http.post(`${API}/caisse/commandes/${NOTE_VIDE.id}/service`, () => {
        remise = true
        return HttpResponse.json(NOTE_VIDE)
      }),
    )
    caisseOuverte('/caisse')

    const tables = await screen.findByRole('list', { name: 'Tables' })
    expect(within(tables).getByRole('button', { name: /T4/ })).toHaveTextContent('2 à servir')
    const aServir = screen.getByRole('list', { name: 'À servir' })
    expect(within(aServir).getByRole('link', { name: /T4/ })).toHaveTextContent('2 à servir')
    const aRemettre = screen.getByRole('list', { name: 'À remettre' })
    expect(aRemettre).toHaveTextContent('n°44, À emporter, Yao')
    expect(aRemettre).toHaveTextContent('Payée')

    await userEvent.click(within(aRemettre).getByRole('button', { name: 'Remise au client' }))
    const dialogue = screen.getByRole('dialog', { name: 'Remettre n°44 au client ?' })
    expect(await within(dialogue).findByText('1× Flag 65 cl')).toBeVisible()
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Remise au client' }))

    await vi.waitFor(() => {
      expect(remise).toBe(true)
    })
  })

  it('met en évidence les notes du comptoir et à emporter, avec leurs repères', async () => {
    planServi({
      ...PLAN,
      sansTable: [
        { ...NOTE_COMPTOIR, aEnvoyer: 1 },
        {
          ...NOTE_COMPTOIR,
          id: 'c0000000-0000-4000-8000-000000000045',
          numero: 45,
          canal: 'EMPORTER',
          clientNom: 'Yao',
          total: 4500,
          totalPaye: 2000,
        },
      ],
    })
    caisseOuverte('/caisse')

    const resume = await screen.findByRole('region', { name: 'Notes ouvertes, toutes salles' })
    expect(
      within(resume).getByRole('heading', { name: /Comptoir et à emporter/ }),
    ).toHaveTextContent('2')
    const sansTable = within(resume).getByRole('list', { name: 'Comptoir et à emporter' })
    const n43 = within(sansTable).getByRole('link', { name: /n°43/ })
    expect(n43).toHaveTextContent('À encaisser 1 500 F')
    expect(n43).toHaveTextContent('1 à envoyer')
    expect(
      within(sansTable).getByRole('link', { name: /n°45, À emporter, Yao/ }),
    ).toHaveTextContent('À encaisser 2 500 F')
  })

  it('ne répète pas dans le comptoir une commande déjà à remettre', async () => {
    planServi({
      ...PLAN,
      enService: [
        {
          id: NOTE_COMPTOIR.id,
          numero: 43,
          canal: 'COMPTOIR',
          serveur: 'Essi D.',
          aServir: 1,
          aServirDepuis: '2026-09-29T20:40:00Z',
          payee: false,
        },
      ],
    })
    caisseOuverte('/caisse')

    const aRemettre = await screen.findByRole('list', { name: 'À remettre' })
    expect(aRemettre).toHaveTextContent('À encaisser 1 500 F')
    expect(screen.queryByRole('list', { name: 'Comptoir et à emporter' })).not.toBeInTheDocument()
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

  it('dit qu’une table vient d’être désactivée et relit le plan', async () => {
    planServi()
    serveurMsw.use(
      http.post(`${API}/caisse/commandes`, () =>
        HttpResponse.json(
          { statut: 409, code: 'TABLE_INDISPONIBLE', message: 'x' },
          { status: 409 },
        ),
      ),
    )
    caisseOuverte('/caisse')

    await userEvent.click(await screen.findByRole('button', { name: /T1, libre/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la note' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette table vient d’être retirée du plan',
    )
    expect(screen.queryByText('Corrigez les champs indiqués')).not.toBeInTheDocument()
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

  it('mène à la caisse de la tablette qui encaisse ou clôture, pas le serveur', async () => {
    planServi()
    serveurMsw.use(
      http.get(`${API}/caisse/situation`, () =>
        HttpResponse.json({ statut: 409, code: 'CAISSE_FERMEE', message: 'x' }, { status: 409 }),
      ),
      http.get(`${API}/caisse/ouverture`, () => HttpResponse.json({ operateurs: [] })),
    )
    caisseOuverte('/caisse', { permissions: ['COMMANDE_CREER', 'PAIEMENT_ENCAISSER'] })

    await userEvent.click(await screen.findByRole('button', { name: 'Caisse' }))

    expect(
      await screen.findByRole('heading', { name: 'La caisse de cette tablette n’est pas ouverte' }),
    ).toBeVisible()
  })

  it('ne montre pas la caisse au serveur', async () => {
    planServi()
    caisseOuverte('/caisse', { permissions: ['COMMANDE_CREER'] })

    await screen.findByRole('list', { name: 'Tables' })
    expect(screen.queryByRole('button', { name: 'Caisse' })).not.toBeInTheDocument()
  })

  it('garde la vente au comptoir quand l’établissement n’a pas de table', async () => {
    planServi({ salles: [], sansTable: [], enService: [] })
    caisseOuverte('/caisse')

    expect(
      await screen.findByRole('heading', { name: 'Aucune table dans cet établissement' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Vente au comptoir' })).toBeVisible()
  })
})
