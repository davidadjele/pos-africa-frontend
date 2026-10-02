import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import { BE_KPOTA } from '../stock/fixtures'
import { HISTORIQUE, RAPPORT } from './fixtures'

const PROPRIETAIRE = [...MOI_TANTI.permissions, 'RAPPORT_VENTES', 'RAPPORT_FINANCIER']

function rapportServi(rapport = RAPPORT) {
  const demandes: URLSearchParams[] = []
  serveurMsw.use(
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({
        elements: [
          BE_KPOTA,
          { ...BE_KPOTA, id: 'e7000000-0000-4000-8000-000000000002', nom: 'Agbalépédo' },
        ],
        page: 0,
        taille: 100,
        total: 2,
      }),
    ),
    http.get(`${API}/stock/a-traiter`, () => HttpResponse.json({ nombre: 0 })),
    http.get(`${API}/ardoises/a-relancer`, () => HttpResponse.json({ nombre: 0 })),
    http.get(`${API}/rapports/ventes`, ({ request }) => {
      demandes.push(new URL(request.url).searchParams)
      return HttpResponse.json(rapport)
    }),
    http.get(`${API}/rapports/caisses`, () => HttpResponse.json(HISTORIQUE)),
  )
  return demandes
}

describe('PageVentes', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('résume la période : indicateurs comparés, jours, modes, produits et points à surveiller', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-01T20:45:00Z'), toFake: ['Date'] })
    const demandes = rapportServi()
    sessionOuverte({ ...MOI_TANTI, permissions: PROPRIETAIRE })
    ouvrir('/gestion/ventes')

    const indicateurs = await screen.findByRole('list', { name: 'Indicateurs' })
    expect(demandes[0]?.get('du')).toBe('2026-09-25')
    expect(demandes[0]?.get('au')).toBe('2026-10-01')
    expect(screen.getByRole('link', { name: /Ventes/ })).toHaveAttribute('aria-current', 'page')
    expect(indicateurs).toHaveTextContent(/Chiffre d’affaires1\s284\s500\sF\+12 %1\s146\s900 avant/)
    expect(indicateurs).toHaveTextContent(/Remises et offerts−28\s4002,2 % des ventes/)
    expect(indicateurs).toHaveTextContent(/Remboursements−9\s0002 notes/)
    expect(screen.getByRole('listitem', { name: /dim\. 27 : 298500/ })).toHaveTextContent('299 k')
    const modes = screen.getByRole('list', { name: 'Par mode de paiement' })
    expect(modes).toHaveTextContent(/Mobile Money398\s00031 %dont Flooz251\s000/)
    const produits = screen.getByRole('table', { name: 'Par produit' })
    expect(within(produits).getAllByRole('row')[1]).toHaveTextContent(
      /Flag 65 clBières412494\s40038 %/,
    )
    expect(screen.getByText(/Remises sur les notes : −6\s200/)).toBeVisible()

    const vigilance = screen.getByRole('region', { name: 'À surveiller' })
    const points = within(vigilance).getAllByRole('link')
    expect(points.map((point) => point.textContent)).toEqual([
      expect.stringMatching(/^Écarts de caisse : −2\s100Caisses avec écart : 3 sur 5$/) as string,
      expect.stringMatching(/^Remboursements : −9\s000Notes remboursées : 2$/) as string,
      expect.stringMatching(
        /^6 articles annulés après envoi \(−6\s000\)dont 4 sur les notes de Kossi A\.$/,
      ) as string,
      expect.stringMatching(
        /^Remises en hausse : 2,2 % des ventescontre 1 % la période d’avant$/,
      ) as string,
      expect.stringMatching(/^87\s500 vendus sur l’ardoiseClients concernés : 3$/) as string,
    ])
    expect(points[0]).toHaveAttribute('href', '/gestion/caisses')
  })

  it('change de période et d’établissement, et passe aux catégories', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-01T20:45:00Z'), toFake: ['Date'] })
    const demandes = rapportServi()
    sessionOuverte({ ...MOI_TANTI, permissions: PROPRIETAIRE })
    ouvrir('/gestion/ventes')
    await screen.findByRole('list', { name: 'Indicateurs' })

    await userEvent.click(screen.getByRole('button', { name: 'Hier' }))
    await userEvent.selectOptions(screen.getByLabelText('Établissement'), 'Agbalépédo')
    await userEvent.click(screen.getByRole('button', { name: 'Catégories' }))

    await vi.waitFor(() => {
      expect(demandes.at(-1)?.toString()).toBe(
        'du=2026-09-30&au=2026-09-30&etablissementId=e7000000-0000-4000-8000-000000000002',
      )
    })
    expect(screen.getByRole('table', { name: 'Par produit' })).toHaveTextContent(
      /Grillades58261\s000/,
    )
  })

  it('sans le rapport financier, ne parle pas des écarts de caisse', async () => {
    rapportServi()
    sessionOuverte({ ...MOI_TANTI, permissions: [...MOI_TANTI.permissions, 'RAPPORT_VENTES'] })
    ouvrir('/gestion/ventes')

    const vigilance = await screen.findByRole('region', { name: 'À surveiller' })
    expect(vigilance).not.toHaveTextContent('Écarts de caisse')
    expect(screen.queryByRole('link', { name: /Caisses/ })).not.toBeInTheDocument()
  })

  it('dit simplement qu’aucune vente n’a eu lieu', async () => {
    rapportServi({
      ...RAPPORT,
      indicateurs: { ...RAPPORT.indicateurs, notes: 0, chiffreAffaires: 0 },
    })
    sessionOuverte({ ...MOI_TANTI, permissions: PROPRIETAIRE })
    ouvrir('/gestion/ventes')

    expect(
      await screen.findByRole('heading', { name: 'Aucune vente sur cette période' }),
    ).toBeVisible()
  })

  it('exporte les jours et les produits en CSV pour le comptable', async () => {
    const urls: Blob[] = []
    const creer = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      urls.push(blob as Blob)
      return 'blob:ventes'
    })
    const revoquer = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    rapportServi()
    sessionOuverte({ ...MOI_TANTI, permissions: PROPRIETAIRE })
    ouvrir('/gestion/ventes')
    await screen.findByRole('list', { name: 'Indicateurs' })

    await userEvent.click(screen.getByRole('button', { name: 'Exporter (CSV)' }))

    const contenu = await urls[0]?.text()
    expect(contenu).toContain(
      'Journée;Total;Espèces;Mobile Money;Carte;Ardoise\r\n2026-09-25;152500;',
    )
    expect(contenu).toContain('Produit;Catégorie;Qté;Montant\r\nFlag 65 cl;Bières;412;494400')
    creer.mockRestore()
    revoquer.mockRestore()
  })
})
