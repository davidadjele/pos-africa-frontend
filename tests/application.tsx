import { render } from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { http, HttpResponse } from 'msw'
import { creerClientRequetes } from '../src/app/clientRequetes'
import { Fournisseurs } from '../src/app/Fournisseurs'
import { creerRouteur } from '../src/app/routeur'
import type { AppareilCourant, ReponseMoi } from '../src/partage/api/contrat'
import { serveurMsw } from './serveurMsw'

export const API = `${window.location.origin}/api`

export const MAQUIS = { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01', nom: 'Maquis Chez Tanti' }
export const FLAMBOYANT = { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a02', nom: 'Bar Le Flamboyant' }

export const MOI_TANTI: ReponseMoi = {
  compte: {
    id: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0001',
    administrateurPlateforme: false,
    motDePasseAChanger: false,
  },
  portee: 'ENTREPRISE',
  utilisateur: { id: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0101', prenom: 'Tanti', nom: 'Akouvi' },
  entrepriseCourante: {
    id: MAQUIS.id,
    nom: MAQUIS.nom,
    pays: 'TG',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Lome',
  },
  entreprises: [MAQUIS],
  permissions: ['BACK_OFFICE', 'ETABLISSEMENT_GERER', 'PERSONNEL_GERER'],
}

export const MOI_SERVEUR: ReponseMoi = {
  ...MOI_TANTI,
  utilisateur: { id: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0102', prenom: 'Kossi', nom: 'Amegah' },
  permissions: [],
}

export const MOI_ADMIN: ReponseMoi = {
  compte: {
    id: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0009',
    administrateurPlateforme: true,
    motDePasseAChanger: false,
    email: 'admin@tonti.africa',
  },
  portee: 'PLATEFORME',
  entreprises: [],
  permissions: [],
}

export const CAISSE_BAR: AppareilCourant = {
  id: '7c2a0000-0000-4000-8000-000000000001',
  nom: 'Caisse 1, bar',
  entreprise: MAQUIS,
  etablissement: { id: '9a1f0c2e-0000-4b8e-8f6a-000000000001', nom: 'Bè Kpota', ville: 'Lomé' },
}

/** La tablette présente son cookie d'appareil (ou non, avec null). */
export function tablette(appareil: AppareilCourant | null) {
  serveurMsw.use(
    http.get(`${API}/appareil`, () =>
      appareil === null
        ? HttpResponse.json({ statut: 401, code: 'NON_AUTHENTIFIE', message: 'x' }, { status: 401 })
        : HttpResponse.json(appareil),
    ),
  )
}

export const SESSION_EXPIREE = {
  statut: 401,
  code: 'SESSION_EXPIREE',
  message: 'Votre session a expiré. Reconnectez-vous.',
}

/** Le cookie de rafraîchissement rouvre la session de ce compte. */
export function sessionOuverte(moi: ReponseMoi) {
  serveurMsw.use(
    http.post(`${API}/auth/rafraichir`, () =>
      HttpResponse.json({
        jetonAcces: 'eyJ.valide',
        entrepriseCourante: moi.entrepriseCourante?.id,
        entreprises: moi.entreprises,
      }),
    ),
    http.get(`${API}/moi`, () => HttpResponse.json(moi)),
  )
}

/** Aucun cookie valable : l'application s'ouvre sans session. */
export function sessionAbsente({ inscriptionOuverte = false } = {}) {
  serveurMsw.use(
    http.post(`${API}/auth/rafraichir`, () => HttpResponse.json(SESSION_EXPIREE, { status: 401 })),
    http.get(`${API}/public/configuration`, () => HttpResponse.json({ inscriptionOuverte })),
  )
}

export function ouvrir(chemin: string) {
  const clientRequetes = creerClientRequetes({ nouvelEssai: false })
  const routeur = creerRouteur({
    clientRequetes,
    historique: createMemoryHistory({ initialEntries: [chemin] }),
  })
  render(<Fournisseurs routeur={routeur} clientRequetes={clientRequetes} />)
  return { routeur, clientRequetes }
}
