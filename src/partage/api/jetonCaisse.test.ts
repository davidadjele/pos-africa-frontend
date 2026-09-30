import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { API } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import { appelerCaisse } from './appelerCaisse'
import { lireJetonAcces } from './jetonAcces'
import { definirJetonCaisse, effacerJetonCaisse, lireJetonCaisse } from './jetonCaisse'

describe('appelerCaisse', () => {
  afterEach(() => {
    effacerJetonCaisse()
  })

  it('envoie le jeton de caisse, jamais celui du back-office', async () => {
    let autorisation: string | null = null
    serveurMsw.use(
      http.get(`${API}/caisse/moi`, ({ request }) => {
        autorisation = request.headers.get('Authorization')
        return HttpResponse.json({ prenom: 'Kossi' })
      }),
    )
    definirJetonCaisse('eyJ.caisse')

    await appelerCaisse('/caisse/moi')

    expect(autorisation).toBe('Bearer eyJ.caisse')
    expect(lireJetonAcces()).toBeNull()
  })

  it('ferme la session de caisse sur un refus 401, sans tenter de rafraîchissement', async () => {
    serveurMsw.use(
      http.get(`${API}/caisse/moi`, () =>
        HttpResponse.json({ statut: 401, code: 'NON_AUTHENTIFIE', message: 'x' }, { status: 401 }),
      ),
    )
    definirJetonCaisse('eyJ.revoque')

    await expect(appelerCaisse('/caisse/moi')).rejects.toMatchObject({ statut: 401 })
    expect(lireJetonCaisse()).toBeNull()
  })

  it('garde la session quand c’est le code d’un gérant qui est faux, pas la session', async () => {
    serveurMsw.use(
      http.post(`${API}/caisse/validations`, () =>
        HttpResponse.json({ statut: 401, code: 'PIN_INCORRECT', message: 'x' }, { status: 401 }),
      ),
    )
    definirJetonCaisse('eyJ.caisse')

    await expect(
      appelerCaisse('/caisse/validations', { methode: 'POST', corps: {} }),
    ).rejects.toMatchObject({ code: 'PIN_INCORRECT' })
    expect(lireJetonCaisse()).toBe('eyJ.caisse')
  })
})
