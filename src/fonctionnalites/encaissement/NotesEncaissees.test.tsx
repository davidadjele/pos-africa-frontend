import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import { RECU } from './fixturesRecu'
import type {
  DemandeRemboursement,
  EtatRemboursement,
  NoteEncaissee,
  SituationCaisse,
} from '../../partage/api/contrat'

const CAISSIER = ['COMMANDE_CREER', 'PAIEMENT_ENCAISSER', 'CAISSE_FERMER', 'CAISSE_OUVRIR']
const NOTE_42 = 'c0000000-0000-4000-8000-000000000042'
const POULETS = '1e000000-0000-4000-8000-000000000001'
const FLAGS = '1e000000-0000-4000-8000-000000000002'
const FLAG_PRODUIT = 'b0000000-0000-4000-8000-000000000002'
const SITUATION: SituationCaisse = {
  reglementsArdoise: { total: 0, especes: 0, mobileMoney: 0, carte: 0 },
  ouverture: {
    id: 'ca155e00-0000-4000-8000-000000000001',
    fondInitial: 20_000,
    ouvertePar: 'Yawa T.',
    ouverteLe: '2026-09-29T07:02:00Z',
  },
  ventes: {
    notes: 2,
    especes: 9000,
    mobileMoney: 9000,
    carte: 0,
    ardoise: 0,
    total: 18_000,
    remboursements: { total: 0, especes: 0, mobileMoney: 0, carte: 0, ardoise: 0 },
  },
  mouvements: [],
  notesOuvertes: [],
}
const NOTES: NoteEncaissee[] = [
  {
    id: NOTE_42,
    numero: 42,
    canal: 'SUR_PLACE',
    table: 'T4',
    journee: '2026-09-29',
    clotureeLe: '2026-09-29T21:05:00Z',
    total: 13_500,
    rembourse: 0,
    payee: true,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000041',
    numero: 41,
    canal: 'COMPTOIR',
    journee: '2026-09-29',
    clotureeLe: '2026-09-29T20:58:00Z',
    total: 4500,
    rembourse: 4500,
    payee: true,
  },
]
const A_REMBOURSER: EtatRemboursement = {
  commandeId: NOTE_42,
  numero: 42,
  table: 'T4',
  total: 13_500,
  rembourse: 0,
  remboursable: true,
  articles: [
    {
      ligneId: POULETS,
      produitId: 'b0000000-0000-4000-8000-000000000001',
      nom: 'Poulet braisé',
      quantite: 2,
      montant: 9000,
      rembourses: 0,
      rembourse: 0,
    },
    {
      ligneId: FLAGS,
      produitId: FLAG_PRODUIT,
      nom: 'Flag 65 cl',
      quantite: 3,
      montant: 3600,
      rembourses: 0,
      rembourse: 0,
    },
  ],
  modes: [
    { mode: 'ESPECES', paye: 9000, rembourse: 0, remboursable: 9000 },
    { mode: 'MOBILE_MONEY', operateur: 'FLOOZ', paye: 4500, rembourse: 0, remboursable: 4500 },
  ],
  remboursements: [],
}
const EN_ESPECES: EtatRemboursement = {
  ...A_REMBOURSER,
  modes: [{ mode: 'ESPECES', paye: 13_500, rembourse: 0, remboursable: 13_500 }],
}
const REMBOURSEE: EtatRemboursement = {
  ...A_REMBOURSER,
  rembourse: 4500,
  remboursements: [
    {
      id: 'b0000000-0000-4000-8000-000000000001',
      montant: 4500,
      parts: [{ mode: 'ESPECES', montant: 4500 }],
      motif: 'ARTICLE_NON_CONFORME',
      articles: [{ nom: 'Poulet braisé', quantite: 1 }],
      remboursePar: 'Yawa T.',
      approuvePar: 'Afi M.',
      rembourseLe: '2026-09-29T21:20:00Z',
    },
  ],
}

