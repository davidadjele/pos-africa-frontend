import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import { BE_KPOTA } from '../stock/fixtures'
import { DETAIL_Z, HISTORIQUE } from './fixtures'

const FINANCIER = [...MOI_TANTI.permissions, 'RAPPORT_VENTES', 'RAPPORT_FINANCIER']

function caissesServies() {
  const demandes: URLSearchParams[] = []
  serveurMsw.use(
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: [BE_KPOTA], page: 0, taille: 100, total: 1 }),
    ),
    http.get(`${API}/stock/a-traiter`, () => HttpResponse.json({ nombre: 0 })),
    http.get(`${API}/ardoises/a-relancer`, () => HttpResponse.json({ nombre: 0 })),
    http.get(`${API}/rapports/caisses`, ({ request }) => {
      demandes.push(new URL(request.url).searchParams)
      return HttpResponse.json(HISTORIQUE)
    }),
    http.get(`${API}/rapports/caisses/:id`, () => HttpResponse.json(DETAIL_Z)),
    http.get(`${API}/rapports/ventes`, () => HttpResponse.json({})),
  )
  return demandes
}

describe('PageCaisses', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('liste les caisses avec leurs écarts, et les écarts jour par jour', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-01T20:45:00Z'), toFake: ['Date'] })
    const demandes = caissesServies()
    sessionOuverte({ ...MOI_TANTI, permissions: FINANCIER })
    ouvrir('/gestion/caisses')

    const tableau = await screen.findByRole('table', { name: 'Caisses de la période' })
    expect(demandes[0]?.toString()).toBe('du=2026-09-25&au=2026-10-01&ecartsSeulement=false')
    expect(screen.getByRole('list', { name: 'Synthèse des caisses' })).toHaveTextContent(
      /Écarts cumulés−2\s1003 caisses avec écart/,
    )
    const lignes = within(tableau).getAllByRole('row')
    expect(lignes[1]).toHaveTextContent(/En coursCaisse 2, terrasseBè Kpota/)
    expect(lignes[2]).toHaveTextContent(/Z n°14Caisse 1, bar.*264\s500−600/)
    const ecarts = screen.getByRole('list', { name: 'Écarts de caisse par jour' })
    expect(within(ecarts).getByRole('listitem', { name: /lun\. 28 : −2\s000/ })).toBeVisible()
    expect(within(ecarts).getByRole('listitem', { name: /mar\. 29 : \+500/ })).toBeVisible()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Seulement les écarts' }))
    await vi.waitFor(() => {
      expect(demandes.at(-1)?.get('ecartsSeulement')).toBe('true')
    })
  })

  it('ouvre le détail du Z : espèces, explication, mouvements et remboursements', async () => {
    caissesServies()
    sessionOuverte({ ...MOI_TANTI, permissions: FINANCIER })
    ouvrir('/gestion/caisses')
    await userEvent.click(await screen.findByRole('link', { name: 'Voir Caisse 1, bar' }))

    expect(
      await screen.findByRole('heading', { name: 'Rapport Z n°14, Caisse 1, bar' }),
    ).toBeVisible()
    const z = screen.getByRole('region', { name: 'Rapport Z' })
    expect(z).toHaveTextContent(/Espèces attendues136\s000/)
    expect(z).toHaveTextContent('Erreur de rendu sur un billet de 1 000, signalée par Yawa.')
    expect(screen.getByRole('region', { name: 'Mouvements de caisse' })).toHaveTextContent(
      'Glace pour les bières',
    )
    expect(screen.getByRole('region', { name: 'Remboursements' })).toHaveTextContent(
      /n°48, T4, Article non conforme.*−4\s500/,
    )
    expect(screen.getByRole('link', { name: /Voir les ventes de cette journée/ })).toHaveAttribute(
      'href',
      '/gestion/ventes?du=2026-09-30&au=2026-09-30&etablissement=e7000000-0000-4000-8000-000000000001',
    )
  })
})
