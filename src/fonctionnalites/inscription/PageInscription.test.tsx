import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MAQUIS, MOI_TANTI, ouvrir, sessionAbsente } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'

describe('PageInscription', () => {
  it('crée l’entreprise du propriétaire puis le connecte directement', async () => {
    sessionAbsente({ inscriptionOuverte: true })
    let corps: unknown = null
    serveurMsw.use(
      http.post(`${API}/inscription`, async ({ request }) => {
        corps = await request.json()
        return HttpResponse.json(
          {
            compte: MOI_TANTI.compte,
            entreprises: [MAQUIS],
            jetonAcces: 'eyJ.maquis',
            entrepriseCourante: MAQUIS.id,
          },
          { status: 201 },
        )
      }),
      http.get(`${API}/moi`, () => HttpResponse.json(MOI_TANTI)),
    )
    const { routeur } = ouvrir('/inscription')

    await screen.findByRole('heading', { level: 1, name: 'Créer mon entreprise' })
    const entreprise = within(screen.getByRole('group', { name: 'Entreprise' }))
    await userEvent.type(entreprise.getByLabelText(/^Nom de l’entreprise/), 'Maquis Chez Tanti')
    const proprietaire = within(screen.getByRole('group', { name: 'Propriétaire' }))
    await userEvent.type(proprietaire.getByLabelText(/^Prénom/), 'Tanti')
    await userEvent.type(proprietaire.getByLabelText(/^Nom/), 'Akouvi')
    await userEvent.type(proprietaire.getByLabelText(/^E-mail/), 'tanti@maquis.tg')
    await userEvent.type(proprietaire.getByLabelText(/^Mot de passe/), 'Tanti-2026')
    const etablissement = within(screen.getByRole('group', { name: 'Premier établissement' }))
    await userEvent.type(etablissement.getByLabelText(/^Nom de l’établissement/), 'Bè Kpota')
    await userEvent.type(etablissement.getByLabelText(/^Code/), 'be')
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon entreprise' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
    expect(routeur.state.location.pathname).toBe('/gestion')
    expect(corps).toMatchObject({
      proprietaire: {
        prenom: 'Tanti',
        nom: 'Akouvi',
        email: 'tanti@maquis.tg',
        motDePasse: 'Tanti-2026',
      },
      etablissement: { nom: 'Bè Kpota', code: 'BE' },
    })
  })

  it('exige un mot de passe d’au moins 8 caractères', async () => {
    sessionAbsente({ inscriptionOuverte: true })
    ouvrir('/inscription')

    await screen.findByRole('heading', { level: 1, name: 'Créer mon entreprise' })
    await userEvent.type(screen.getByLabelText(/^Mot de passe/), 'court')
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon entreprise' }))

    expect(screen.getByLabelText(/^Mot de passe/)).toHaveAccessibleDescription(
      'Le mot de passe doit faire au moins 8 caractères.',
    )
  })

  it('ramène à la connexion pour qui a déjà un compte', async () => {
    sessionAbsente({ inscriptionOuverte: true })
    ouvrir('/inscription')

    expect(await screen.findByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion',
    )
  })
})
