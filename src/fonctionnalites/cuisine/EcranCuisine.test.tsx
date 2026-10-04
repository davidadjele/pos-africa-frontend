import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API, CAISSE_BAR, ouvrir, tablette } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { AppareilCourant, BonCuisine, EcranCuisine } from '../../partage/api/contrat'

const CUISINE: AppareilCourant = { ...CAISSE_BAR, nom: 'Cuisine', type: 'CUISINE' }

const BON_T7: BonCuisine = {
  envoiId: 'b0000000-0000-4000-8000-000000000007',
  commandeId: 'c0000000-0000-4000-8000-000000000041',
  numero: 41,
  canal: 'SUR_PLACE',
  table: 'T7',
  salle: 'Terrasse',
  couverts: 8,
  serveur: 'Kossi A.',
  envoyeLe: '2026-10-03T21:30:00Z',
  commenceLe: '2026-10-03T21:31:00Z',
  articles: [
    {
      ligneId: '1e000000-0000-4000-8000-000000000071',
      nom: 'Pintade braisée',
      quantite: 4,
    },
    {
      ligneId: '1e000000-0000-4000-8000-000000000072',
      nom: 'Poulet braisé',
      quantite: 1,
      annuleeLe: '2026-10-03T21:41:00Z',
    },
  ],
}

const BON_COMPTOIR: BonCuisine = {
  envoiId: 'b0000000-0000-4000-8000-000000000012',
  commandeId: 'c0000000-0000-4000-8000-000000000012',
  numero: 12,
  canal: 'EMPORTER',
  clientNom: 'Yao',
  serveur: 'Afi M.',
  envoyeLe: '2026-10-03T21:42:00Z',
  articles: [
    {
      ligneId: '1e000000-0000-4000-8000-000000000121',
      nom: 'Brochettes de bœuf',
      quantite: 3,
      note: 'bien cuites',
    },
    {
      ligneId: '1e000000-0000-4000-8000-000000000122',
      nom: 'Attiéké',
      quantite: 2,
      preteLe: '2026-10-03T21:44:00Z',
    },
  ],
}

const BON_PRET: BonCuisine = {
  envoiId: 'b0000000-0000-4000-8000-000000000004',
  commandeId: 'c0000000-0000-4000-8000-000000000042',
  numero: 42,
  canal: 'SUR_PLACE',
  table: 'T4',
  salle: 'Terrasse',
  serveur: 'Essi D.',
  envoyeLe: '2026-10-03T21:20:00Z',
  preteLe: '2026-10-03T21:38:00Z',
  articles: [
    {
      ligneId: '1e000000-0000-4000-8000-000000000041',
      nom: 'Alloco',
      quantite: 2,
      preteLe: '2026-10-03T21:38:00Z',
    },
  ],
}

