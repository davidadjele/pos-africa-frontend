import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { serveurMsw } from '../../../tests/serveurMsw'
import { definirJetonAcces, effacerJetonAcces, lireJetonAcces } from './jetonAcces'
import { oublierRafraichissementEnCours, rafraichirJeton } from './rafraichissement'

const API = `${window.location.origin}/api`

const ENTREPRISES = [
  { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01', nom: 'Maquis Chez Tanti' },
  { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a02', nom: 'Bar Le Flamboyant' },
]

describe('rafraichirJeton', () => {
  afterEach(() => {
    effacerJetonAcces()
    oublierRafraichissementEnCours()
  })

  it('échange le cookie contre un jeton d’accès gardé en mémoire', async () => {
    let requete = null as Request | null
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, ({ request }) => {
        requete = request
        return HttpResponse.json({
          jetonAcces: 'eyJ.neuf',
          entrepriseCourante: ENTREPRISES[0]?.id,
          entreprises: ENTREPRISES,
        })
      }),
    )

    const reponse = await rafraichirJeton()

    expect(reponse.entreprises).toHaveLength(2)
    expect(lireJetonAcces()).toBe('eyJ.neuf')
    expect(requete?.credentials).toBe('include')
    expect(requete?.headers.get('X-Demande-Tonti')).toBe('1')
  })

  it('demande l’entreprise choisie pour en changer', async () => {
    let corps: unknown = null
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, async ({ request }) => {
        corps = await request.json()
        return HttpResponse.json({ jetonAcces: 'eyJ.flamboyant', entreprises: ENTREPRISES })
      }),
    )

    await rafraichirJeton(ENTREPRISES[1]?.id)

    expect(corps).toEqual({ entrepriseId: ENTREPRISES[1]?.id })
    expect(lireJetonAcces()).toBe('eyJ.flamboyant')
  })

  it('oublie l’ancien jeton quand il reste une entreprise à choisir', async () => {
    definirJetonAcces('eyJ.ancien')
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, () => HttpResponse.json({ entreprises: ENTREPRISES })),
    )

    await rafraichirJeton()

    expect(lireJetonAcces()).toBeNull()
  })

  it('partage un rafraichissement déjà en cours au lieu d’en lancer un second', async () => {
    let appels = 0
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, async () => {
        appels += 1
        await new Promise((resoudre) => setTimeout(resoudre, 20))
        return HttpResponse.json({ jetonAcces: `eyJ.${String(appels)}`, entreprises: [] })
      }),
    )

    const [premier, second] = await Promise.all([rafraichirJeton(), rafraichirJeton()])

    expect(appels).toBe(1)
    expect(premier).toBe(second)

    await rafraichirJeton()
    expect(appels).toBe(2)
  })

  it('attend la fin du rafraîchissement en cours avant de changer d’entreprise', async () => {
    const ordre: string[] = []
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, async ({ request }) => {
        const texte = await request.text()
        ordre.push(texte === '' ? 'courante' : 'changement')
        await new Promise((resoudre) => setTimeout(resoudre, 10))
        return HttpResponse.json({ jetonAcces: 'eyJ.x', entreprises: ENTREPRISES })
      }),
    )

    await Promise.all([rafraichirJeton(), rafraichirJeton(ENTREPRISES[1]?.id)])

    expect(ordre).toEqual(['courante', 'changement'])
  })

  it('oublie le jeton quand la session a expiré, puis remonte l’erreur', async () => {
    definirJetonAcces('eyJ.ancien')
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, () =>
        HttpResponse.json(
          { statut: 401, code: 'SESSION_EXPIREE', message: 'Votre session a expiré.' },
          { status: 401 },
        ),
      ),
    )

    await expect(rafraichirJeton()).rejects.toMatchObject({ code: 'SESSION_EXPIREE' })
    expect(lireJetonAcces()).toBeNull()
  })
})
