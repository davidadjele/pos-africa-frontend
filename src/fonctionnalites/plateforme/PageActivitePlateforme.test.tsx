import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_ADMIN, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { EntreeActivitePlateforme, MembrePlateforme } from '../../partage/api/contrat'

const SUSPENSION: EntreeActivitePlateforme = {
  id: 'a0000000-0000-4000-8000-000000000001',
  type: 'ENTREPRISE_SUSPENDUE',
  le: '2026-10-03T15:44:00Z',
  detail: 'IMPAYE : relancé deux fois en septembre',
  entrepriseId: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a05',
  entrepriseNom: 'Maquis La Détente',
  auteurCompteId: 'c0000000-0000-4000-8000-00000000000b',
  auteurNom: 'Akossiwa Dogbe',
}
const AJOUT: EntreeActivitePlateforme = {
  id: 'a0000000-0000-4000-8000-000000000002',
  type: 'MEMBRE_AJOUTE',
  le: '2026-10-03T11:02:00Z',
  detail: 'Yao Mensah',
  auteurCompteId: 'c0000000-0000-4000-8000-00000000000a',
  auteurNom: 'Kodjo Amegah',
}
const EQUIPE: Pick<MembrePlateforme, 'compteId' | 'prenom' | 'nom'>[] = [
  { compteId: AJOUT.auteurCompteId, prenom: 'Kodjo', nom: 'Amegah' },
  { compteId: SUSPENSION.auteurCompteId, prenom: 'Akossiwa', nom: 'Dogbe' },
]

function activiteServie() {
  const demandes: string[] = []
  serveurMsw.use(
    http.get(`${API}/plateforme/activite`, ({ request }) => {
      demandes.push(new URL(request.url).searchParams.toString())
      return HttpResponse.json({ elements: [SUSPENSION, AJOUT], page: 0, taille: 50, total: 2 })
    }),
    http.get(`${API}/plateforme/equipe`, () => HttpResponse.json(EQUIPE)),
  )
  return demandes
}

describe('PageActivitePlateforme', () => {
  it('montre qui a fait quoi, sur quelle entreprise', async () => {
    activiteServie()
    sessionOuverte(MOI_ADMIN)
    ouvrir('/plateforme/activite')

    const lignes = within(
      await screen.findByRole('table', { name: 'Activité de la plateforme' }),
    ).getAllByRole('row')
    expect(lignes[1]).toHaveTextContent('Akossiwa Dogbe')
    expect(lignes[1]).toHaveTextContent('Suspension')
    expect(lignes[1]).toHaveTextContent('Impayé : relancé deux fois en septembre')
    expect(screen.getByRole('link', { name: 'Maquis La Détente' })).toHaveAttribute(
      'href',
      `/plateforme/entreprises/${SUSPENSION.entrepriseId ?? ''}`,
    )
    expect(lignes[2]).toHaveTextContent('Membre ajouté')
    expect(lignes[2]).toHaveTextContent('Équipe')
  })

  it('filtre par action, par membre et par entreprise', async () => {
    const demandes = activiteServie()
    sessionOuverte(MOI_ADMIN)
    ouvrir('/plateforme/activite')
    await screen.findByRole('table', { name: 'Activité de la plateforme' })

    await userEvent.selectOptions(screen.getByLabelText('Action'), 'Suspension')
    await userEvent.selectOptions(screen.getByLabelText('Membre'), 'Akossiwa Dogbe')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Entreprise' }), 'détente{Enter}')

    await waitFor(() => {
      expect(demandes.at(-1)).toBe(
        `type=ENTREPRISE_SUSPENDUE&auteur=${SUSPENSION.auteurCompteId}&recherche=d%C3%A9tente&page=0&taille=50`,
      )
    })
  })
})
