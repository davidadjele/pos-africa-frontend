import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { serveurMsw } from '../../../tests/serveurMsw'
import { appelerApi } from './appelerApi'
import { ErreurApi } from './ErreurApi'
import { definirJetonAcces, effacerJetonAcces, lireJetonAcces } from './jetonAcces'
import { oublierRafraichissementEnCours } from './rafraichissement'
import type { ReponseErreur } from './ReponseErreur'

const API = `${window.location.origin}/api`

async function capturerErreur(promesse: Promise<unknown>): Promise<ErreurApi> {
  try {
    await promesse
  } catch (erreur) {
    if (erreur instanceof ErreurApi) return erreur
    throw erreur
  }
  throw new Error('L’appel aurait dû échouer.')
}

describe('appelerApi', () => {
  afterEach(() => {
    effacerJetonAcces()
    oublierRafraichissementEnCours()
  })

  it('renvoie le corps JSON d’une réponse réussie, sur la même origine sous le préfixe /api', async () => {
    serveurMsw.use(
      http.get(`${API}/produits/42`, () =>
        HttpResponse.json({ id: 42, nom: 'Poulet braisé', prix: 4500 }),
      ),
    )

    await expect(appelerApi('/produits/42')).resolves.toEqual({
      id: 42,
      nom: 'Poulet braisé',
      prix: 4500,
    })
  })

  it('envoie le jeton d’accès en mémoire dans l’en-tête Authorization', async () => {
    let autorisation: string | null = null
    serveurMsw.use(
      http.get(`${API}/moi`, ({ request }) => {
        autorisation = request.headers.get('Authorization')
        return HttpResponse.json({})
      }),
    )
    definirJetonAcces('eyJ.jeton.court')

    await appelerApi('/moi')

    expect(autorisation).toBe('Bearer eyJ.jeton.court')
  })

  it('n’envoie pas d’en-tête Authorization sans jeton', async () => {
    let entetePresent = true
    serveurMsw.use(
      http.get(`${API}/moi`, ({ request }) => {
        entetePresent = request.headers.has('Authorization')
        return HttpResponse.json({})
      }),
    )

    await appelerApi('/moi')

    expect(entetePresent).toBe(false)
  })

  it('envoie le corps en JSON avec la méthode demandée', async () => {
    let recu: unknown = null
    let typeContenu: string | null = null
    serveurMsw.use(
      http.post(`${API}/commandes/7/lignes`, async ({ request }) => {
        recu = await request.json()
        typeContenu = request.headers.get('Content-Type')
        return HttpResponse.json({ id: 1 }, { status: 201 })
      }),
    )

    await appelerApi('/commandes/7/lignes', {
      methode: 'POST',
      corps: { produit: 'Flag 65 cl', quantite: 2 },
    })

    expect(recu).toEqual({ produit: 'Flag 65 cl', quantite: 2 })
    expect(typeContenu).toBe('application/json')
  })

  it('renvoie undefined pour une réponse sans contenu', async () => {
    serveurMsw.use(http.delete(`${API}/lignes/3`, () => new HttpResponse(null, { status: 204 })))

    await expect(appelerApi('/lignes/3', { methode: 'DELETE' })).resolves.toBeUndefined()
  })

  it('transmet l’erreur métier 422 telle que l’API la décrit', async () => {
    const reponse: ReponseErreur = {
      statut: 422,
      code: 'STOCK_INSUFFISANT',
      message: 'Stock insuffisant pour cet article.',
      traceId: '6f1c2a9e',
    }
    serveurMsw.use(
      http.post(`${API}/commandes/7/lignes`, () => HttpResponse.json(reponse, { status: 422 })),
    )

    const erreur = await capturerErreur(appelerApi('/commandes/7/lignes', { methode: 'POST' }))

    expect(erreur.reponse).toEqual(reponse)
    expect(erreur.statut).toBe(422)
    expect(erreur.code).toBe('STOCK_INSUFFISANT')
  })

  it('conserve les champs invalides d’une erreur 400', async () => {
    const reponse: ReponseErreur = {
      statut: 400,
      code: 'REQUETE_INVALIDE',
      message: 'La requête contient des données invalides.',
      traceId: 'a41b7d03',
      champs: [
        { champ: 'nom', message: 'Le nom est obligatoire.' },
        { champ: 'prix', message: 'Le prix doit être positif.' },
      ],
    }
    serveurMsw.use(http.post(`${API}/produits`, () => HttpResponse.json(reponse, { status: 400 })))

    const erreur = await capturerErreur(appelerApi('/produits', { methode: 'POST', corps: {} }))

    expect(erreur.reponse.champs).toEqual(reponse.champs)
  })

  it('conserve le traceId d’une erreur 500 pour le support', async () => {
    serveurMsw.use(
      http.get(`${API}/rapports/jour`, () =>
        HttpResponse.json(
          {
            statut: 500,
            code: 'ERREUR_INTERNE',
            message: 'Une erreur inattendue est survenue.',
            traceId: 'c0ffee42',
          },
          { status: 500 },
        ),
      ),
    )

    const erreur = await capturerErreur(appelerApi('/rapports/jour'))

    expect(erreur.code).toBe('ERREUR_INTERNE')
    expect(erreur.reponse.traceId).toBe('c0ffee42')
  })

  it('signale une coupure réseau par le code RESEAU_INDISPONIBLE', async () => {
    serveurMsw.use(http.get(`${API}/produits`, () => HttpResponse.error()))

    const erreur = await capturerErreur(appelerApi('/produits'))

    expect(erreur.code).toBe('RESEAU_INDISPONIBLE')
    expect(erreur.statut).toBe(0)
    expect(erreur.reponse.traceId).toBeUndefined()
  })

  it('traite un corps d’erreur qui n’est pas du JSON comme une erreur interne', async () => {
    serveurMsw.use(
      http.get(
        `${API}/produits`,
        () =>
          new HttpResponse('<html>502 Bad Gateway</html>', {
            status: 502,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    )

    const erreur = await capturerErreur(appelerApi('/produits'))

    expect(erreur.code).toBe('ERREUR_INTERNE')
    expect(erreur.statut).toBe(502)
  })

  it('traite un JSON d’erreur qui ne respecte pas le contrat comme une erreur interne', async () => {
    serveurMsw.use(
      http.get(`${API}/produits`, () => HttpResponse.json({ error: 'Not Found' }, { status: 404 })),
    )

    const erreur = await capturerErreur(appelerApi('/produits'))

    expect(erreur.code).toBe('ERREUR_INTERNE')
    expect(erreur.statut).toBe(404)
  })

  it('traite une réponse réussie mais illisible comme une erreur interne', async () => {
    serveurMsw.use(http.get(`${API}/produits`, () => new HttpResponse('pas du json')))

    const erreur = await capturerErreur(appelerApi('/produits'))

    expect(erreur.code).toBe('ERREUR_INTERNE')
  })

  it('laisse passer l’annulation d’une requête sans la déguiser en erreur API', async () => {
    serveurMsw.use(http.get(`${API}/produits`, () => HttpResponse.json([])))
    const controleur = new AbortController()
    controleur.abort()

    await expect(appelerApi('/produits', { signal: controleur.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
  it('envoie le cookie et l’en-tête anti-CSRF sur les routes /auth', async () => {
    let requete = null as Request | null
    serveurMsw.use(
      http.post(`${API}/auth/deconnexion`, ({ request }) => {
        requete = request
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await appelerApi('/auth/deconnexion', { methode: 'POST' })

    expect(requete?.headers.get('X-Demande-Tonti')).toBe('1')
    expect(requete?.credentials).toBe('include')
  })

  it('n’envoie pas l’en-tête anti-CSRF hors des routes /auth', async () => {
    let entetePresent = true
    serveurMsw.use(
      http.get(`${API}/etablissements`, ({ request }) => {
        entetePresent = request.headers.has('X-Demande-Tonti')
        return HttpResponse.json({})
      }),
    )

    await appelerApi('/etablissements')

    expect(entetePresent).toBe(false)
  })

  it('traite les routes de la tablette comme des routes à cookie, sans rafraîchir de session', async () => {
    definirJetonAcces('eyJ.expire')
    let requete = null as Request | null
    let rafraichissements = 0
    serveurMsw.use(
      http.post(`${API}/appareil/appairage`, ({ request }) => {
        requete = request
        return HttpResponse.json(
          { statut: 400, code: 'CODE_APPAIRAGE_INVALIDE', message: 'x' },
          { status: 400 },
        )
      }),
      http.get(`${API}/appareil`, () =>
        HttpResponse.json({ statut: 401, code: 'NON_AUTHENTIFIE', message: 'x' }, { status: 401 }),
      ),
      http.post(`${API}/auth/rafraichir`, () => {
        rafraichissements++
        return HttpResponse.json({ jetonAcces: 'eyJ.neuf', entreprises: [] })
      }),
    )

    await expect(
      appelerApi('/appareil/appairage', { methode: 'POST', corps: { code: '482915' } }),
    ).rejects.toMatchObject({
      code: 'CODE_APPAIRAGE_INVALIDE',
    })
    await expect(appelerApi('/appareil')).rejects.toMatchObject({ statut: 401 })

    expect(requete?.headers.get('X-Demande-Tonti')).toBe('1')
    expect(requete?.credentials).toBe('include')
    expect(rafraichissements).toBe(0)
  })

  it('transmet le délai Retry-After d’un refus pour trop de tentatives', async () => {
    serveurMsw.use(
      http.post(`${API}/auth/connexion`, () =>
        HttpResponse.json(
          { statut: 429, code: 'TROP_DE_TENTATIVES', message: 'Trop de tentatives.' },
          { status: 429, headers: { 'Retry-After': '90' } },
        ),
      ),
    )

    const erreur = await capturerErreur(appelerApi('/auth/connexion', { methode: 'POST' }))

    expect(erreur.code).toBe('TROP_DE_TENTATIVES')
    expect(erreur.reessayerApresSecondes).toBe(90)
  })

  it('ignore un Retry-After illisible', async () => {
    serveurMsw.use(
      http.post(`${API}/auth/connexion`, () =>
        HttpResponse.json(
          { statut: 429, code: 'TROP_DE_TENTATIVES', message: 'Trop de tentatives.' },
          { status: 429, headers: { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' } },
        ),
      ),
    )

    const erreur = await capturerErreur(appelerApi('/auth/connexion', { methode: 'POST' }))

    expect(erreur.reessayerApresSecondes).toBeUndefined()
  })

  describe('jeton d’accès expiré', () => {
    const NON_AUTHENTIFIE = {
      statut: 401,
      code: 'NON_AUTHENTIFIE',
      message: 'Authentification requise.',
    }

    function etablissementsAvecJeton(jetonValide: string) {
      return http.get(`${API}/etablissements`, ({ request }) =>
        request.headers.get('Authorization') === `Bearer ${jetonValide}`
          ? HttpResponse.json({ elements: [], page: 0, taille: 50, total: 0 })
          : HttpResponse.json(NON_AUTHENTIFIE, { status: 401 }),
      )
    }

    it('rafraîchit le jeton une fois puis rejoue la requête avec le nouveau', async () => {
      definirJetonAcces('eyJ.expire')
      let rafraichissements = 0
      serveurMsw.use(
        etablissementsAvecJeton('eyJ.neuf'),
        http.post(`${API}/auth/rafraichir`, () => {
          rafraichissements += 1
          return HttpResponse.json({ jetonAcces: 'eyJ.neuf', entreprises: [] })
        }),
      )

      await expect(appelerApi('/etablissements')).resolves.toMatchObject({ total: 0 })

      expect(rafraichissements).toBe(1)
      expect(lireJetonAcces()).toBe('eyJ.neuf')
    })

    it('ne lance qu’un seul rafraîchissement pour plusieurs requêtes refusées en même temps', async () => {
      definirJetonAcces('eyJ.expire')
      let rafraichissements = 0
      serveurMsw.use(
        etablissementsAvecJeton('eyJ.neuf'),
        http.post(`${API}/auth/rafraichir`, async () => {
          rafraichissements += 1
          await new Promise((resoudre) => setTimeout(resoudre, 20))
          return HttpResponse.json({ jetonAcces: 'eyJ.neuf', entreprises: [] })
        }),
      )

      await Promise.all([
        appelerApi('/etablissements'),
        appelerApi('/etablissements'),
        appelerApi('/etablissements'),
      ])

      expect(rafraichissements).toBe(1)
    })

    it('ne rejoue la requête qu’une seule fois', async () => {
      definirJetonAcces('eyJ.expire')
      let appels = 0
      serveurMsw.use(
        http.get(`${API}/etablissements`, () => {
          appels += 1
          return HttpResponse.json(NON_AUTHENTIFIE, { status: 401 })
        }),
        http.post(`${API}/auth/rafraichir`, () =>
          HttpResponse.json({ jetonAcces: 'eyJ.neuf', entreprises: [] }),
        ),
      )

      const erreur = await capturerErreur(appelerApi('/etablissements'))

      expect(erreur.code).toBe('NON_AUTHENTIFIE')
      expect(appels).toBe(2)
    })

    it('oublie le jeton et remonte SESSION_EXPIREE quand la session est finie', async () => {
      definirJetonAcces('eyJ.expire')
      serveurMsw.use(
        etablissementsAvecJeton('eyJ.neuf'),
        http.post(`${API}/auth/rafraichir`, () =>
          HttpResponse.json(
            { statut: 401, code: 'SESSION_EXPIREE', message: 'Votre session a expiré.' },
            { status: 401 },
          ),
        ),
      )

      const erreur = await capturerErreur(appelerApi('/etablissements'))

      expect(erreur.code).toBe('SESSION_EXPIREE')
      expect(lireJetonAcces()).toBeNull()
    })

    it('rejoue sans rafraîchir si un autre appel a déjà renouvelé le jeton entre-temps', async () => {
      definirJetonAcces('eyJ.expire')
      let rafraichissements = 0
      serveurMsw.use(
        http.get(`${API}/etablissements`, ({ request }) => {
          if (request.headers.get('Authorization') === 'Bearer eyJ.neuf') {
            return HttpResponse.json({ total: 0 })
          }
          definirJetonAcces('eyJ.neuf')
          return HttpResponse.json(NON_AUTHENTIFIE, { status: 401 })
        }),
        http.post(`${API}/auth/rafraichir`, () => {
          rafraichissements += 1
          return HttpResponse.json({ jetonAcces: 'eyJ.autre', entreprises: [] })
        }),
      )

      await expect(appelerApi('/etablissements')).resolves.toEqual({ total: 0 })
      expect(rafraichissements).toBe(0)
    })

    it('ne rafraîchit pas sans jeton envoyé, ni pour un refus des routes /auth', async () => {
      let rafraichissements = 0
      serveurMsw.use(
        http.get(`${API}/moi`, () => HttpResponse.json(NON_AUTHENTIFIE, { status: 401 })),
        http.post(`${API}/auth/connexion`, () =>
          HttpResponse.json(
            {
              statut: 401,
              code: 'IDENTIFIANTS_INVALIDES',
              message: 'Identifiant ou mot de passe incorrect.',
            },
            { status: 401 },
          ),
        ),
        http.post(`${API}/auth/rafraichir`, () => {
          rafraichissements += 1
          return HttpResponse.json({ entreprises: [] })
        }),
      )

      await capturerErreur(appelerApi('/moi'))
      definirJetonAcces('eyJ.valide')
      await capturerErreur(appelerApi('/auth/connexion', { methode: 'POST', corps: {} }))

      expect(rafraichissements).toBe(0)
    })
  })
})