function notesServies(initial: EtatRemboursement = A_REMBOURSER) {
  const recus: DemandeRemboursement[] = []
  let etat = initial
  serveurMsw.use(
    http.get(`${API}/caisse/situation`, () => HttpResponse.json(SITUATION)),
    http.get(`${API}/caisse/ouverture`, () =>
      HttpResponse.json({
        ouverture: SITUATION.ouverture,
        operateurs: [{ code: 'FLOOZ', libelle: 'Flooz (Moov Africa)' }],
      }),
    ),
    http.get(`${API}/caisse/notes-encaissees`, () => HttpResponse.json(NOTES)),
    http.get(`${API}/caisse/commandes/${NOTE_42}/remboursement`, () => HttpResponse.json(etat)),
    http.post(`${API}/caisse/commandes/${NOTE_42}/remboursements`, async ({ request }) => {
      const demande = (await request.json()) as DemandeRemboursement
      recus.push(demande)
      return demande.validationId === undefined
        ? HttpResponse.json(
            { statut: 403, code: 'VALIDATION_REQUISE', message: 'x' },
            { status: 403 },
          )
        : HttpResponse.json((etat = REMBOURSEE))
    }),
    http.get(`${API}/caisse/validateurs`, () =>
      HttpResponse.json([
        {
          utilisateurId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0301',
          prenom: 'Afi',
          nomCourt: 'Afi M.',
          role: 'GERANT',
          bloque: false,
        },
      ]),
    ),
    http.post(`${API}/caisse/validations`, () =>
      HttpResponse.json(
        { id: 'a1b20000-0000-4000-8000-000000000009', expireLe: '2026-09-29T21:30:00Z' },
        { status: 201 },
      ),
    ),
  )
  return recus
}

