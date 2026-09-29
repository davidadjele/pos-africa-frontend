import { expect, test, type Page } from '@playwright/test'

function surveillerErreursConsole(page: Page): string[] {
  const erreurs: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') erreurs.push(message.text())
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

test('l’accueil mène à la caisse, sous la barre de l’établissement', async ({ page }) => {
  const erreurs = surveillerErreursConsole(page)
  await page.goto('/')

  await expect(page).toHaveURL(/\/caisse$/)
  await expect(page.getByRole('banner')).toContainText('TONTI')
  await expect(page.getByRole('banner')).toContainText('Maquis Chez Tanti')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Aucun produit à vendre pour l’instant' }),
  ).toBeVisible()
  await verifierSansDefilementHorizontal(page)
  expect(erreurs).toEqual([])
})

test('la gestion présente sa navigation et son tableau de bord', async ({ page }) => {
  const erreurs = surveillerErreursConsole(page)
  await page.goto('/gestion')

  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible()
  const navigation = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(navigation.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await navigation.getByRole('link', { name: 'Caisse' }).click()
  await expect(page).toHaveURL(/\/caisse$/)
  await verifierSansDefilementHorizontal(page)
  expect(erreurs).toEqual([])
})

test('un reçu public s’ouvre depuis son lien partagé', async ({ page }) => {
  const erreurs = surveillerErreursConsole(page)
  await page.goto('/r/abc')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('abc', { exact: true })).toBeVisible()
  await verifierSansDefilementHorizontal(page)
  expect(erreurs).toEqual([])
})

test('une adresse inconnue affiche une page introuvable qui ramène à la caisse', async ({
  page,
}) => {
  await page.goto('/cuisine/ecran')

  await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible()
  const retour = page.getByRole('link', { name: 'Revenir à la caisse' })
  const hauteur = (await retour.boundingBox())?.height ?? 0
  expect(hauteur).toBeGreaterThanOrEqual(48)

  await retour.click()
  await expect(page).toHaveURL(/\/caisse$/)
})
