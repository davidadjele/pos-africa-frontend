import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import {
  FLAG,
  FLAG_ENVOYE,
  NOTE_T4,
  PLAN,
  POULET,
  POULET_A_ENVOYER,
} from '../../../tests/commandes'
import { serveurMsw } from '../../../tests/serveurMsw'
import { KOMLAN_EN_CAISSE, YAO_EN_CAISSE } from '../ardoise/fixtures'
import { RECU } from './fixturesRecu'
import type {
  ClientEnCaisse,
  DemandeClient,
  DemandeEnvoiRecu,
  DemandeFondDeCaisse,
  DemandePaiement,
  DemandePartage,
  EtatCaisse,
  EtatEncaissement,
  RecuCaisse,
} from '../../partage/api/contrat'

const CAISSIER = ['COMMANDE_CREER', 'PAIEMENT_ENCAISSER', 'CAISSE_OUVRIR']
const OPERATEURS = [
  { code: 'FLOOZ', libelle: 'Flooz (Moov Africa)' },
  { code: 'TMONEY', libelle: 'T-Money (Yas)' },
  { code: 'AUTRE', libelle: 'Autre opérateur' },
]
const CAISSE_OUVERTE: EtatCaisse = {
  ouverture: {
    id: 'ca155e00-0000-4000-8000-000000000001',
    fondInitial: 20_000,
    ouvertePar: 'Yawa T.',
    ouverteLe: '2026-09-29T07:02:00Z',
  },
  pays: 'TG',
  operateurs: OPERATEURS,
}
const A_PAYER: EtatEncaissement = {
  commandeId: NOTE_T4.id,
  numero: 42,
  total: 10_200,
  paye: 0,
  reste: 10_200,
  payee: false,
  partsPayees: 0,
  articles: [
    {
      ligneId: FLAG_ENVOYE.id,
      nom: 'Flag 65 cl',
      quantite: 1,
      montant: 1200,
      payees: 0,
      paye: 0,
    },
    {
      ligneId: POULET_A_ENVOYER.id,
      nom: 'Poulet braisé',
      quantite: 2,
      montant: 9000,
      payees: 0,
      paye: 0,
    },
  ],
  paiements: [],
}
const FLOOZ = {
  id: 'fa000000-0000-4000-8000-000000000001',
  mode: 'MOBILE_MONEY' as const,
  montant: 5000,
  monnaieRendue: 0,
  operateur: 'FLOOZ',
  reference: '7F3K29',
  encaissePar: 'Yawa T.',
  encaisseLe: '2026-09-29T20:42:00Z',
  part: false,
  articles: [],
}

function encaissementServi(
  caisse: EtatCaisse = CAISSE_OUVERTE,
  permissions = CAISSIER,
  etat: EtatEncaissement = A_PAYER,
  recu: RecuCaisse = RECU,
) {
  serveurMsw.use(
    http.get(`${API}/caisse/commandes/${NOTE_T4.id}`, () => HttpResponse.json(NOTE_T4)),
    http.get(`${API}/caisse/commandes/${NOTE_T4.id}/encaissement`, () => HttpResponse.json(etat)),
    http.get(`${API}/caisse/ouverture`, () => HttpResponse.json(caisse)),
    http.get(`${API}/caisse/carte`, () => HttpResponse.json([FLAG, POULET])),
    http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)),
    http.get(`${API}/caisse/commandes/${NOTE_T4.id}/recu`, () => HttpResponse.json(recu)),
  )
  caisseOuverte(`/caisse/notes/${NOTE_T4.id}/encaisser`, { permissions })
}

/** Répond aux paiements, dans l'ordre, par les états donnés, et retient ce qui a été envoyé. */
function paiements(...etats: EtatEncaissement[]) {
  const recus: DemandePaiement[] = []
  serveurMsw.use(
    http.post(`${API}/caisse/commandes/${NOTE_T4.id}/paiements`, async ({ request }) => {
      recus.push((await request.json()) as DemandePaiement)
      return HttpResponse.json(etats[recus.length - 1])
    }),
  )
  return recus
}

async function remplacer(champ: HTMLElement, valeur: string) {
  await userEvent.clear(champ)
  await userEvent.type(champ, valeur)
}

