import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API, MOI_ADMIN, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { EntreprisePlateforme } from '../../partage/api/contrat'

const MAQUIS: EntreprisePlateforme = {
  id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01',
  nom: 'Maquis Chez Tanti',
  pays: 'TG',
  devise: 'XOF',
  nombreEtablissements: 2,
  statut: 'ACTIVE',
  creeLe: '2026-09-28T10:15:00Z',
  derniereVenteLe: '2026-10-02T20:41:00Z',
}
const FLAMBOYANT: EntreprisePlateforme = {
  id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a02',
  nom: 'Bar Le Flamboyant',
  pays: 'CI',
  devise: 'XOF',
  nombreEtablissements: 1,
  statut: 'SUSPENDUE',
  creeLe: '2026-09-12T08:00:00Z',
}
const BAOBAB: EntreprisePlateforme = {
  id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a03',
  nom: 'Restaurant Le Baobab',
  pays: 'SN',
  devise: 'XOF',
  nombreEtablissements: 2,
  statut: 'ACTIVE',
  creeLe: '2026-09-02T08:00:00Z',
}

function entreprisesEnMemoire(depart: EntreprisePlateforme[], total = depart.length) {
  const liste = [...depart]
  const pagesDemandees: string[] = []
  const recherches: string[] = []
  serveurMsw.use(
    http.get(`${API}/plateforme/entreprises`, ({ request }) => {
      const parametres = new URL(request.url).searchParams
      pagesDemandees.push(parametres.get('page') ?? '')
      recherches.push(parametres.toString())
      return HttpResponse.json({ elements: liste, page: 0, taille: 50, total })
    }),
  )
  return { liste, pagesDemandees, recherches }
}

async function ouvrirPlateforme(chemin = '/plateforme') {
  sessionOuverte(MOI_ADMIN)
  const application = ouvrir(chemin)
  await screen.findByRole('heading', { level: 1, name: 'Entreprises' })
  return application
}

describe('PageEntreprises', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

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
    expect(ligneMaquis).toHaveTextContent('Togo, XOF')
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

  it('mène à la fiche de chaque entreprise, où se font désormais suspension et réactivation', async () => {
    entreprisesEnMemoire([MAQUIS, FLAMBOYANT])
    await ouvrirPlateforme()

    const lien = await screen.findByRole('link', { name: 'Ouvrir la fiche de Maquis Chez Tanti' })
    expect(lien).toHaveAttribute('href', `/plateforme/entreprises/${MAQUIS.id}`)
    expect(screen.queryByRole('button', { name: /Suspendre|Réactiver/ })).not.toBeInTheDocument()
  })

  it('montre la dernière vente, sans montant, et signale ce qui mérite un appel', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-03T12:00:00Z'), toFake: ['Date'] })
    entreprisesEnMemoire([
      MAQUIS,
      { ...BAOBAB, derniereVenteLe: '2026-09-24T21:00:00Z' },
      { ...BAOBAB, id: 'nouvelle', nom: 'Chez Mama Adjoa', creeLe: '2026-10-01T09:00:00Z' },
    ])
    await ouvrirPlateforme()

    const tableau = await screen.findByRole('table', { name: 'Entreprises clientes' })
    expect(within(tableau).getByRole('row', { name: /Maquis Chez Tanti/ })).toHaveTextContent(
      /02\/10\/2026/,
    )
    expect(within(tableau).getByRole('row', { name: /Le Baobab/ })).toHaveTextContent(
      'Sans vente depuis 7 jours',
    )
    const nouvelle = within(tableau).getByRole('row', { name: /Chez Mama Adjoa/ })
    expect(nouvelle).toHaveTextContent('Aucune vente')
    expect(within(nouvelle).getByText('Nouvelle')).toHaveClass('rounded-petit')
  })

  it('cherche par nom d’entreprise ou de propriétaire, depuis la première page', async () => {
    const { recherches } = entreprisesEnMemoire([MAQUIS], 120)
    await ouvrirPlateforme()
    await userEvent.click(await screen.findByRole('button', { name: 'Page suivante' }))

    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher' }), 'Tanti{Enter}')

    await waitFor(() => {
      expect(recherches.at(-1)).toBe('recherche=Tanti&page=0&taille=50')
    })
  })

  it('confirme la création d’une entreprise au retour sur la liste', async () => {
    entreprisesEnMemoire([MAQUIS])
    await ouvrirPlateforme('/plateforme?creee=Maquis%20Chez%20Tanti')

    expect(screen.getByRole('status')).toHaveTextContent('Maquis Chez Tanti a été créée.')
  })
})
