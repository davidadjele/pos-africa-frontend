import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API, MOI_ADMIN, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { TableauDeBordPlateforme } from '../../partage/api/contrat'

const TABLEAU: TableauDeBordPlateforme = {
  indicateurs: {
    actives: 42,
    suspendues: 2,
    nouvellesSemaine: 3,
    etablissements: 61,
    tablettes: 88,
    notesHier: 9214,
    notesSemaineAvant: 8692,
    erreursInternes24h: 1,
  },
  parJour: Array.from({ length: 30 }, (_, rang) => ({
    jour: `2026-09-${String(rang + 1).padStart(2, '0')}`,
    notes: 7000 + rang * 50,
  })),
  aRelancer: [
    {
      id: 'e0000000-0000-4000-8000-000000000001',
      nom: 'Restaurant Le Baobab',
      pays: 'SN',
      creeLe: '2026-09-02T08:00:00Z',
      derniereVenteLe: '2026-09-24T21:00:00Z',
      proprietaire: 'Awa Ndiaye',
      telephone: '+221771234567',
    },
    {
      id: 'e0000000-0000-4000-8000-000000000002',
      nom: 'Maquis Le Palmier',
      pays: 'TG',
      creeLe: '2026-09-28T08:00:00Z',
      proprietaire: 'Komi Agbeko',
      telephone: '+22891223344',
    },
  ],
  nouvelles: [
    {
      id: 'e0000000-0000-4000-8000-000000000003',
      nom: 'Chez Mama Adjoa',
      pays: 'GH',
      creeLe: '2026-10-02T09:00:00Z',
      premiereVenteLe: '2026-10-03T12:40:00Z',
    },
    {
      id: 'e0000000-0000-4000-8000-000000000002',
      nom: 'Maquis Le Palmier',
      pays: 'TG',
      creeLe: '2026-09-28T08:00:00Z',
    },
  ],
}

describe('PageTableauDeBordPlateforme', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('montre les indicateurs, sans aucun montant, et la comparaison à la semaine d’avant', async () => {
    serveurMsw.use(http.get(`${API}/plateforme/tableau-de-bord`, () => HttpResponse.json(TABLEAU)))
    sessionOuverte(MOI_ADMIN)
    ouvrir('/plateforme/tableau-de-bord')

    const indicateurs = await screen.findByRole('list', { name: 'Indicateurs' })
    expect(indicateurs).toHaveTextContent('Entreprises actives42')
    expect(indicateurs).toHaveTextContent('+3 cette semaine')
    expect(indicateurs).toHaveTextContent(/Notes encaissées hier9\s214/)
    expect(indicateurs).toHaveTextContent('+6 % sur la semaine d’avant')
    expect(indicateurs).toHaveTextContent('Erreurs internes, 24 h1')
    expect(within(indicateurs).getByRole('link', { name: /Erreurs internes/ })).toHaveAttribute(
      'href',
      '/plateforme/support',
    )
    expect(document.body).not.toHaveTextContent(/FCFA|\bF\b/)
    const onglets = screen.getByRole('navigation', { name: 'Espace plateforme' })
    expect(within(onglets).getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('liste les entreprises à relancer avec leur propriétaire, et les nouvelles', async () => {
    serveurMsw.use(http.get(`${API}/plateforme/tableau-de-bord`, () => HttpResponse.json(TABLEAU)))
    sessionOuverte(MOI_ADMIN)
    ouvrir('/plateforme/tableau-de-bord')

    const relancer = await screen.findByRole('region', { name: 'À relancer' })
    const baobab = within(relancer).getByRole('listitem', { name: /Restaurant Le Baobab/ })
    expect(baobab).toHaveTextContent('Dernière vente le 24/09/2026')
    expect(baobab).toHaveTextContent('Awa Ndiaye, +221771234567')
    expect(
      within(baobab).getByRole('link', { name: 'Ouvrir la fiche de Restaurant Le Baobab' }),
    ).toHaveAttribute('href', '/plateforme/entreprises/e0000000-0000-4000-8000-000000000001')
    expect(within(relancer).getByRole('listitem', { name: /Maquis Le Palmier/ })).toHaveTextContent(
      'Aucune vente',
    )
    const nouvelles = screen.getByRole('region', { name: 'Nouvelles entreprises' })
    expect(nouvelles).toHaveTextContent('Chez Mama Adjoa')
    expect(nouvelles).toHaveTextContent('Première vente le 03/10/2026')
    expect(screen.getByRole('img', { name: /Notes encaissées par jour/ })).toBeVisible()
  })

  it('rafraîchit toutes les 5 minutes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let appels = 0
    serveurMsw.use(
      http.get(`${API}/plateforme/tableau-de-bord`, () => {
        appels += 1
        return HttpResponse.json(TABLEAU)
      }),
    )
    sessionOuverte(MOI_ADMIN)
    ouvrir('/plateforme/tableau-de-bord')
    await screen.findByRole('list', { name: 'Indicateurs' })

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    await vi.waitFor(() => {
      expect(appels).toBe(2)
    })
  })
})
