import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Le backend est neuf à chaque lancement (scripts/e2e-reel.sh) : ces données n'existent pas encore.
const ADMIN = {
  identifiant: process.env.APP_ADMIN_EMAIL ?? 'admin.e2e@tonti.africa',
  motDePasse: process.env.APP_ADMIN_MOT_DE_PASSE ?? 'Admin-e2e-2026',
}
const TANTI = { telephone: '+228 90 11 22 33', saisie: '90 11 22 33', motDePasse: 'Tanti-2026' }
const AFI = { telephone: '90 44 55 66', motDePasse: 'Afi-Bekpota-26' }

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

/** Lit un code affiché une seule fois (PIN, mot de passe), puis ferme le dialogue. */
async function noterCode(page: Page, libelle: string, bouton: string): Promise<string> {
  const dialogue = page.getByRole('dialog')
  // Le bloc du libellé exact : ses parents contiennent aussi les autres codes du dialogue.
  const code = dialogue
    .getByText(libelle, { exact: true })
    .locator('xpath=..')
    .locator('[data-code]')
  const valeur = (await code.textContent()) ?? ''
  await dialogue.getByRole('button', { name: bouton }).click()
  return valeur
}

/** Sur l'écran obligatoire : remplace le mot de passe temporaire, puis se reconnecte avec le nouveau. */
async function remplacerMotDePasse(
  page: Page,
  identifiant: string,
  temporaire: string,
  choisi: string,
) {
  await expect(page).toHaveURL(/\/changer-mot-de-passe$/)
  await page.getByLabel(/^Mot de passe temporaire/).fill(temporaire)
  await page.getByLabel(/^Nouveau mot de passe/).fill(choisi)
  await page.getByLabel(/^Confirmez le nouveau mot de passe/).fill(choisi)
  await page.getByRole('button', { name: 'Enregistrer et me reconnecter' }).click()
  await expect(page.getByRole('status')).toContainText('Mot de passe enregistré')
  await page.getByLabel(/Téléphone ou e-mail/).fill(identifiant)
  await page.getByLabel(/Mot de passe/).fill(choisi)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

/** Première connexion avec le mot de passe temporaire, qu'il faut aussitôt remplacer. */
async function premiereConnexion(
  page: Page,
  identifiant: string,
  temporaire: string,
  choisi: string,
) {
  await seConnecter(page, identifiant, temporaire)
  await remplacerMotDePasse(page, identifiant, temporaire, choisi)
}

/** @returns le mot de passe temporaire du propriétaire, s'il n'avait pas encore de compte */
async function creerEntreprise(
  page: Page,
  { nom, etablissement, code }: { nom: string; etablissement: string; code: string },
): Promise<string | undefined> {
  await page.getByRole('link', { name: 'Créer une entreprise' }).click()
  const entreprise = page.getByRole('group', { name: 'Entreprise' })
  await entreprise.getByLabel(/^Nom de l’entreprise/).fill(nom)
  await expect(entreprise.getByLabel(/^Pays/)).toHaveValue('TG')
  await expect(entreprise.getByLabel(/^Devise/)).toHaveValue('XOF')
  const proprietaire = page.getByRole('group', { name: 'Propriétaire' })
  await proprietaire.getByLabel(/^Prénom/).fill('Tanti')
  await proprietaire.getByLabel(/^Nom/).fill('Akouvi')
  await proprietaire.getByLabel(/^Téléphone/).fill(TANTI.telephone)
  const premier = page.getByRole('group', { name: 'Premier établissement' })
  await premier.getByLabel(/^Nom de l’établissement/).fill(etablissement)
  await premier.getByLabel(/^Code/).fill(code)
  await premier.getByLabel(/^Ville/).fill('Lomé')
  await page.getByRole('button', { name: 'Créer l’entreprise' }).click()
  const dialogue = page.getByRole('dialog')
  await Promise.race([dialogue.waitFor(), page.waitForURL(/\/plateforme(\?.*)?$/)])
  const temporaire = (await dialogue.isVisible())
    ? await noterCode(page, 'Mot de passe temporaire du back-office', 'J’ai noté les codes')
    : undefined
  await expect(page).toHaveURL(/\/plateforme(\?.*)?$/)
  return temporaire
}

test.describe.configure({ mode: 'serial' })

/** PIN temporaire de Kossi, donné par Tanti, que Kossi remplace à sa première prise de caisse. */
let pinTemporaireKossi = ''

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
  const temporaire = await creerEntreprise(page, {
    nom: 'Maquis Chez Tanti',
    etablissement: 'Bè Kpota',
    code: 'BE',
  })
  expect(temporaire).toMatch(/^[a-z2-9]{12}$/)
  await expect(page.getByRole('status')).toContainText('Maquis Chez Tanti a été créée.')
  const ligne = page.getByRole('row', { name: /Maquis Chez Tanti/ })
  await expect(ligne).toContainText('Togo')
  await expect(ligne).toContainText('Active')
  await capturer(page, '03-plateforme-entreprises')
  await seDeconnecter(page)

  // Tanti se connecte avec son téléphone, saisi sans indicatif, et remplace le mot de passe temporaire.
  await premiereConnexion(page, TANTI.saisie, temporaire ?? '', TANTI.motDePasse)
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

test('Tanti ajoute son personnel, et la gérante ne voit que le sien', async ({ page }) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()
  await expect(page).toHaveURL(/\/gestion$/)
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Personnel' })
    .click()
  await expect(page.getByRole('table', { name: 'Personnel de l’entreprise' })).toContainText(
    'Tanti Akouvi',
  )

  // Un serveur : caisse seulement, avec un PIN temporaire.
  await page.getByRole('button', { name: 'Ajouter un employé' }).click()
  let formulaire = page.getByRole('form', { name: 'Ajouter un employé' })
  await formulaire.getByLabel(/^Prénom/).fill('Kossi')
  await formulaire.getByLabel(/^Nom/).fill('Agbeko')
  await formulaire.getByLabel('Rôle à Bè Kpota').selectOption({ label: 'Serveur' })
  await page.getByRole('button', { name: 'Enregistrer l’employé' }).click()
  pinTemporaireKossi = await noterCode(page, 'PIN de caisse temporaire', 'J’ai noté les codes')
  expect(pinTemporaireKossi).toMatch(/^\d{6}$/)

  // Une serveuse partagée entre les deux établissements.
  await page.getByRole('button', { name: 'Ajouter un employé' }).click()
  formulaire = page.getByRole('form', { name: 'Ajouter un employé' })
  await formulaire.getByLabel(/^Prénom/).fill('Sena')
  await formulaire.getByLabel(/^Nom/).fill('Gbeasor')
  await formulaire.getByLabel('Rôle à Bè Kpota').selectOption({ label: 'Serveur' })
  await formulaire.getByLabel('Rôle à Agbalépédo').selectOption({ label: 'Serveur' })
  await page.getByRole('button', { name: 'Enregistrer l’employé' }).click()
  await noterCode(page, 'PIN de caisse temporaire', 'J’ai noté les codes')

  // Une gérante à Bè Kpota, avec un accès au back-office.
  await page.getByRole('button', { name: 'Ajouter un employé' }).click()
  formulaire = page.getByRole('form', { name: 'Ajouter un employé' })
  await formulaire.getByLabel(/^Prénom/).fill('Afi')
  await formulaire.getByLabel(/^Nom/).fill('Mensah')
  await formulaire.getByLabel('Rôle à Bè Kpota').selectOption({ label: 'Gérant' })
  await formulaire.getByLabel('Donner un accès au back-office').check()
  await formulaire.getByLabel(/^Téléphone/).fill(AFI.telephone)
  await capturer(page, '07-personnel-formulaire')
  await page.getByRole('button', { name: 'Enregistrer l’employé' }).click()
  await expect(page.getByRole('dialog')).toContainText('Mot de passe temporaire du back-office')
  await capturer(page, '08-personnel-codes')
  const motDePasseAfi = await noterCode(
    page,
    'Mot de passe temporaire du back-office',
    'J’ai noté les codes',
  )
  const tableau = page.getByRole('table', { name: 'Personnel de l’entreprise' })
  await expect(tableau.getByRole('row', { name: /Afi Mensah/ })).toContainText('Back-office')
  await capturer(page, '09-personnel-liste')
  await page.getByRole('button', { name: 'Plus d’actions pour Kossi Agbeko' }).click()
  await expect(page.getByRole('menuitem', { name: 'Réinitialiser le PIN' })).toBeFocused()
  await capturer(page, '09-personnel-menu-actions')
  await page.keyboard.press('Escape')
  // Dernière ligne : le menu sort du tableau au lieu d'y être coupé.
  await page.getByRole('button', { name: 'Plus d’actions pour Afi Mensah' }).click()
  await expect(page.getByRole('menuitem', { name: 'Désactiver' })).toBeInViewport()
  await capturer(page, '09-personnel-menu-derniere-ligne')
  await page.keyboard.press('Escape')
  await seDeconnecter(page)

  // Afi remplace son mot de passe temporaire, puis ne voit que le personnel de Bè Kpota.
  await seConnecter(page, AFI.telephone, motDePasseAfi)
  await expect(page).toHaveURL(/\/changer-mot-de-passe$/)
  await capturer(page, '10-mot-de-passe-obligatoire')
  await remplacerMotDePasse(page, AFI.telephone, motDePasseAfi, AFI.motDePasse)
  await expect(page).toHaveURL(/\/gestion$/)
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Personnel' })
    .click()
  const vueGerante = page.getByRole('table', { name: 'Personnel de l’entreprise' })
  await expect(vueGerante).toContainText('Kossi Agbeko')
  await expect(vueGerante).not.toContainText('Tanti Akouvi')
  await capturer(page, '11-personnel-vue-gerante')

  // Sena travaille aussi à Agbalépédo : Afi ne la modifie ni ne la désactive, mais peut la débloquer.
  await expect(vueGerante.getByRole('row', { name: /Sena Gbeasor/ })).toContainText(
    'Bè Kpota : Serveur',
  )
  await expect(page.getByRole('button', { name: 'Modifier Sena Gbeasor' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Plus d’actions pour Sena Gbeasor' }).click()
  await expect(page.getByRole('menuitem', { name: 'Désactiver' })).toHaveCount(0)
  await capturer(page, '11-personnel-employe-partage')
  await page.getByRole('menuitem', { name: 'Réinitialiser le PIN' }).click()
  await page.getByRole('button', { name: 'Générer un nouveau PIN' }).click()
  await expect(page.getByRole('dialog', { name: 'Nouveau PIN de Sena Gbeasor' })).toBeVisible()
  const nouveauPinSena = await noterCode(page, 'PIN de caisse temporaire', 'J’ai noté le PIN')
  expect(nouveauPinSena).toMatch(/^\d{6}$/)
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '11-personnel-vue-gerante-telephone')
})

async function taperCode(page: Page, code: string) {
  for (const chiffre of code) {
    await page.getByRole('button', { name: chiffre, exact: true }).click()
  }
}

test('Tanti enregistre une tablette avec un code, Kossi y prend la caisse, puis Tanti la révoque', async ({
  page,
  browser,
}) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Tablettes' })
    .click()
  await page.getByRole('button', { name: 'Enregistrer une tablette' }).click()
  const formulaire = page.getByRole('form', { name: 'Enregistrer une tablette' })
  await formulaire.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await formulaire.getByLabel(/^Nom de la caisse/).fill('Caisse 1, bar')
  await formulaire.getByRole('button', { name: 'Générer le code' }).click()
  const panneau = page.getByRole('region', { name: 'Code d’enregistrement' })
  const code = ((await panneau.locator('[data-code]').textContent()) ?? '').replace(/\D/g, '')
  expect(code).toMatch(/^\d{6}$/)
  await capturer(page, '12-tablettes-code')

  // Une autre fenêtre joue la tablette : aucune session, seulement le code.
  const contexteTablette = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const tablette = await contexteTablette.newPage()
  await tablette.goto('/caisse')
  await expect(tablette).toHaveURL(/\/enregistrement-tablette$/)
  await capturer(tablette, '13-tablette-enregistrement')
  await taperCode(tablette, code)
  await expect(tablette).toHaveURL(/\/caisse$/)
  await expect(tablette.getByRole('banner')).toContainText('Bè Kpota, Caisse 1, bar')
  await expect(
    tablette.getByRole('heading', { level: 1, name: 'Qui prend la caisse ?' }),
  ).toBeVisible()
  await capturer(tablette, '14-tablette-qui-prend-la-caisse')

  // Kossi tape le PIN temporaire donné par Tanti, puis choisit le sien, tapé deux fois.
  await tablette.getByRole('button', { name: /Kossi A\./ }).click()
  await taperCode(tablette, pinTemporaireKossi)
  await capturer(tablette, '14-tablette-pin')
  await tablette.getByRole('button', { name: 'Ouvrir la caisse' }).click()
  await expect(
    tablette.getByRole('heading', { level: 1, name: 'Choisissez votre code personnel' }),
  ).toBeVisible()
  await taperCode(tablette, '4827')
  await tablette.getByRole('button', { name: 'Continuer' }).click()
  await taperCode(tablette, '4827')
  await capturer(tablette, '14-tablette-nouveau-pin')
  await tablette.getByRole('button', { name: 'Enregistrer mon code' }).click()
  const barreTablette = tablette.getByRole('banner')
  await expect(barreTablette).toContainText('Kossi A.')
  await capturer(tablette, '14-tablette-caisse-ouverte')

  // Changement d'utilisateur, puis retour de Kossi avec son propre code.
  await barreTablette.getByRole('button', { name: 'Changer d’utilisateur' }).click()
  await tablette.getByRole('button', { name: /Kossi A\./ }).click()
  await taperCode(tablette, '4827')
  await tablette.getByRole('button', { name: 'Ouvrir la caisse' }).click()
  await expect(barreTablette).toContainText('Kossi A.')

  await expect(panneau).toContainText('La tablette « Caisse 1, bar » est enregistrée.')
  await panneau.getByRole('button', { name: 'Terminer' }).click()
  const tableau = page.getByRole('table', { name: 'Tablettes de l’entreprise' })
  await expect(tableau.getByRole('row', { name: /Caisse 1, bar/ })).toContainText('Active')
  await capturer(page, '15-tablettes-liste')

  // Révoquée, la tablette revient à l'écran d'enregistrement.
  await page.getByRole('button', { name: 'Plus d’actions pour Caisse 1, bar' }).click()
  await page.getByRole('menuitem', { name: 'Révoquer' }).click()
  await page.getByRole('button', { name: 'Révoquer la tablette' }).click()
  await expect(tableau.getByRole('row', { name: /Caisse 1, bar/ })).toContainText('Révoquée')
  await tablette.reload()
  await expect(tablette).toHaveURL(/\/enregistrement-tablette$/)
  await contexteTablette.close()
})

test('Tanti compose sa carte : taxe, catégories, produits et changement de prix', async ({
  page,
}) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()
  const navigation = page.getByRole('navigation', { name: 'Navigation principale' })

  // La TVA saisie à la création de l'entreprise est là.
  await navigation.getByRole('link', { name: 'Taxes' }).click()
  const taxes = page.getByRole('table', { name: 'Taxes de l’entreprise' })
  await expect(taxes.getByRole('row', { name: /TVA/ })).toContainText('18 %')
  await capturer(page, '16-taxes')

  // Deux catégories, la seconde remontée en tête.
  await navigation.getByRole('link', { name: 'Produits' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'La carte est vide' })).toBeVisible()
  await page.getByRole('button', { name: 'Gérer les catégories' }).click()
  const dialogue = page.getByRole('dialog', { name: 'Catégories de la carte' })
  for (const [nom, couleur] of [
    ['Grillades', 'Ocre'],
    ['Bières', 'Feuille'],
  ] as const) {
    const formulaire = dialogue.getByRole('form', { name: 'Nouvelle catégorie' })
    await formulaire.getByLabel(/^Nom/).fill(nom)
    await formulaire.getByText(couleur, { exact: true }).click()
    await formulaire.getByRole('button', { name: 'Ajouter la catégorie' }).click()
    await expect(dialogue.getByRole('list', { name: 'Catégories' })).toContainText(nom)
  }
  await dialogue.getByRole('button', { name: 'Monter Bières' }).click()
  await expect(dialogue.getByRole('listitem').first()).toContainText('Bières')
  await capturer(page, '17-categories')
  await dialogue.getByRole('button', { name: 'Fermer' }).click()

  // Une boisson, suivie en stock d'office, avec la TVA comprise calculée.
  await page.getByRole('link', { name: 'Ajouter un produit' }).click()
  await page.getByLabel(/^Nom/).fill('Flag 65 cl')
  await page.getByLabel(/^Catégorie/).selectOption({ label: 'Bières' })
  await page.getByRole('radio', { name: 'Boisson' }).check({ force: true })
  await page.getByLabel(/^Prix TTC/).fill('1000')
  await expect(page.getByText('Dont TVA : 153 F par unité.')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Suivre le stock/ })).toBeChecked()
  await capturer(page, '18-fiche-produit')
  await page.getByRole('button', { name: 'Enregistrer le produit' }).click()
  await expect(page.getByText('« Flag 65 cl » est enregistré.')).toBeVisible()

  // Changement de prix, tracé côté serveur (visible dans l'activité en 2d).
  await page.getByRole('link', { name: 'Modifier Flag 65 cl' }).click()
  await page.getByLabel(/^Prix TTC/).fill('1100')
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  const produits = page.getByRole('table', { name: 'Produits de la carte' })
  await expect(produits.getByRole('row', { name: /Flag 65 cl/ })).toContainText('1 100 F')
  await capturer(page, '19-produits')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '19-produits-telephone')
})

