import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import { FLAG, FLAG_ENVOYE, NOTE_T4, PLAN, POULET } from '../../../tests/commandes'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { CommandeDetail } from '../../partage/api/contrat'

const AFI_ID = '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0301'
const VALIDATION_ID = 'a1b20000-0000-4000-8000-000000000003'
const CAISSIER = { permissions: ['COMMANDE_CREER', 'REMISE_APPLIQUER'], plafondRemise: 1000 }
const GERANT = {
  permissions: ['COMMANDE_CREER', 'REMISE_APPLIQUER', 'REMISE_AU_DELA_PLAFOND', 'ARTICLE_OFFRIR'],
  plafondRemise: 10_000,
}

const FLAG_REMISE = {
  ...FLAG_ENVOYE,
  quantite: 3,
  montantBrut: 3600,
  remise: 360,
  montant: 3240,
  tauxRemise: 1000,
  motifRemise: 'CLIENT_FIDELE' as const,
}

function noteServie(session: { permissions: string[]; plafondRemise: number }, note = NOTE_T4) {
  serveurMsw.use(
    http.get(`${API}/caisse/commandes/${note.id}`, () => HttpResponse.json(note)),
    http.get(`${API}/caisse/carte`, () => HttpResponse.json([FLAG, POULET])),
    http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)),
    http.get(`${API}/caisse/validateurs`, () =>
      HttpResponse.json([
        { utilisateurId: AFI_ID, prenom: 'Afi', nomCourt: 'Afi M.', role: 'GERANT', bloque: false },
      ]),
    ),
    http.post(`${API}/caisse/validations`, () =>
      HttpResponse.json({ id: VALIDATION_ID, expireLe: '2026-09-29T21:11:00Z' }, { status: 201 }),
    ),
  )
  caisseOuverte(`/caisse/notes/${note.id}`, session)
}

/** Répond « validation requise » tant que la demande n'en porte pas, puis la note donnée. */
function routeValidee(methode: 'put' | 'post', chemin: string, reponse: CommandeDetail) {
  const recues: unknown[] = []
  serveurMsw.use(
    http[methode](`${API}/caisse/commandes/${NOTE_T4.id}/${chemin}`, async ({ request }) => {
      const corps = (await request.json()) as { validationId?: string }
      recues.push(corps)
      return corps.validationId === undefined
        ? HttpResponse.json(
            { statut: 403, code: 'VALIDATION_REQUISE', message: 'x' },
            { status: 403 },
          )
        : HttpResponse.json(reponse)
    }),
  )
  return recues
}

/** Répond toujours par la note donnée. */
function route(methode: 'put' | 'post', chemin: string, reponse: CommandeDetail) {
  const recues: unknown[] = []
  serveurMsw.use(
    http[methode](`${API}/caisse/commandes/${NOTE_T4.id}/${chemin}`, async ({ request }) => {
      recues.push(await request.json())
      return HttpResponse.json(reponse)
    }),
  )
  return recues
}

