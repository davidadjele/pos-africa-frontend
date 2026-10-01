import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import { PLAN } from '../../../tests/commandes'
import { serveurMsw } from '../../../tests/serveurMsw'
import type {
  DemandeCloture,
  DemandeFondDeCaisse,
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
const AUCUN_REMBOURSEMENT = { total: 0, especes: 0, mobileMoney: 0, carte: 0 }
const ESPECES = {
  fond: 20_000,
  recues: 10_000,
  rendues: 4300,
  remboursements: 0,
  apports: 0,
  retraits: 10_000,
  depenses: 0,
  attendu: 15_700,
}
const SITUATION: SituationCaisse = {
  ouverture: OUVERTURE,
  ventes: {
    notes: 2,
    especes: 5700,
    mobileMoney: 2400,
    carte: 0,
    ardoise: 0,
    total: 8100,
    remboursements: AUCUN_REMBOURSEMENT,
  },
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
  especes: ESPECES,

  notesOuvertes: 1,
}
const Z: RapportZ = {
  numero: 12,
  ouverteLe: '2026-09-29T07:02:00Z',
  clotureeLe: '2026-09-29T23:14:00Z',
  clotureePar: 'Yawa T.',
  ventes: {
    ...SITUATION.ventes,
    ardoise: 2000,
    total: 10_100,
    remboursements: { total: 2600, especes: 1100, mobileMoney: 1500, carte: 0 },
  },
  remises: 0,
  annulations: 0,
  articlesAnnules: 0,
  tva: 1235,
  especes: {
    fond: 20_000,
    recues: 10_000,
    rendues: 4300,
    remboursements: 0,
    apports: 0,
    retraits: 10_000,
    depenses: 0,
    attendu: 15_700,
  },
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

  it('compte l’ardoise dans les ventes, sans rien attendre dans le tiroir', async () => {
    tiroirServi({ ...SITUATION, ventes: { ...SITUATION.ventes, ardoise: 13_500, total: 21_600 } })
    caisseOuverte('/caisse/tiroir', { permissions: GERANT })

    const ventes = await screen.findByRole('region', { name: 'Ventes de la caisse' })
    expect(ventes).toHaveTextContent('Ardoise13 500')
    expect(ventes).toHaveTextContent('Total vendu21 600 F')
    expect(screen.getByRole('region', { name: 'Espèces dans le tiroir' })).toHaveTextContent(
      'Attendu15 700 F',
    )
  })

  it('déduit les remboursements des ventes et, en espèces, de l’attendu', async () => {
    tiroirServi({
      ...SITUATION,
      ventes: {
        ...SITUATION.ventes,
        remboursements: { total: 4500, especes: 4500, mobileMoney: 0, carte: 0 },
      },
      especes: { ...ESPECES, remboursements: 4500, attendu: 11_200 },
    })
    caisseOuverte('/caisse/tiroir', { permissions: GERANT })

    const ventes = await screen.findByRole('region', { name: 'Ventes de la caisse' })
    expect(ventes).toHaveTextContent('Remboursements−4 500')
    expect(ventes).toHaveTextContent('Ventes nettes3 600 F')
    expect(ventes).toHaveTextContent('dont espèces4 500')
    expect(screen.getByRole('region', { name: 'Espèces dans le tiroir' })).toHaveTextContent(
      'Remboursements en espèces−4 500',
    )
  })

  it('renvoie au plan de salle un serveur qui prend la tablette sur l’écran de la caisse', async () => {
    tiroirServi()
    caisseOuverte('/caisse/tiroir', { permissions: ['COMMANDE_CREER'] })

    expect(await screen.findByRole('list', { name: 'Tables' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Ventes de la caisse' })).not.toBeInTheDocument()
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
    // Une section par question : combien vendu, pour information, le tiroir, le comptage.
    for (const section of ['Ventes', 'Pour information', 'Espèces du tiroir', 'Comptage']) {
      expect(within(z).getByRole('heading', { name: section })).toBeVisible()
    }
    expect(z).toHaveTextContent('Remboursements−2 600')
    expect(z).toHaveTextContent('dont espèces1 100')
    expect(z).toHaveTextContent('dont Mobile Money1 500')
    // Une note sur l'ardoise est vendue, pas encaissée.
    expect(z).toHaveTextContent('Ventes (2 notes)10 100')
    expect(z).toHaveTextContent('dont ardoise2 000')
    expect(z).toHaveTextContent('Ventes nettes7 500')
    // L'attendu s'explique sur le Z lui-même : fond, espèces reçues et rendues, mouvements.
    expect(z).toHaveTextContent('Fond de caisse20 000')
    expect(z).toHaveTextContent('Monnaie rendue−4 300')
    expect(z).toHaveTextContent('Retraits−10 000')
    expect(z).toHaveTextContent('Dépenses0')
    expect(z).toHaveTextContent('Espèces attendues15 700')
    expect(clotures).toEqual([
      { especesComptees: 15_000, fondLaisse: 20_000, explication: 'Monnaie rendue en trop' },
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Terminer' }))
    expect(await screen.findByRole('list', { name: 'Tables' })).toBeVisible()
  })

  it('fait recompter le fond à l’ouverture et expliquer un écart avec la dernière clôture', async () => {
    tiroirServi()
    const ouvertures: DemandeFondDeCaisse[] = []
    serveurMsw.use(
      http.get(`${API}/caisse/situation`, () =>
        HttpResponse.json({ statut: 409, code: 'CAISSE_FERMEE', message: 'x' }, { status: 409 }),
      ),
      http.get(`${API}/caisse/ouverture`, async () => {
        // L'état arrive après la situation, comme au retour d'une clôture.
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json({ operateurs: [], dernierFond: 20_000 })
      }),
      http.post(`${API}/caisse/ouverture`, async ({ request }) => {
        ouvertures.push((await request.json()) as DemandeFondDeCaisse)
        return HttpResponse.json({ ouverture: OUVERTURE, operateurs: [] })
      }),
    )
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    const billets = await screen.findByRole('textbox', {
      name: /^Nombre de billets de 10\s000\sF$/,
    })
    expect(screen.queryByText(/20\s000/)).not.toBeInTheDocument()
    await remplacer(billets, '1')
    await userEvent.click(screen.getByRole('button', { name: /^Un de plus : 5\s000\sF$/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Valider le comptage' }))

    const controle = screen.getByRole('region', { name: 'Contrôle du fond' })
    expect(controle).toHaveTextContent('Laissé à la clôture20 000 F')
    expect(controle).toHaveTextContent('Manque−5 000 F')
    const ouvrir = screen.getByRole('button', { name: /^Ouvrir la caisse avec 15\s000/ })
    expect(ouvrir).toBeDisabled()
    await userEvent.type(
      screen.getByRole('textbox', { name: /^Explication de l’écart/ }),
      'Monnaie prêtée au bar',
    )
    await userEvent.click(ouvrir)

    expect(ouvertures).toEqual([{ fond: 15_000, explication: 'Monnaie prêtée au bar' }])
  })

  it('ouvre sans explication quand le fond est celui laissé à la clôture', async () => {
    tiroirServi()
    serveurMsw.use(
      http.get(`${API}/caisse/situation`, () =>
        HttpResponse.json({ statut: 409, code: 'CAISSE_FERMEE', message: 'x' }, { status: 409 }),
      ),
      http.get(`${API}/caisse/ouverture`, () =>
        HttpResponse.json({ operateurs: [], dernierFond: 20_000 }),
      ),
    )
    caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })

    await remplacer(
      await screen.findByRole('textbox', { name: /^Nombre de billets de 10\s000\sF$/ }),
      '2',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Valider le comptage' }))

    expect(screen.getByRole('region', { name: 'Contrôle du fond' })).toHaveTextContent(
      'Caisse juste',
    )
    expect(screen.getByRole('button', { name: /^Ouvrir la caisse avec 20\s000/ })).toBeEnabled()
  })
})
