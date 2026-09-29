import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_ADMIN, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'

async function ouvrirCreation() {
  sessionOuverte(MOI_ADMIN)
  serveurMsw.use(
    http.get(`${API}/plateforme/entreprises`, () =>
      HttpResponse.json({ elements: [], page: 0, taille: 50, total: 0 }),
    ),
  )
  const application = ouvrir('/plateforme/entreprises/nouvelle')
  await screen.findByRole('heading', { level: 1, name: 'Nouvelle entreprise' })
  return application
}

function section(nom: string) {
  return within(screen.getByRole('group', { name: nom }))
}

async function remplir() {
  const entreprise = section('Entreprise')
  await userEvent.type(entreprise.getByLabelText(/^Nom de l’entreprise/), 'Maquis Chez Tanti')
  const proprietaire = section('Propriétaire')
  await userEvent.type(proprietaire.getByLabelText(/^Prénom/), 'Tanti')
  await userEvent.type(proprietaire.getByLabelText(/^Nom/), 'Akouvi')
  await userEvent.type(proprietaire.getByLabelText(/^Téléphone/), '+228 90 11 22 33')
  const etablissement = section('Premier établissement')
  await userEvent.type(etablissement.getByLabelText(/^Nom de l’établissement/), 'Bè Kpota')
  await userEvent.type(etablissement.getByLabelText(/^Code/), 'BE')
  await userEvent.type(etablissement.getByLabelText(/^Ville/), 'Lomé')
}

describe('PageNouvelleEntreprise', () => {
  it('part du Togo, en francs CFA, à l’heure de Lomé et en français', async () => {
    await ouvrirCreation()

    const entreprise = section('Entreprise')
    expect(entreprise.getByLabelText(/^Pays/)).toHaveValue('TG')
    expect(entreprise.getByLabelText(/^Devise/)).toHaveValue('XOF')
    expect(entreprise.getByLabelText(/^Fuseau horaire/)).toHaveValue('Africa/Lome')
    expect(entreprise.getByLabelText(/^Langue/)).toHaveValue('fr')
  })

  it('propose la devise et le fuseau du pays choisi', async () => {
    await ouvrirCreation()
    const entreprise = section('Entreprise')

    await userEvent.selectOptions(entreprise.getByLabelText(/^Pays/), 'CM')

    expect(entreprise.getByLabelText(/^Devise/)).toHaveValue('XAF')
    expect(entreprise.getByLabelText(/^Fuseau horaire/)).toHaveValue('Africa/Douala')
  })

  it('guide la saisie du téléphone selon le pays choisi', async () => {
    await ouvrirCreation()
    const proprietaire = section('Propriétaire')
    const telephone = proprietaire.getByLabelText(/^Téléphone/)

    expect(proprietaire.getByText('+228')).toBeVisible()
    expect(telephone).toHaveAttribute('placeholder', '90 11 23 45')
    expect(telephone).toHaveAccessibleDescription(
      'Numéro local (Togo), espaces facultatifs. Autre pays : commencez par « + » et son indicatif.',
    )

    await userEvent.selectOptions(section('Entreprise').getByLabelText(/^Pays/), 'CI')

    expect(proprietaire.getByText('+225')).toBeVisible()
    expect(telephone).toHaveAttribute('placeholder', '01 23 45 67 89')
    expect(telephone).toHaveAccessibleDescription(
      'Numéro local (Côte d’Ivoire), espaces facultatifs. Autre pays : commencez par « + » et son indicatif.',
    )
  })

  it('retire l’indicatif affiché dès que l’on saisit le sien', async () => {
    await ouvrirCreation()
    const proprietaire = section('Propriétaire')

    await userEvent.type(proprietaire.getByLabelText(/^Téléphone/), '+233 23 123 4567')

    expect(proprietaire.queryByText('+228')).not.toBeInTheDocument()
  })

  it('crée l’entreprise, son propriétaire et son premier établissement', async () => {
    let corps: unknown = null
    serveurMsw.use(
      http.post(`${API}/plateforme/entreprises`, async ({ request }) => {
        corps = await request.json()
        return HttpResponse.json(
          {
            id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01',
            nom: 'Maquis Chez Tanti',
            etablissementId: '9a1f0c2e-0000-4b8e-8f6a-000000000001',
            proprietaireCompteId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0001',
            compteExistant: false,
            motDePasseTemporaire: 'kp7mzr4qtx9w',
          },
          { status: 201 },
        )
      }),
    )
    const { routeur } = await ouvrirCreation()

    await remplir()
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’entreprise' }))

    const codes = await screen.findByRole('dialog', { name: 'Codes d’accès de Tanti Akouvi' })
    expect(within(codes).getByText('zr4q')).toBeVisible()
    expect(codes).toHaveTextContent('+228 90 11 22 33')
    await userEvent.click(within(codes).getByRole('button', { name: 'J’ai noté les codes' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Maquis Chez Tanti a été créée.')
    expect(routeur.state.location.pathname).toBe('/plateforme')
    expect(corps).toEqual({
      entreprise: {
        nom: 'Maquis Chez Tanti',
        pays: 'TG',
        devise: 'XOF',
        fuseauHoraire: 'Africa/Lome',
        langue: 'fr',
      },
      proprietaire: {
        prenom: 'Tanti',
        nom: 'Akouvi',
        telephone: '+228 90 11 22 33',
      },
      etablissement: { nom: 'Bè Kpota', code: 'BE', ville: 'Lomé' },
    })
  })

  it('exige un téléphone ou un e-mail pour le propriétaire', async () => {
    await ouvrirCreation()

    await userEvent.click(screen.getByRole('button', { name: 'Créer l’entreprise' }))

    expect(
      await section('Propriétaire').findByText('Saisissez un téléphone ou un e-mail.'),
    ).toBeVisible()
  })

  it('place sous les champs les erreurs renvoyées par le serveur', async () => {
    serveurMsw.use(
      http.post(`${API}/plateforme/entreprises`, () =>
        HttpResponse.json(
          {
            statut: 400,
            code: 'REQUETE_INVALIDE',
            message: 'x',
            champs: [{ champ: 'proprietaire.telephone', message: 'numéro de téléphone invalide' }],
          },
          { status: 400 },
        ),
      ),
    )
    await ouvrirCreation()

    await remplir()
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’entreprise' }))

    const proprietaire = section('Propriétaire')
    await waitFor(() => {
      expect(proprietaire.getByLabelText(/^Téléphone/)).toHaveAccessibleDescription(
        'numéro de téléphone invalide',
      )
    })
    expect(proprietaire.queryByLabelText(/^Mot de passe/)).not.toBeInTheDocument()
  })

  it('dit quand le propriétaire avait déjà un compte', async () => {
    serveurMsw.use(
      http.post(`${API}/plateforme/entreprises`, () =>
        HttpResponse.json(
          {
            id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a02',
            nom: 'Bar Le Flamboyant',
            etablissementId: '9a1f0c2e-0000-4b8e-8f6a-000000000002',
            proprietaireCompteId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0001',
            compteExistant: true,
          },
          { status: 201 },
        ),
      ),
    )
    await ouvrirCreation()

    await remplir()
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’entreprise' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Bar Le Flamboyant a été créée et rattachée au compte existant du propriétaire',
    )
  })
})
