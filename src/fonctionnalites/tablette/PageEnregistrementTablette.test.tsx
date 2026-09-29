import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, CAISSE_BAR, ouvrir, tablette } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'

async function ouvrirEnregistrement() {
  tablette(null)
  const application = ouvrir('/enregistrement-tablette')
  await screen.findByRole('heading', { level: 1, name: 'Enregistrer cette tablette' })
  return application
}

async function taper(code: string) {
  for (const chiffre of code) {
    await userEvent.click(screen.getByRole('button', { name: chiffre }))
  }
}

describe('PageEnregistrementTablette', () => {
  it('envoie le code au 6e chiffre, puis ouvre la caisse de la tablette', async () => {
    let corps: unknown = null
    serveurMsw.use(
      http.post(`${API}/appareil/appairage`, async ({ request }) => {
        corps = await request.json()
        tablette(CAISSE_BAR)
        return HttpResponse.json(CAISSE_BAR)
      }),
    )
    const { routeur } = await ouvrirEnregistrement()

    await taper('48291')
    expect(screen.getByRole('status', { name: '5 chiffres saisis sur 6' })).toBeInTheDocument()
    expect(corps).toBeNull()
    await taper('5')

    await waitFor(() => {
      expect(routeur.state.location.pathname).toBe('/caisse')
    })
    expect(corps).toEqual({ code: '482915' })
    expect(await screen.findByRole('banner')).toHaveTextContent('Bè Kpota, Caisse 1, bar')
  })

  it('efface le code refusé et dit quoi faire', async () => {
    serveurMsw.use(
      http.post(`${API}/appareil/appairage`, () =>
        HttpResponse.json(
          { statut: 400, code: 'CODE_APPAIRAGE_INVALIDE', message: 'x' },
          { status: 400 },
        ),
      ),
    )
    await ouvrirEnregistrement()

    await taper('000000')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Code invalide ou expiré. Demandez un nouveau code au gérant.',
    )
    expect(screen.getByRole('status', { name: '0 chiffre saisi sur 6' })).toBeInTheDocument()
  })

  it('corrige le dernier chiffre avec la touche d’effacement', async () => {
    await ouvrirEnregistrement()

    await taper('482')
    await userEvent.click(screen.getByRole('button', { name: 'Effacer le dernier chiffre' }))

    expect(screen.getByRole('status', { name: '2 chiffres saisis sur 6' })).toBeInTheDocument()
  })

  it('renvoie à la caisse une tablette déjà enregistrée', async () => {
    tablette(CAISSE_BAR)
    const { routeur } = ouvrir('/enregistrement-tablette')

    await waitFor(() => {
      expect(routeur.state.location.pathname).toBe('/caisse')
    })
  })
})
