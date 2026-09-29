import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Le backend est neuf à chaque lancement (scripts/e2e-reel.sh) : ces données n'existent pas encore.
const ADMIN = {
  identifiant: process.env.APP_ADMIN_EMAIL ?? 'admin.e2e@tonti.africa',
  motDePasse: process.env.APP_ADMIN_MOT_DE_PASSE ?? 'Admin-e2e-2026',
}
const TANTI = { telephone: '+228 90 11 22 33', saisie: '90 11 22 33', motDePasse: 'Tanti-2026' }

const DOSSIER_CAPTURES = process.env.DOSSIER_CAPTURES ?? 'test-results/captures-1a'
mkdirSync(DOSSIER_CAPTURES, { recursive: true })

async function capturer(page: Page, nom: string) {
  await page.screenshot({ path: `${DOSSIER_CAPTURES}/${nom}.png`, fullPage: true })
}

async function seConnecter(page: Page, identifiant: string, motDePasse: string) {
  await page.goto('/connexion')
  await page.getByLabel(/Téléphone ou e-mail/).fill(identifiant)
  await page.getByLabel(/Mot de passe/).fill(motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

async function seDeconnecter(page: Page) {
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page).toHaveURL(/\/connexion$/)
}

async function creerEntreprise(
  page: Page,
  { nom, etablissement, code }: { nom: string; etablissement: string; code: string },
) {
  await page.getByRole('link', { name: 'Créer une entreprise' }).click()
  const entreprise = page.getByRole('group', { name: 'Entreprise' })
  await entreprise.getByLabel(/^Nom de l’entreprise/).fill(nom)
  await expect(entreprise.getByLabel(/^Pays/)).toHaveValue('TG')
  await expect(entreprise.getByLabel(/^Devise/)).toHaveValue('XOF')
  const proprietaire = page.getByRole('group', { name: 'Propriétaire' })
  await proprietaire.getByLabel(/^Prénom/).fill('Tanti')
  await proprietaire.getByLabel(/^Nom/).fill('Akouvi')
  await proprietaire.getByLabel(/^Téléphone/).fill(TANTI.telephone)
  await proprietaire.getByLabel(/^Mot de passe provisoire/).fill(TANTI.motDePasse)
  const premier = page.getByRole('group', { name: 'Premier établissement' })
  await premier.getByLabel(/^Nom de l’établissement/).fill(etablissement)
  await premier.getByLabel(/^Code/).fill(code)
  await premier.getByLabel(/^Ville/).fill('Lomé')
  await page.getByRole('button', { name: 'Créer l’entreprise' }).click()
  await expect(page).toHaveURL(/\/plateforme(\?.*)?$/)
}

test.describe.configure({ mode: 'serial' })

test('l’admin crée Maquis Chez Tanti, puis Tanti gère ses établissements', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/connexion$/)
  await capturer(page, '01-connexion-tablette')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '01-connexion-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })

  // L'administrateur de la plateforme crée l'entreprise, son propriétaire et Bè Kpota.
  await seConnecter(page, ADMIN.identifiant, ADMIN.motDePasse)
  await expect(page).toHaveURL(/\/plateforme$/)
  await expect(page.getByRole('banner')).toContainText('Administration de la plateforme')
  await creerEntreprise(page, { nom: 'Maquis Chez Tanti', etablissement: 'Bè Kpota', code: 'BE' })
  await expect(page.getByRole('status')).toContainText('Maquis Chez Tanti a été créée.')
  const ligne = page.getByRole('row', { name: /Maquis Chez Tanti/ })
  await expect(ligne).toContainText('Togo')
  await expect(ligne).toContainText('Active')
  await capturer(page, '03-plateforme-entreprises')
  await seDeconnecter(page)

  // Tanti se connecte avec son téléphone, saisi sans indicatif.
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await expect(page).toHaveURL(/\/gestion$/)
  await expect(page.getByRole('banner')).toContainText('Maquis Chez Tanti')
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Établissements' })
    .click()
  const tableau = page.getByRole('table', { name: 'Établissements de l’entreprise' })
  await expect(tableau).toContainText('Bè Kpota')

  await page.getByRole('button', { name: 'Ajouter un établissement' }).click()
  const formulaire = page.getByRole('form', { name: 'Nouvel établissement' })
  await formulaire.getByLabel(/^Code/).fill('ag')
  await formulaire.getByLabel(/^Nom/).fill('Agbalépédo')
  await formulaire.getByLabel(/^Ville/).fill('Lomé')
  await capturer(page, '05-etablissements-formulaire')
  await page.getByRole('button', { name: 'Créer l’établissement' }).click()

  await expect(page.getByRole('status')).toContainText('Agbalépédo a été créé.')
  await expect(tableau.getByRole('row', { name: /Agbalépédo/ })).toContainText('AG')
  await capturer(page, '04-etablissements-tablette')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '04-etablissements-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })
  await seDeconnecter(page)
})

test('un compte à plusieurs entreprises choisit la sienne après connexion', async ({ page }) => {
  await seConnecter(page, ADMIN.identifiant, ADMIN.motDePasse)
  await expect(page).toHaveURL(/\/plateforme$/)
  await creerEntreprise(page, {
    nom: 'Bar Le Flamboyant',
    etablissement: 'Tokoin',
    code: 'TK',
  })
  await expect(page.getByRole('status')).toContainText(
    'rattachée au compte existant du propriétaire',
  )
  await seDeconnecter(page)

  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await expect(page).toHaveURL(/\/choix-entreprise$/)
  await expect(page.getByRole('button', { name: 'Bar Le Flamboyant' })).toBeVisible()
  await capturer(page, '02-choix-entreprise')
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()

  await expect(page).toHaveURL(/\/gestion$/)
  const selecteur = page.getByRole('combobox', { name: 'Entreprise' })
  await expect(selecteur).toHaveValue(/.+/)
  await selecteur.selectOption({ label: 'Bar Le Flamboyant' })
  // Le titre de la barre (et non l'option choisie) prouve que le changement a abouti.
  await expect(
    page.getByRole('banner').locator('span', { hasText: /^Bar Le Flamboyant$/ }),
  ).toBeVisible()
  await expect(selecteur).toBeEnabled()
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Établissements' })
    .click()
  const tableau = page.getByRole('table', { name: 'Établissements de l’entreprise' })
  await expect(tableau).toContainText('Tokoin')
  await expect(tableau).not.toContainText('Bè Kpota')
  await capturer(page, '06-gestion-autre-entreprise')
})
