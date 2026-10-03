import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_ADMIN, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type {
  DemandeModificationPlateforme,
  DemandeSuspension,
  FicheEntreprisePlateforme,
} from '../../partage/api/contrat'

const ID = '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01'

const FICHE: FicheEntreprisePlateforme = {
  id: ID,
  nom: 'Maquis Chez Tanti',
  pays: 'TG',
  devise: 'XOF',
  numeroFiscal: '1000123456',
  statut: 'ACTIVE',
  creeLe: '2026-09-28T10:15:00Z',
  version: 2,
  aDejaVendu: true,
  tvaDepart: 1800,
  proprietaires: [
    {
      prenom: 'Tanti',
      nom: 'Akouvi',
      telephone: '+22890123456',
      email: 'tanti.akouvi@gmail.com',
      derniereConnexionLe: '2026-10-03T18:02:00Z',
    },
  ],
  utilisation: {
    utilisateursActifs: 14,
    avecBackOffice: 3,
    tablettes: 4,
    tablettesRevoquees: 1,
    notesSeptJours: 1284,
    notesSemainePrecedente: 1190,
    derniereVenteLe: '2026-10-03T20:41:00Z',
    derniereConnexionLe: '2026-10-03T18:02:00Z',
    derniereConnexionPar: 'Tanti Akouvi',
  },
  etablissements: [
    {
      id: 'e7000000-0000-4000-8000-000000000001',
      code: 'BE',
      nom: 'Bè Kpota',
      ville: 'Lomé',
      actif: true,
      tablettes: 2,
      derniereVenteLe: '2026-10-03T20:41:00Z',
    },
    {
      id: 'e7000000-0000-4000-8000-000000000003',
      code: 'TK',
      nom: 'Tokoin',
      ville: 'Lomé',
      actif: true,
      tablettes: 0,
    },
  ],
}