async function actionsSur(produit: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Actions sur ${produit}` }))
  return screen.getByRole('dialog', { name: produit })
}

async function validerParAfi() {
  const validation = await screen.findByRole('dialog', { name: /\?$/ })
  await userEvent.click(await within(validation).findByRole('button', { name: /Afi M\./ }))
  for (const chiffre of '5937') {
    await userEvent.click(within(validation).getByRole('button', { name: chiffre }))
  }
  await userEvent.click(within(validation).getByRole('button', { name: 'Valider' }))
}

describe('Remises et articles offerts', () => {
  it('laisse le caissier remiser une ligne jusqu’à son plafond', async () => {
    noteServie(CAISSIER)
    const recues = route('put', `lignes/${FLAG_ENVOYE.id}/remise`, {
      ...NOTE_T4,
      lignes: [FLAG_REMISE, NOTE_T4.lignes[1] ?? FLAG_ENVOYE],
      sousTotal: 12_600,
      remises: 360,
      total: 12_240,
    })

    const actions = await actionsSur('Flag 65 cl')
    expect(within(actions).getByRole('button', { name: /Faire une remise/ })).toHaveTextContent(
      'jusqu’à 10 % pour vous',
    )
    await userEvent.click(within(actions).getByRole('button', { name: /Faire une remise/ }))
    const dialogue = screen.getByRole('dialog', { name: 'Remise sur Flag 65 cl' })
    await userEvent.click(within(dialogue).getByRole('button', { name: /^10\s%$/ }))
    expect(dialogue).toHaveTextContent('1 080')
    await userEvent.click(within(dialogue).getByRole('radio', { name: 'Client fidèle' }))
    await userEvent.click(within(dialogue).getByRole('button', { name: /^Appliquer −10\s%$/ }))

    const note = screen.getByRole('region', { name: 'Note en cours' })
    const lignes = within(note).getByRole('list', { name: 'Articles de la note' })
    expect(await within(lignes).findByText('Client fidèle')).toBeVisible()
    expect(lignes).toHaveTextContent('−10 %Client fidèle')
    expect(note).toHaveTextContent('Remises et offerts')
    expect(recues).toEqual([{ taux: 1000, motif: 'CLIENT_FIDELE' }])
  })

  it('fait valider par un gérant une remise en montant au-delà du plafond', async () => {
    noteServie(CAISSIER)
    const recues = routeValidee('put', `lignes/${FLAG_ENVOYE.id}/remise`, {
      ...NOTE_T4,
      lignes: [
        {
          ...FLAG_ENVOYE,
          remise: 500,
          montant: 700,
          remiseValideePar: 'Afi M.',
          motifRemise: 'RECLAMATION',
        },
      ],
    })

    await userEvent.click(
      within(await actionsSur('Flag 65 cl')).getByRole('button', { name: /Faire une remise/ }),
    )
    const dialogue = screen.getByRole('dialog', { name: 'Remise sur Flag 65 cl' })
    await userEvent.click(within(dialogue).getByRole('tab', { name: 'En montant' }))
    await userEvent.type(
      within(dialogue).getByRole('textbox', { name: /Montant de la remise/ }),
      '500',
    )
    await userEvent.click(within(dialogue).getByRole('radio', { name: 'Réclamation' }))
    await userEvent.click(within(dialogue).getByRole('button', { name: /^Appliquer/ }))
    await validerParAfi()

    expect(await screen.findByText('Réclamation, validé par Afi M.')).toBeVisible()
    expect(recues).toEqual([
      { montant: 500, motif: 'RECLAMATION' },
      { montant: 500, motif: 'RECLAMATION', validationId: VALIDATION_ID },
    ])
  })

  it('offre une unité après la validation d’un gérant', async () => {
    const trois = { ...FLAG_ENVOYE, quantite: 3, montantBrut: 3600, montant: 3600 }
    noteServie(
      { permissions: ['COMMANDE_CREER'], plafondRemise: 0 },
      { ...NOTE_T4, lignes: [trois] },
    )
    const recues = routeValidee('post', `lignes/${FLAG_ENVOYE.id}/offert`, {
      ...NOTE_T4,
      lignes: [
        { ...trois, quantite: 2, montantBrut: 2400, montant: 2400 },
        {
          ...FLAG_ENVOYE,
          id: '1e000000-0000-4000-8000-000000000009',
          offert: true,
          remise: 1200,
          montant: 0,
          motifRemise: 'GESTE_COMMERCIAL',
          remiseValideePar: 'Afi M.',
        },
      ],
    })

    const actions = await actionsSur('Flag 65 cl')
    expect(within(actions).getByRole('button', { name: /Offrir/ })).toHaveTextContent(
      'validation d’un gérant',
    )
    await userEvent.click(within(actions).getByRole('button', { name: /Offrir/ }))
    const dialogue = screen.getByRole('dialog', { name: 'Offrir Flag 65 cl ?' })
    await userEvent.click(within(dialogue).getByRole('radio', { name: 'Geste commercial' }))
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Offrir 1 article' }))
    await validerParAfi()

    const offerte = (await screen.findByText('Geste commercial, validé par Afi M.')).closest('li')
    expect(offerte).toHaveTextContent('OffertGeste commercial')
    expect(recues).toEqual([
      { quantite: 1, motif: 'GESTE_COMMERCIAL' },
      { quantite: 1, motif: 'GESTE_COMMERCIAL', validationId: VALIDATION_ID },
    ])
  })

  it('pose puis retire une remise sur la note entière', async () => {
    noteServie(GERANT)
    const recues = route('put', 'remise', {
      ...NOTE_T4,
      remiseNote: { montant: 1020, taux: 1000, motif: 'GESTE_COMMERCIAL' },
      remises: 1020,
      total: 9180,
    })
    const retraits = route('post', 'remise/retrait', NOTE_T4)

    await userEvent.click(await screen.findByRole('button', { name: 'Actions sur la note' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remise sur la note' }))
    const dialogue = screen.getByRole('dialog', { name: 'Remise sur la note' })
    await userEvent.click(within(dialogue).getByRole('button', { name: /^10\s%$/ }))
    await userEvent.click(within(dialogue).getByRole('radio', { name: 'Geste commercial' }))
    await userEvent.click(within(dialogue).getByRole('button', { name: /^Appliquer −10\s%$/ }))

    const note = screen.getByRole('region', { name: 'Note en cours' })
    expect(
      await within(note).findByText(/Remise sur la note −10 %, Geste commercial/),
    ).toBeVisible()
    await userEvent.click(within(note).getByRole('button', { name: 'Actions sur la note' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Retirer la remise sur la note' }))
    expect(await screen.findByText('10 200 FCFA')).toBeVisible()
    expect(recues).toEqual([{ taux: 1000, motif: 'GESTE_COMMERCIAL' }])
    expect(retraits).toEqual([{}])
  })

  it('retire la remise d’une ligne', async () => {
    noteServie(CAISSIER, { ...NOTE_T4, lignes: [FLAG_REMISE] })
    const retraits = route('post', `lignes/${FLAG_ENVOYE.id}/remise/retrait`, NOTE_T4)

    await userEvent.click(
      within(await actionsSur('Flag 65 cl')).getByRole('button', { name: /Retirer la remise/ }),
    )

    expect(await screen.findByText('10 200 FCFA')).toBeVisible()
    expect(retraits).toEqual([{}])
  })
})
