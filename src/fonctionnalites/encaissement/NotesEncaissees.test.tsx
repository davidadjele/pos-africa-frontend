import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type {
  DemandeRemboursement,
  EtatRemboursement,
  NoteEncaissee,
  SituationCaisse,
} from '../../partage/api/contrat'

const CAISSIER = ['COMMANDE_CREER', 'PAIEMENT_ENCAISSER', 'CAISSE_FERMER', 'CAISSE_OUVRIR']
const NOTE_42 = 'c0000000-0000-4000-8000-000000000042'
const POULETS = '1e000000-0000-4000-8000-000000000001'
const SITUATION: SituationCaisse = {
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
    total: 18_000,
    remboursements: { total: 0, especes: 0, mobileMoney: 0, carte: 0 },
  },
  mouvements: [],
  notesOuvertes: 0,
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
      nom: 'Poulet braisé',
      quantite: 2,
      montant: 9000,
      rembourses: 0,
      rembourse: 0,
    },
    {
      ligneId: '1e000000-0000-4000-8000-000000000002',
      nom: 'Flag 65 cl',
      quantite: 3,
      montant: 3600,
      rembourses: 0,
      rembourse: 0,
    },
  ],
  modes: [
    { mode: 'ESPECES', paye: 9000, rembourse: 0 },
    { mode: 'MOBILE_MONEY', operateur: 'FLOOZ', paye: 4500, rembourse: 0 },
  ],
  remboursements: [],
}
const REMBOURSEE: EtatRemboursement = {
  ...A_REMBOURSER,
  rembourse: 4500,
  remboursements: [
    {
      id: 'b0000000-0000-4000-8000-000000000001',
      mode: 'ESPECES',
      montant: 4500,
      motif: 'ARTICLE_NON_CONFORME',
      articles: [{ nom: 'Poulet braisé', quantite: 1 }],
      remboursePar: 'Yawa T.',
      approuvePar: 'Afi M.',
      rembourseLe: '2026-09-29T21:20:00Z',
    },
  ],
}

function notesServies() {
  const recus: DemandeRemboursement[] = []
  let etat = A_REMBOURSER
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
    const recus = notesServies()
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    await userEvent.click(await screen.findByRole('tab', { name: 'Notes encaissées' }))
    await userEvent.click(await screen.findByRole('button', { name: /n°42, T4/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Rembourser' }))

    const articles = screen.getByRole('list', { name: 'Articles à rembourser' })
    await userEvent.click(
      within(articles).getByRole('button', { name: 'Un Poulet braisé de plus' }),
    )
    expect(screen.getByRole('status', { name: 'À rembourser' })).toHaveTextContent('4 500 F')
    const modes = screen.getByRole('radiogroup', { name: 'Rendre l’argent en' })
    expect(within(modes).getByRole('radio', { name: /Espèces/ })).toBeChecked()
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
        mode: 'ESPECES',
        montant: 4500,
        articles: [{ ligneId: POULETS, quantite: 1 }],
        motif: 'ARTICLE_NON_CONFORME',
      },
      {
        id: recus[0]?.id,
        mode: 'ESPECES',
        montant: 4500,
        articles: [{ ligneId: POULETS, quantite: 1 }],
        motif: 'ARTICLE_NON_CONFORME',
        validationId: 'a1b20000-0000-4000-8000-000000000009',
      },
    ])
  })
})
