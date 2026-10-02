import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { DemandeIdentiteEntreprise } from '../../partage/api/contrat'

describe('PageEntreprise', () => {
  it('modifie l’identité imprimée sur les reçus', async () => {
    const recus: DemandeIdentiteEntreprise[] = []
    serveurMsw.use(
      http.get(`${API}/entreprise`, () =>
        HttpResponse.json({ nom: 'Maquis Chez Tanti', adresse: 'Lomé' }),
      ),
      http.put(`${API}/entreprise`, async ({ request }) => {
        const demande = (await request.json()) as DemandeIdentiteEntreprise
        recus.push(demande)
        return HttpResponse.json({ nom: 'Maquis Chez Tanti', ...demande })
      }),
    )
    sessionOuverte(MOI_TANTI)
    ouvrir('/gestion/entreprise')

    expect(await screen.findByRole('heading', { name: 'Maquis Chez Tanti' })).toBeVisible()
    expect(await screen.findByLabelText(/^Adresse/)).toHaveValue('Lomé')
    await userEvent.type(screen.getByLabelText(/^Numéro fiscal/), '1000123456')
    await userEvent.type(screen.getByLabelText(/^Téléphone/), '90 11 23 45')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Identité de l’entreprise enregistrée.',
    )
    expect(recus).toEqual([
      { numeroFiscal: '1000123456', telephone: '90 11 23 45', adresse: 'Lomé' },
    ])
    expect(screen.getByRole('link', { name: /Entreprise/ })).toHaveAttribute('aria-current', 'page')
  })
})
