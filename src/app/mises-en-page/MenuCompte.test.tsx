import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  API,
  FLAMBOYANT,
  MAQUIS,
  MOI_TANTI,
  ouvrir,
  sessionOuverte,
} from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'

const MOI_DEUX_ENTREPRISES = { ...MOI_TANTI, entreprises: [MAQUIS, FLAMBOYANT] }
const MOI_FLAMBOYANT = {
  ...MOI_DEUX_ENTREPRISES,
  entrepriseCourante: {
    id: FLAMBOYANT.id,
    nom: FLAMBOYANT.nom,
    pays: 'CI',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Abidjan',
  },
}

function titreBarre() {
  return within(screen.getByRole('banner')).getByText(/^(Maquis Chez Tanti|Bar Le Flamboyant)$/, {
    selector: 'span',
  })
}

describe('MenuCompte', () => {
  it('montre l’utilisateur connecté et le déconnecte', async () => {
    sessionOuverte(MOI_TANTI)
    let deconnexions = 0
    serveurMsw.use(
      http.post(`${API}/auth/deconnexion`, () => {
        deconnexions += 1
        return new HttpResponse(null, { status: 204 })
      }),
      http.get(`${API}/public/configuration`, () =>
        HttpResponse.json({ inscriptionOuverte: false }),
      ),
    )
    const { routeur } = ouvrir('/gestion')

    expect(await screen.findByText('Tanti Akouvi')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Entreprise' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    await screen.findByRole('heading', { name: 'Se connecter' })
    expect(routeur.state.location.pathname).toBe('/connexion')
    expect(deconnexions).toBe(1)
  })

  it('change d’entreprise depuis la barre haute et en montre aussitôt les données', async () => {
    let entrepriseCourante = MAQUIS.id
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, async ({ request }) => {
        const texte = await request.text()
        if (texte !== '')
          entrepriseCourante = (JSON.parse(texte) as { entrepriseId: string }).entrepriseId
        return HttpResponse.json({
          jetonAcces: `eyJ.${entrepriseCourante}`,
          entrepriseCourante,
          entreprises: [MAQUIS, FLAMBOYANT],
        })
      }),
      http.get(`${API}/moi`, () =>
        HttpResponse.json(entrepriseCourante === MAQUIS.id ? MOI_DEUX_ENTREPRISES : MOI_FLAMBOYANT),
      ),
    )
    ouvrir('/gestion')

    const selecteur = await screen.findByRole('combobox', { name: 'Entreprise' })
    expect(titreBarre()).toHaveTextContent('Maquis Chez Tanti')
    await userEvent.selectOptions(selecteur, FLAMBOYANT.id)

    await waitFor(() => {
      expect(titreBarre()).toHaveTextContent('Bar Le Flamboyant')
    })
    expect(screen.getByRole('banner')).toHaveTextContent('Côte d’Ivoire')
  })

  it('signale un changement refusé sans perdre la session', async () => {
    sessionOuverte(MOI_DEUX_ENTREPRISES)
    ouvrir('/gestion')
    const selecteur = await screen.findByRole('combobox', { name: 'Entreprise' })
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, () =>
        HttpResponse.json(
          { statut: 403, code: 'ENTREPRISE_SUSPENDUE', message: 'x' },
          { status: 403 },
        ),
      ),
    )

    await userEvent.selectOptions(selecteur, FLAMBOYANT.id)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'L’accès à cette entreprise est suspendu.',
    )
    expect(titreBarre()).toHaveTextContent('Maquis Chez Tanti')
    expect(selecteur).toHaveValue(MAQUIS.id)
  })
})
