import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { DemandeClient } from '../../partage/api/contrat'
import { BE_KPOTA } from '../stock/fixtures'
import { AMA, ARDOISES, FICHE_KOMLAN } from './fixtures'

const GERANTE = [...MOI_TANTI.permissions, 'CLIENT_CREDIT']

function ardoisesServies() {
  const crees: DemandeClient[] = []
  const desactives: string[] = []
  serveurMsw.use(
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: [BE_KPOTA], page: 0, taille: 100, total: 1 }),
    ),
    http.get(`${API}/stock/a-traiter`, () => HttpResponse.json({ nombre: 0 })),
    http.get(`${API}/etablissements/:id/clients`, () => HttpResponse.json(ARDOISES)),
    http.get(`${API}/etablissements/:id/clients/:client`, () => HttpResponse.json(FICHE_KOMLAN)),
    http.post(`${API}/etablissements/:id/clients`, async ({ request }) => {
      const demande = (await request.json()) as DemandeClient
      crees.push(demande)
      return HttpResponse.json({ ...AMA, id: 'nouveau', nom: demande.nom }, { status: 201 })
    }),
    http.post(`${API}/etablissements/:id/clients/:client/desactivation`, ({ params }) => {
      desactives.push(String(params.client))
      return HttpResponse.json({ ...AMA, actif: false })
    }),
  )
  return { crees, desactives }
}

async function ouvrirArdoises() {
  sessionOuverte({ ...MOI_TANTI, permissions: GERANTE })
  ouvrir('/gestion/ardoises')
  return screen.findByRole('table', { name: 'Ardoises de Bè Kpota' })
}

describe('PageArdoises', () => {
  it('montre ce qui est à recevoir, la plus ancienne dette en tête', async () => {
    ardoisesServies()
    const tableau = await ouvrirArdoises()

    expect(screen.getByRole('link', { name: /Ardoises/ })).toHaveAttribute('aria-current', 'page')
    const chiffres = screen.getByRole('region', { name: 'Résumé des ardoises' })
    expect(chiffres).toHaveTextContent(/À recevoir56\s000\sF2 clients/)
    expect(chiffres).toHaveTextContent(/À relancer38\s000\sF1 client, dette de plus de 30 jours/)
    const lignes = within(tableau).getAllByRole('row').slice(1)
    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toHaveTextContent('Edem A., entreprise SOTRA')
    expect(lignes[0]).toHaveTextContent('Depuis 45 jours')
    expect(lignes[1]).toHaveTextContent(/18\s000/)
    expect(lignes[1]).toHaveTextContent(/Vente à crédit, n°42, T4/)
  })

  it('filtre les clients à relancer, ou montre tous les clients', async () => {
    ardoisesServies()
    const tableau = await ouvrirArdoises()

    await userEvent.click(screen.getByRole('button', { name: /À relancer/ }))
    expect(within(tableau).getAllByRole('row')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: /Tous les clients/ }))
    expect(within(tableau).getAllByRole('row')).toHaveLength(4)
    expect(within(tableau).getByText('Ama K.').closest('tr')).toHaveTextContent('Rien à payer')
  })

  it('ouvre une ardoise à un nouveau client', async () => {
    const { crees } = ardoisesServies()
    await ouvrirArdoises()

    await userEvent.click(screen.getByRole('button', { name: 'Nouveau client' }))
    const dialogue = screen.getByRole('dialog', { name: 'Nouveau client' })
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ouvrir l’ardoise' }))
    expect(within(dialogue).getByText('Indiquez le nom du client.')).toBeInTheDocument()
    await userEvent.type(within(dialogue).getByLabelText(/^Nom/), 'Akossiwa M.')
    // Sans indicatif, le numéro se lit dans le pays de l'entreprise, rappelé devant la saisie.
    const telephone = within(dialogue).getByLabelText(/^Téléphone/)
    expect(within(dialogue).getByText('+228')).toBeVisible()
    expect(telephone).toHaveAttribute('placeholder', '90 11 23 45')
    await userEvent.type(telephone, '99 01 77 23')
    await userEvent.type(within(dialogue).getByLabelText(/^Plafond/), '5000')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Ouvrir l’ardoise' }))

    expect(await screen.findByText('Ardoise ouverte pour Akossiwa M.')).toBeInTheDocument()
    expect(crees).toEqual([{ nom: 'Akossiwa M.', telephone: '99 01 77 23', plafond: 5000 }])
  })

  it('montre la fiche d’un client et les mouvements de son ardoise', async () => {
    ardoisesServies()
    const tableau = await ouvrirArdoises()

    await userEvent.click(within(tableau).getByRole('link', { name: 'Komlan D.' }))

    expect(await screen.findByRole('heading', { name: 'Komlan D.' })).toBeInTheDocument()
    const resume = screen.getByRole('region', { name: 'Ce que doit Komlan D.' })
    expect(resume).toHaveTextContent(/Doit18\s000\sFsur un plafond de 25\s000\sF/)
    expect(resume).toHaveTextContent('Depuis 12 jours')
    expect(resume).toHaveTextContent('Paie chaque fin de mois.')
    const mouvements = screen.getByRole('table', { name: 'Mouvements de l’ardoise' })
    const lignes = within(mouvements).getAllByRole('row').slice(1)
    expect(lignes[0]).toHaveTextContent('Vente à crédit')
    expect(lignes[0]).toHaveTextContent('Yawa T., validé par Afi M.')
    expect(lignes[0]).toHaveTextContent(/\+13\s500/)
    // Un client qui doit encore ne se désactive pas : l'action n'est pas proposée.
    expect(screen.queryByRole('button', { name: 'Fermer l’ardoise' })).not.toBeInTheDocument()
  })

  it('ferme l’ardoise d’un client qui ne doit rien', async () => {
    const { desactives } = ardoisesServies()
    const tableau = await ouvrirArdoises()
    await userEvent.click(screen.getByRole('button', { name: /Tous les clients/ }))

    await userEvent.click(
      within(tableau).getByRole('button', { name: 'Plus d’actions pour Ama K.' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Fermer l’ardoise' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Fermer l’ardoise' }),
    )

    expect(await screen.findByText('Ardoise de Ama K. fermée')).toBeInTheDocument()
    expect(desactives).toEqual([AMA.id])
  })

  it('n’apparaît pas dans le menu sans le droit de vendre à crédit', async () => {
    serveurMsw.use(
      http.get(`${API}/etablissements`, () =>
        HttpResponse.json({ elements: [BE_KPOTA], page: 0, taille: 100, total: 1 }),
      ),
    )
    sessionOuverte(MOI_TANTI)
    ouvrir('/gestion')

    await screen.findByRole('navigation')
    expect(screen.queryByRole('link', { name: /Ardoises/ })).not.toBeInTheDocument()
  })
})
