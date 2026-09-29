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
  sessionOuverte,
} from '../../tests/application'
import { serveurMsw } from '../../tests/serveurMsw'

async function attendreChemin(routeur: ReturnType<typeof ouvrir>['routeur'], chemin: string) {
  await waitFor(() => {
    expect(routeur.state.location.pathname).toBe(chemin)
  })
}

describe('routeur', () => {
  describe('accueil', () => {
    it('mène à la connexion sans session', async () => {
      sessionAbsente()
      const { routeur } = ouvrir('/')

      expect(await screen.findByRole('heading', { name: 'Se connecter' })).toBeVisible()
      await attendreChemin(routeur, '/connexion')
    })

    it('mène à la gestion pour une session d’entreprise', async () => {
      sessionOuverte(MOI_TANTI)
      const { routeur } = ouvrir('/')

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' }),
      ).toBeVisible()
      await attendreChemin(routeur, '/gestion')
    })

    it('mène à l’administration pour une session plateforme', async () => {
      sessionOuverte(MOI_ADMIN)
      serveurMsw.use(
        http.get(`${API}/plateforme/entreprises`, () =>
          HttpResponse.json({ elements: [], page: 0, taille: 50, total: 0 }),
        ),
      )
      const { routeur } = ouvrir('/')

      expect(await screen.findByRole('heading', { level: 1, name: 'Entreprises' })).toBeVisible()
      await attendreChemin(routeur, '/plateforme')
    })

    it('demande de choisir l’entreprise quand le compte en a plusieurs', async () => {
      serveurMsw.use(
        http.post(`${API}/auth/rafraichir`, () =>
          HttpResponse.json({ entreprises: [MAQUIS, FLAMBOYANT] }),
        ),
      )
      const { routeur } = ouvrir('/gestion')

      expect(await screen.findByRole('heading', { name: 'Choisir l’entreprise' })).toBeVisible()
      await attendreChemin(routeur, '/choix-entreprise')
    })
  })

  describe('gardes', () => {
    it.each(['/gestion', '/gestion/etablissements', '/caisse', '/plateforme'])(
      'renvoie %s vers la connexion sans session',
      async (chemin) => {
        sessionAbsente()
        const { routeur } = ouvrir(chemin)

        await screen.findByRole('heading', { name: 'Se connecter' })
        await attendreChemin(routeur, '/connexion')
      },
    )

    it('garde l’espace plateforme hors de portée d’une session d’entreprise', async () => {
      sessionOuverte(MOI_TANTI)
      const { routeur } = ouvrir('/plateforme')

      await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })
      await attendreChemin(routeur, '/gestion')
    })

    it('garde la gestion et la caisse hors de portée d’une session plateforme', async () => {
      sessionOuverte(MOI_ADMIN)
      serveurMsw.use(
        http.get(`${API}/plateforme/entreprises`, () =>
          HttpResponse.json({ elements: [], page: 0, taille: 50, total: 0 }),
        ),
      )
      const { routeur } = ouvrir('/caisse')

      await screen.findByRole('heading', { level: 1, name: 'Entreprises' })
      await attendreChemin(routeur, '/plateforme')
    })

    it('mène directement à son espace une session déjà ouverte qui ouvre la connexion', async () => {
      sessionOuverte(MOI_TANTI)
      const { routeur } = ouvrir('/connexion')

      await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })
      await attendreChemin(routeur, '/gestion')
    })

    it('n’ouvre le choix d’entreprise que s’il reste une entreprise à choisir', async () => {
      sessionAbsente()
      const { routeur } = ouvrir('/choix-entreprise')

      await screen.findByRole('heading', { name: 'Se connecter' })
      await attendreChemin(routeur, '/connexion')
    })

    it('renvoie l’inscription vers la connexion quand elle est fermée', async () => {
      sessionAbsente({ inscriptionOuverte: false })
      const { routeur } = ouvrir('/inscription')

      await screen.findByRole('heading', { name: 'Se connecter' })
      await attendreChemin(routeur, '/connexion')
    })

    it('renvoie vers la connexion quand la session expire en cours d’usage', async () => {
      sessionOuverte(MOI_TANTI)
      const { routeur } = ouvrir('/gestion')
      await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })
      serveurMsw.use(
        http.get(`${API}/etablissements`, () =>
          HttpResponse.json(
            { statut: 401, code: 'NON_AUTHENTIFIE', message: 'x' },
            { status: 401 },
          ),
        ),
        http.post(`${API}/auth/rafraichir`, () =>
          HttpResponse.json(
            { statut: 401, code: 'SESSION_EXPIREE', message: 'x' },
            { status: 401 },
          ),
        ),
        http.get(`${API}/public/configuration`, () =>
          HttpResponse.json({ inscriptionOuverte: false }),
        ),
      )

      await userEvent.click(screen.getByRole('link', { name: 'Établissements' }))

      await screen.findByRole('heading', { name: 'Se connecter' })
      await attendreChemin(routeur, '/connexion')
    })
  })

  it('ouvre la caisse en plein écran, sous la barre de l’entreprise', async () => {
    sessionOuverte(MOI_TANTI)
    ouvrir('/caisse')

    expect(await screen.findByRole('banner')).toHaveTextContent('Maquis Chez Tanti')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('ouvre la gestion avec sa navigation latérale et l’entrée active marquée', async () => {
    sessionOuverte(MOI_TANTI)
    ouvrir('/gestion')

    expect(await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Caisse' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Établissements' })).toHaveAttribute(
      'href',
      '/gestion/etablissements',
    )
  })

  it('ouvre un reçu public sans rien demander à la session', async () => {
    ouvrir('/r/abc')

    expect(await screen.findByText('abc')).toBeInTheDocument()
  })

  it('affiche une page introuvable qui ramène à l’accueil', async () => {
    ouvrir('/cuisine/ecran')

    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument()
    expect(screen.getByText(/\/cuisine\/ecran/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revenir à l’accueil' })).toHaveAttribute('href', '/')
  })

  it('traite une adresse inconnue sous la gestion comme une page introuvable', async () => {
    sessionOuverte(MOI_TANTI)
    ouvrir('/gestion/inconnue')

    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument()
    expect(screen.getAllByRole('banner')).toHaveLength(1)
  })

  it('présente une panne au chargement de la session avec un bouton pour réessayer', async () => {
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, () =>
        HttpResponse.json({ jetonAcces: 'eyJ.valide', entreprises: [MAQUIS] }),
      ),
      http.get(`${API}/moi`, () =>
        HttpResponse.json(
          { statut: 500, code: 'ERREUR_INTERNE', message: 'x', traceId: 'c0ffee42' },
          { status: 500 },
        ),
      ),
    )
    ouvrir('/gestion')

    expect(
      await screen.findByRole('heading', { name: 'Impossible d’afficher cette page' }),
    ).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('c0ffee42')

    serveurMsw.use(http.get(`${API}/moi`, () => HttpResponse.json(MOI_TANTI)))
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
  })
})
