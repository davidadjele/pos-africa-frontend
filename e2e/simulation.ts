import type { Page } from '@playwright/test'

// L'API simulée par le navigateur (page.route) : les tests de fumée et de performance visent le build de
// production sans backend.

export const MAQUIS = { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01', nom: 'Maquis Chez Tanti' }

const MOI_TANTI = {
  compte: {
    id: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0001',
    administrateurPlateforme: false,
    motDePasseAChanger: false,
  },
  portee: 'ENTREPRISE',
  utilisateur: { id: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0101', prenom: 'Tanti', nom: 'Akouvi' },
  entrepriseCourante: { ...MAQUIS, pays: 'TG', devise: 'XOF', fuseauHoraire: 'Africa/Lome' },
  entreprises: [MAQUIS],
  permissions: ['ETABLISSEMENT_GERER'],
}

export const ETABLISSEMENTS = {
  elements: [
    {
      id: '9a1f0c2e-0000-4b8e-8f6a-000000000001',
      code: 'BE',
      nom: 'Bè Kpota',
      ville: 'Lomé',
      adresse: 'Rue de la Plage',
      fuseauHoraire: 'Africa/Lome',
      actif: true,
      version: 0,
    },
  ],
  page: 0,
  taille: 50,
  total: 1,
}

export async function simulerApi(page: Page, { connecte }: { connecte: boolean }) {
  let sessionOuverte = connecte
  await page.route('**/api/auth/rafraichir', (route) =>
    sessionOuverte
      ? route.fulfill({ json: { jetonAcces: 'eyJ.valide', entreprises: [MAQUIS] } })
      : route.fulfill({
          status: 401,
          json: { statut: 401, code: 'SESSION_EXPIREE', message: 'Session expirée.' },
        }),
  )
  await page.route('**/api/auth/connexion', (route) => {
    sessionOuverte = true
    return route.fulfill({
      json: { compte: MOI_TANTI.compte, entreprises: [MAQUIS], jetonAcces: 'eyJ.valide' },
    })
  })
  await page.route('**/api/moi', (route) => route.fulfill({ json: MOI_TANTI }))
  await page.route('**/api/public/configuration', (route) =>
    route.fulfill({ json: { inscriptionOuverte: false } }),
  )
  await page.route('**/api/etablissements?*', (route) => route.fulfill({ json: ETABLISSEMENTS }))
  // « Réglages » ouvre d'abord la fiche de l'entreprise.
  await page.route('**/api/entreprise', (route) => route.fulfill({ json: { nom: MAQUIS.nom } }))
  // Cette machine est une tablette enregistrée comme caisse de Bè Kpota.
  await page.route('**/api/appareil', (route) =>
    route.fulfill({
      json: {
        id: '7c2a0000-0000-4000-8000-000000000001',
        nom: 'Caisse 1, bar',
        entreprise: { ...MAQUIS, devise: 'XOF' },
        etablissement: { id: ETABLISSEMENTS.elements[0]?.id, nom: 'Bè Kpota', ville: 'Lomé' },
        delaiVerrouillageMinutes: 3,
      },
    }),
  )
  await page.route('**/api/appareil/personnel', (route) =>
    route.fulfill({
      json: [
        {
          utilisateurId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0201',
          prenom: 'Kossi',
          nomCourt: 'Kossi A.',
          role: 'SERVEUR',
          bloque: false,
          pinAChanger: false,
        },
      ],
    }),
  )
}
