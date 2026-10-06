import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  API,
  FLAMBOYANT,
  MAQUIS,
  MOI_ADMIN,
  MOI_SERVEUR,
  MOI_TANTI,
  CAISSE_BAR,
  ouvrir,
  tablette,
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
        http.get(`${API}/plateforme/tableau-de-bord`, () =>
          HttpResponse.json({
            indicateurs: {
              actives: 0,
              suspendues: 0,
              nouvellesSemaine: 0,
              etablissements: 0,
              tablettes: 0,
              notesHier: 0,
              notesSemaineAvant: 0,
              erreursInternes24h: 0,
            },
            parJour: [],
            aRelancer: [],
            nouvelles: [],
          }),
        ),
      )
      const { routeur } = ouvrir('/')

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' }),
      ).toBeVisible()
      await attendreChemin(routeur, '/plateforme/tableau-de-bord')
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
    it.each(['/gestion', '/gestion/etablissements', '/gestion/personnel', '/plateforme'])(
      'renvoie %s vers la connexion sans session',
      async (chemin) => {
        sessionAbsente()
        const { routeur } = ouvrir(chemin)

        await screen.findByRole('heading', { name: 'Se connecter' })
        await attendreChemin(routeur, '/connexion')
      },
    )

    it.each([
      ['/plateforme', 'hors de portée d’une session d’entreprise'],
      ['/connexion', 'une session déjà ouverte'],
      ['/changer-mot-de-passe', 'réservé à un mot de passe temporaire'],
    ])('ramène une session d’entreprise de %s à la gestion (%s)', async (chemin) => {
      sessionOuverte(MOI_TANTI)
      const { routeur } = ouvrir(chemin)

      await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })
      await attendreChemin(routeur, '/gestion')
    })

    it('garde la gestion hors de portée d’une session plateforme', async () => {
      sessionOuverte(MOI_ADMIN)
      serveurMsw.use(
        http.get(`${API}/plateforme/tableau-de-bord`, () =>
          HttpResponse.json({
            indicateurs: {
              actives: 0,
              suspendues: 0,
              nouvellesSemaine: 0,
              etablissements: 0,
              tablettes: 0,
              notesHier: 0,
              notesSemaineAvant: 0,
              erreursInternes24h: 0,
            },
            parJour: [],
            aRelancer: [],
            nouvelles: [],
          }),
        ),
      )
      const { routeur } = ouvrir('/gestion')

      await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })
      await attendreChemin(routeur, '/plateforme/tableau-de-bord')
    })

    it('impose de remplacer un mot de passe temporaire avant tout autre écran', async () => {
      sessionOuverte({ ...MOI_TANTI, compte: { ...MOI_TANTI.compte, motDePasseAChanger: true } })
      const { routeur } = ouvrir('/gestion/etablissements')

      expect(
        await screen.findByRole('heading', { name: 'Choisissez votre mot de passe' }),
      ).toBeVisible()
      await attendreChemin(routeur, '/changer-mot-de-passe')
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

      await userEvent.click(screen.getByRole('link', { name: 'Réglages' }))
      await userEvent.click(
        within(await screen.findByRole('navigation', { name: 'Réglages' })).getByRole('link', {
          name: 'Établissements',
        }),
      )

      await screen.findByRole('heading', { name: 'Se connecter' })
      await attendreChemin(routeur, '/connexion')
    })
  })

  it('ouvre la caisse d’une tablette enregistrée en plein écran, sous le nom de la caisse', async () => {
    tablette(CAISSE_BAR)
    serveurMsw.use(http.get(`${API}/appareil/personnel`, () => HttpResponse.json([])))
    ouvrir('/caisse')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Qui prend la caisse ?' }),
    ).toBeVisible()
    const barre = await screen.findByRole('banner')
    await waitFor(() => {
      expect(barre).toHaveTextContent('Maquis Chez Tanti')
    })
    expect(barre).toHaveTextContent('Bè Kpota, Caisse 1, bar')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('mène une tablette non enregistrée à l’écran d’enregistrement', async () => {
    tablette(null)
    const { routeur } = ouvrir('/caisse')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Enregistrer cette tablette' }),
    ).toBeVisible()
    await attendreChemin(routeur, '/enregistrement-tablette')
  })

  it('ouvre la gestion sur un menu de sept entrées, l’entrée active marquée', async () => {
    sessionOuverte(MOI_TANTI)
    ouvrir('/gestion')

    expect(await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(within(menu).getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(menu).getByRole('link', { name: 'Caisse' })).not.toHaveAttribute('aria-current')
    expect(within(menu).getByRole('link', { name: 'Réglages' })).toHaveAttribute(
      'href',
      '/gestion/entreprise',
    )
    expect(within(menu).queryByRole('link', { name: 'Personnel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Tableau de bord' })).not.toBeInTheDocument()
  })

  it('range les pages d’une entrée en onglets, l’onglet de la page marqué', async () => {
    sessionOuverte(MOI_TANTI)
    serveurMsw.use(
      http.get(`${API}/personnel`, () =>
        HttpResponse.json({ elements: [], page: 0, taille: 50, total: 0 }),
      ),
    )
    ouvrir('/gestion/personnel')

    const menu = await screen.findByRole('navigation', { name: 'Navigation principale' })
    expect(within(menu).getByRole('link', { name: 'Réglages' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const onglets = screen.getByRole('navigation', { name: 'Réglages' })
    expect(within(onglets).getByRole('link', { name: 'Personnel' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(onglets).getByRole('link', { name: 'Établissements' })).toHaveAttribute(
      'href',
      '/gestion/etablissements',
    )
    expect(within(onglets).queryByRole('link', { name: 'Tablettes' })).not.toBeInTheDocument()
  })

  it('ouvre et referme le menu sur téléphone', async () => {
    sessionOuverte(MOI_TANTI)
    ouvrir('/gestion')

    const bouton = await screen.findByRole('button', { name: 'Menu' })
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(bouton)
    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
  })

  it('masque une entrée dont aucune page n’est permise', async () => {
    sessionOuverte(MOI_SERVEUR)
    ouvrir('/gestion')

    await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })
    const menu = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(within(menu).queryByRole('link', { name: 'Réglages' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: 'Ventes' })).not.toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: 'Carte' })).toBeInTheDocument()
  })

  it('ouvre un reçu public sans rien demander à la session', async () => {
    serveurMsw.use(
      http.get(`${API}/public/recus/abc`, () =>
        HttpResponse.json(
          { statut: 404, code: 'RESSOURCE_INTROUVABLE', message: 'Introuvable.', traceId: 't' },
          { status: 404 },
        ),
      ),
    )
    ouvrir('/r/abc')

    expect(await screen.findByRole('heading', { name: 'Reçu introuvable' })).toBeInTheDocument()
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
