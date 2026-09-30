import { expect, test, type Page } from '@playwright/test'

// Tests de fumée contre le build de production : l'API est simulée par le navigateur (page.route),
// le parcours contre le vrai backend est dans e2e-reel/.

const MAQUIS = { id: '6b0e6a52-7a6a-4d57-9d3e-1c1a9b1f0a01', nom: 'Maquis Chez Tanti' }

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

const ETABLISSEMENTS = {
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

async function simulerApi(page: Page, { connecte }: { connecte: boolean }) {
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

function surveillerErreursConsole(page: Page): string[] {
  const erreurs: string[] = []
  page.on('console', (message) => {
    // Le 401 du rafraîchissement silencieux sans session est attendu.
    if (message.type() === 'error' && !message.text().includes('status of 401')) {
      erreurs.push(message.text())
    }
  })
  page.on('pageerror', (erreur) => erreurs.push(erreur.message))
  return erreurs
}

async function verifierSansDefilementHorizontal(page: Page) {
  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(debordement).toBeLessThanOrEqual(0)
}

test('sans session, l’accueil mène à la connexion', async ({ page }) => {
  const erreurs = surveillerErreursConsole(page)
  await simulerApi(page, { connecte: false })
  await page.goto('/')

  await expect(page).toHaveURL(/\/connexion$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Se connecter' })).toBeVisible()
  await expect(page.getByLabel(/Téléphone ou e-mail/)).toBeVisible()
  const bouton = page.getByRole('button', { name: 'Se connecter' })
  expect((await bouton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48)
  await verifierSansDefilementHorizontal(page)
  expect(erreurs).toEqual([])
})

test('le propriétaire se connecte et retrouve ses établissements', async ({ page }) => {
  const erreurs = surveillerErreursConsole(page)
  await simulerApi(page, { connecte: false })
  await page.goto('/connexion')

  await page.getByLabel(/Téléphone ou e-mail/).fill('90 11 22 33')
  await page.getByLabel(/Mot de passe/).fill('Tanti-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page).toHaveURL(/\/gestion$/)
  await expect(page.getByRole('banner')).toContainText('Maquis Chez Tanti')
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Établissements' })
    .click()
  await expect(page.getByRole('table', { name: 'Établissements de l’entreprise' })).toContainText(
    'Bè Kpota',
  )
  await verifierSansDefilementHorizontal(page)
  expect(erreurs).toEqual([])
})

test('la gestion présente sa navigation et mène à la caisse', async ({ page }) => {
  const erreurs = surveillerErreursConsole(page)
  await simulerApi(page, { connecte: true })
  await page.goto('/gestion')

  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
  const navigation = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(navigation.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await navigation.getByRole('link', { name: 'Caisse' }).click()
  await expect(page).toHaveURL(/\/caisse$/)
  await expect(page.getByRole('banner')).toContainText('Maquis Chez Tanti')
  await expect(page.getByRole('heading', { level: 1, name: 'Qui prend la caisse ?' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Kossi A\./ })).toBeVisible()
  await verifierSansDefilementHorizontal(page)
  expect(erreurs).toEqual([])
})

test('un reçu public s’ouvre depuis son lien partagé, sans session', async ({ page }) => {
  const erreurs = surveillerErreursConsole(page)
  await page.goto('/r/abc')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('abc', { exact: true })).toBeVisible()
  await verifierSansDefilementHorizontal(page)
  expect(erreurs).toEqual([])
})

test('une adresse inconnue affiche une page introuvable qui ramène à l’accueil', async ({
  page,
}) => {
  await simulerApi(page, { connecte: false })
  await page.goto('/cuisine/ecran')

  await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible()
  const retour = page.getByRole('link', { name: 'Revenir à l’accueil' })
  expect((await retour.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48)

  await retour.click()
  await expect(page).toHaveURL(/\/connexion$/)
})
