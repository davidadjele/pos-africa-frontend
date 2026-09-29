import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { serveurMsw } from '../../../tests/serveurMsw'
import { appelerApi } from '../api/appelerApi'
import { definirJetonAcces, lireJetonAcces } from '../api/jetonAcces'
import {
  abonnerSession,
  choisirEntreprise,
  connecter,
  deconnecter,
  demarrerSession,
  lireEtatSession,
  ouvrirSession,
  reinitialiserSession,
} from './session'

const API = `${window.location.origin}/api`

const TANTI = {
  id: '0d6a8f3e-1111-4c1b-9a51-5d7b9b0e0001',
  administrateurPlateforme: false,
  motDePasseAChanger: false,
}
const MAQUIS = { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01', nom: 'Maquis Chez Tanti' }
const FLAMBOYANT = { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a02', nom: 'Bar Le Flamboyant' }

function rafraichissementRepond(corps: object, statut = 200) {
  return http.post(`${API}/auth/rafraichir`, () => HttpResponse.json(corps, { status: statut }))
}

const SESSION_EXPIREE = { statut: 401, code: 'SESSION_EXPIREE', message: 'Votre session a expiré.' }

describe('session', () => {
  afterEach(() => {
    reinitialiserSession()
  })

  describe('au démarrage', () => {
    it('est inconnue tant que le rafraîchissement silencieux n’a pas répondu', () => {
      expect(lireEtatSession()).toEqual({ statut: 'inconnue' })
    })

    it('reprend la session du cookie par un rafraîchissement silencieux', async () => {
      serveurMsw.use(
        rafraichissementRepond({
          jetonAcces: 'eyJ.maquis',
          entrepriseCourante: MAQUIS.id,
          entreprises: [MAQUIS],
        }),
      )

      await expect(demarrerSession()).resolves.toEqual({ statut: 'connectee' })
      expect(lireJetonAcces()).toBe('eyJ.maquis')
    })

    it('ne rafraîchit qu’une fois, même appelé plusieurs fois', async () => {
      let appels = 0
      serveurMsw.use(
        http.post(`${API}/auth/rafraichir`, () => {
          appels += 1
          return HttpResponse.json({ jetonAcces: 'eyJ.maquis', entreprises: [MAQUIS] })
        }),
      )

      await Promise.all([demarrerSession(), demarrerSession()])
      await demarrerSession()

      expect(appels).toBe(1)
    })

    it('demande de choisir l’entreprise quand le cookie n’en désigne aucune', async () => {
      serveurMsw.use(rafraichissementRepond({ entreprises: [MAQUIS, FLAMBOYANT] }))

      await expect(demarrerSession()).resolves.toEqual({
        statut: 'choixEntreprise',
        entreprises: [MAQUIS, FLAMBOYANT],
      })
    })

    it('est anonyme sans cookie valable', async () => {
      serveurMsw.use(rafraichissementRepond(SESSION_EXPIREE, 401))

      await expect(demarrerSession()).resolves.toEqual({ statut: 'anonyme' })
    })

    it('est anonyme aussi quand le serveur est injoignable', async () => {
      serveurMsw.use(http.post(`${API}/auth/rafraichir`, () => HttpResponse.error()))

      await expect(demarrerSession()).resolves.toEqual({ statut: 'anonyme' })
    })
  })

  describe('connexion', () => {
    it('ouvre la session quand le serveur donne directement un jeton', async () => {
      let corps: unknown = null
      serveurMsw.use(
        http.post(`${API}/auth/connexion`, async ({ request }) => {
          corps = await request.json()
          return HttpResponse.json({
            compte: TANTI,
            entreprises: [MAQUIS],
            jetonAcces: 'eyJ.maquis',
            entrepriseCourante: MAQUIS.id,
          })
        }),
      )

      await expect(connecter('90 11 22 33', 'mot-de-passe-solide')).resolves.toEqual({
        statut: 'connectee',
      })
      expect(corps).toEqual({ identifiant: '90 11 22 33', motDePasse: 'mot-de-passe-solide' })
      expect(lireJetonAcces()).toBe('eyJ.maquis')
    })

    it('demande de choisir l’entreprise pour un compte qui en a plusieurs', async () => {
      serveurMsw.use(
        http.post(`${API}/auth/connexion`, () =>
          HttpResponse.json({ compte: TANTI, entreprises: [MAQUIS, FLAMBOYANT] }),
        ),
      )

      await expect(connecter('tanti@exemple.tg', 'mot-de-passe-solide')).resolves.toEqual({
        statut: 'choixEntreprise',
        entreprises: [MAQUIS, FLAMBOYANT],
      })
      expect(lireJetonAcces()).toBeNull()
    })

    it('reste anonyme et remonte l’erreur quand la connexion est refusée', async () => {
      serveurMsw.use(
        http.post(`${API}/auth/connexion`, () =>
          HttpResponse.json(
            { statut: 401, code: 'IDENTIFIANTS_INVALIDES', message: 'x' },
            { status: 401 },
          ),
        ),
      )

      await expect(connecter('90 11 22 33', 'faux')).rejects.toMatchObject({
        code: 'IDENTIFIANTS_INVALIDES',
      })
      expect(lireEtatSession()).toEqual({ statut: 'anonyme' })
    })

    it('ouvre la session à partir de la réponse d’une inscription', () => {
      ouvrirSession({
        compte: TANTI,
        entreprises: [MAQUIS],
        jetonAcces: 'eyJ.maquis',
        entrepriseCourante: MAQUIS.id,
      })

      expect(lireEtatSession()).toEqual({ statut: 'connectee' })
    })
  })

  it('change d’entreprise en rafraîchissant le jeton pour celle choisie', async () => {
    let corps: unknown = null
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, async ({ request }) => {
        corps = await request.json()
        return HttpResponse.json({
          jetonAcces: 'eyJ.flamboyant',
          entrepriseCourante: FLAMBOYANT.id,
          entreprises: [MAQUIS, FLAMBOYANT],
        })
      }),
    )

    await expect(choisirEntreprise(FLAMBOYANT.id)).resolves.toEqual({ statut: 'connectee' })
    expect(corps).toEqual({ entrepriseId: FLAMBOYANT.id })
    expect(lireJetonAcces()).toBe('eyJ.flamboyant')
  })

  describe('déconnexion', () => {
    it('révoque la session côté serveur et oublie le jeton', async () => {
      let deconnexions = 0
      serveurMsw.use(
        http.post(`${API}/auth/deconnexion`, () => {
          deconnexions += 1
          return new HttpResponse(null, { status: 204 })
        }),
      )
      ouvrirSession({ compte: TANTI, entreprises: [MAQUIS], jetonAcces: 'eyJ.maquis' })

      await deconnecter()

      expect(deconnexions).toBe(1)
      expect(lireJetonAcces()).toBeNull()
      expect(lireEtatSession()).toEqual({ statut: 'anonyme' })
    })

    it('oublie la session localement même si le serveur est injoignable', async () => {
      serveurMsw.use(http.post(`${API}/auth/deconnexion`, () => HttpResponse.error()))
      ouvrirSession({ compte: TANTI, entreprises: [MAQUIS], jetonAcces: 'eyJ.maquis' })

      await deconnecter()

      expect(lireJetonAcces()).toBeNull()
      expect(lireEtatSession()).toEqual({ statut: 'anonyme' })
    })
  })

  it('devient anonyme quand un appel découvre que la session a expiré', async () => {
    serveurMsw.use(
      http.get(`${API}/moi`, () =>
        HttpResponse.json({ statut: 401, code: 'NON_AUTHENTIFIE', message: 'x' }, { status: 401 }),
      ),
      rafraichissementRepond(SESSION_EXPIREE, 401),
    )
    ouvrirSession({ compte: TANTI, entreprises: [MAQUIS], jetonAcces: 'eyJ.maquis' })

    await expect(appelerApi('/moi')).rejects.toMatchObject({ code: 'SESSION_EXPIREE' })

    expect(lireEtatSession()).toEqual({ statut: 'anonyme' })
  })

  it('prévient les abonnés de chaque changement d’état', () => {
    const ecouteur = vi.fn()
    const desabonner = abonnerSession(ecouteur)

    ouvrirSession({ compte: TANTI, entreprises: [MAQUIS], jetonAcces: 'eyJ.maquis' })
    desabonner()
    definirJetonAcces('eyJ.autre')

    expect(ecouteur).toHaveBeenCalledTimes(1)
  })
})
