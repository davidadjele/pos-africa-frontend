import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { CaisseResume, HistoriqueCaisses, TableauDeBord } from '../../partage/api/contrat'
import { BE_KPOTA } from '../stock/fixtures'

const TOUT = [
  ...MOI_TANTI.permissions,
  'RAPPORT_VENTES',
  'RAPPORT_FINANCIER',
  'STOCK_AJUSTER',
  'CLIENT_CREDIT',
]

const TABLEAU: TableauDeBord = {
  maintenant: '2026-10-02T20:45:00Z',
  chiffreAffaires: 412_500,
  comparable: 381_000,
  notes: 118,
  etablissements: [
    {
      etablissementId: 'e1',
      nom: 'Bè Kpota',
      journee: '2026-10-02',
      chiffreAffaires: 283_000,
      comparable: 255_000,
      notes: 80,
      notesOuvertes: 9,
      aEncaisser: 61_500,
      plusAncienneLe: '2026-10-02T19:05:00Z',
      plusAncienneNote: 'n°42, T4',
    },
    {
      etablissementId: 'e2',
      nom: 'Agbalépédo',
      journee: '2026-10-02',
      chiffreAffaires: 129_500,
      comparable: 126_000,
      notes: 38,
      notesOuvertes: 0,
      aEncaisser: 0,
    },
    {
      etablissementId: 'e3',
      nom: 'Tokoin',
      journee: '2026-10-02',
      chiffreAffaires: 0,
      comparable: 0,
      notes: 0,
      notesOuvertes: 0,
      aEncaisser: 0,
    },
  ],
  annulations: { articles: 3, montant: 4800, serveur: 'Kossi A.', articlesDuServeur: 2 },
}

const OUVERTES: CaisseResume[] = [
  {
    id: 'c1',
    etablissementId: 'e2',
    etablissement: 'Agbalépédo',
    caisse: 'Caisse 1',
    statut: 'OUVERTE',
    journee: '2026-10-01',
    ouverteLe: '2026-10-01T09:02:00Z',
    ouvertePar: 'Sena K.',
  },
  {
    id: 'c2',
    etablissementId: 'e1',
    etablissement: 'Bè Kpota',
    caisse: 'Caisse 2, terrasse',
    statut: 'OUVERTE',
    journee: '2026-10-02',
    ouverteLe: '2026-10-02T11:30:00Z',
    ouvertePar: 'Yawa T.',
  },
]

const DU_JOUR: HistoriqueCaisses = {
  synthese: { cloturees: 0, ouvertes: 2, ecartCumule: 0, avecEcart: 0 },
  parJour: [],
  caisses: [],
}

function tableauServi() {
  serveurMsw.use(
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: [BE_KPOTA], page: 0, taille: 100, total: 1 }),
    ),
    http.get(`${API}/rapports/tableau-de-bord`, () => HttpResponse.json(TABLEAU)),
    http.get(`${API}/rapports/caisses/ouvertes`, () => HttpResponse.json(OUVERTES)),
    http.get(`${API}/rapports/caisses`, () => HttpResponse.json(DU_JOUR)),
    http.get(`${API}/stock/a-traiter`, () =>
      HttpResponse.json({
        nombre: 1,
        produits: [
          {
            produitId: 'p1',
            nom: 'Castel 65 cl',
            etablissementId: 'e1',
            etablissement: 'Bè Kpota',
            etat: 'NEGATIF',
            quantite: -2,
          },
        ],
      }),
    ),
    http.get(`${API}/ardoises/a-relancer`, () => HttpResponse.json({ nombre: 5, montant: 42_500 })),
  )
}

describe('TableauDeBord', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('dit ce qui est à traiter et ce qui se passe en ce moment, établissement par établissement', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-02T20:45:00Z'), toFake: ['Date'] })
    tableauServi()
    sessionOuverte({ ...MOI_TANTI, permissions: TOUT })
    ouvrir('/gestion')

    const vendu = await screen.findByRole('region', { name: 'Vendu aujourd’hui' })
    expect(vendu).toHaveTextContent(/412\s500\sF/)
    expect(vendu).toHaveTextContent(/\+8 %sur vendredi dernier à la même heure \(381\s000\)/)
    expect(within(vendu).getByRole('link', { name: 'Voir les ventes' })).toHaveAttribute(
      'href',
      '/gestion/ventes?du=2026-10-02&au=2026-10-02',
    )

    const aTraiter = await screen.findByRole('region', { name: 'À traiter' })
    const lignes = within(aTraiter).getAllByRole('listitem')
    expect(lignes.map((ligne) => ligne.textContent)).toEqual([
      expect.stringMatching(
        /^Caisse ouverte depuis un autre jourAgbalépédo, Caisse 1 : ouverte le jeu\. 1 oct\., 09:02 par Sena K\./,
      ) as string,
      expect.stringMatching(/^Castel 65 cl en stock négatif \(−2\)Bè Kpota/) as string,
      expect.stringMatching(/^3 articles annulés après envoi \(−4\s800\)/) as string,
      expect.stringMatching(/^Ardoises à relancer : 42\s500/) as string,
    ])
    expect(
      within(aTraiter)
        .getAllByRole('link')
        .slice(0, 2)
        .map((lien) => lien.getAttribute('href')),
    ).toEqual(['/gestion/caisses/c1', '/gestion/stock?etablissement=e1'])

    const beKpota = screen.getByRole('region', { name: 'Bè Kpota en ce moment' })
    expect(beKpota).toHaveTextContent(/\+11 %283\s000/)
    expect(beKpota).toHaveTextContent(/Caisse 2, terrasseYawa T\., depuis 11:30/)
    expect(beKpota).toHaveTextContent(
      /9 notes ouvertes, la plus ancienne depuis 1 h 40 \(n°42, T4\)61\s500 à encaisser/,
    )
    expect(screen.getByRole('region', { name: 'Agbalépédo en ce moment' })).toHaveTextContent(
      'Sena K., depuis le jeu. 1 oct., 09:02',
    )
    expect(screen.getByRole('region', { name: 'Tokoin en ce moment' })).toHaveTextContent(
      'Aucune activité aujourd’hui',
    )
  })

  it('sans le droit de voir les ventes, garde l’accueil simple', async () => {
    sessionOuverte(MOI_TANTI)
    ouvrir('/gestion')

    expect(await screen.findByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'À traiter' })).not.toBeInTheDocument()
  })
})
