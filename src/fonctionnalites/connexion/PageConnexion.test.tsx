import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  API,
  FLAMBOYANT,
  MAQUIS,
  MOI_ADMIN,
  MOI_TANTI,
  ouvrir,
  sessionAbsente,
} from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'

function connexionRepond(corps: object, statut = 200, entetes: Record<string, string> = {}) {
  serveurMsw.use(
    http.post(`${API}/auth/connexion`, () =>
      HttpResponse.json(corps, { status: statut, headers: entetes }),
    ),
  )
}

async function seConnecter(identifiant = '90 11 22 33', motDePasse = 'Tanti-2026') {
  await userEvent.type(await screen.findByLabelText(/Téléphone ou e-mail/), identifiant)
  await userEvent.type(screen.getByLabelText(/Mot de passe/), motDePasse)
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('PageConnexion', () => {
  it('demande l’identifiant et le mot de passe sous des libellés visibles', async () => {
    sessionAbsente()
    ouvrir('/connexion')

    const identifiant = await screen.findByLabelText(/Téléphone ou e-mail/)
    expect(identifiant).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText(/Mot de passe/)).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Se connecter' })).toHaveClass('bg-accent')
  })

  it('explique comment saisir un numéro étranger', async () => {
    sessionAbsente()
    ouvrir('/connexion')

    expect(await screen.findByLabelText(/Téléphone ou e-mail/)).toHaveAccessibleDescription(
      'Téléphone : numéro local (Togo), espaces facultatifs. Autre pays : commencez par « + » et son indicatif.',
    )
  })

  it('n’offre pas de lien de réinitialisation, mais dit à qui s’adresser', async () => {
    sessionAbsente()
    ouvrir('/connexion')

    expect(
      await screen.findByText(
        'Mot de passe oublié ? Contactez le propriétaire de votre établissement.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: /oublié/ })).not.toBeInTheDocument()
  })

  it('signale les champs vides sans appeler le serveur', async () => {
    sessionAbsente()
    ouvrir('/connexion')

    await userEvent.click(await screen.findByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Saisissez votre téléphone ou votre e-mail.')).toBeVisible()
    expect(screen.getByText('Saisissez votre mot de passe.')).toBeVisible()
  })

  it('mène le propriétaire à la gestion', async () => {
    sessionAbsente()
    let corps: unknown = null
    serveurMsw.use(
      http.post(`${API}/auth/connexion`, async ({ request }) => {
        corps = await request.json()
        return HttpResponse.json({
          compte: MOI_TANTI.compte,
          entreprises: [MAQUIS],
          jetonAcces: 'eyJ.maquis',
          entrepriseCourante: MAQUIS.id,
        })
      }),
      http.get(`${API}/moi`, () => HttpResponse.json(MOI_TANTI)),
    )
    const { routeur } = ouvrir('/connexion')

    await seConnecter()

    expect(await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
    expect(routeur.state.location.pathname).toBe('/gestion')
    expect(corps).toEqual({ identifiant: '90 11 22 33', motDePasse: 'Tanti-2026' })
  })

  it('mène l’administrateur de la plateforme à son espace', async () => {
    sessionAbsente()
    connexionRepond({ compte: MOI_ADMIN.compte, entreprises: [], jetonAcces: 'eyJ.admin' })
    serveurMsw.use(
      http.get(`${API}/moi`, () => HttpResponse.json(MOI_ADMIN)),
      http.get(`${API}/plateforme/entreprises`, () =>
        HttpResponse.json({ elements: [], page: 0, taille: 50, total: 0 }),
      ),
    )
    const { routeur } = ouvrir('/connexion')

    await seConnecter('admin@tonti.africa', 'mot-de-passe-admin')

    expect(await screen.findByText('Administration de la plateforme')).toBeVisible()
    expect(routeur.state.location.pathname).toBe('/plateforme')
  })

  it('fait choisir l’entreprise à un compte qui en a plusieurs', async () => {
    sessionAbsente()
    connexionRepond({ compte: MOI_TANTI.compte, entreprises: [MAQUIS, FLAMBOYANT] })
    const { routeur } = ouvrir('/connexion')

    await seConnecter()

    expect(await screen.findByRole('heading', { name: 'Choisir l’entreprise' })).toBeVisible()
    expect(routeur.state.location.pathname).toBe('/choix-entreprise')
  })

  it('montre le chargement dans le bouton pendant la connexion', async () => {
    sessionAbsente()
    serveurMsw.use(
      http.post(`${API}/auth/connexion`, async () => {
        await new Promise((resoudre) => setTimeout(resoudre, 50))
        return HttpResponse.json(
          { statut: 401, code: 'IDENTIFIANTS_INVALIDES', message: 'x' },
          { status: 401 },
        )
      }),
    )
    ouvrir('/connexion')

    await seConnecter()

    expect(screen.getByRole('button', { name: 'Connexion…' })).toHaveAttribute('aria-busy', 'true')
    await screen.findByRole('alert')
  })

  it.each([
    [
      'des identifiants invalides, sans dire lequel est faux',
      401,
      'IDENTIFIANTS_INVALIDES',
      {},
      'Identifiant ou mot de passe incorrect. Vérifiez votre saisie et réessayez.',
    ],
    [
      'un compte verrouillé',
      423,
      'COMPTE_VERROUILLE',
      {},
      'Trop d’essais infructueux : le compte est verrouillé pendant quelques minutes. Réessayez plus tard.',
    ],
    [
      'trop de tentatives, avec le délai',
      429,
      'TROP_DE_TENTATIVES',
      { 'Retry-After': '240' },
      'Trop de tentatives. Réessayez dans 4 min.',
    ],
    [
      'une entreprise suspendue',
      403,
      'ENTREPRISE_SUSPENDUE',
      {},
      'L’accès à cette entreprise est suspendu. Contactez le support de Tonti.',
    ],
    [
      'un compte sans entreprise',
      403,
      'AUCUNE_ENTREPRISE',
      {},
      'Ce compte n’est rattaché à aucune entreprise active. Contactez le propriétaire de votre établissement.',
    ],
  ])('explique %s en gardant la saisie', async (_cas, statut, code, entetes, message) => {
    sessionAbsente()
    connexionRepond({ statut, code, message: 'x', traceId: 'a41b7d03' }, statut, entetes)
    ouvrir('/connexion')

    await seConnecter()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText(/Téléphone ou e-mail/)).toHaveValue('90 11 22 33')
    expect(screen.getByLabelText(/Mot de passe/)).toHaveValue('Tanti-2026')
  })

  it('propose de créer son entreprise quand l’inscription est ouverte', async () => {
    sessionAbsente({ inscriptionOuverte: true })
    ouvrir('/connexion')

    expect(await screen.findByRole('link', { name: 'Créer mon entreprise' })).toHaveAttribute(
      'href',
      '/inscription',
    )
  })

  it('ne propose pas l’inscription quand elle est fermée', async () => {
    sessionAbsente({ inscriptionOuverte: false })
    ouvrir('/connexion')

    await screen.findByRole('button', { name: 'Se connecter' })
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Créer mon entreprise' })).not.toBeInTheDocument()
    })
  })
})
