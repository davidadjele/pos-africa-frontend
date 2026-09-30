import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import { PLAN } from '../../../tests/commandes'
import { serveurMsw } from '../../../tests/serveurMsw'
import type {
  DemandeCloture,
  DemandeMouvement,
  RapportZ,
  SituationCaisse,
} from '../../partage/api/contrat'

const GERANT = [
  'COMMANDE_CREER',
  'PAIEMENT_ENCAISSER',
  'CAISSE_FERMER',
  'CAISSE_MOUVEMENT',
  'RAPPORT_FINANCIER',
]
const CAISSIER = ['COMMANDE_CREER', 'PAIEMENT_ENCAISSER', 'CAISSE_FERMER', 'CAISSE_OUVRIR']
const OUVERTURE = {
  id: 'ca155e00-0000-4000-8000-000000000001',
  fondInitial: 20_000,
  ouvertePar: 'Afi M.',
  ouverteLe: '2026-09-29T07:02:00Z',
}
const SITUATION: SituationCaisse = {
  ouverture: OUVERTURE,
  ventes: { notes: 2, especes: 5700, mobileMoney: 2400, carte: 0, total: 8100 },
  mouvements: [
    {
      id: 'b0b00000-0000-4000-8000-000000000001',
      type: 'RETRAIT',
      montant: 10_000,
      motif: 'Vers le coffre',
      effectuePar: 'Afi M.',
      effectueLe: '2026-09-29T15:30:00Z',
    },
  ],
  especes: {
    fond: 20_000,
    recues: 10_000,
    rendues: 4300,
    apports: 0,
    retraits: 10_000,
    depenses: 0,
    attendu: 15_700,
  },
  notesOuvertes: 1,
}
const Z: RapportZ = {
  numero: 12,
  ouverteLe: '2026-09-29T07:02:00Z',
  clotureeLe: '2026-09-29T23:14:00Z',
  clotureePar: 'Yawa T.',
  ventes: SITUATION.ventes,
  remises: 0,
  annulations: 0,
  articlesAnnules: 0,
  tva: 1235,
  attendu: 15_700,
  compte: 15_000,
  ecart: -700,
  explication: 'Monnaie rendue en trop',
  fondLaisse: 20_000,
}

function tiroirServi(situation: SituationCaisse = SITUATION) {
  serveurMsw.use(
    http.get(`${API}/caisse/situation`, () => HttpResponse.json(situation)),
    http.get(`${API}/caisse/ouverture`, () =>
      HttpResponse.json({ ouverture: OUVERTURE, operateurs: [] }),
    ),
    http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)),
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
        { id: 'a1b20000-0000-4000-8000-000000000009', expireLe: '2026-09-29T21:11:00Z' },
        { status: 201 },
      ),
    ),
  )
}

async function remplacer(champ: HTMLElement, valeur: string) {
  await userEvent.clear(champ)
  await userEvent.type(champ, valeur)
}

