import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import { PLAN } from '../../../tests/commandes'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { ClientEnCaisse, DemandeReglement, SituationCaisse } from '../../partage/api/contrat'
import { ilYA, KOMLAN_EN_CAISSE, YAO_EN_CAISSE } from '../ardoise/fixtures'

const CAISSIER = ['COMMANDE_CREER', 'PAIEMENT_ENCAISSER', 'CAISSE_FERMER']
const OUVERTURE = {
  id: 'ca155e00-0000-4000-8000-000000000001',
  fondInitial: 20_000,
  ouvertePar: 'Yawa T.',
  ouverteLe: '2026-09-29T07:02:00Z',
}
const VIDE = { total: 0, especes: 0, mobileMoney: 0, carte: 0 }
const SITUATION: SituationCaisse = {
  ouverture: OUVERTURE,
  ventes: {
    notes: 0,
    especes: 0,
    mobileMoney: 0,
    carte: 0,
    ardoise: 0,
    total: 0,
    remboursements: { ...VIDE, ardoise: 0 },
  },
  reglementsArdoise: VIDE,
  mouvements: [],
  notesOuvertes: 0,
}
const KOMLAN: ClientEnCaisse = { ...KOMLAN_EN_CAISSE, solde: 18_000, detteDepuis: ilYA(45) }
const AMA: ClientEnCaisse = { id: 'c0000000-0000-4000-8000-000000000003', nom: 'Ama K.', solde: 0 }

function ardoisesServies() {
  const recus: DemandeReglement[] = []
  serveurMsw.use(
    http.get(`${API}/caisse/situation`, () => HttpResponse.json(SITUATION)),
    http.get(`${API}/caisse/ouverture`, () =>
      HttpResponse.json({
        ouverture: OUVERTURE,
        pays: 'TG',
        operateurs: [{ code: 'FLOOZ', libelle: 'Flooz (Moov Africa)' }],
      }),
    ),
    http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)),
    http.get(`${API}/caisse/clients`, () => HttpResponse.json([AMA, KOMLAN, YAO_EN_CAISSE])),
    http.post(`${API}/caisse/clients/:id/reglements`, async ({ request }) => {
      const demande = (await request.json()) as DemandeReglement
      recus.push(demande)
      return HttpResponse.json({ ...KOMLAN, solde: KOMLAN.solde - demande.montant })
    }),
  )
  caisseOuverte('/caisse/tiroir', { permissions: CAISSIER })
  return recus
}

async function choisir(nom: RegExp) {
  await userEvent.click(await screen.findByRole('tab', { name: 'Ardoises' }))
  const clients = await screen.findByRole('list', { name: 'Clients qui doivent' })
  await userEvent.click(within(clients).getByRole('button', { name: nom }))
  return screen.getByRole('region', { name: /^Règlement de/ })
}

describe('Ardoises de la caisse', () => {
  it('liste les clients qui doivent, la plus ancienne dette en tête', async () => {
    ardoisesServies()

    await userEvent.click(await screen.findByRole('tab', { name: 'Ardoises' }))
    const clients = await screen.findByRole('list', { name: 'Clients qui doivent' })
    const boutons = within(clients).getAllByRole('button')
    expect(boutons.map((bouton) => bouton.textContent)).toEqual([
      expect.stringMatching(/^Komlan D\..*Depuis 45 jours.*18\s000/) as string,
      expect.stringMatching(/^Yao S\..*12\s000/) as string,
    ])
    expect(screen.getByText(/2 clients doivent/)).toHaveTextContent(/30\s000\sF/)
  })

  it('encaisse un règlement partiel en espèces et dit ce qui reste dû', async () => {
    const recus = ardoisesServies()

    const reglement = await choisir(/Komlan D\./)
    expect(reglement).toHaveTextContent(/Doit 18\s000\sF/)
    await userEvent.type(
      within(reglement).getByRole('textbox', { name: /^Montant réglé/ }),
      '10000',
    )
    expect(reglement).toHaveTextContent(/Doit après8\s000\sF/)
    await userEvent.click(
      within(reglement).getByRole('button', { name: /^Encaisser 10\s000\sF en espèces/ }),
    )

    expect(
      await screen.findByText(
        /Règlement de 10\s000\sF encaissé\. Komlan D\. doit encore 8\s000\sF\./,
      ),
    ).toBeVisible()
    expect(recus).toEqual([
      { id: expect.any(String) as string, mode: 'ESPECES', montant: 10_000, montantRecu: 10_000 },
    ])
  })

  it('règle toute la dette d’un geste, par carte', async () => {
    const recus = ardoisesServies()

    const reglement = await choisir(/Yao S\./)
    await userEvent.click(within(reglement).getByRole('button', { name: /^Tout : 12\s000/ }))
    await userEvent.click(within(reglement).getByRole('radio', { name: 'Carte' }))
    await userEvent.click(
      within(reglement).getByRole('button', { name: /^Encaisser 12\s000\sF en carte/ }),
    )

    await screen.findByText(/Règlement de 12\s000\sF encaissé/)
    expect(recus[0]).toMatchObject({ mode: 'CARTE', montant: 12_000 })
  })

  it('refuse de régler plus que la dette', async () => {
    ardoisesServies()

    const reglement = await choisir(/Yao S\./)
    await userEvent.type(
      within(reglement).getByRole('textbox', { name: /^Montant réglé/ }),
      '15000',
    )

    expect(within(reglement).getByText(/Au plus 12\s000\sF/)).toBeVisible()
    expect(within(reglement).getByRole('button', { name: /^Encaisser/ })).toBeDisabled()
  })
})
