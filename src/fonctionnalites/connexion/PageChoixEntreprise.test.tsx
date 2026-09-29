import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, FLAMBOYANT, MAQUIS, MOI_TANTI, ouvrir } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'

const MOI_FLAMBOYANT = {
  ...MOI_TANTI,
  entrepriseCourante: {
    id: FLAMBOYANT.id,
    nom: FLAMBOYANT.nom,
    pays: 'TG',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Lome',
  },
  entreprises: [MAQUIS, FLAMBOYANT],
}

describe('PageChoixEntreprise', () => {
  it('liste les entreprises du compte et ouvre celle choisie', async () => {
    let corps: unknown = null
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, async ({ request }) => {
        const texte = await request.text()
        if (texte === '') return HttpResponse.json({ entreprises: [MAQUIS, FLAMBOYANT] })
        corps = JSON.parse(texte)
        return HttpResponse.json({
          jetonAcces: 'eyJ.flamboyant',
          entrepriseCourante: FLAMBOYANT.id,
          entreprises: [MAQUIS, FLAMBOYANT],
        })
      }),
      http.get(`${API}/moi`, () => HttpResponse.json(MOI_FLAMBOYANT)),
    )
    const { routeur } = ouvrir('/choix-entreprise')

    const liste = await screen.findByRole('list', { name: 'Entreprises de votre compte' })
    expect(liste).toHaveTextContent('Maquis Chez Tanti')
    await userEvent.click(screen.getByRole('button', { name: 'Bar Le Flamboyant' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
    expect(routeur.state.location.pathname).toBe('/gestion')
    expect(corps).toEqual({ entrepriseId: FLAMBOYANT.id })
    expect(screen.getByRole('banner')).toHaveTextContent('Bar Le Flamboyant')
  })

  it('explique un refus sans perdre le choix', async () => {
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, async ({ request }) => {
        if ((await request.text()) === '') {
          return HttpResponse.json({ entreprises: [MAQUIS, FLAMBOYANT] })
        }
        return HttpResponse.json(
          { statut: 403, code: 'ENTREPRISE_SUSPENDUE', message: 'x' },
          { status: 403 },
        )
      }),
    )
    ouvrir('/choix-entreprise')

    await userEvent.click(await screen.findByRole('button', { name: 'Bar Le Flamboyant' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'L’accès à cette entreprise est suspendu.',
    )
    expect(screen.getByRole('button', { name: 'Maquis Chez Tanti' })).toBeEnabled()
  })
})
