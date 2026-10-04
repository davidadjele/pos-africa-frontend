import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, caisseOuverte } from '../../../tests/application'
import { FLAG, FLAG_ENVOYE, NOTE_T4, PLAN, POULET } from '../../../tests/commandes'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { DemandeAjout, DemandeAnnulation, StockCaisse } from '../../partage/api/contrat'

const GERANT = ['COMMANDE_CREER', 'LIGNE_ANNULER_APRES_ENVOI']

function noteAvecStock(stock: StockCaisse, permissions = ['COMMANDE_CREER']) {
  serveurMsw.use(
    http.get(`${API}/caisse/commandes/${NOTE_T4.id}`, () => HttpResponse.json(NOTE_T4)),
    http.get(`${API}/caisse/carte`, () => HttpResponse.json([FLAG, POULET])),
    http.get(`${API}/caisse/plan`, () => HttpResponse.json(PLAN)),
  )
  caisseOuverte(`/caisse/notes/${NOTE_T4.id}`, { stock, permissions })
}

async function tuile(nom: RegExp) {
  const produits = await screen.findByRole('list', { name: 'Produits' })
  return within(produits).findByRole('button', { name: nom })
}

describe('Le stock à la caisse', () => {
  it('signale sur la tuile le stock faible, puis la rupture', async () => {
    noteAvecStock({
      politique: 'SOUPLE',
      articles: [{ produitId: FLAG.produitId, quantite: 3, faible: true }],
    })
    expect(await tuile(/Flag 65 cl/)).toHaveTextContent('3 restants')
  })

  it('refuse en politique stricte un article qui n’a plus de stock', async () => {
    noteAvecStock({
      politique: 'STRICT',
      articles: [{ produitId: FLAG.produitId, quantite: 0, faible: true }],
    })
    const flag = await tuile(/Flag 65 cl/)
    expect(flag).toHaveTextContent('Plus en stock')
    expect(flag).toBeDisabled()
  })

  it('prévient en politique avertissement, puis vend si on le confirme', async () => {
    const ajouts: DemandeAjout[] = []
    serveurMsw.use(
      http.post(`${API}/caisse/commandes/${NOTE_T4.id}/lignes`, async ({ request }) => {
        ajouts.push((await request.json()) as DemandeAjout)
        return HttpResponse.json(NOTE_T4)
      }),
    )
    noteAvecStock({
      politique: 'AVERTISSEMENT',
      articles: [{ produitId: FLAG.produitId, quantite: 0, faible: true }],
    })

    await userEvent.click(await tuile(/Flag 65 cl/))
    const alerte = screen.getByRole('dialog', { name: 'Flag 65 cl n’est plus en stock' })
    expect(ajouts).toEqual([])
    await userEvent.click(within(alerte).getByRole('button', { name: 'Vendre quand même' }))

    await screen.findByRole('region', { name: 'Note en cours' })
    expect(ajouts).toEqual([{ produitId: FLAG.produitId }])
  })

  it('demande si l’article annulé revient en stock, selon le motif par défaut', async () => {
    const annulations: DemandeAnnulation[] = []
    serveurMsw.use(
      http.post(
        `${API}/caisse/commandes/${NOTE_T4.id}/lignes/${FLAG_ENVOYE.id}/annulation`,
        async ({ request }) => {
          annulations.push((await request.json()) as DemandeAnnulation)
          return HttpResponse.json(NOTE_T4)
        },
      ),
    )
    noteAvecStock(
      {
        politique: 'SOUPLE',
        articles: [{ produitId: FLAG.produitId, quantite: 12, faible: false }],
      },
      GERANT,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Actions sur Flag 65 cl' }))
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Flag 65 cl' })).getByRole('button', {
        name: /^Annuler/,
      }),
    )
    const annulation = screen.getByRole('dialog', { name: 'Annuler Flag 65 cl ?' })
    await userEvent.click(
      within(annulation).getByRole('radio', { name: 'Non servie (trop d’attente)' }),
    )
    const stock = within(annulation).getByRole('radiogroup', { name: 'L’article' })
    expect(within(stock).getByRole('radio', { name: /Revient en stock/ })).toBeChecked()
    await userEvent.click(within(stock).getByRole('radio', { name: /Perdu/ }))
    await userEvent.click(within(annulation).getByRole('button', { name: 'Annuler 1 article' }))

    await screen.findByRole('region', { name: 'Note en cours' })
    expect(annulations).toEqual([{ quantite: 1, motif: 'NON_SERVIE', retourEnStock: false }])
  })

  it('compte perdu par défaut un article que la cuisine a commencé', async () => {
    noteAvecStock(
      {
        politique: 'SOUPLE',
        articles: [{ produitId: FLAG.produitId, quantite: 12, faible: false }],
      },
      GERANT,
    )
    // Après l'ouverture de la caisse : cette réponse prend le pas sur la note par défaut.
    serveurMsw.use(
      http.get(`${API}/caisse/commandes/${NOTE_T4.id}`, () =>
        HttpResponse.json({
          ...NOTE_T4,
          lignes: NOTE_T4.lignes.map((ligne) =>
            ligne.id === FLAG_ENVOYE.id
              ? { ...ligne, enCuisine: true, commenceeLe: '2026-09-29T19:05:00Z' }
              : ligne,
          ),
        }),
      ),
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Actions sur Flag 65 cl' }))
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Flag 65 cl' })).getByRole('button', {
        name: /^Annuler/,
      }),
    )
    const annulation = screen.getByRole('dialog', { name: 'Annuler Flag 65 cl ?' })
    await userEvent.click(
      within(annulation).getByRole('radio', { name: 'Le client a changé d’avis' }),
    )
    const stock = within(annulation).getByRole('radiogroup', { name: 'L’article' })
    expect(within(stock).getByRole('radio', { name: /Perdu/ })).toBeChecked()
    expect(annulation).toHaveTextContent('La cuisine l’a déjà commencé')
  })
})