test('Tanti fixe un prix à Bè Kpota, puis la gérante déclare une rupture depuis son téléphone', async ({
  page,
}) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Par établissement' })
    .click()
  await page.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await expect(page.getByRole('heading', { level: 1, name: 'Carte de Bè Kpota' })).toBeVisible()

  await page.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }).click()
  await page.getByRole('menuitem', { name: 'Prix dans cet établissement' }).click()
  const dialogue = page.getByRole('dialog', { name: 'Prix de « Flag 65 cl » à Bè Kpota' })
  await dialogue.getByLabel(/^Prix TTC à Bè Kpota/).fill('1200')
  await capturer(page, '20-prix-etablissement')
  await dialogue.getByRole('button', { name: 'Enregistrer le prix' }).click()
  const carte = page.getByRole('table', { name: 'Carte de l’établissement' })
  await expect(carte.getByRole('row', { name: /Flag 65 cl/ })).toContainText('Prix propre')
  await capturer(page, '21-carte-etablissement')
  await seDeconnecter(page)

  // La gérante, sur son téléphone : seule la rupture lui est proposée.
  await page.setViewportSize({ width: 390, height: 844 })
  await seConnecter(page, AFI.telephone, AFI.motDePasse)
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Par établissement' })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Carte de Bè Kpota' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Déclarer Flag 65 cl épuisé ce jour' }).click()
  await expect(page.getByText('« Flag 65 cl » est épuisé jusqu’au lendemain 4 h.')).toBeVisible()
  await expect(
    page
      .getByRole('table', { name: 'Carte de l’établissement' })
      .getByRole('row', { name: /Flag 65 cl/ }),
  ).toContainText('Afi M.')
  await capturer(page, '22-rupture-telephone')
})
