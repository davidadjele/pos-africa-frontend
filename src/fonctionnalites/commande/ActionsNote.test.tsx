import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, caisseOuverte, STOCK_SANS_SUIVI } from '../../../tests/application'
import { FLAG, FLAG_ENVOYE, NOTE_T4, PLAN, POULET, T1_ID } from '../../../tests/commandes'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { CommandeDetail, DemandeAnnulationNote, StockCaisse } from '../../partage/api/contrat'

const ESSI_ID = '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0202'
const AFI_ID = '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0301'
const TOUT = ['COMMANDE_CREER', 'TABLE_TRANSFERER']

function noteServie(
  permissions = TOUT,
  note: CommandeDetail = NOTE_T4,
  stock: StockCaisse = STOCK_SANS_SUIVI,
) {
  serveurMsw.use(
    http.get(`${API}/caisse/commandes/${note.id}`, () => HttpResponse.json(note)),
    http.get(`${API}/caisse/carte`, () => HttpResponse.json([FLAG, POULET])),
    http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)),
  )
  caisseOuverte(`/caisse/notes/${note.id}`, { permissions, stock })
}

/** Retient les corps reçus sur une route de la note et répond par la note donnée. */
function route(methode: 'post' | 'put' | 'delete', suffixe: string, reponse: CommandeDetail) {
  const recus: unknown[] = []
  serveurMsw.use(
    http[methode](`${API}/caisse/commandes/${NOTE_T4.id}/${suffixe}`, async ({ request }) => {
      recus.push(methode === 'delete' ? null : await request.json().catch(() => null))
      return HttpResponse.json(reponse)
    }),
  )
  return recus
}

async function choisirAction(nom: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Actions sur la note' }))
  await userEvent.click(screen.getByRole('menuitem', { name: nom }))
}

