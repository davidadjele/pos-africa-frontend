import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { TaxeResume } from '../../partage/api/contrat'

const TVA: TaxeResume = {
  id: '7a000000-0000-4000-8000-000000000001',
  nom: 'TVA',
  tauxPointsDeBase: 1800,
  active: true,
  nbProduits: 15,
  version: 0,
}
const BOISSONS: TaxeResume = {
  id: '7a000000-0000-4000-8000-000000000002',
  nom: 'Taxe sur les boissons alcoolisées',
  tauxPointsDeBase: 200,
  active: false,
  nbProduits: 0,
  version: 3,
}

function backendSimule() {
  const envois: { methode: string; chemin: string; corps: unknown }[] = []
  serveurMsw.use(
    http.get(`${API}/taxes`, () => HttpResponse.json([TVA, BOISSONS])),
    http.post(`${API}/taxes`, async ({ request }) => {
      const corps = (await request.json()) as { nom: string; tauxPointsDeBase: number }
      envois.push({ methode: 'POST', chemin: '/taxes', corps })
      return HttpResponse.json({ ...TVA, ...corps, id: 'nouvelle', nbProduits: 0 }, { status: 201 })
    }),
    http.put(`${API}/taxes/:id`, async ({ request, params }) => {
      const corps = (await request.json()) as object
      envois.push({ methode: 'PUT', chemin: `/taxes/${String(params.id)}`, corps })
      return HttpResponse.json({ ...TVA, ...corps, version: 1 })
    }),
    http.post(`${API}/taxes/:id/reactivation`, ({ params }) => {
      envois.push({
        methode: 'POST',
        chemin: `/taxes/${String(params.id)}/reactivation`,
        corps: null,
      })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return envois
}

async function ouvrirTaxes(permissions = [...MOI_TANTI.permissions, 'CATALOGUE_GERER']) {
  sessionOuverte({ ...MOI_TANTI, permissions })
  ouvrir('/gestion/taxes')
  return screen.findByRole('table', { name: 'Taxes de l’entreprise' })
}

describe('PageTaxes', () => {
  it('liste les taxes avec leur taux, leurs produits et leur statut', async () => {
    backendSimule()
    const tableau = await ouvrirTaxes()

    const tva = within(tableau).getByRole('row', { name: /TVA/ })
    expect(tva).toHaveTextContent('18 %')
    expect(tva).toHaveTextContent('15 produits')
    expect(tva).toHaveTextContent('Active')
    expect(within(tableau).getByRole('row', { name: /boissons/ })).toHaveTextContent('Désactivée')
  })

  it('ajoute une taxe à partir d’un taux saisi en pourcentage', async () => {
    const envois = backendSimule()
    await ouvrirTaxes()

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une taxe' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Ajouter une taxe' })
    await userEvent.type(within(dialogue).getByLabelText(/^Nom/), 'TVA réduite')
    await userEvent.type(within(dialogue).getByLabelText(/^Taux/), '9,5')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ajouter la taxe' }))

    await waitFor(() => {
      expect(envois).toEqual([
        { methode: 'POST', chemin: '/taxes', corps: { nom: 'TVA réduite', tauxPointsDeBase: 950 } },
      ])
    })
    expect(await screen.findByText('La taxe « TVA réduite » est ajoutée.')).toBeVisible()
  })

  it('prévient qu’un nouveau taux vaut pour les ventes suivantes et envoie la version', async () => {
    const envois = backendSimule()
    await ouvrirTaxes()

    await userEvent.click(screen.getByRole('button', { name: 'Modifier TVA' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Modifier la taxe « TVA »' })
    const taux = within(dialogue).getByLabelText(/^Taux/)
    await userEvent.clear(taux)
    await userEvent.type(taux, '19')

    expect(within(dialogue).getByRole('status')).toHaveTextContent('18 % → 19 % sur 15 produits')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(envois[0]?.corps).toEqual({ nom: 'TVA', tauxPointsDeBase: 1900, version: 0 })
    })
  })

  it('refuse un taux illisible sans rien envoyer', async () => {
    const envois = backendSimule()
    await ouvrirTaxes()

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une taxe' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Ajouter une taxe' })
    await userEvent.type(within(dialogue).getByLabelText(/^Nom/), 'TVA')
    await userEvent.type(within(dialogue).getByLabelText(/^Taux/), '120')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ajouter la taxe' }))

    expect(
      await within(dialogue).findByText(
        'Saisissez un taux entre 0 et 100, avec deux décimales au plus.',
      ),
    ).toBeVisible()
    expect(envois).toEqual([])
  })

  it('réactive une taxe désactivée', async () => {
    const envois = backendSimule()
    await ouvrirTaxes()

    await userEvent.click(
      screen.getByRole('button', { name: 'Plus d’actions pour Taxe sur les boissons alcoolisées' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Réactiver' }))

    await waitFor(() => {
      expect(envois.map((envoi) => envoi.chemin)).toEqual([`/taxes/${BOISSONS.id}/reactivation`])
    })
  })

  it('explique pourquoi une taxe encore appliquée ne se désactive pas', async () => {
    backendSimule()
    serveurMsw.use(
      http.post(`${API}/taxes/:id/desactivation`, () =>
        HttpResponse.json(
          { statut: 409, code: 'TAXE_EN_USAGE', message: 'x', traceId: 't' },
          { status: 409 },
        ),
      ),
    )
    await ouvrirTaxes()

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour TVA' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Désactiver' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '« TVA » s’applique encore à 15 produits actifs : changez d’abord leur taxe dans leur fiche, puis désactivez-la.',
    )
  })

  it('montre les taxes sans pouvoir les changer sans la permission', async () => {
    backendSimule()
    await ouvrirTaxes(MOI_TANTI.permissions)

    expect(screen.queryByRole('button', { name: 'Ajouter une taxe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modifier TVA' })).not.toBeInTheDocument()
  })
})