describe('Caisse de la tablette', () => {
  it('montre au gérant les ventes, les mouvements et les espèces attendues', async () => {
    tiroirServi()
    caisseOuverte('/caisse/tiroir', { permissions: GERANT })

    const ventes = await screen.findByRole('region', { name: 'Ventes de la caisse' })
    expect(ventes).toHaveTextContent('2 notes encaissées')
    expect(ventes).toHaveTextContent('Espèces5 700')
    expect(ventes).toHaveTextContent('Total encaissé8 100 F')
    expect(ventes).toHaveTextContent('RetraitVers le coffre')
    const especes = screen.getByRole('region', { name: 'Espèces dans le tiroir' })
    expect(especes).toHaveTextContent('Attendu15 700 F')
    expect(screen.getByText('1 note encore ouverte dans l’établissement.')).toBeVisible()
  })

  it('cache les espèces attendues au caissier', async () => {
    const sansEspeces: SituationCaisse = {
      ouverture: SITUATION.ouverture,
      ventes: SITUATION.ventes,
      mouvements: SITUATION.mouvements,
      notesOuvertes: SITUATION.notesOuvertes,
    }
    tiroirServi(sansEspeces)
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    expect(await screen.findByRole('region', { name: 'Ventes de la caisse' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Espèces dans le tiroir' })).not.toBeInTheDocument()
    expect(screen.getByText(/réservé au gérant/)).toBeVisible()
  })

  it('fait valider par un gérant la dépense d’un caissier', async () => {
    tiroirServi()
    const recues: DemandeMouvement[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/mouvements`, async ({ request }) => {
        const demande = (await request.json()) as DemandeMouvement
        recues.push(demande)
        return demande.validationId === undefined
          ? HttpResponse.json(
              { statut: 403, code: 'VALIDATION_REQUISE', message: 'x' },
              { status: 403 },
            )
          : HttpResponse.json(SITUATION)
      }),
    )
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    await userEvent.click(await screen.findByRole('button', { name: /Mouvement de caisse/ }))
    const dialogue = screen.getByRole('dialog', { name: 'Mouvement de caisse' })
    await userEvent.click(within(dialogue).getByRole('radio', { name: /Dépense/ }))
    await userEvent.type(within(dialogue).getByRole('textbox', { name: /^Montant/ }), '2500')
    await userEvent.type(within(dialogue).getByRole('textbox', { name: /^Motif/ }), 'Glace')
    await userEvent.click(
      within(dialogue).getByRole('button', { name: /^Sortir 2\s500\sF du tiroir/ }),
    )

    const validation = await screen.findByRole('dialog', { name: /^Dépense de 2\s500\sF/ })
    await userEvent.click(await within(validation).findByRole('button', { name: /Afi M\./ }))
    for (const chiffre of '5937') {
      await userEvent.click(within(validation).getByRole('button', { name: chiffre }))
    }
    await userEvent.click(within(validation).getByRole('button', { name: 'Valider' }))

    await screen.findByRole('region', { name: 'Ventes de la caisse' })
    expect(recues).toEqual([
      { type: 'DEPENSE', montant: 2500, motif: 'Glace' },
      {
        type: 'DEPENSE',
        montant: 2500,
        motif: 'Glace',
        validationId: 'a1b20000-0000-4000-8000-000000000009',
      },
    ])
  })

  it('clôture : compte à l’aveugle, explique l’écart, puis donne le rapport Z', async () => {
    tiroirServi()
    const clotures: DemandeCloture[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/cloture/comptage`, () =>
        HttpResponse.json({ compte: 15_000, attendu: 15_700, ecart: -700, notesOuvertes: 1 }),
      ),
      http.post(`${API}/caisse/cloture`, async ({ request }) => {
        clotures.push((await request.json()) as DemandeCloture)
        return HttpResponse.json(Z)
      }),
    )
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    await userEvent.click(await screen.findByRole('button', { name: 'Clôturer la caisse' }))
    expect(screen.queryByText(/Attendu/)).not.toBeInTheDocument()
    await remplacer(screen.getByRole('textbox', { name: /^Nombre de billets de 10\s000\sF$/ }), '1')
    await userEvent.click(screen.getByRole('button', { name: /^Un de plus : 5\s000\sF$/ }))
    expect(screen.getByRole('status', { name: 'Espèces comptées' })).toHaveTextContent('15 000 F')
    await userEvent.click(screen.getByRole('button', { name: 'Valider le comptage' }))

    const ecart = await screen.findByRole('region', { name: 'Écart' })
    expect(ecart).toHaveTextContent('Attendu15 700 F')
    expect(ecart).toHaveTextContent('Manque−700 F')
    expect(screen.getByRole('button', { name: 'Clôturer la caisse' })).toBeDisabled()
    await userEvent.type(
      screen.getByRole('textbox', { name: /^Explication de l’écart/ }),
      'Monnaie rendue en trop',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Clôturer la caisse' }))

    const z = await screen.findByRole('region', { name: 'Rapport Z n°12' })
    expect(z).toHaveTextContent('Écart−700')
    expect(clotures).toEqual([
      { especesComptees: 15_000, fondLaisse: 20_000, explication: 'Monnaie rendue en trop' },
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Terminer' }))
    expect(await screen.findByRole('list', { name: 'Tables' })).toBeVisible()
  })

  it('propose de rouvrir la caisse fermée avec le fond laissé à la clôture', async () => {
    tiroirServi()
    serveurMsw.use(
      http.get(`${API}/caisse/situation`, () =>
        HttpResponse.json({ statut: 409, code: 'CAISSE_FERMEE', message: 'x' }, { status: 409 }),
      ),
      http.get(`${API}/caisse/ouverture`, async () => {
        // L'état arrive après la situation, comme au retour d'une clôture.
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json({ operateurs: [], dernierFond: 20_000 })
      }),
    )
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    expect(
      await screen.findByText(/À la dernière clôture, 20\s000\sF ont été laissés en fond/),
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: /^Fond de caisse/ })).toHaveValue('20000')
  })
})
