import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'

const MOI_TEMPORAIRE = { ...MOI_TANTI, compte: { ...MOI_TANTI.compte, motDePasseAChanger: true } }

async function ouvrirChangement() {
  sessionOuverte(MOI_TEMPORAIRE)
  const application = ouvrir('/changer-mot-de-passe')
  await screen.findByRole('heading', { level: 1, name: 'Choisissez votre mot de passe' })
  return application
}

async function remplir(actuel: string, nouveau: string, confirmation = nouveau) {
  await userEvent.type(screen.getByLabelText(/^Mot de passe temporaire/), actuel)
  await userEvent.type(screen.getByLabelText(/^Nouveau mot de passe/), nouveau)
  await userEvent.type(screen.getByLabelText(/^Confirmez le nouveau mot de passe/), confirmation)
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer et me reconnecter' }))
}

describe('PageChangerMotDePasse', () => {
  it('vérifie la confirmation avant d’envoyer quoi que ce soit', async () => {
    let appels = 0
    serveurMsw.use(
      http.post(`${API}/moi/mot-de-passe`, () => {
        appels++
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await ouvrirChangement()

    await remplir('kp7mzr4qtx9w', 'Bekpota-Soir-26', 'Bekpota-Soir-27')

    expect(
      await screen.findByLabelText(/^Confirmez le nouveau mot de passe/),
    ).toHaveAccessibleDescription('Les deux mots de passe ne correspondent pas.')
    expect(appels).toBe(0)
  })

  it('remplace le mot de passe temporaire puis ramène à la connexion', async () => {
    let corps: unknown = null
    serveurMsw.use(
      http.post(`${API}/moi/mot-de-passe`, async ({ request }) => {
        corps = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
      http.post(`${API}/auth/deconnexion`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${API}/auth/rafraichir`, () =>
        HttpResponse.json({ statut: 401, code: 'SESSION_EXPIREE', message: 'x' }, { status: 401 }),
      ),
      http.get(`${API}/public/configuration`, () =>
        HttpResponse.json({ inscriptionOuverte: false }),
      ),
    )
    const { routeur } = await ouvrirChangement()

    await remplir('kp7mzr4qtx9w', 'Bekpota-Soir-26')

    expect(
      await screen.findByText(
        'Mot de passe enregistré. Reconnectez-vous avec votre nouveau mot de passe.',
      ),
    ).toBeVisible()
    await waitFor(() => {
      expect(routeur.state.location.pathname).toBe('/connexion')
    })
    expect(corps).toEqual({
      motDePasseActuel: 'kp7mzr4qtx9w',
      nouveauMotDePasse: 'Bekpota-Soir-26',
    })
  })

  it('place sous le champ un mot de passe temporaire refusé par le serveur', async () => {
    serveurMsw.use(
      http.post(`${API}/moi/mot-de-passe`, () =>
        HttpResponse.json(
          {
            statut: 400,
            code: 'REQUETE_INVALIDE',
            message: 'x',
            champs: [{ champ: 'motDePasseActuel', message: 'Mot de passe actuel incorrect.' }],
          },
          { status: 400 },
        ),
      ),
    )
    await ouvrirChangement()

    await remplir('pas-le-bon', 'Bekpota-Soir-26')

    expect(await screen.findByLabelText(/^Mot de passe temporaire/)).toHaveAccessibleDescription(
      'Mot de passe actuel incorrect.',
    )
  })
})
