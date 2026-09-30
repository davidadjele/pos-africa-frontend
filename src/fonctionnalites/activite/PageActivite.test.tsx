import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, MOI_TANTI, ouvrir, sessionOuverte } from '../../../tests/application'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { EvenementActivite } from '../../partage/api/contrat'

const PRIX: EvenementActivite = {
  id: 'a0000000-0000-4000-8000-000000000001',
  type: 'PRIX_ETABLISSEMENT_MODIFIE',
  domaine: 'CARTE',
  critique: true,
  objetType: 'PRODUIT',
  objetId: 'b0000000-0000-4000-8000-000000000002',
  objetLibelle: 'Flag 65 cl',
  etablissementId: '9a1f0c2e-0000-4b8e-8f6a-000000000001',
  etablissementNom: 'Bè Kpota',
  auteurNom: 'Tanti A.',
  survenuLe: new Date().toISOString(),
  details: { avant: 1000, apres: 1200 },
  detailsNoms: {},
}
// Taxe créée depuis l'espace plateforme : ni établissement ni auteur dans l'entreprise.
const TVA: EvenementActivite = {
  id: 'a0000000-0000-4000-8000-000000000002',
  type: 'TAXE_CREEE',
  domaine: 'CARTE',
  critique: false,
  objetType: 'TAXE',
  objetId: '7a000000-0000-4000-8000-000000000001',
  objetLibelle: 'TVA',
  survenuLe: PRIX.survenuLe,
  details: { taux: 1800 },
  detailsNoms: {},
}

const ETABLISSEMENT = {
  code: 'BE',
  fuseauHoraire: 'Africa/Lome',
  delaiVerrouillageMinutes: 3,
  actif: true,
  version: 0,
}

function backendSimule() {
  const requetes: URLSearchParams[] = []
  serveurMsw.use(
    http.get(`${API}/etablissements`, () =>
      HttpResponse.json({ elements: [], page: 0, taille: 50, total: 0 }),
    ),
    http.get(`${API}/activite`, ({ request }) => {
      const parametres = new URL(request.url).searchParams
      requetes.push(parametres)
      const elements = parametres.get('critiques') === 'false' ? [PRIX, TVA] : [PRIX]
      return HttpResponse.json({ elements, page: 0, taille: 50, total: elements.length })
    }),
  )
  return requetes
}

async function ouvrirActivite() {
  sessionOuverte({ ...MOI_TANTI, permissions: [...MOI_TANTI.permissions, 'ACTIVITE_CONSULTER'] })
  ouvrir('/gestion/activite')
  return screen.findByRole('region', { name: 'Activité' })
}

describe('PageActivite', () => {
  it('raconte chaque action critique : qui, quoi, où, avant et après', async () => {
    const requetes = backendSimule()
    const liste = await ouvrirActivite()

    const ligne = within(liste).getByRole('listitem')
    expect(ligne).toHaveTextContent('Tanti A. a changé le prix de Flag 65 cl à Bè Kpota')
    expect(ligne).toHaveTextContent('1 000 F → 1 200 F')
    expect(ligne).toHaveTextContent('Critique')
    expect(screen.getByRole('heading', { name: /^Aujourd’hui, / })).toBeVisible()
    expect(requetes[0]?.get('critiques')).toBe('true')
    expect(requetes[0]?.get('depuis')).not.toBeNull()
  })

  it('ajoute les informations et les actions de l’équipe Tonti avec « Tout »', async () => {
    backendSimule()
    await ouvrirActivite()

    await userEvent.click(screen.getByRole('button', { name: 'Tout' }))

    const liste = screen.getByRole('region', { name: 'Activité' })
    await waitFor(() => {
      expect(within(liste).getAllByRole('listitem')).toHaveLength(2)
    })
    expect(liste).toHaveTextContent('Équipe Tonti a créé la taxe TVA')
    expect(liste).toHaveTextContent('Information')
  })

  it('cite les établissements d’un employé qui travaille dans plusieurs', async () => {
    backendSimule()
    serveurMsw.use(
      http.get(`${API}/etablissements`, () =>
        HttpResponse.json({
          elements: [
            { ...ETABLISSEMENT, id: 'e-be', nom: 'Bè Kpota' },
            { ...ETABLISSEMENT, id: 'e-ag', nom: 'Agbalépédo' },
          ],
          page: 0,
          taille: 50,
          total: 2,
        }),
      ),
      http.get(`${API}/activite`, () =>
        HttpResponse.json({
          elements: [
            {
              ...TVA,
              type: 'PIN_REINITIALISE',
              domaine: 'PERSONNEL',
              critique: true,
              objetType: 'EMPLOYE',
              objetLibelle: 'Sena Gbeasor',
              auteurNom: 'Afi M.',
              details: { etablissements: ['e-be', 'e-ag'] },
            },
          ],
          page: 0,
          taille: 50,
          total: 1,
        }),
      ),
    )
    const liste = await ouvrirActivite()

    expect(await within(liste).findByText('Bè Kpota, Agbalépédo')).toBeVisible()
  })

  it('filtre par domaine', async () => {
    const requetes = backendSimule()
    await ouvrirActivite()

    await userEvent.selectOptions(screen.getByLabelText(/^Domaine/), 'Personnel')

    await waitFor(() => {
      expect(requetes.at(-1)?.get('domaine')).toBe('PERSONNEL')
    })
  })
})
