import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_ADMIN, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { DemandeMembrePlateforme, MembrePlateforme } from '../../partage/api/contrat'

const KODJO: MembrePlateforme = {
  compteId: 'c0000000-0000-4000-8000-00000000000a',
  prenom: 'Kodjo',
  nom: 'Amegah',
  email: 'kodjo@tonti.africa',
  role: 'RESPONSABLE',
  actif: true,
  motDePasseAChanger: false,
  derniereConnexionLe: '2026-10-03T08:12:00Z',
  ajouteLe: '2026-09-28T09:00:00Z',
  vous: true,
}
const AKOSSIWA: MembrePlateforme = {
  compteId: 'c0000000-0000-4000-8000-00000000000b',
  prenom: 'Akossiwa',
  nom: 'Dogbe',
  email: 'akossiwa@tonti.africa',
  role: 'MEMBRE',
  actif: true,
  motDePasseAChanger: false,
  derniereConnexionLe: '2026-10-03T15:40:00Z',
  ajouteLe: '2026-10-01T09:00:00Z',
  ajoutePar: 'Kodjo Amegah',
  vous: false,
}

function equipeServie(depart: MembrePlateforme[] = [KODJO, AKOSSIWA]) {
  let membres = depart
  const ajouts: DemandeMembrePlateforme[] = []
  const actions: string[] = []
  serveurMsw.use(
    http.get(`${API}/plateforme/equipe`, () => HttpResponse.json(membres)),
    http.post(`${API}/plateforme/equipe`, async ({ request }) => {
      const demande = (await request.json()) as DemandeMembrePlateforme
      ajouts.push(demande)
      const membre: MembrePlateforme = {
        compteId: 'c0000000-0000-4000-8000-00000000000c',
        prenom: demande.prenom,
        nom: demande.nom,
        email: demande.email,
        role: 'MEMBRE',
        actif: true,
        motDePasseAChanger: true,
        ajouteLe: '2026-10-03T16:00:00Z',
        ajoutePar: 'Kodjo Amegah',
        vous: false,
      }
      membres = [...membres, membre]
      return HttpResponse.json({ membre, motDePasseTemporaire: 'yq7mzr4qtx9w' }, { status: 201 })
    }),
    http.post(`${API}/plateforme/equipe/:id/:action`, async ({ params, request }) => {
      actions.push(`${String(params.action)} ${String(params.id)}`)
      if (params.action === 'role') {
        const { role } = (await request.json()) as { role: MembrePlateforme['role'] }
        membres = membres.map((membre) =>
          membre.compteId === params.id ? { ...membre, role } : membre,
        )
        return new HttpResponse(null, { status: 204 })
      }
      if (params.action === 'mot-de-passe')
        return HttpResponse.json({
          identifiant: AKOSSIWA.email,
          motDePasseTemporaire: 'hq4nwd7cpz2k',
        })
      membres = membres.map((membre) =>
        membre.compteId === params.id
          ? { ...membre, actif: params.action === 'reactivation' }
          : membre,
      )
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { ajouts, actions }
}

async function choisir(nom: string, action: string) {
  await userEvent.click(screen.getByRole('button', { name: `Plus d’actions pour ${nom}` }))
  await userEvent.click(screen.getByRole('menuitem', { name: action }))
}

async function ouvrirEquipe() {
  sessionOuverte(MOI_ADMIN)
  ouvrir('/plateforme/equipe')
  await screen.findByRole('heading', { level: 1, name: 'Équipe plateforme' })
  return screen.findByRole('table', { name: 'Membres de l’équipe' })
}

describe('PageEquipe', () => {
  it('liste les membres et leur rôle, sans action sur soi-même', async () => {
    equipeServie()
    const tableau = await ouvrirEquipe()

    const moi = within(tableau).getByRole('row', { name: /^Kodjo Amegah/ })
    expect(moi).toHaveTextContent('Vous')
    expect(moi).toHaveTextContent('Responsable')
    expect(within(moi).queryByRole('button')).not.toBeInTheDocument()
    const akossiwa = within(tableau).getByRole('row', { name: /Akossiwa Dogbe/ })
    expect(akossiwa).toHaveTextContent('akossiwa@tonti.africa')
    expect(akossiwa).toHaveTextContent('Actif')
    expect(akossiwa).toHaveTextContent('par Kodjo Amegah')
  })

  it('ajoute un membre et montre son mot de passe temporaire une seule fois', async () => {
    const { ajouts } = equipeServie()
    await ouvrirEquipe()

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un membre' }))
    const dialogue = screen.getByRole('dialog', { name: 'Ajouter un membre à l’équipe' })
    await userEvent.type(within(dialogue).getByLabelText(/^Prénom/), 'Yao')
    await userEvent.type(within(dialogue).getByLabelText(/^Nom/), 'Mensah')
    await userEvent.type(within(dialogue).getByLabelText(/^E-mail/), 'yao@tonti.africa')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ajouter le membre' }))

    const secret = await screen.findByRole('dialog', {
      name: 'Mot de passe temporaire de Yao Mensah',
    })
    expect(secret).toHaveTextContent('yq7mzr4qtx9w')
    expect(secret).toHaveTextContent('yao@tonti.africa')
    await userEvent.click(
      within(secret).getByRole('button', { name: 'J’ai transmis le mot de passe' }),
    )
    expect(ajouts).toEqual([{ prenom: 'Yao', nom: 'Mensah', email: 'yao@tonti.africa' }])
    const yao = await screen.findByRole('row', { name: /Yao Mensah/ })
    expect(yao).toHaveTextContent('Mot de passe à choisir')
  })

  it('désactive un membre après confirmation, puis le réactive', async () => {
    const { actions } = equipeServie()
    await ouvrirEquipe()

    await choisir('Akossiwa Dogbe', 'Désactiver')
    const dialogue = screen.getByRole('dialog', { name: 'Désactiver Akossiwa Dogbe ?' })
    expect(dialogue).toHaveTextContent('Ses sessions ouvertes sont coupées')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Désactiver le membre' }))

    await screen.findByRole('row', { name: /Akossiwa Dogbe.*Désactivé/ })
    await choisir('Akossiwa Dogbe', 'Réactiver')
    await screen.findByRole('row', { name: /Akossiwa Dogbe.*Actif/ })
    expect(actions).toEqual([
      `desactivation ${AKOSSIWA.compteId}`,
      `reactivation ${AKOSSIWA.compteId}`,
    ])
  })

  it('redonne un mot de passe temporaire à un membre', async () => {
    const { actions } = equipeServie()
    await ouvrirEquipe()

    await choisir('Akossiwa Dogbe', 'Redonner un mot de passe')
    await userEvent.click(screen.getByRole('button', { name: 'Générer le mot de passe' }))

    const secret = await screen.findByRole('dialog', {
      name: 'Mot de passe temporaire de Akossiwa Dogbe',
    })
    expect(secret).toHaveTextContent('hq4nwd7cpz2k')
    expect(actions).toEqual([`mot-de-passe ${AKOSSIWA.compteId}`])
  })

  it('nomme un responsable après confirmation : il n’est alors plus ni désactivable ni réinitialisable', async () => {
    const { actions } = equipeServie()
    await ouvrirEquipe()

    await choisir('Akossiwa Dogbe', 'Nommer responsable')
    const dialogue = screen.getByRole('dialog', { name: 'Nommer Akossiwa Dogbe responsable ?' })
    expect(dialogue).toHaveTextContent('gérer l’équipe')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Nommer responsable' }))

    await screen.findByRole('row', { name: /Akossiwa Dogbe.*Responsable/ })
    await userEvent.click(
      screen.getByRole('button', { name: 'Plus d’actions pour Akossiwa Dogbe' }),
    )
    const menu = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(menu).toEqual(['Retirer le rôle de responsable'])
    expect(actions).toEqual([`role ${AKOSSIWA.compteId}`])
  })

  it('laisse un simple membre consulter l’équipe sans rien y changer', async () => {
    equipeServie([
      { ...KODJO, vous: false },
      { ...AKOSSIWA, vous: true },
    ])
    const tableau = await ouvrirEquipe()

    expect(screen.queryByRole('button', { name: 'Ajouter un membre' })).not.toBeInTheDocument()
    expect(within(tableau).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/Seul un responsable gère l’équipe/)).toBeVisible()
  })
})