/** Sert l'écran donné et retient les actions de la cuisine. */
function cuisineServie(
  ecran: EcranCuisine = { aPreparer: [BON_T7, BON_COMPTOIR], prets: [BON_PRET] },
) {
  const actions: string[] = []
  serveurMsw.use(
    http.get(`${API}/appareil/cuisine`, () => HttpResponse.json(ecran)),
    http.post(`${API}/appareil/cuisine/*`, ({ request }) => {
      actions.push(new URL(request.url).pathname.replace('/api/appareil/cuisine', ''))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return actions
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T21:46:30Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EcranCuisine', () => {
  it('envoie une tablette de cuisine sur son écran, les bons les plus anciens d’abord', async () => {
    tablette(CUISINE)
    cuisineServie()
    const { routeur } = ouvrir('/caisse')

    const t7 = await screen.findByRole('region', { name: 'Bon T7' })
    expect(routeur.state.location.pathname).toBe('/cuisine')
    expect(screen.getByRole('banner')).toHaveTextContent('Bè Kpota, Cuisine')
    expect(t7).toHaveTextContent('Terrasse')
    expect(t7).toHaveTextContent('Kossi A., 8 couverts')
    expect(t7).toHaveTextContent('16:30')
    expect(t7).toHaveTextContent('En préparation')
    expect(within(t7).getByText('Poulet braisé')).toHaveClass('line-through')
    expect(t7).toHaveTextContent('Annulé à 21:41')

    const comptoir = screen.getByRole('region', { name: 'Bon n°12' })
    expect(comptoir).toHaveTextContent('À emporter, Yao')
    expect(comptoir).toHaveTextContent('bien cuites')
    expect(comptoir).toHaveTextContent('04:30')
    const onglets = screen.getByRole('tablist', { name: 'Bons' })
    expect(within(onglets).getByRole('tab', { name: /À préparer/ })).toHaveTextContent('2')
    expect(within(onglets).getByRole('tab', { name: /Prêts/ })).toHaveTextContent('1')
  })

  it('commence un bon, marque un article puis tout le bon prêt', async () => {
    tablette(CUISINE)
    const actions = cuisineServie()
    ouvrir('/cuisine')

    const comptoir = await screen.findByRole('region', { name: 'Bon n°12' })
    expect(within(comptoir).queryByRole('button', { name: 'Tout est prêt' })).toBeNull()
    await userEvent.click(within(comptoir).getByRole('button', { name: 'Commencer' }))
    await userEvent.click(
      within(comptoir).getByRole('button', { name: 'Brochettes de bœuf : prêt' }),
    )
    const t7 = screen.getByRole('region', { name: 'Bon T7' })
    await userEvent.click(within(t7).getByRole('button', { name: 'Tout est prêt' }))

    await waitFor(() => {
      expect(actions).toEqual([
        `/bons/${BON_COMPTOIR.envoiId}/debut`,
        '/lignes/1e000000-0000-4000-8000-000000000121/pret',
        `/bons/${BON_T7.envoiId}/pret`,
      ])
    })
    expect(within(comptoir).getByText('Attiéké').closest('li')).toHaveTextContent('Prêt')
  })

  it('rappelle un bon prêt par erreur', async () => {
    tablette(CUISINE)
    const actions = cuisineServie()
    ouvrir('/cuisine')

    await userEvent.click(await screen.findByRole('tab', { name: /Prêts/ }))
    const t4 = screen.getByRole('region', { name: 'Bon T4' })
    expect(t4).toHaveTextContent('Prêt à 21:38')
    await userEvent.click(within(t4).getByRole('button', { name: 'Rappeler' }))

    await waitFor(() => {
      expect(actions).toEqual([`/bons/${BON_PRET.envoiId}/rappel`])
    })
  })

  it('ne propose pas de rappeler un bon déjà servi', async () => {
    tablette(CUISINE)
    cuisineServie({
      aPreparer: [],
      prets: [
        {
          ...BON_PRET,
          articles: BON_PRET.articles.map((article) => ({
            ...article,
            servieLe: '2026-10-03T21:40:00Z',
          })),
        },
      ],
    })
    ouvrir('/cuisine')

    await userEvent.click(await screen.findByRole('tab', { name: /Prêts/ }))
    const t4 = screen.getByRole('region', { name: 'Bon T4' })
    expect(t4).toHaveTextContent('Servi')
    expect(within(t4).queryByRole('button', { name: 'Rappeler' })).toBeNull()
  })

  it('dit quand il n’y a rien à préparer', async () => {
    tablette(CUISINE)
    cuisineServie({ aPreparer: [], prets: [] })
    ouvrir('/cuisine')

    expect(await screen.findByRole('heading', { name: 'Rien à préparer' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Son des nouveaux bons' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('renvoie une tablette de caisse vers la caisse', async () => {
    tablette(CAISSE_BAR)
    serveurMsw.use(http.get(`${API}/appareil/personnel`, () => HttpResponse.json([])))
    const { routeur } = ouvrir('/cuisine')

    await waitFor(() => {
      expect(routeur.state.location.pathname).toBe('/caisse')
    })
  })
})