describe('EcranEncaissement', () => {
  it('fait ouvrir la caisse avec son fond avant d’encaisser', async () => {
    const recues: DemandeFondDeCaisse[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/ouverture`, async ({ request }) => {
        recues.push((await request.json()) as DemandeFondDeCaisse)
        return HttpResponse.json(CAISSE_OUVERTE)
      }),
    )
    encaissementServi({ pays: 'TG', operateurs: OPERATEURS })

    expect(
      await screen.findByRole('heading', { name: 'La caisse de cette tablette n’est pas ouverte' }),
    ).toBeVisible()
    await remplacer(screen.getByRole('textbox', { name: /^Nombre de billets de 10\s000\sF$/ }), '2')
    await userEvent.click(screen.getByRole('button', { name: /^Ouvrir la caisse avec 20\s000/ }))

    expect(await screen.findByRole('radiogroup', { name: 'Mode de paiement' })).toBeVisible()
    expect(recues).toEqual([{ fond: 20_000 }])
  })

  it('encaisse en Mobile Money puis en espèces, et dit la monnaie à rendre', async () => {
    const recus = paiements(
      { ...A_PAYER, paye: 5000, reste: 5200, paiements: [FLOOZ] },
      {
        ...A_PAYER,
        paye: 10_200,
        reste: 0,
        payee: true,
        paiements: [
          FLOOZ,
          {
            id: 'fa000000-0000-4000-8000-000000000002',
            mode: 'ESPECES',
            montant: 5200,
            montantRecu: 10_000,
            monnaieRendue: 4800,
            encaissePar: 'Yawa T.',
            encaisseLe: '2026-09-29T20:43:00Z',
            part: false,
            articles: [],
          },
        ],
      },
    )
    encaissementServi()

    const modes = await screen.findByRole('radiogroup', { name: 'Mode de paiement' })
    expect(within(modes).getAllByRole('radio')).toHaveLength(4)
    await userEvent.click(within(modes).getByRole('radio', { name: /Mobile Money/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'Flooz (Moov Africa)' }))
    await remplacer(screen.getByRole('textbox', { name: /^Montant payé/ }), '5000')
    await userEvent.type(
      screen.getByRole('textbox', { name: /^Référence de la transaction/ }),
      '7F3K29',
    )
    await userEvent.click(
      screen.getByRole('button', { name: /^Valider 5\s000\sF en Mobile Money/ }),
    )

    const recap = await screen.findByRole('region', { name: 'Note à encaisser' })
    expect(await within(recap).findByText(/Flooz \(Moov Africa\), réf\. 7F3K29/)).toBeVisible()
    expect(recap).toHaveTextContent('Reste à payer5 200 F')

    await userEvent.click(within(modes).getByRole('radio', { name: /Espèces/ }))
    await userEvent.click(screen.getByRole('button', { name: /^10\s000$/ }))
    expect(screen.getByRole('status', { name: 'Monnaie à rendre' })).toHaveTextContent('4 800 F')
    await userEvent.click(screen.getByRole('button', { name: /^Valider 5\s200\sF en espèces/ }))

    expect(await screen.findByRole('heading', { name: 'T4 est libre' })).toBeVisible()
    expect(screen.getByRole('status', { name: 'Monnaie à rendre' })).toHaveTextContent('4 800 F')
    expect(recus).toEqual([
      {
        id: expect.any(String) as string,
        mode: 'MOBILE_MONEY',
        montant: 5000,
        operateur: 'FLOOZ',
        reference: '7F3K29',
      },
      { id: expect.any(String) as string, mode: 'ESPECES', montant: 5200, montantRecu: 10_000 },
    ])
    expect(recus[0]?.id).not.toBe(recus[1]?.id)

    await userEvent.click(await screen.findByRole('button', { name: 'Sans reçu' }))
    expect(await screen.findByRole('list', { name: 'Tables' })).toBeVisible()
  })

  it('partage l’addition en parts égales, proposées d’après les couverts', async () => {
    const partages: DemandePartage[] = []
    const enTrois = { ...A_PAYER, parts: 3, montantPart: 3400 }
    serveurMsw.use(
      http.put(`${API}/caisse/commandes/${NOTE_T4.id}/partage`, async ({ request }) => {
        const demande = (await request.json()) as DemandePartage
        partages.push(demande)
        return HttpResponse.json(
          demande.parts === 4 ? { ...A_PAYER, parts: 4, montantPart: 2550 } : enTrois,
        )
      }),
    )
    const recus = paiements({
      ...enTrois,
      paye: 3400,
      reste: 6800,
      partsPayees: 1,
      paiements: [
        {
          ...FLOOZ,
          mode: 'ESPECES',
          montant: 3400,
          montantRecu: 5000,
          monnaieRendue: 1600,
          part: true,
        },
      ],
    })
    encaissementServi()

    const partage = await screen.findByRole('radiogroup', { name: 'Partager l’addition' })
    await userEvent.click(within(partage).getByRole('radio', { name: /Parts égales/ }))
    const parts = await screen.findByRole('list', { name: 'Parts' })
    expect(parts).toHaveTextContent('Part 1En cours3 400')
    expect(parts).toHaveTextContent('Part 3À payer3 400')
    expect(screen.queryByRole('textbox', { name: /^Montant payé/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Une part de plus' }))
    expect(await within(parts).findByText('Part 4')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Une part de moins' }))
    await remplacer(screen.getByRole('textbox', { name: /^Espèces reçues/ }), '5000')
    await userEvent.click(screen.getByRole('button', { name: /^Valider 3\s400\sF en espèces/ }))

    const recap = screen.getByRole('region', { name: 'Note à encaisser' })
    expect(await within(recap).findByText(/Part 1, espèces/)).toBeVisible()
    expect(partages).toEqual([{ parts: 3 }, { parts: 4 }, { parts: 3 }])
    expect(recus).toEqual([
      {
        id: expect.any(String) as string,
        mode: 'ESPECES',
        montant: 3400,
        montantRecu: 5000,
        part: true,
      },
    ])
  })

  it('fait payer à chacun ses articles', async () => {
    const recus = paiements({
      ...A_PAYER,
      paye: 4500,
      reste: 5700,
      paiements: [
        {
          id: 'fa000000-0000-4000-8000-000000000003',
          mode: 'CARTE',
          montant: 4500,
          monnaieRendue: 0,
          encaissePar: 'Yawa T.',
          encaisseLe: '2026-09-29T20:44:00Z',
          part: false,
          articles: [{ nom: 'Poulet braisé', quantite: 1 }],
        },
      ],
    })
    encaissementServi()

    const partage = await screen.findByRole('radiogroup', { name: 'Partager l’addition' })
    await userEvent.click(within(partage).getByRole('radio', { name: /Par articles/ }))
    const articles = screen.getByRole('list', { name: 'Articles à payer' })
    await userEvent.click(
      within(articles).getByRole('button', { name: 'Un Poulet braisé de plus' }),
    )
    expect(screen.getByRole('status', { name: 'Sélection' })).toHaveTextContent('4 500 F')
    await userEvent.click(screen.getByRole('radio', { name: /Carte/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Valider 4\s500\sF en carte/ }))

    const recap = screen.getByRole('region', { name: 'Note à encaisser' })
    expect(await within(recap).findByText(/1× Poulet braisé, carte/)).toBeVisible()
    expect(recus).toEqual([
      {
        id: expect.any(String) as string,
        mode: 'CARTE',
        montant: 4500,
        articles: [{ ligneId: POULET_A_ENVOYER.id, quantite: 1 }],
      },
    ])
  })

  it('refuse des espèces qui ne couvrent pas le montant', async () => {
    const recus = paiements(A_PAYER)
    encaissementServi()

    await remplacer(await screen.findByRole('textbox', { name: /^Espèces reçues/ }), '5000')

    expect(screen.getByText('Il manque 5 200 F.')).toBeVisible()
    expect(screen.getByRole('button', { name: /^Valider/ })).toBeDisabled()
    expect(recus).toEqual([])
  })

  it('dit ce qui manque pour valider un paiement Mobile Money', async () => {
    encaissementServi()

    const modes = await screen.findByRole('radiogroup', { name: 'Mode de paiement' })
    await userEvent.click(within(modes).getByRole('radio', { name: /Mobile Money/ }))

    expect(screen.getByRole('button', { name: /^Valider/ })).toBeDisabled()
    expect(
      screen.getByText('Pour valider : choisissez l’opérateur, recopiez la référence.'),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('radio', { name: 'Flooz (Moov Africa)' }))
    expect(screen.getByText('Pour valider : recopiez la référence.')).toBeVisible()
  })

  it('choisit d’office le seul opérateur proposé', async () => {
    encaissementServi({
      ...CAISSE_OUVERTE,
      operateurs: [{ code: 'AUTRE', libelle: 'Autre opérateur' }],
    })

    const modes = await screen.findByRole('radiogroup', { name: 'Mode de paiement' })
    await userEvent.click(within(modes).getByRole('radio', { name: /Mobile Money/ }))
    await userEvent.type(
      screen.getByRole('textbox', { name: /^Référence de la transaction/ }),
      'GN-4471',
    )

    expect(screen.getByRole('radio', { name: 'Autre opérateur' })).toBeChecked()
    expect(screen.getByRole('button', { name: /^Valider/ })).toBeEnabled()
  })

  it('tape le montant au clavier de la caisse', async () => {
    encaissementServi()

    const clavier = await screen.findByRole('group', { name: 'Clavier' })
    await userEvent.click(
      within(clavier).getByRole('button', { name: 'Effacer le dernier chiffre' }),
    )
    await userEvent.click(within(clavier).getByRole('button', { name: '000' }))

    expect(screen.getByRole('textbox', { name: /^Espèces reçues/ })).toHaveValue('1020000')
  })

  it('renvoie à la note un serveur qui prend la tablette sur l’encaissement', async () => {
    encaissementServi(CAISSE_OUVERTE, ['COMMANDE_CREER'])

    expect(await screen.findByRole('region', { name: 'Note en cours' })).toBeVisible()
    expect(screen.queryByRole('radiogroup', { name: 'Mode de paiement' })).not.toBeInTheDocument()
  })

  it('ne propose pas d’ouvrir la caisse à qui n’en a pas le droit', async () => {
    encaissementServi({ pays: 'TG', operateurs: OPERATEURS }, [
      'COMMANDE_CREER',
      'PAIEMENT_ENCAISSER',
    ])

    expect(
      await screen.findByText('Un caissier ou un gérant ouvre la caisse avec son code.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Ouvrir la caisse/ })).not.toBeInTheDocument()
  })
})

describe('Encaisser sur l’ardoise', () => {
  const GERANT = [...CAISSIER, 'CLIENT_CREDIT']
  const SUR_ARDOISE: EtatEncaissement = {
    ...A_PAYER,
    paye: 10_200,
    reste: 0,
    payee: true,
    paiements: [
      {
        id: 'fa000000-0000-4000-8000-000000000009',
        mode: 'ARDOISE',
        montant: 10_200,
        monnaieRendue: 0,
        encaissePar: 'Afi M.',
        encaisseLe: '2026-09-29T21:05:00Z',
        part: false,
        articles: [],
        client: 'Komlan D.',
      },
    ],
  }

  function clientsServis(clients: ClientEnCaisse[] = [KOMLAN_EN_CAISSE, YAO_EN_CAISSE]) {
    const crees: DemandeClient[] = []
    serveurMsw.use(
      http.get(`${API}/caisse/clients`, () => HttpResponse.json(clients)),
      http.post(`${API}/caisse/clients`, async ({ request }) => {
        const demande = (await request.json()) as DemandeClient
        crees.push(demande)
        return HttpResponse.json(
          { id: 'c0000000-0000-4000-8000-000000000099', nom: demande.nom, solde: 0 },
          { status: 201 },
        )
      }),
    )
    return crees
  }

  async function choisirArdoise() {
    await userEvent.click(await screen.findByRole('radio', { name: /Ardoise/ }))
    return screen.findByRole('radiogroup', { name: 'Client' })
  }

  it('met la note sur l’ardoise d’un client et montre ce qu’il devra', async () => {
    clientsServis()
    encaissementServi(CAISSE_OUVERTE, GERANT)
    const recus = paiements(SUR_ARDOISE)

    const clients = await choisirArdoise()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Chercher un client' }), 'kom')
    expect(within(clients).queryByRole('radio', { name: /Yao S\./ })).not.toBeInTheDocument()
    await userEvent.click(within(clients).getByRole('radio', { name: /Komlan D\./ }))

    const resume = screen.getByRole('region', { name: 'Ardoise de Komlan D.' })
    expect(resume).toHaveTextContent(/Doit déjà4\s500/)
    expect(resume).toHaveTextContent(/Cette note\+\s?10\s200/)
    expect(resume).toHaveTextContent(/Doit après14\s700\sF/)
    expect(resume).toHaveTextContent(/14\s700 sur un plafond de 25\s000\sF/)
    await userEvent.click(
      screen.getByRole('button', { name: /^Mettre 10\s200\sF sur l’ardoise de Komlan D\./ }),
    )

    expect(await screen.findByText('Note encaissée')).toBeInTheDocument()
    expect(recus).toEqual([
      {
        id: expect.any(String) as string,
        mode: 'ARDOISE',
        montant: 10_200,
        clientId: KOMLAN_EN_CAISSE.id,
      },
    ])
    // Le reçu partira au numéro du client, sans indicatif puisque c'est celui du pays.
    expect(screen.getByLabelText('Numéro WhatsApp du client')).toHaveValue('90123456')
  })

  it('demande de confirmer le dépassement du plafond', async () => {
    clientsServis([{ ...KOMLAN_EN_CAISSE, solde: 20_000 }])
    encaissementServi(CAISSE_OUVERTE, GERANT)
    const recus = paiements(SUR_ARDOISE)

    const clients = await choisirArdoise()
    await userEvent.click(within(clients).getByRole('radio', { name: /Komlan D\./ }))

    expect(screen.getByRole('alert')).toHaveTextContent(/Plafond dépassé de 5\s200\sF/)
    await userEvent.click(
      screen.getByRole('button', { name: /^Dépasser le plafond : 10\s200\sF sur l’ardoise/ }),
    )

    await screen.findByText('Note encaissée')
    expect(recus[0]).toMatchObject({ mode: 'ARDOISE', depasserPlafond: true })
  })

  it('fait valider par un gérant l’ardoise d’un caissier', async () => {
    clientsServis()
    encaissementServi()
    const recus: DemandePaiement[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/paiements`, async ({ request }) => {
        const demande = (await request.json()) as DemandePaiement
        recus.push(demande)
        return demande.validationId === undefined
          ? HttpResponse.json(
              { statut: 403, code: 'VALIDATION_REQUISE', message: 'x' },
              { status: 403 },
            )
          : HttpResponse.json(SUR_ARDOISE)
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

    const clients = await choisirArdoise()
    // Seul qui peut vendre à crédit ouvre une ardoise depuis la caisse.
    expect(screen.queryByRole('button', { name: 'Nouveau client' })).not.toBeInTheDocument()
    await userEvent.click(within(clients).getByRole('radio', { name: /Yao S\./ }))
    await userEvent.click(screen.getByRole('button', { name: /^Mettre 10\s200\sF sur l’ardoise/ }))

    const validation = await screen.findByRole('dialog', { name: /ardoise de Yao S\./ })
    await userEvent.click(await within(validation).findByRole('button', { name: /Afi M\./ }))
    for (const chiffre of '5937') {
      await userEvent.click(within(validation).getByRole('button', { name: chiffre }))
    }
    await userEvent.click(within(validation).getByRole('button', { name: 'Valider' }))

    await screen.findByText('Note encaissée')
    expect(recus[1]).toMatchObject({
      clientId: YAO_EN_CAISSE.id,
      validationId: 'a1b20000-0000-4000-8000-000000000009',
    })
    // Le même paiement repart : un réseau lent ne le compte pas deux fois.
    expect(recus[1]?.id).toBe(recus[0]?.id)
  })

  it('ouvre une ardoise à un nouveau client sans quitter l’encaissement', async () => {
    const crees = clientsServis()
    encaissementServi(CAISSE_OUVERTE, GERANT)

    await choisirArdoise()
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau client' }))
    const dialogue = screen.getByRole('dialog', { name: 'Nouveau client' })
    expect(within(dialogue).queryByLabelText(/Note interne/)).not.toBeInTheDocument()
    expect(within(dialogue).getByText('+228')).toBeVisible()
    await userEvent.type(within(dialogue).getByLabelText(/^Nom/), 'Akossiwa M.')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ouvrir l’ardoise' }))

    expect(await screen.findByRole('region', { name: 'Ardoise de Akossiwa M.' })).toBeVisible()
    expect(crees).toEqual([{ nom: 'Akossiwa M.' }])
  })
})

describe('Reçu de fin d’encaissement', () => {
  const PAYEE: EtatEncaissement = { ...A_PAYER, paye: 10_200, reste: 0, payee: true }

  function payerToutEnCarte(recu: RecuCaisse = RECU) {
    encaissementServi(CAISSE_OUVERTE, CAISSIER, A_PAYER, recu)
    paiements(PAYEE)
    const impressions: string[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/recu/impressions`, () => {
        impressions.push('impression')
        return HttpResponse.json({ ...recu, duplicata: impressions.length > 1 })
      }),
    )
    return impressions
  }

  function envoisServis() {
    const envois: DemandeEnvoiRecu[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/recu/envois`, async ({ request }) => {
        envois.push((await request.json()) as DemandeEnvoiRecu)
        return HttpResponse.json({ telephone: '+22890112345' })
      }),
    )
    return envois
  }

  async function encaisser() {
    await userEvent.click(await screen.findByRole('radio', { name: /Carte/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Valider 10\s200\sF en carte/ }))
  }

  it('montre le reçu numéroté et l’imprime à la demande', async () => {
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const impressions = payerToutEnCarte()

    await encaisser()

    expect(await screen.findByRole('heading', { name: 'Reçu n° BE-000127' })).toBeVisible()
    const ticket = screen.getByRole('article', { name: 'Reçu BE-000127' })
    expect(ticket).toHaveTextContent('Maquis Chez Tanti')
    expect(ticket).toHaveTextContent('NIF 1000123456')
    expect(ticket).toHaveTextContent(/2× Poulet braisé9\s000/)
    expect(ticket).toHaveTextContent(/TOTAL10\s200\sF/)
    expect(ticket).toHaveTextContent(/dont TVA 18\s%1\s556/)
    expect(ticket).toHaveTextContent('Flooz (Moov Africa), réf. 7F3K29')
    expect(ticket).toHaveTextContent(/reçu 10\s000, rendu 4\s800/)
    expect(ticket).toHaveTextContent('Merci et à bientôt !')
    expect(imprimer).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Imprimer le reçu' }))

    await vi.waitFor(() => {
      expect(imprimer).toHaveBeenCalledOnce()
    })
    expect(impressions).toHaveLength(1)
    imprimer.mockRestore()
  })

  it('imprime d’office quand l’établissement le demande', async () => {
    const imprimer = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const impressions = payerToutEnCarte({ ...RECU, impressionAuto: true })

    await encaisser()

    await vi.waitFor(() => {
      expect(imprimer).toHaveBeenCalledOnce()
    })
    expect(impressions).toHaveLength(1)
    imprimer.mockRestore()
  })

  it('envoie le lien du reçu par WhatsApp au numéro saisi, lu dans le pays de l’entreprise', async () => {
    const ouvrirFenetre = vi.spyOn(window, 'open').mockImplementation(() => null)
    payerToutEnCarte()
    const envois = envoisServis()

    await encaisser()
    const envoi = await screen.findByRole('group', { name: 'Envoyer par WhatsApp' })
    expect(within(envoi).getByText('+228')).toBeVisible()
    await userEvent.type(within(envoi).getByLabelText('Numéro WhatsApp du client'), '90 11 23 45')
    await userEvent.click(within(envoi).getByRole('button', { name: 'Envoyer' }))

    await vi.waitFor(() => {
      expect(ouvrirFenetre).toHaveBeenCalledOnce()
    })
    expect(envois).toEqual([{ telephone: '90 11 23 45' }])
    const [lien, cible] = ouvrirFenetre.mock.calls[0] ?? []
    expect(cible).toBe('_blank')
    expect(decodeURIComponent(String(lien))).toBe(
      `https://wa.me/22890112345?text=Votre reçu BE-000127 de Maquis Chez Tanti : ${window.location.origin}/r/${RECU.jeton}`,
    )
    expect(screen.getByRole('status', { name: 'Envoi WhatsApp' })).toHaveTextContent(
      'WhatsApp est ouvert : il reste à envoyer le message.',
    )
    ouvrirFenetre.mockRestore()
  })

  it('place sous le champ un numéro refusé, sans ouvrir WhatsApp', async () => {
    const ouvrirFenetre = vi.spyOn(window, 'open').mockImplementation(() => null)
    payerToutEnCarte()
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/recu/envois`, () =>
        HttpResponse.json(
          {
            statut: 400,
            code: 'REQUETE_INVALIDE',
            message: 'Requête invalide.',
            traceId: 't',
            champs: [{ champ: 'telephone', message: 'Ce numéro n’existe pas.' }],
          },
          { status: 400 },
        ),
      ),
    )

    await encaisser()
    const envoi = await screen.findByRole('group', { name: 'Envoyer par WhatsApp' })
    await userEvent.type(within(envoi).getByLabelText('Numéro WhatsApp du client'), '123')
    await userEvent.click(within(envoi).getByRole('button', { name: 'Envoyer' }))

    expect(await within(envoi).findByText('Ce numéro n’existe pas.')).toBeVisible()
    expect(ouvrirFenetre).not.toHaveBeenCalled()
    ouvrirFenetre.mockRestore()
  })

  it('repart au plan sans reçu', async () => {
    const impressions = payerToutEnCarte()

    await encaisser()
    await userEvent.click(await screen.findByRole('button', { name: 'Sans reçu' }))

    expect(await screen.findByRole('list', { name: 'Tables' })).toBeVisible()
    expect(impressions).toHaveLength(0)
  })
})