function ficheServie(depart: FicheEntreprisePlateforme = FICHE) {
  let fiche = depart
  const modifications: DemandeModificationPlateforme[] = []
  const suspensions: DemandeSuspension[] = []
  let reactivations = 0
  serveurMsw.use(
    http.get(`${API}/plateforme/entreprises/${ID}`, () => HttpResponse.json(fiche)),
    http.put(`${API}/plateforme/entreprises/${ID}`, async ({ request }) => {
      const demande = (await request.json()) as DemandeModificationPlateforme
      modifications.push(demande)
      fiche = {
        ...fiche,
        nom: demande.nom,
        ...(demande.numeroFiscal === undefined ? {} : { numeroFiscal: demande.numeroFiscal }),
        version: fiche.version + 1,
      }
      return HttpResponse.json(fiche)
    }),
    http.post(`${API}/plateforme/entreprises/${ID}/suspension`, async ({ request }) => {
      const demande = (await request.json()) as DemandeSuspension
      suspensions.push(demande)
      fiche = {
        ...fiche,
        statut: 'SUSPENDUE',
        suspension: {
          raison: demande.raison,
          ...(demande.precision === undefined ? {} : { precision: demande.precision }),
          le: '2026-10-03T21:00:00Z',
        },
      }
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API}/plateforme/entreprises/${ID}/reactivation`, () => {
      reactivations += 1
      const active: FicheEntreprisePlateforme = { ...fiche, statut: 'ACTIVE' }
      delete active.suspension
      fiche = active
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return {
    modifications,
    suspensions,
    reactivations: () => reactivations,
    changerSurLeServeur: (nouvelle: FicheEntreprisePlateforme) => {
      fiche = nouvelle
    },
  }
}

async function ouvrirFiche() {
  sessionOuverte(MOI_ADMIN)
  ouvrir(`/plateforme/entreprises/${ID}`)
  return screen.findByRole('heading', { level: 1, name: 'Maquis Chez Tanti' })
}

describe('PageFicheEntreprise', () => {
  it('montre l’identité, le propriétaire, l’utilisation et les établissements, sans aucun montant', async () => {
    ficheServie()
    await ouvrirFiche()

    expect(screen.getByRole('link', { name: 'Entreprises' })).toHaveAttribute('href', '/plateforme')
    expect(screen.getByText('Active')).toHaveClass('rounded-petit')
    const utilisation = screen.getByRole('list', { name: 'Utilisation' })
    expect(utilisation).toHaveTextContent('Utilisateurs actifs14dont 3 avec accès au back-office')
    expect(utilisation).toHaveTextContent('Tablettes4dont 1 révoquée')
    expect(utilisation).toHaveTextContent(/Notes encaissées, 7 jours1\s284contre 1\s190/)
    const identite = screen.getByRole('region', { name: 'Identité' })
    expect(identite).toHaveTextContent('Togo')
    expect(identite).toHaveTextContent('XOF')
    expect(identite).toHaveTextContent('1000123456')
    expect(identite).toHaveTextContent('18 %')
    const proprietaire = screen.getByRole('region', { name: 'Propriétaire' })
    expect(proprietaire).toHaveTextContent('Tanti Akouvi')
    expect(proprietaire).toHaveTextContent('+22890123456')
    const etablissements = within(
      screen.getByRole('table', { name: 'Établissements de l’entreprise' }),
    ).getAllByRole('row')
    expect(etablissements[1]).toHaveTextContent('BEBè KpotaLomé2')
    expect(etablissements[2]).toHaveTextContent('Aucune vente')
    expect(document.body).not.toHaveTextContent('FCFA')
  })

  it('modifie le nom et le NIF, avec le pays et la devise figés depuis la première vente', async () => {
    const { modifications } = ficheServie()
    await ouvrirFiche()

    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const dialogue = screen.getByRole('dialog', { name: 'Modifier Maquis Chez Tanti' })
    expect(within(dialogue).getByLabelText('Pays')).toBeDisabled()
    expect(within(dialogue).getByLabelText('Devise')).toBeDisabled()
    expect(dialogue).toHaveTextContent('ne changent plus depuis la première vente')
    const nom = within(dialogue).getByLabelText(/^Nom de l’entreprise/)
    await userEvent.clear(nom)
    await userEvent.type(nom, 'Maquis Chez Tanti, Lomé')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Maquis Chez Tanti, Lomé' }),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Les modifications sont enregistrées.')
    expect(modifications).toEqual([
      {
        nom: 'Maquis Chez Tanti, Lomé',
        numeroFiscal: '1000123456',
        pays: 'TG',
        devise: 'XOF',
        version: 2,
      },
    ])
  })

  it('recharge la fiche sans rien écraser quand elle a changé entre-temps', async () => {
    const serveur = ficheServie()
    serveurMsw.use(
      http.put(`${API}/plateforme/entreprises/${ID}`, () =>
        HttpResponse.json(
          { statut: 409, code: 'CONFLIT_MODIFICATION', message: 'x', traceId: 't409' },
          { status: 409 },
        ),
      ),
    )
    await ouvrirFiche()
    serveur.changerSurLeServeur({ ...FICHE, nom: 'Maquis Tanti', version: 3 })

    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Maquis Tanti' })).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('modifiée entre-temps')
  })

  it('suspend avec une raison, précisée quand c’est « Autre », puis réactive', async () => {
    const serveur = ficheServie()
    await ouvrirFiche()

    await userEvent.click(screen.getByRole('button', { name: 'Suspendre' }))
    const dialogue = screen.getByRole('dialog', { name: 'Suspendre Maquis Chez Tanti ?' })
    expect(dialogue).toHaveTextContent('les sessions en cours seront coupées')
    await userEvent.selectOptions(within(dialogue).getByLabelText(/^Raison/), 'Autre')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Suspendre l’entreprise' }))
    expect(within(dialogue).getByText('Précisez la raison.')).toBeVisible()
    expect(serveur.suspensions).toEqual([])

    await userEvent.type(
      within(dialogue).getByLabelText(/^Précision/),
      'Fermeture pour travaux jusqu’au 15 novembre',
    )
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Suspendre l’entreprise' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Maquis Chez Tanti est suspendue.')
    expect(serveur.suspensions).toEqual([
      { raison: 'AUTRE', precision: 'Fermeture pour travaux jusqu’au 15 novembre' },
    ])
    const suspension = await screen.findByRole('region', { name: 'Suspension' })
    expect(suspension).toHaveTextContent('Autre : Fermeture pour travaux jusqu’au 15 novembre')

    await userEvent.click(screen.getByRole('button', { name: 'Réactiver' }))
    await userEvent.click(screen.getByRole('button', { name: 'Réactiver l’entreprise' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Maquis Chez Tanti est de nouveau active.',
    )
    expect(serveur.reactivations()).toBe(1)
    expect(screen.queryByRole('region', { name: 'Suspension' })).not.toBeInTheDocument()
  })

  it('laisse changer pays et devise tant que rien n’a été vendu', async () => {
    const { modifications } = ficheServie({ ...FICHE, aDejaVendu: false })
    await ouvrirFiche()

    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    const dialogue = screen.getByRole('dialog')
    await userEvent.selectOptions(within(dialogue).getByLabelText('Devise'), 'XAF')
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    await screen.findByRole('status')
    expect(modifications[0]).toMatchObject({ devise: 'XAF' })
  })
})
