import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { AppareilResume, EtablissementResume } from '../../partage/api/contrat'

const BE_KPOTA: EtablissementResume = {
  id: '9a1f0c2e-0000-4b8e-8f6a-000000000001',
  code: 'BE',
  nom: 'Bè Kpota',
  ville: 'Lomé',
  fuseauHoraire: 'Africa/Lome',
  actif: true,
  version: 0,
}

const CAISSE_BAR: AppareilResume = {
  id: '7c2a0000-0000-4000-8000-000000000001',
  nom: 'Caisse 1, bar',
  etablissementId: BE_KPOTA.id,
  derniereActiviteLe: '2026-09-28T20:41:00Z',
  revoquee: false,
  version: 0,
}
const ANCIENNE: AppareilResume = {
  ...CAISSE_BAR,
  id: '7c2a0000-0000-4000-8000-000000000002',
  nom: 'Ancienne tablette',
  revoquee: true,
}

function backendSimule({ statutsDuCode = ['EN_ATTENTE'] }: { statutsDuCode?: string[] } = {}) {
  const requetes: { methode: string; chemin: string; corps: unknown }[] = []
  const statuts = [...statutsDuCode]
  serveurMsw.use(
    http.get(`${API}/appareils`, () =>
      HttpResponse.json({ elements: [CAISSE_BAR, ANCIENNE], page: 0, taille: 50, total: 2 }),
    ),
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: [BE_KPOTA], page: 0, taille: 50, total: 1 }),
    ),
    http.post(`${API}/appareils/codes`, async ({ request }) => {
      requetes.push({ methode: 'POST', chemin: '/appareils/codes', corps: await request.json() })
      return HttpResponse.json(
        {
          id: 'c0de0000-0000-4000-8000-000000000001',
          code: '482915',
          expireLe: new Date(Date.now() + 600_000).toISOString(),
        },
        { status: 201 },
      )
    }),
    http.get(`${API}/appareils/codes/:id`, () =>
      HttpResponse.json({
        statut: statuts.length > 1 ? statuts.shift() : statuts[0],
        expireLe: new Date(Date.now() + 600_000).toISOString(),
      }),
    ),
    http.delete(`${API}/appareils/codes/:id`, ({ params }) => {
      requetes.push({
        methode: 'DELETE',
        chemin: `/appareils/codes/${String(params.id)}`,
        corps: null,
      })
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API}/appareils/:id/revocation`, ({ params }) => {
      requetes.push({
        methode: 'POST',
        chemin: `/appareils/${String(params.id)}/revocation`,
        corps: null,
      })
      return new HttpResponse(null, { status: 204 })
    }),
    http.put(`${API}/appareils/:id`, async ({ request }) => {
      const corps = (await request.json()) as { nom: string }
      requetes.push({ methode: 'PUT', chemin: '/appareils', corps })
      return HttpResponse.json({ ...CAISSE_BAR, nom: corps.nom, version: 1 })
    }),
  )
  return requetes
}

async function ouvrirTablettes() {
  sessionOuverte({ ...MOI_TANTI, permissions: [...MOI_TANTI.permissions, 'APPAREIL_GERER'] })
  ouvrir('/gestion/tablettes')
  await screen.findByRole('heading', { level: 1, name: 'Tablettes' })
}

describe('PageTablettes', () => {
  it('liste les tablettes, leur établissement, leur dernière activité et leur statut', async () => {
    backendSimule()
    await ouvrirTablettes()

    const tableau = await screen.findByRole('table', { name: 'Tablettes de l’entreprise' })
    const bar = within(tableau).getByRole('row', { name: /Caisse 1, bar/ })
    expect(bar).toHaveTextContent('Bè Kpota')
    expect(bar).toHaveTextContent('28/09/2026, 20:41')
    expect(bar).toHaveTextContent('Active')
    const ancienne = within(tableau).getByRole('row', { name: /Ancienne tablette/ })
    expect(ancienne).toHaveTextContent('Révoquée')
    expect(within(ancienne).queryByRole('button')).not.toBeInTheDocument()
  })

  it('génère un code, attend la tablette et annonce son enregistrement', async () => {
    const requetes = backendSimule({ statutsDuCode: ['EN_ATTENTE', 'UTILISE'] })
    await ouvrirTablettes()

    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer une tablette' }))
    const formulaire = await screen.findByRole('form', { name: 'Enregistrer une tablette' })
    await userEvent.type(
      within(formulaire).getByLabelText(/^Nom de la caisse/),
      'Caisse 2, terrasse',
    )
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Générer le code' }))

    const panneau = await screen.findByRole('region', { name: 'Code d’enregistrement' })
    expect(within(panneau).getByText('482')).toBeVisible()
    expect(within(panneau).getByText('915')).toBeVisible()
    expect(panneau).toHaveTextContent('Valable encore')
    expect(requetes[0]?.corps).toEqual({ etablissementId: BE_KPOTA.id, nom: 'Caisse 2, terrasse' })

    expect(
      await screen.findByText(
        'La tablette « Caisse 2, terrasse » est enregistrée.',
        {},
        { timeout: 5000 },
      ),
    ).toBeVisible()
  })

  it('annule un code dont on n’a plus besoin', async () => {
    const requetes = backendSimule()
    await ouvrirTablettes()

    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer une tablette' }))
    const formulaire = await screen.findByRole('form', { name: 'Enregistrer une tablette' })
    await userEvent.type(
      within(formulaire).getByLabelText(/^Nom de la caisse/),
      'Caisse 2, terrasse',
    )
    await userEvent.click(within(formulaire).getByRole('button', { name: 'Générer le code' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler ce code' }))

    await waitFor(() => {
      expect(requetes.map((requete) => requete.methode)).toEqual(['POST', 'DELETE'])
    })
    expect(screen.queryByRole('region', { name: 'Code d’enregistrement' })).not.toBeInTheDocument()
  })

  it('révoque une tablette après une confirmation qui dit ce qu’elle perd', async () => {
    const requetes = backendSimule()
    await ouvrirTablettes()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Plus d’actions pour Caisse 1, bar' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Révoquer' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Révoquer « Caisse 1, bar » ?' })
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Révoquer la tablette' }))

    await waitFor(() => {
      expect(requetes.map((requete) => requete.chemin)).toEqual([
        `/appareils/${CAISSE_BAR.id}/revocation`,
      ])
    })
    expect(await screen.findByText('« Caisse 1, bar » est révoquée.')).toBeVisible()
  })

  it('renomme une tablette en envoyant sa version', async () => {
    const requetes = backendSimule()
    await ouvrirTablettes()

    await userEvent.click(await screen.findByRole('button', { name: 'Renommer Caisse 1, bar' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Renommer « Caisse 1, bar »' })
    const champ = within(dialogue).getByLabelText(/^Nom de la caisse/)
    await userEvent.clear(champ)
    await userEvent.type(champ, 'Caisse du bar')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Renommer' }))

    await waitFor(() => {
      expect(requetes[0]?.corps).toEqual({ nom: 'Caisse du bar', version: 0 })
    })
    expect(
      await screen.findByText('La tablette s’appelle maintenant « Caisse du bar ».'),
    ).toBeVisible()
  })
})
