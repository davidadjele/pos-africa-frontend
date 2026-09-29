import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_ADMIN, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { EntreprisePlateforme } from '../../partage/api/contrat'

const MAQUIS: EntreprisePlateforme = {
  id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01',
  nom: 'Maquis Chez Tanti',
  pays: 'TG',
  nombreEtablissements: 2,
  statut: 'ACTIVE',
  creeLe: '2026-09-28T10:15:00Z',
}
const FLAMBOYANT: EntreprisePlateforme = {
  id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a02',
  nom: 'Bar Le Flamboyant',
  pays: 'CI',
  nombreEtablissements: 1,
  statut: 'SUSPENDUE',
  creeLe: '2026-09-12T08:00:00Z',
}

function entreprisesEnMemoire(depart: EntreprisePlateforme[], total = depart.length) {
  const liste = [...depart]
  const pagesDemandees: string[] = []
  serveurMsw.use(
    http.get(`${API}/plateforme/entreprises`, ({ request }) => {
      pagesDemandees.push(new URL(request.url).searchParams.get('page') ?? '')
      return HttpResponse.json({ elements: liste, page: 0, taille: 50, total })
    }),
  )
  return { liste, pagesDemandees }
}

async function ouvrirPlateforme(chemin = '/plateforme') {
  sessionOuverte(MOI_ADMIN)
  const application = ouvrir(chemin)
  await screen.findByRole('heading', { level: 1, name: 'Entreprises' })
  return application
}

describe('PageEntreprises', () => {
  it('se présente sous une barre navy titrée « Administration de la plateforme »', async () => {
    entreprisesEnMemoire([MAQUIS])
    await ouvrirPlateforme()

    const barre = screen.getByRole('banner')
    expect(barre).toHaveClass('bg-barre-fond')
    expect(barre).toHaveTextContent('Administration de la plateforme')
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it('liste les entreprises avec leur pays, leurs établissements et un statut teinté', async () => {
    entreprisesEnMemoire([MAQUIS, FLAMBOYANT])
    await ouvrirPlateforme()

    const tableau = await screen.findByRole('table', { name: 'Entreprises clientes' })
    const ligneMaquis = within(tableau).getByRole('row', { name: /Maquis Chez Tanti/ })
    const ligneFlamboyant = within(tableau).getByRole('row', { name: /Bar Le Flamboyant/ })
    expect(ligneMaquis).toHaveTextContent('Maquis Chez Tanti')
    expect(ligneMaquis).toHaveTextContent('Créée le 28/09/2026')
    expect(ligneMaquis).toHaveTextContent('Togo')
    expect(within(ligneMaquis).getByRole('cell', { name: '2' })).toHaveClass('chiffres')
    expect(within(ligneMaquis).getByText('Active')).toHaveClass('bg-succes-fond', 'rounded-petit')
    expect(within(ligneFlamboyant).getByText('Suspendue')).toHaveClass('bg-danger-fond')
    expect(ligneFlamboyant).toHaveTextContent('Côte d’Ivoire')
  })

  it('pagine la liste', async () => {
    const { pagesDemandees } = entreprisesEnMemoire([MAQUIS], 120)
    await ouvrirPlateforme()

    await userEvent.click(await screen.findByRole('button', { name: 'Page suivante' }))

    await waitFor(() => {
      expect(pagesDemandees).toEqual(['0', '1'])
    })
  })

  it('invite à créer la première entreprise quand il n’y en a aucune', async () => {
    entreprisesEnMemoire([])
    await ouvrirPlateforme()

    expect(await screen.findByRole('heading', { name: 'Aucune entreprise' })).toBeVisible()
    const liens = screen.getAllByRole('link', { name: 'Créer une entreprise' })
    expect(liens).toHaveLength(1)
    expect(liens[0]).toHaveAttribute('href', '/plateforme/entreprises/nouvelle')
  })

  it('suspend une entreprise après une confirmation explicite', async () => {
    const { liste } = entreprisesEnMemoire([MAQUIS])
    let suspensions = 0
    serveurMsw.use(
      http.post(`${API}/plateforme/entreprises/${MAQUIS.id}/suspension`, () => {
        suspensions += 1
        liste[0] = { ...MAQUIS, statut: 'SUSPENDUE' }
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await ouvrirPlateforme()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Suspendre Maquis Chez Tanti' }),
    )
    const dialogue = screen.getByRole('dialog', { name: 'Suspendre Maquis Chez Tanti ?' })
    expect(dialogue).toHaveTextContent('les sessions en cours seront coupées')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Suspendre l’entreprise' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Maquis Chez Tanti est suspendue.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Suspendue')).toBeVisible()
    expect(suspensions).toBe(1)
  })

  it('ne suspend rien quand on garde l’entreprise active', async () => {
    entreprisesEnMemoire([MAQUIS])
    await ouvrirPlateforme()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Suspendre Maquis Chez Tanti' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Garder l’entreprise active' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('réactive une entreprise suspendue', async () => {
    const { liste } = entreprisesEnMemoire([FLAMBOYANT])
    serveurMsw.use(
      http.post(`${API}/plateforme/entreprises/${FLAMBOYANT.id}/reactivation`, () => {
        liste[0] = { ...FLAMBOYANT, statut: 'ACTIVE' }
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await ouvrirPlateforme()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Réactiver Bar Le Flamboyant' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Réactiver l’entreprise' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Bar Le Flamboyant est de nouveau active.',
    )
  })

  it('garde le dialogue ouvert et explique un échec', async () => {
    entreprisesEnMemoire([MAQUIS])
    serveurMsw.use(
      http.post(`${API}/plateforme/entreprises/${MAQUIS.id}/suspension`, () =>
        HttpResponse.json(
          { statut: 500, code: 'ERREUR_INTERNE', message: 'x', traceId: 'c0ffee42' },
          { status: 500 },
        ),
      ),
    )
    await ouvrirPlateforme()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Suspendre Maquis Chez Tanti' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Suspendre l’entreprise' }))

    const dialogue = screen.getByRole('dialog')
    expect(await within(dialogue).findByRole('alert')).toHaveTextContent('c0ffee42')
  })

  it('confirme la création d’une entreprise au retour sur la liste', async () => {
    entreprisesEnMemoire([MAQUIS])
    await ouvrirPlateforme('/plateforme?creee=Maquis%20Chez%20Tanti')

    expect(screen.getByRole('status')).toHaveTextContent(
      'Maquis Chez Tanti a été créée. Le propriétaire se connecte avec son téléphone ou son e-mail et le mot de passe provisoire.',
    )
  })
})
