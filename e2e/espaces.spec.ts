import { expect, test, type Page } from '@playwright/test'
import { simulerApi } from './simulation'

// Tests de fumée contre le build de production : l'API est simulée par le navigateur (page.route),
// le parcours contre le vrai backend est dans e2e-reel/.

const RECU_EN_LIGNE = {
  recu: {
    numero: 'BE-000127',
    duplicata: false,
    jeton: 'abc',
    emisLe: '2026-10-01T21:05:00Z',
    entreprise: 'Maquis Chez Tanti',
    etablissement: { nom: 'Bè Kpota', ville: 'Lomé' },
    largeur: 80,
    impressionAuto: false,
    note: 'n°42, T4',
    serveur: 'Kossi A.',
    caissier: 'Yawa T.',
    lignes: [{ quantite: 2, nom: 'Poulet braisé', montant: 9000, offert: false, options: [] }],
    remise: 0,
    total: 9000,
    taxes: [],
    paiements: [{ mode: 'ESPECES', montant: 9000, montantRecu: 10_000, monnaieRendue: 1000 }],
  },
  devise: 'XOF',
  fuseauHoraire: 'Africa/Lome',
  operateurs: [],
  remboursements: [],
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

/** Le menu de la gestion : une entrée, puis l'onglet de la page s'il y en a plusieurs. Sur téléphone, ouvre le menu. */
async function allerA(page: Page, section: string, onglet?: string) {
  const menu = page.getByRole('navigation', { name: 'Navigation principale' })
  // Juste après une connexion, la page n'est pas encore affichée : on attend le menu avant de regarder.
  await menu.waitFor()
  const bouton = menu.getByRole('button', { name: 'Menu' })
  if (await bouton.isVisible()) await bouton.click()
  // Le nom peut finir par un compteur (« Stock, 2 produits à traiter ») : on ne regarde que le début.
  await menu.getByRole('link', { name: new RegExp(`^${section}`) }).click()
  const onglets = page.getByRole('navigation', { name: section })
  if (onglet !== undefined && (await onglets.count()) > 0) {
    await onglets.getByRole('link', { name: new RegExp(`^${onglet}`) }).click()
  }
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
  await allerA(page, 'Réglages', 'Établissements')
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
  // Sur téléphone, les entrées sont derrière le bouton « Menu ».
  const bouton = navigation.getByRole('button', { name: 'Menu' })
  if (await bouton.isVisible()) await bouton.click()
  await expect(navigation.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await expect(navigation.getByRole('link', { name: 'Aide' })).toHaveAttribute(
    'href',
    '/aide?depuis=%2Fgestion',
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
  await simulerApi(page, { connecte: false })
  await page.route('**/api/public/recus/abc', (route) => route.fulfill({ json: RECU_EN_LIGNE }))
  await page.goto('/r/abc')

  await expect(page.getByRole('heading', { level: 1, name: 'Votre reçu' })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Reçu BE-000127' })).toContainText('Poulet braisé')
  await verifierSansDefilementHorizontal(page)
  expect(erreurs).toEqual([])
})

test('l’aide s’ouvre sans session, et ses captures passent la politique de sécurité', async ({
  page,
}) => {
  const erreurs = surveillerErreursConsole(page)
  await simulerApi(page, { connecte: false })
  await page.goto('/aide')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Comment pouvons-nous vous aider ?' }),
  ).toBeVisible()
  await page
    .getByRole('region', { name: 'Je suis en caisse' })
    .getByRole('link', { name: 'Encaisser une note' })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Encaisser une note' })).toBeVisible()
  const capture = page.getByRole('list', { name: 'Étapes' }).getByRole('img').first()
  await capture.scrollIntoViewIfNeeded()
  // Une image chargée a une largeur réelle : ni bloquée par la CSP, ni réécrite vers index.html.
  await expect
    .poll(() => capture.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0)
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
