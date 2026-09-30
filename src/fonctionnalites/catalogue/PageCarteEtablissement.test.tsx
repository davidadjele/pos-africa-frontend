import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { EtablissementResume, LigneCarteEtablissement } from '../../partage/api/contrat'

const BE_KPOTA: EtablissementResume = {
  id: '9a1f0c2e-0000-4b8e-8f6a-000000000001',
  code: 'BE',
  nom: 'Bè Kpota',
  ville: 'Lomé',
  fuseauHoraire: 'Africa/Lome',
  delaiVerrouillageMinutes: 3,
  actif: true,
  version: 0,
}
const AGBALEPEDO: EtablissementResume = {
  ...BE_KPOTA,
  id: '9a1f0c2e-0000-4b8e-8f6a-000000000002',
  code: 'AG',
  nom: 'Agbalépédo',
}
const BIERES = {
  id: 'ca000000-0000-4000-8000-000000000002',
  nom: 'Bières',
  couleur: 'FEUILLE',
  ordre: 1,
} as const
const GRILLADES = {
  id: 'ca000000-0000-4000-8000-000000000001',
  nom: 'Grillades',
  couleur: 'OCRE',
  ordre: 2,
} as const

const FLAG: LigneCarteEtablissement = {
  produitId: 'b0000000-0000-4000-8000-000000000002',
  nom: 'Flag 65 cl',
  type: 'BOISSON',
  categorie: BIERES,
  prixBase: 1000,
  prix: 1200,
  prixPropre: true,
  nomTaxe: 'TVA',
  tauxTaxePointsDeBase: 1800,
  propose: true,
  epuise: false,
}
const POULET: LigneCarteEtablissement = {
  produitId: 'b0000000-0000-4000-8000-000000000001',
  nom: 'Poulet braisé',
  type: 'PLAT',
  categorie: GRILLADES,
  prixBase: 4500,
  prix: 4500,
  prixPropre: false,
  nomTaxe: 'TVA',
  tauxTaxePointsDeBase: 1800,
  propose: true,
  epuise: true,
  epuisePar: 'Afi M.',
  epuiseLe: '2026-09-29T19:42:00Z',
  epuiseJusquA: '2026-09-30T04:00:00Z',
}
const FUFU: LigneCarteEtablissement = {
  ...POULET,
  produitId: 'b0000000-0000-4000-8000-000000000003',
  nom: 'Fufu sauce graine',
  prixBase: 3000,
  prix: 3000,
  epuise: false,
  propose: false,
}

function backendSimule() {
  const envois: { methode: string; chemin: string; corps: unknown }[] = []
  const cartesLues: string[] = []
  serveurMsw.use(
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: [BE_KPOTA, AGBALEPEDO], page: 0, taille: 100, total: 2 }),
    ),
    http.get(`${API}/etablissements/:id/carte`, ({ params }) => {
      cartesLues.push(String(params.id))
      return HttpResponse.json([FLAG, POULET, FUFU])
    }),
    http.all(`${API}/etablissements/:id/carte/:produit/:action`, async ({ request, params }) => {
      envois.push({
        methode: request.method,
        chemin: `${String(params.produit)}/${String(params.action)}`,
        corps: request.method === 'PUT' ? await request.json() : null,
      })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { envois, cartesLues }
}

async function ouvrirCarte(permissions: string[]) {
  sessionOuverte({ ...MOI_TANTI, permissions })
  ouvrir('/gestion/carte-etablissement')
  return screen.findByRole('table', { name: 'Carte de l’établissement' })
}

const PROPRIETAIRE = [
  ...MOI_TANTI.permissions,
  'CATALOGUE_GERER',
  'PRIX_MODIFIER',
  'DISPONIBILITE_GERER',
]

describe('PageCarteEtablissement', () => {
  it('présente prix de base, prix propre et disponibilité, les ruptures en tête', async () => {
    backendSimule()
    const tableau = await ouvrirCarte(PROPRIETAIRE)

    expect(screen.getByRole('heading', { level: 1, name: 'Carte de Bè Kpota' })).toBeVisible()
    expect(screen.getByText('1 épuisé ce jour')).toBeVisible()
    expect(screen.getByText('1 prix propre')).toBeVisible()
    expect(screen.getByText('1 pas proposé ici')).toBeVisible()
    const lignes = within(tableau).getAllByRole('row')
    expect(lignes[1]).toHaveTextContent('Poulet braisé')
    expect(lignes[1]).toHaveTextContent('Épuisé ce jour')
    expect(lignes[1]).toHaveTextContent('Afi M., 19:42, jusqu’au lendemain 4 h')
    const flag = within(tableau).getByRole('row', { name: /Flag 65 cl/ })
    expect(flag).toHaveTextContent('1 200 F')
    expect(flag).toHaveTextContent('Prix propre')
    expect(within(tableau).getByRole('row', { name: /Fufu/ })).toHaveTextContent('Pas proposé ici')
  })

  it('laisse le gérant déclarer une rupture, sans toucher aux prix', async () => {
    const { envois } = backendSimule()
    await ouvrirCarte([...MOI_TANTI.permissions, 'DISPONIBILITE_GERER'])

    expect(
      screen.queryByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }),
    ).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Déclarer Flag 65 cl épuisé ce jour' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Remettre Poulet braisé en vente' }))

    await waitFor(() => {
      expect(envois).toEqual([
        { methode: 'POST', chemin: `${FLAG.produitId}/rupture`, corps: null },
        { methode: 'DELETE', chemin: `${POULET.produitId}/rupture`, corps: null },
      ])
    })
    expect(
      screen.queryByRole('button', { name: 'Proposer Fufu sauce graine ici' }),
    ).not.toBeInTheDocument()
  })

  it('fixe un prix propre puis revient au prix de base', async () => {
    const { envois } = backendSimule()
    await ouvrirCarte(PROPRIETAIRE)

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Prix dans cet établissement' }))
    const dialogue = await screen.findByRole('dialog', {
      name: 'Prix de « Flag 65 cl » à Bè Kpota',
    })
    expect(dialogue).toHaveTextContent('Prix de base de la carte : 1 000 F.')
    const prix = within(dialogue).getByLabelText(/^Prix TTC à Bè Kpota/)
    await userEvent.clear(prix)
    await userEvent.type(prix, '1300')
    expect(within(dialogue).getByText('Dont TVA : 198 F par unité.')).toBeVisible()
    await userEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer le prix' }))

    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Prix dans cet établissement' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Revenir au prix de base',
      }),
    )

    await waitFor(() => {
      expect(envois).toEqual([
        { methode: 'PUT', chemin: `${FLAG.produitId}/prix`, corps: { prix: 1300 } },
        { methode: 'PUT', chemin: `${FLAG.produitId}/prix`, corps: {} },
      ])
    })
  })

  it('change d’établissement et filtre par recherche', async () => {
    const { cartesLues } = backendSimule()
    const tableau = await ouvrirCarte(PROPRIETAIRE)

    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un produit' }), 'flag')
    expect(within(tableau).queryByText('Poulet braisé')).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText(/^Établissement/), 'Agbalépédo')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Carte de Agbalépédo' }),
    ).toBeVisible()
    await waitFor(() => {
      expect(cartesLues).toEqual([BE_KPOTA.id, AGBALEPEDO.id])
    })
  })
})