describe('Actions sur la note', () => {
  it('transfère la note vers une table libre', async () => {
    noteServie()
    const recus = route('post', 'transfert', {
      ...NOTE_T4,
      table: { id: T1_ID, nom: 'T1', salle: 'Terrasse' },
    })

    await choisirAction('Transférer vers une autre table')
    const dialogue = screen.getByRole('dialog', { name: 'Transférer la note de T4' })
    expect(within(dialogue).queryByRole('button', { name: /T7/ })).not.toBeInTheDocument()
    await userEvent.click(await within(dialogue).findByRole('button', { name: /T1/ }))
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Transférer vers T1' }))

    const note = screen.getByRole('region', { name: 'Note en cours' })
    expect(await within(note).findByRole('heading', { name: /T1/ })).toBeVisible()
    expect(recus).toEqual([{ tableId: T1_ID }])
  })

  it('confie la note à un collègue de l’établissement', async () => {
    serveurMsw.use(
      http.get(`${API}/caisse/validateurs`, () =>
        HttpResponse.json([
          {
            utilisateurId: ESSI_ID,
            prenom: 'Essi',
            nomCourt: 'Essi D.',
            role: 'SERVEUR',
            bloque: false,
          },
        ]),
      ),
    )
    noteServie()
    const recus = route('post', 'serveur', { ...NOTE_T4, serveur: 'Essi D.', mienne: false })

    await choisirAction('Changer de serveur')
    await userEvent.click(await screen.findByRole('button', { name: /Essi D\./ }))

    expect(await screen.findByText(/ouverte à 18:55 par Essi D\./)).toBeVisible()
    expect(recus).toEqual([{ serveurId: ESSI_ID }])
  })

  it('corrige les couverts', async () => {
    noteServie()
    const recus = route('put', 'couverts', { ...NOTE_T4, couverts: 4 })

    await choisirAction('Couverts')
    const dialogue = screen.getByRole('dialog', { name: 'Couverts de T4' })
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Un couvert de plus' }))
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText(/n°42, 4 couverts/)).toBeVisible()
    expect(recus).toEqual([{ couverts: 4 }])
  })

  it('signale l’addition demandée, puis la retire', async () => {
    noteServie()
    route('post', 'addition', {
      ...NOTE_T4,
      additionDemandeeLe: '2026-09-29T21:10:00Z',
      additionDemandeePar: 'Kossi A.',
    })
    const retraits = route('delete', 'addition', NOTE_T4)

    await choisirAction('Addition demandée')
    expect(await screen.findByText('Addition demandée à 21:10 par Kossi A.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Retirer l’addition demandée' }))

    expect(await screen.findByRole('button', { name: 'Actions sur la note' })).toBeVisible()
    expect(screen.queryByText(/Addition demandée à/)).not.toBeInTheDocument()
    expect(retraits).toHaveLength(1)
  })

  it('annule la note entière après la validation d’un gérant', async () => {
    const recues: DemandeAnnulationNote[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/annulation`, async ({ request }) => {
        const demande = (await request.json()) as DemandeAnnulationNote
        recues.push(demande)
        return demande.validationId === undefined
          ? HttpResponse.json(
              { statut: 403, code: 'VALIDATION_REQUISE', message: 'x' },
              { status: 403 },
            )
          : new HttpResponse(null, { status: 204 })
      }),
      http.get(`${API}/caisse/validateurs`, () =>
        HttpResponse.json([
          {
            utilisateurId: AFI_ID,
            prenom: 'Afi',
            nomCourt: 'Afi M.',
            role: 'GERANT',
            bloque: false,
          },
        ]),
      ),
      http.post(`${API}/caisse/validations`, () =>
        HttpResponse.json(
          { id: 'a1b20000-0000-4000-8000-000000000002', expireLe: '2026-09-29T21:11:00Z' },
          { status: 201 },
        ),
      ),
    )
    noteServie()

    await choisirAction('Annuler la note')
    const dialogue = screen.getByRole('dialog', { name: 'Annuler la note de T4 ?' })
    expect(dialogue).toHaveTextContent('1 article envoyé en préparation, annulé')
    expect(dialogue).toHaveTextContent('2 articles à envoyer, retirés')
    await userEvent.click(within(dialogue).getByRole('radio', { name: 'Le client est parti' }))
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Annuler la note' }))

    const validation = await screen.findByRole('dialog', { name: 'Annuler la note de T4 ?' })
    await userEvent.click(await within(validation).findByRole('button', { name: /Afi M\./ }))
    for (const chiffre of '5937') {
      await userEvent.click(within(validation).getByRole('button', { name: chiffre }))
    }
    await userEvent.click(within(validation).getByRole('button', { name: 'Valider' }))

    expect(await screen.findByRole('list', { name: 'Tables' })).toBeVisible()
    expect(recues).toEqual([
      { motif: 'CLIENT_PARTI' },
      { motif: 'CLIENT_PARTI', validationId: 'a1b20000-0000-4000-8000-000000000002' },
    ])
  })

  it('demande si les articles suivis reviennent en stock quand on annule la note', async () => {
    const recues = route('post', 'annulation', NOTE_T4)
    noteServie(TOUT, NOTE_T4, {
      politique: 'SOUPLE',
      articles: [{ produitId: FLAG.produitId, quantite: 12, faible: false }],
    })

    await choisirAction('Annuler la note')
    const dialogue = screen.getByRole('dialog', { name: 'Annuler la note de T4 ?' })
    await userEvent.click(within(dialogue).getByRole('radio', { name: 'Le client est parti' }))
    const stock = within(dialogue).getByRole('radiogroup', { name: 'Les articles suivis en stock' })
    // Client parti : ce qui était servi est perdu, sauf si l'on dit le contraire.
    expect(within(stock).getByRole('radio', { name: /Perdu/ })).toBeChecked()
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Annuler la note' }))

    await screen.findByRole('list', { name: 'Tables' })
    expect(recues).toEqual([{ motif: 'CLIENT_PARTI', retourEnStock: false }])
  })

  it('annule sans validation une note dont rien n’est parti', async () => {
    let annulee = false
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/annulation`, () => {
        annulee = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    noteServie(TOUT, {
      ...NOTE_T4,
      lignes: NOTE_T4.lignes.filter((ligne) => ligne.id !== FLAG_ENVOYE.id),
    })

    await choisirAction('Annuler la note')
    const dialogue = screen.getByRole('dialog', { name: 'Annuler la note de T4 ?' })
    expect(dialogue).not.toHaveTextContent('envoyé en préparation')
    await userEvent.click(within(dialogue).getByRole('radio', { name: 'Erreur de saisie' }))
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Annuler la note' }))

    expect(await screen.findByRole('list', { name: 'Tables' })).toBeVisible()
    expect(annulee).toBe(true)
  })

  it('ne propose le transfert qu’aux rôles qui en ont le droit', async () => {
    noteServie(['COMMANDE_CREER'])

    await userEvent.click(await screen.findByRole('button', { name: 'Actions sur la note' }))

    expect(screen.queryByRole('menuitem', { name: /Transférer/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Changer de serveur' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Addition demandée' })).toBeVisible()
  })
})
