import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { serveurMsw } from '../../../tests/serveurMsw'
import type { ReponseMoi } from '../api/contrat'
import { ouvrirSession, reinitialiserSession } from './session'
import { nomAffiche, useSession } from './useSession'

const API = `${window.location.origin}/api`
const MAQUIS = { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01', nom: 'Maquis Chez Tanti' }
const FLAMBOYANT = { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a02', nom: 'Bar Le Flamboyant' }

const MOI_TANTI: ReponseMoi = {
  compte: {
    id: 'c1',
    administrateurPlateforme: false,
    motDePasseAChanger: false,
    telephone: '+22890112233',
  },
  portee: 'ENTREPRISE',
  utilisateur: { id: 'u1', prenom: 'Tanti', nom: 'Akouvi' },
  entrepriseCourante: {
    id: MAQUIS.id,
    nom: MAQUIS.nom,
    pays: 'TG',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Lome',
  },
  entreprises: [MAQUIS, FLAMBOYANT],
  permissions: ['ETABLISSEMENT_GERER'],
}

function monter() {
  const clientRequetes = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const enveloppe = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={clientRequetes}>{children}</QueryClientProvider>
  )
  return { clientRequetes, ...renderHook(() => useSession(), { wrapper: enveloppe }) }
}

describe('useSession', () => {
  afterEach(() => {
    reinitialiserSession()
  })

  it('ne demande pas le profil tant que la session n’est pas ouverte', () => {
    const { result } = monter()

    expect(result.current.etat).toEqual({ statut: 'inconnue' })
    expect(result.current.moi).toBeUndefined()
    expect(result.current.aLaPermission('ETABLISSEMENT_GERER')).toBe(false)
  })

  it('charge le profil de la session ouverte et expose ses permissions', async () => {
    serveurMsw.use(http.get(`${API}/moi`, () => HttpResponse.json(MOI_TANTI)))
    ouvrirSession({ compte: MOI_TANTI.compte, entreprises: [MAQUIS], jetonAcces: 'eyJ.maquis' })

    const { result } = monter()

    await waitFor(() => {
      expect(result.current.moi?.portee).toBe('ENTREPRISE')
    })
    expect(result.current.aLaPermission('ETABLISSEMENT_GERER')).toBe(true)
  })

  it('oublie toutes les données de l’entreprise précédente en changeant d’entreprise', async () => {
    serveurMsw.use(
      http.post(`${API}/auth/rafraichir`, () =>
        HttpResponse.json({ jetonAcces: 'eyJ.flamboyant', entreprises: [MAQUIS, FLAMBOYANT] }),
      ),
    )
    const { result, clientRequetes } = monter()
    clientRequetes.setQueryData(['etablissements', 0], { total: 2 })

    await act(() => result.current.choisirEntreprise(FLAMBOYANT.id))

    expect(clientRequetes.getQueryData(['etablissements', 0])).toBeUndefined()
    expect(result.current.etat).toEqual({ statut: 'connectee' })
  })

  it('oublie les données à la connexion et à la déconnexion', async () => {
    serveurMsw.use(
      http.post(`${API}/auth/connexion`, () =>
        HttpResponse.json({ compte: MOI_TANTI.compte, entreprises: [MAQUIS], jetonAcces: 'eyJ' }),
      ),
      http.post(`${API}/auth/deconnexion`, () => new HttpResponse(null, { status: 204 })),
      http.get(`${API}/moi`, () => HttpResponse.json(MOI_TANTI)),
    )
    const { result, clientRequetes } = monter()
    clientRequetes.setQueryData(['plateforme', 'entreprises', 0], { total: 3 })

    await act(() => result.current.connecter('90 11 22 33', 'mot-de-passe-solide'))
    expect(clientRequetes.getQueryData(['plateforme', 'entreprises', 0])).toBeUndefined()

    clientRequetes.setQueryData(['etablissements', 0], { total: 2 })
    await act(() => result.current.deconnecter())

    expect(clientRequetes.getQueryData(['etablissements', 0])).toBeUndefined()
    expect(result.current.etat).toEqual({ statut: 'anonyme' })
  })
})

describe('nomAffiche', () => {
  it('préfère le prénom et le nom de l’utilisateur de l’entreprise', () => {
    expect(nomAffiche(MOI_TANTI)).toBe('Tanti Akouvi')
  })

  it('se rabat sur l’e-mail ou le téléphone du compte', () => {
    const sansUtilisateur: ReponseMoi = { ...MOI_TANTI }
    delete sansUtilisateur.utilisateur
    expect(
      nomAffiche({
        ...sansUtilisateur,
        portee: 'PLATEFORME',
        compte: {
          id: 'a',
          administrateurPlateforme: true,
          motDePasseAChanger: false,
          email: 'admin@tonti.africa',
        },
      }),
    ).toBe('admin@tonti.africa')
    expect(nomAffiche(sansUtilisateur)).toBe('+22890112233')
  })
})
