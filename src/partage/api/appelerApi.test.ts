import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { serveurMsw } from '../../../tests/serveurMsw'
import { appelerApi } from './appelerApi'
import { ErreurApi } from './ErreurApi'
import { definirJetonAcces, effacerJetonAcces } from './jetonAcces'
import type { ReponseErreur } from './ReponseErreur'

const API = 'http://api.test'

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
  })

  it('renvoie le corps JSON d’une réponse réussie, depuis l’URL de base configurée', async () => {
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
})
