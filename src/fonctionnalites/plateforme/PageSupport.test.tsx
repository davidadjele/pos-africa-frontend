import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_ADMIN, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { ErreurPlateforme } from '../../partage/api/contrat'

const PAIEMENT: ErreurPlateforme = {
  traceId: 'c0ffee42a1b2c3d4e5f60718293a4b5c',
  le: '2026-10-03T15:31:08Z',
  statut: 500,
  code: 'ERREUR_INTERNE',
  methode: 'POST',
  chemin: '/caisse/commandes/{id}/paiements',
  entrepriseId: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01',
  entrepriseNom: 'Maquis Chez Tanti',
  etablissementNom: 'Bè Kpota',
  personne: 'Afi Mensah',
  appareilNom: 'Caisse 1, bar',
}
const STOCK: ErreurPlateforme = {
  traceId: '52d9e1f0aa17b8c9d0e1f2a3b4c5d6e7',
  le: '2026-10-03T11:48:00Z',
  statut: 422,
  code: 'STOCK_INSUFFISANT',
  methode: 'POST',
  chemin: '/caisse/commandes/{id}/envoi',
}

function erreursServies() {
  const codes: (string | null)[] = []
  serveurMsw.use(
    http.get(`${API}/plateforme/erreurs`, ({ request }) => {
      const code = new URL(request.url).searchParams.get('code')
      codes.push(code)
      if (code === null) return HttpResponse.json([PAIEMENT, STOCK])
      return HttpResponse.json(PAIEMENT.traceId.startsWith(code) ? [PAIEMENT] : [])
    }),
  )
  return codes
}

async function ouvrirSupport() {
  sessionOuverte(MOI_ADMIN)
  ouvrir('/plateforme/support')
  return screen.findByRole('heading', { level: 1, name: 'Support' })
}

describe('PageSupport', () => {
  it('montre les erreurs des dernières 24 heures, toutes entreprises', async () => {
    erreursServies()
    await ouvrirSupport()

    const onglets = screen.getByRole('navigation', { name: 'Espace plateforme' })
    expect(within(onglets).getByRole('link', { name: 'Support' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const lignes = within(
      await screen.findByRole('table', { name: 'Erreurs récentes' }),
    ).getAllByRole('row')
    expect(lignes[1]).toHaveTextContent('Maquis Chez Tanti')
    expect(lignes[1]).toHaveTextContent('500')
    expect(lignes[1]).toHaveTextContent('POST /caisse/commandes/{id}/paiements')
    expect(lignes[2]).toHaveTextContent('Hors entreprise')
  })

  it('retrouve une erreur par le début de son code et dit ce que le client a vu', async () => {
    const codes = erreursServies()
    await ouvrirSupport()

    await userEvent.type(screen.getByLabelText(/^Code de l’erreur/), ' C0FFEE42 {Enter}')

    const resultat = await screen.findByRole('region', { name: 'Erreur interne' })
    expect(codes.at(-1)).toBe('c0ffee42')
    expect(resultat).toHaveTextContent('ERREUR_INTERNE')
    expect(resultat).toHaveTextContent('Maquis Chez Tanti, Bè Kpota')
    expect(resultat).toHaveTextContent('Afi Mensah, sur la tablette « Caisse 1, bar »')
    expect(resultat).toHaveTextContent('POST /caisse/commandes/{id}/paiements')
    expect(resultat).toHaveTextContent('Une erreur inattendue est survenue')
    expect(within(resultat).getByRole('link', { name: 'Maquis Chez Tanti' })).toHaveAttribute(
      'href',
      `/plateforme/entreprises/${PAIEMENT.entrepriseId ?? ''}`,
    )
  })

  it('exige 8 caractères au moins, et explique un code introuvable', async () => {
    const codes = erreursServies()
    await ouvrirSupport()
    const champ = screen.getByLabelText(/^Code de l’erreur/)

    await userEvent.type(champ, 'c0ff{Enter}')
    expect(screen.getByText('Saisissez au moins les 8 premiers caractères du code.')).toBeVisible()
    expect(codes).toEqual([null])

    await userEvent.clear(champ)
    await userEvent.type(champ, 'deadbeef{Enter}')
    expect(await screen.findByRole('heading', { name: 'Aucune erreur avec ce code' })).toBeVisible()
  })
})