describe('Notes encaissées', () => {
  it('liste les notes de la journée avec ce qui en a été remboursé', async () => {
    notesServies()
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    await userEvent.click(await screen.findByRole('tab', { name: 'Notes encaissées' }))
    const notes = await screen.findByRole('list', { name: 'Notes encaissées' })
    expect(within(notes).getByRole('button', { name: /n°42, T4/ })).toHaveTextContent('13 500')
    expect(within(notes).getByRole('button', { name: /n°41, Comptoir/ })).toHaveTextContent(
      'Remboursée',
    )
    await userEvent.type(screen.getByRole('searchbox', { name: 'Chercher une note' }), 'T4')
    expect(within(notes).queryByRole('button', { name: /n°41/ })).not.toBeInTheDocument()
  })

  it('rembourse un article dans le mode d’origine, validé par un gérant', async () => {
    const recus = notesServies(EN_ESPECES)
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    await userEvent.click(await screen.findByRole('tab', { name: 'Notes encaissées' }))
    await userEvent.click(await screen.findByRole('button', { name: /n°42, T4/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rembourser' }))

    const articles = screen.getByRole('list', { name: 'Articles à rembourser' })
    await userEvent.click(
      within(articles).getByRole('button', { name: 'Un Poulet braisé de plus' }),
    )
    expect(screen.getByRole('status', { name: 'À rembourser' })).toHaveTextContent('4 500 F')
    expect(screen.getByRole('region', { name: 'Rendre l’argent en' })).toHaveTextContent(
      /Espèces.*4\s500\sF/,
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Article non conforme' }))
    await userEvent.click(screen.getByRole('button', { name: /^Rembourser 4\s500\sF en espèces/ }))

    const validation = await screen.findByRole('dialog', { name: /^Rembourser 4\s500\sF/ })
    await userEvent.click(await within(validation).findByRole('button', { name: /Afi M\./ }))
    for (const chiffre of '5937') {
      await userEvent.click(within(validation).getByRole('button', { name: chiffre }))
    }
    await userEvent.click(within(validation).getByRole('button', { name: 'Valider' }))

    const detail = await screen.findByRole('region', { name: 'n°42, T4' })
    expect(await within(detail).findByText(/1× Poulet braisé, espèces/)).toBeVisible()
    expect(detail).toHaveTextContent('Validé par Afi M.')
    expect(recus).toEqual([
      {
        id: expect.any(String) as string,
        montant: 4500,
        articles: [{ ligneId: POULETS, quantite: 1 }],
        motif: 'ARTICLE_NON_CONFORME',
      },
      {
        id: recus[0]?.id,
        montant: 4500,
        articles: [{ ligneId: POULETS, quantite: 1 }],
        motif: 'ARTICLE_NON_CONFORME',
        validationId: 'a1b20000-0000-4000-8000-000000000009',
      },
    ])
  })

  it('demande si un article suivi remboursé revient en stock', async () => {
    const recus = notesServies(EN_ESPECES)
    caisseOuverte('/caisse/tiroir', {
      permissions: CAISSIER,
      stock: {
        politique: 'SOUPLE',
        articles: [{ produitId: FLAG_PRODUIT, quantite: 20, faible: false }],
      },
    })

    await userEvent.click(await screen.findByRole('tab', { name: 'Notes encaissées' }))
    await userEvent.click(await screen.findByRole('button', { name: /n°42, T4/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rembourser' }))
    const articles = screen.getByRole('list', { name: 'Articles à rembourser' })
    await userEvent.click(within(articles).getByRole('button', { name: 'Un Flag 65 cl de plus' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Article non conforme' }))
    const stock = screen.getByRole('radiogroup', { name: 'Les articles suivis en stock' })
    expect(within(stock).getByRole('radio', { name: /Perdu/ })).toBeChecked()
    await userEvent.click(within(stock).getByRole('radio', { name: /Revient en stock/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Rembourser 1\s200\sF en espèces/ }))

    await screen.findByRole('dialog', { name: /^Rembourser 1\s200\sF/ })
    expect(recus[0]).toMatchObject({ motif: 'ARTICLE_NON_CONFORME', retourEnStock: true })
  })

  it('rembourse une vente sur l’ardoise en diminuant ce que doit le client', async () => {
    notesServies({
      ...A_REMBOURSER,
      modes: [{ mode: 'ARDOISE', paye: 13_500, rembourse: 0, remboursable: 13_500 }],
    })
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    await userEvent.click(await screen.findByRole('tab', { name: 'Notes encaissées' }))
    await userEvent.click(await screen.findByRole('button', { name: /n°42, T4/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rembourser' }))

    expect(screen.getByRole('region', { name: 'Rendre l’argent en' })).toHaveTextContent(
      'Diminue ce que doit le client',
    )
  })

  it('répartit le remboursement entre l’ardoise et les espèces', async () => {
    const recus = notesServies({
      ...A_REMBOURSER,
      modes: [
        { mode: 'ESPECES', paye: 13_000, rembourse: 0, remboursable: 13_000 },
        { mode: 'ARDOISE', paye: 500, rembourse: 0, remboursable: 500 },
      ],
    })
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    await userEvent.click(await screen.findByRole('tab', { name: 'Notes encaissées' }))
    await userEvent.click(await screen.findByRole('button', { name: /n°42, T4/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rembourser' }))
    const articles = screen.getByRole('list', { name: 'Articles à rembourser' })
    await userEvent.click(within(articles).getByRole('button', { name: 'Un Flag 65 cl de plus' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Article non conforme' }))

    const repartition = screen.getByRole('region', { name: 'Rendre l’argent en' })
    expect(repartition).toHaveTextContent(/Espèces.*700\sF/)
    expect(repartition).toHaveTextContent(/Ardoise.*500\sF/)
    await userEvent.click(screen.getByRole('button', { name: /^Rembourser 1\s200\sF$/ }))

    await screen.findByRole('dialog', { name: /^Rembourser 1\s200\sF/ })
    expect(recus[0]).toMatchObject({ montant: 1200 })
    expect(recus[0]).not.toHaveProperty('mode')
  })

  it('réimprime le reçu d’une note, marqué duplicata', async () => {
    notesServies()
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_42}/recu/impressions`, () =>
        HttpResponse.json({ ...RECU, duplicata: true }),
      ),
    )
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    await userEvent.click(await screen.findByRole('tab', { name: 'Notes encaissées' }))
    await userEvent.click(await screen.findByRole('button', { name: /n°42, T4/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Réimprimer le reçu' }))

    await vi.waitFor(() => {
      expect(imprimer).toHaveBeenCalledOnce()
    })
    expect(document.querySelector('.zone-impression')).toHaveTextContent('DUPLICATA')
    imprimer.mockRestore()
  })
})
