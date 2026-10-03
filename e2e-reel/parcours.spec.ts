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

/**
 * Remplace la boîte d'impression du navigateur, qui bloquerait le parcours, par un simple compteur, et WhatsApp par
 * le dernier lien qu'on lui aurait ouvert.
 */
async function simulerImpression(page: Page) {
  await page.evaluate(() => {
    const fenetre = globalThis as typeof globalThis & { impressions?: number; dernierLien?: string }
    fenetre.impressions = 0
    fenetre.print = () => {
      fenetre.impressions = (fenetre.impressions ?? 0) + 1
      fenetre.dispatchEvent(new Event('afterprint'))
    }
    fenetre.open = (lien) => {
      fenetre.dernierLien = String(lien)
      return null
    }
  })
}

/** Le reçu en ligne, tiré du message WhatsApp préparé pour le client. */
async function lienDuRecuEnvoye(page: Page): Promise<string> {
  const lien = await page.evaluate(
    () => (globalThis as typeof globalThis & { dernierLien?: string }).dernierLien ?? '',
  )
  const recu = /https?:\/\/\S+\/r\/[\w-]+/.exec(decodeURIComponent(lien))?.[0]
  expect(lien).toMatch(/^https:\/\/wa\.me\/228\d{8}\?text=/)
  if (recu === undefined) throw new Error(`Aucun reçu dans le message : ${lien}`)
  return recu
}

async function envoyerParWhatsApp(page: Page, numero: string): Promise<string> {
  const envoi = page.getByRole('group', { name: 'Envoyer par WhatsApp' })
  await envoi.getByLabel('Numéro WhatsApp du client').fill(numero)
  await envoi.getByRole('button', { name: 'Envoyer' }).click()
  await expect(page.getByRole('status', { name: 'Envoi WhatsApp' })).toBeVisible()
  return lienDuRecuEnvoye(page)
}

async function impressions(page: Page): Promise<number> {
  return page.evaluate(
    () => (globalThis as typeof globalThis & { impressions?: number }).impressions ?? 0,
  )
}

async function capturer(page: Page, nom: string) {
  // Transitions terminées : un bouton qui vient de s'activer apparaît avec sa couleur finale.
  await page.screenshot({
    path: `${DOSSIER_CAPTURES}/${nom}.png`,
    fullPage: true,
    animations: 'disabled',
  })
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

/** Lit un code affiché une seule fois (PIN, mot de passe), sans fermer le dialogue. */
async function lireCode(page: Page, libelle: string): Promise<string> {
  // Le bloc du libellé exact : ses parents contiennent aussi les autres codes du dialogue.
  const code = page
    .getByRole('dialog')
    .getByText(libelle, { exact: true })
    .locator('xpath=..')
    .locator('[data-code]')
  return (await code.textContent()) ?? ''
}

/** Lit un code affiché une seule fois, puis ferme le dialogue. */
async function noterCode(page: Page, libelle: string, bouton: string): Promise<string> {
  const valeur = await lireCode(page, libelle)
  await page.getByRole('dialog').getByRole('button', { name: bouton }).click()
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
/** PIN temporaire de la gérante : elle choisit le sien sur la tablette avant de valider une annulation. */
let pinTemporaireAfi = ''

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
  pinTemporaireAfi = await lireCode(page, 'PIN de caisse temporaire')
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

test('La gérante compte le stock de Bè Kpota, réceptionne une livraison et déclare une casse', async ({
  page,
}) => {
  await seConnecter(page, AFI.telephone, AFI.motDePasse)
  const navigation = page.getByRole('navigation', { name: 'Navigation principale' })
  await navigation.getByRole('link', { name: /Stock/ }).click()
  const stock = page.getByRole('table', { name: 'Stock de Bè Kpota' })
  await expect(stock.getByRole('row', { name: /Flag 65 cl/ })).toContainText('À compter')
  await capturer(page, '60-stock-a-compter')

  // Premier comptage : il devient le stock, sans écart à justifier.
  await page.getByRole('link', { name: 'Faire l’inventaire' }).click()
  await page.getByRole('textbox', { name: 'Compté : Flag 65 cl' }).fill('12')
  await page.getByRole('button', { name: 'Voir les écarts' }).click()
  await expect(page.getByRole('table', { name: 'Écarts de l’inventaire' })).toContainText(
    'Premier comptage',
  )
  await page.getByRole('button', { name: 'Valider l’inventaire' }).click()
  await expect(page.getByText('Inventaire enregistré : 1 premier comptage.')).toBeVisible()

  await page.getByRole('link', { name: 'Réceptionner une livraison' }).click()
  await page
    .getByRole('combobox', { name: 'Ajouter un produit' })
    .selectOption({ label: 'Flag 65 cl' })
  await page.getByRole('textbox', { name: /^N° du bon de livraison/ }).fill('BL 2240')
  await page.getByRole('textbox', { name: 'Quantité de Flag 65 cl' }).fill('24')
  await page.getByRole('textbox', { name: 'Coût unitaire de Flag 65 cl' }).fill('650')
  await capturer(page, '61-stock-reception')
  await page.getByRole('button', { name: 'Enregistrer : 1 produit, 24 unités' }).click()
  await expect(page.getByText('Réception enregistrée : 1 produit, 24 unités.')).toBeVisible()
  await expect(stock.getByRole('row', { name: /Flag 65 cl/ })).toContainText('36')

  await page.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }).click()
  await page.getByRole('menuitem', { name: 'Régler le seuil d’alerte' }).click()
  const seuil = page.getByRole('dialog', { name: 'Seuil d’alerte de Flag 65 cl' })
  await seuil.getByRole('textbox', { name: /^Seuil/ }).fill('40')
  await seuil.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(stock.getByRole('row', { name: /Flag 65 cl/ })).toContainText('Stock faible')

  await page.getByRole('button', { name: 'Déclarer une perte' }).click()
  const perte = page.getByRole('dialog', { name: 'Déclarer une perte' })
  await perte.getByRole('combobox', { name: /^Produit/ }).selectOption({ label: 'Flag 65 cl' })
  await perte.getByRole('textbox', { name: /^Quantité/ }).fill('2')
  await perte.getByRole('radio', { name: 'Casse' }).click()
  await capturer(page, '62-stock-perte')
  await perte.getByRole('button', { name: 'Retirer 2 du stock' }).click()
  await expect(page.getByText('2 Flag 65 cl retirés du stock.')).toBeVisible()
  await capturer(page, '63-stock')

  // Inventaire : un écart à justifier.
  await page.getByRole('link', { name: 'Faire l’inventaire' }).click()
  await capturer(page, '64-inventaire-comptage')
  await page.getByRole('textbox', { name: 'Compté : Flag 65 cl' }).fill('33')
  await page.getByRole('button', { name: 'Voir les écarts' }).click()
  const ecarts = page.getByRole('table', { name: 'Écarts de l’inventaire' })
  await expect(ecarts).toContainText('−1')
  await expect(page.getByRole('button', { name: 'Valider l’inventaire' })).toBeDisabled()
  await ecarts.getByRole('combobox', { name: 'Motif de l’écart : Flag 65 cl' }).selectOption('VOL')
  await capturer(page, '65-inventaire-ecarts')
  await page.getByRole('button', { name: 'Valider l’inventaire' }).click()
  await expect(page.getByText('Inventaire enregistré : 1 écart.')).toBeVisible()

  await page.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }).click()
  await page.getByRole('menuitem', { name: 'Historique' }).click()
  const historique = page.getByRole('dialog', { name: 'Historique de Flag 65 cl' })
  await expect(historique.getByRole('listitem')).toHaveCount(4)
  await expect(historique).toContainText('BL 2240')
  await capturer(page, '66-stock-historique')
  await historique.getByRole('button', { name: 'Fermer' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '63-stock-telephone')
})

test('Tanti retrouve dans l’activité les changements de la journée et l’historique des prix', async ({
  page,
}) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()
  const navigation = page.getByRole('navigation', { name: 'Navigation principale' })
  await navigation.getByRole('link', { name: 'Activité' }).click()

  const activite = page.getByRole('region', { name: 'Activité' })
  await expect(activite).toContainText('a changé le prix de Flag 65 cl à Bè Kpota')
  await expect(activite).toContainText('a changé le prix de base de Flag 65 cl')
  await expect(activite).toContainText('a réinitialisé le PIN de Sena Gbeasor')
  await expect(activite).toContainText('Afi M. a déclaré une perte de Flag 65 cl à Bè Kpota')
  await expect(activite).toContainText(
    'Afi M. a corrigé le stock de Flag 65 cl par inventaire à Bè Kpota',
  )
  await expect(activite).not.toContainText('épuisé')
  await page.getByRole('button', { name: 'Tout', exact: true }).click()
  await expect(activite).toContainText('Afi M. a déclaré Flag 65 cl épuisé à Bè Kpota')
  await expect(activite).toContainText('Équipe Tonti a créé la taxe TVA')
  await capturer(page, '24-activite')

  await navigation.getByRole('link', { name: 'Produits' }).click()
  await page.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }).click()
  await page.getByRole('menuitem', { name: 'Historique des prix' }).click()
  const historique = page.getByRole('dialog', { name: 'Historique des prix de « Flag 65 cl »' })
  await expect(historique.getByRole('listitem')).toHaveCount(2)
  await expect(historique).toContainText('Bè Kpota')
  await capturer(page, '25-historique-prix')
  await page.setViewportSize({ width: 390, height: 844 })
  await historique.getByRole('button', { name: 'Fermer' }).click()
  await navigation.getByRole('link', { name: 'Activité' }).click()
  await expect(activite).toContainText('Flag 65 cl')
  await capturer(page, '24-activite-telephone')
})

test('La gérante crée les salles de Bè Kpota et leurs tables', async ({ page }) => {
  await seConnecter(page, AFI.telephone, AFI.motDePasse)
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Salles et tables' })
    .click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Salles et tables de Bè Kpota' }),
  ).toBeVisible()

  for (const nom of ['Terrasse', 'Bar']) {
    await page.getByRole('button', { name: 'Nouvelle salle' }).click()
    const dialogue = page.getByRole('dialog', { name: 'Nouvelle salle' })
    await dialogue.getByLabel(/^Nom/).fill(nom)
    await dialogue.getByRole('button', { name: 'Créer la salle' }).click()
    await expect(page.getByText(`La salle « ${nom} » est créée.`)).toBeVisible()
  }

  const onglets = page.getByRole('tablist', { name: 'Salles' })
  await onglets.getByRole('tab', { name: /Terrasse/ }).click()
  await page.getByRole('button', { name: 'Ajouter des tables' }).click()
  const lot = page.getByRole('dialog', { name: 'Ajouter des tables à « Terrasse »' })
  await lot.getByLabel(/^Nombre/).fill('8')
  await expect(lot.getByRole('status')).toContainText('T1, T2, T3, T4, T5, T6, T7, T8')
  await capturer(page, '26-tables-en-lot')
  await lot.getByRole('button', { name: 'Ajouter 8 tables' }).click()
  const grille = page.getByRole('list', { name: 'Tables de Terrasse' })
  await expect(grille.getByRole('listitem')).toHaveCount(8)

  await page.getByRole('button', { name: 'Plus d’actions pour T7' }).click()
  await page.getByRole('menuitem', { name: 'Modifier' }).click()
  const modification = page.getByRole('dialog', { name: 'Modifier T7' })
  await modification.getByLabel(/^Places/).fill('8')
  await modification.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(grille.getByRole('listitem', { name: 'T7' })).toContainText('8 places')
  await expect(onglets.getByRole('tab').first()).toContainText('Terrasse')
  await capturer(page, '27-salles-et-tables')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '27-salles-et-tables-telephone')
})

test('Kossi ouvre une note sur T4 depuis une tablette de la terrasse et la remplit', async ({
  page,
  browser,
}) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()
  const navigation = page.getByRole('navigation', { name: 'Navigation principale' })

  // Un plat à vendre, à côté de la bière déclarée épuisée par la gérante.
  await navigation.getByRole('link', { name: 'Produits' }).click()
  await page.getByRole('link', { name: 'Ajouter un produit' }).click()
  await page.getByLabel(/^Nom/).fill('Poulet braisé')
  await page.getByLabel(/^Catégorie/).selectOption({ label: 'Grillades' })
  await page.getByRole('radio', { name: 'Plat' }).check({ force: true })
  await page.getByLabel(/^Prix TTC/).fill('4500')
  await page.getByRole('button', { name: 'Enregistrer le produit' }).click()
  await expect(page.getByText('« Poulet braisé » est enregistré.')).toBeVisible()

  await navigation.getByRole('link', { name: 'Tablettes' }).click()
  await page.getByRole('button', { name: 'Enregistrer une tablette' }).click()
  const formulaire = page.getByRole('form', { name: 'Enregistrer une tablette' })
  await formulaire.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await formulaire.getByLabel(/^Nom de la caisse/).fill('Caisse 2, terrasse')
  await formulaire.getByRole('button', { name: 'Générer le code' }).click()
  const code = (
    (await page
      .getByRole('region', { name: 'Code d’enregistrement' })
      .locator('[data-code]')
      .textContent()) ?? ''
  ).replace(/\D/g, '')

  const contexteTablette = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const tablette = await contexteTablette.newPage()
  await tablette.goto('/caisse')
  await taperCode(tablette, code)

  // La gérante choisit son code sur cette tablette : il lui servira à valider une annulation.
  await tablette.getByRole('button', { name: /Afi M\./ }).click()
  await taperCode(tablette, pinTemporaireAfi)
  await tablette.getByRole('button', { name: 'Ouvrir la caisse' }).click()
  await taperCode(tablette, '6194')
  await tablette.getByRole('button', { name: 'Continuer' }).click()
  await taperCode(tablette, '6194')
  await tablette.getByRole('button', { name: 'Enregistrer mon code' }).click()
  await tablette.getByRole('banner').getByRole('button', { name: 'Changer d’utilisateur' }).click()

  await tablette.getByRole('button', { name: /Kossi A\./ }).click()
  await taperCode(tablette, '4827')
  await tablette.getByRole('button', { name: 'Ouvrir la caisse' }).click()

  // Le plan de salle : la terrasse d'abord, toutes ses tables libres.
  const tables = tablette.getByRole('list', { name: 'Tables' })
  await expect(tables.getByRole('button', { name: /libre/ })).toHaveCount(8)
  await tables.getByRole('button', { name: 'T4, libre' }).click()
  const ouverture = tablette.getByRole('dialog', { name: 'Ouvrir une note sur T4' })
  await ouverture.getByRole('button', { name: 'Un couvert de plus' }).click()
  await capturer(tablette, '28-ouvrir-une-note')
  await ouverture.getByRole('button', { name: 'Ouvrir la note' }).click()

  const note = tablette.getByRole('region', { name: 'Note en cours' })
  await expect(note.getByRole('heading', { name: /T4/ })).toContainText('Terrasse')
  await expect(note).toContainText('n°1, 3 couverts')
  const produits = tablette.getByRole('list', { name: 'Produits' })
  await expect(produits.getByRole('button', { name: /Flag 65 cl/ })).toBeDisabled()
  await produits.getByRole('button', { name: /Poulet braisé/ }).click()
  await expect(note).toContainText('4 500')
  await produits.getByRole('button', { name: /Poulet braisé/ }).click()
  await expect(note).toContainText('9 000 FCFA')

  await note.getByRole('button', { name: 'Actions sur Poulet braisé' }).click()
  await tablette
    .getByRole('dialog', { name: 'Poulet braisé' })
    .getByRole('button', { name: /^Consigne pour la préparation/ })
    .click()
  const ligne = tablette.getByRole('dialog', { name: 'Poulet braisé' })
  await ligne.getByLabel(/^Note pour la préparation/).fill('sans piment')
  await ligne.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(note).toContainText('« sans piment »')
  await expect(note).toContainText('2 articles')
  await capturer(tablette, '29-note-en-cours')

  // Tout part en préparation ; un poulet non servi est annulé, validé par le PIN de la gérante.
  await note.getByRole('button', { name: 'Envoyer 2 articles en préparation' }).click()
  await expect(tablette.getByText(/2 articles envoyés en préparation à/)).toBeVisible()
  await note.getByRole('button', { name: 'Actions sur Poulet braisé' }).click()
  await tablette
    .getByRole('dialog', { name: 'Poulet braisé' })
    .getByRole('button', { name: /^Annuler/ })
    .click()
  const annulation = tablette.getByRole('dialog', { name: 'Annuler Poulet braisé ?' })
  await annulation.getByRole('radio', { name: 'Non servie (trop d’attente)' }).check()
  await capturer(tablette, '30-annuler-un-article')
  await annulation.getByRole('button', { name: 'Annuler 1 article' }).click()
  const validation = tablette.getByRole('dialog', { name: 'Annuler 1 Poulet braisé ?' })
  await validation.getByRole('button', { name: /Afi M\./ }).click()
  // Un code erroné est refusé dans le dialogue : la caisse de Kossi reste ouverte.
  await taperCode(tablette, '1357')
  await validation.getByRole('button', { name: 'Valider' }).click()
  await expect(validation).toContainText('Code incorrect')
  await expect(tablette.getByRole('banner')).toContainText('Kossi A.')
  await taperCode(tablette, '6194')
  await capturer(tablette, '31-validation-gerante')
  await validation.getByRole('button', { name: 'Valider' }).click()
  await expect(note).toContainText('Validé par Afi M.')
  await expect(note).toContainText('4 500 FCFA')
  await capturer(tablette, '32-note-apres-annulation')

  // De retour au plan, T4 porte sa note ; une vente au comptoir vide ne laisse pas de trace.
  await note.getByRole('button', { name: 'Plan de salle' }).click()
  await expect(tables.getByRole('button', { name: /T4, note de 4\s500/ })).toContainText('Ma table')
  await tablette.getByRole('button', { name: 'Vente au comptoir' }).click()
  await expect(note.getByRole('heading', { name: /n°2/ })).toContainText('Comptoir')
  await note.getByRole('button', { name: 'Plan de salle' }).click()
  const resume = tablette.getByRole('region', { name: 'Notes ouvertes, toutes salles' })
  await expect(resume).toContainText('Aucune note au comptoir ni à emporter.')
  await expect(resume).toContainText('1 note ouverte')
  await capturer(tablette, '33-plan-de-salle')

  // Le client de T4 demande l'addition, puis la table déménage en T5 : la salle le voit dans « À traiter ».
  await tables.getByRole('button', { name: /T4, note de/ }).click()
  await note.getByRole('button', { name: 'Actions sur la note' }).click()
  await tablette.getByRole('menuitem', { name: 'Addition demandée' }).click()
  await expect(note).toContainText('Addition demandée à')
  await capturer(tablette, '34-addition-demandee')
  await note.getByRole('button', { name: 'Actions sur la note' }).click()
  await tablette.getByRole('menuitem', { name: 'Transférer vers une autre table' }).click()
  const transfert = tablette.getByRole('dialog', { name: 'Transférer la note de T4' })
  await transfert.getByRole('button', { name: /^T5/ }).click()
  await capturer(tablette, '35-transfert')
  await transfert.getByRole('button', { name: 'Transférer vers T5' }).click()
  await expect(note.getByRole('heading', { name: /T5/ })).toBeVisible()
  await note.getByRole('button', { name: 'Plan de salle' }).click()
  const aTraiter = tablette.getByRole('list', { name: 'À traiter' })
  await expect(aTraiter.getByRole('link', { name: /T5, Terrasse/ })).toContainText(
    'Addition demandée',
  )
  await capturer(tablette, '36-plan-a-traiter')

  // Réclamation sur le poulet : Kossi (serveur) accorde 500 F, validés par la gérante.
  await tables.getByRole('button', { name: /T5, note de/ }).click()
  await note.getByRole('button', { name: 'Actions sur Poulet braisé' }).click()
  await tablette
    .getByRole('dialog', { name: 'Poulet braisé' })
    .getByRole('button', { name: /^Faire une remise/ })
    .click()
  const remise = tablette.getByRole('dialog', { name: 'Remise sur Poulet braisé' })
  await remise.getByRole('tab', { name: 'En montant' }).click()
  await remise.getByLabel(/^Montant de la remise/).fill('500')
  await remise.getByRole('radio', { name: 'Réclamation' }).check()
  await capturer(tablette, '37-remise')
  await remise.getByRole('button', { name: /^Appliquer/ }).click()
  const validationRemise = tablette.getByRole('dialog', {
    name: /^Remise de 500\sF sur Poulet braisé/,
  })
  await validationRemise.getByRole('button', { name: /Afi M\./ }).click()
  await taperCode(tablette, '6194')
  await validationRemise.getByRole('button', { name: 'Valider' }).click()
  await expect(note).toContainText('Réclamation, validé par Afi M.')
  await expect(note).toContainText('4 000 FCFA')
  await capturer(tablette, '38-note-remisee')
  await tablette.setViewportSize({ width: 390, height: 844 })
  await note.scrollIntoViewIfNeeded()
  await capturer(tablette, '38-note-remisee-telephone')
  await tablette.setViewportSize({ width: 1280, height: 800 })
  await note.getByRole('button', { name: 'Plan de salle' }).click()

  // Le client part sans consommer : la note entière est annulée, validée par la gérante.
  await tables.getByRole('button', { name: /T5, note de/ }).click()
  await note.getByRole('button', { name: 'Actions sur la note' }).click()
  await tablette.getByRole('menuitem', { name: 'Annuler la note' }).click()
  const annulationNote = tablette.getByRole('dialog', { name: 'Annuler la note de T5 ?' })
  await annulationNote.getByRole('radio', { name: 'Le client est parti' }).check()
  await capturer(tablette, '39-annuler-la-note')
  await annulationNote.getByRole('button', { name: 'Annuler la note' }).click()
  const validationNote = tablette.getByRole('dialog', { name: 'Annuler la note de T5 ?' })
  await validationNote.getByRole('button', { name: /Afi M\./ }).click()
  await taperCode(tablette, '6194')
  await validationNote.getByRole('button', { name: 'Valider' }).click()
  await expect(tables.getByRole('button', { name: 'T5, libre' })).toBeVisible()
  await expect(resume).toContainText('0 note ouverte')

  // Au comptoir, le serveur prend la commande ; la gérante ouvre la caisse et encaisse en deux fois.
  await tablette.getByRole('button', { name: 'Vente au comptoir' }).click()
  await tablette
    .getByRole('list', { name: 'Produits' })
    .getByRole('button', { name: /Poulet braisé/ })
    .click()
  await expect(note).toContainText('4 500 FCFA')
  await expect(note.getByRole('button', { name: /Encaisser/ })).toBeDisabled()
  await expect(note).toContainText('Un caissier encaisse cette note.')
  await tablette.getByRole('banner').getByRole('button', { name: 'Changer d’utilisateur' }).click()
  await tablette.getByRole('button', { name: /Afi M\./ }).click()
  await taperCode(tablette, '6194')
  await tablette.getByRole('button', { name: 'Ouvrir la caisse' }).click()
  // La tablette reprend là où elle était : la note n°3, désormais encaissable.
  await expect(note.getByRole('heading', { name: /n°3/ })).toBeVisible()
  await note.getByRole('button', { name: /Encaisser/ }).click()
  // Première ouverture : la gérante compte le fond, billet par billet.
  await tablette.getByRole('textbox', { name: /^Nombre de billets de 10\s000\sF$/ }).fill('1')
  await tablette.getByRole('button', { name: /^Un de plus : 5\s000\sF$/ }).click()
  await tablette.getByRole('button', { name: /^Un de plus : 2\s000\sF$/ }).click()
  await tablette.getByRole('button', { name: /^Un de plus : 2\s000\sF$/ }).click()
  await tablette.getByRole('textbox', { name: /^Nombre de pièces de 500\sF$/ }).fill('2')
  await expect(tablette.getByRole('status', { name: 'Espèces comptées' })).toContainText('20 000 F')
  await capturer(tablette, '40b-ouverture-comptage')
  await tablette.getByRole('button', { name: /^Ouvrir la caisse avec 20\s000/ }).click()
  const modes = tablette.getByRole('radiogroup', { name: 'Mode de paiement' })
  await modes.getByRole('radio', { name: /Mobile Money/ }).click()
  await tablette.getByRole('radio', { name: /^Flooz/ }).click()
  await tablette.getByLabel(/^Montant payé/).fill('2000')
  await tablette.getByLabel(/^Référence de la transaction/).fill('7F3K29')
  await capturer(tablette, '41-encaisser-mobile-money')
  await tablette.getByRole('button', { name: /^Valider 2\s000\sF en Mobile Money/ }).click()
  const recap = tablette.getByRole('region', { name: 'Note à encaisser' })
  await expect(recap).toContainText('Reste à payer2 500 F')
  await modes.getByRole('radio', { name: /Espèces/ }).click()
  await tablette.getByLabel(/^Espèces reçues/).fill('5000')
  await expect(tablette.getByRole('status', { name: 'Monnaie à rendre' })).toContainText('2 500 F')
  await capturer(tablette, '42-encaisser-especes')
  await tablette.getByRole('button', { name: /^Valider 2\s500\sF en espèces/ }).click()
  await expect(tablette.getByRole('heading', { name: 'n°3 est encaissée' })).toBeVisible()
  // Le reçu est numéroté dès l'encaissement ; on l'imprime, sans ouvrir la boîte d'impression du navigateur.
  await expect(tablette.getByRole('heading', { name: /^Reçu n° / })).toBeVisible()
  await capturer(tablette, '43-note-encaissee')
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '43-note-encaissee-telephone')
  await tablette.setViewportSize({ width: 1280, height: 800 })
  await simulerImpression(tablette)
  await tablette.getByRole('button', { name: 'Imprimer le reçu' }).click()
  await expect.poll(() => impressions(tablette)).toBe(1)
  // Le client veut aussi son reçu sur son téléphone : WhatsApp s'ouvre, message prêt, lien du reçu en ligne.
  const recuN3 = await envoyerParWhatsApp(tablette, '90 11 23 45')
  await capturer(tablette, '44-recu-whatsapp')
  const telephoneClient = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const client = await telephoneClient.newPage()
  await client.goto(recuN3)
  await expect(client.getByRole('heading', { level: 1, name: 'Votre reçu' })).toBeVisible()
  await expect(client.getByRole('article', { name: /^Reçu BE-/ })).toContainText('Poulet braisé')
  await capturer(client, '45-recu-en-ligne')
  await tablette.getByRole('button', { name: 'Retour au plan de salle' }).click()
  await expect(resume).toContainText('0 note ouverte')

  // Payée mais pas encore remise : la commande reste suivie jusqu'à ce qu'on la donne au client.
  const aRemettre = tablette.getByRole('list', { name: 'À remettre' })
  await expect(aRemettre).toContainText('n°3, Comptoir')
  await aRemettre.getByRole('button', { name: 'Remise au client' }).click()
  const remettre = tablette.getByRole('dialog', { name: 'Remettre n°3 au client ?' })
  await expect(remettre).toContainText('1× Poulet braisé')
  await capturer(tablette, '44-remettre-au-client')
  await remettre.getByRole('button', { name: 'Remise au client' }).click()
  await expect(aRemettre).toHaveCount(0)

  // Un service chargé : une table à servir, une commande envoyée pas encore payée, une vente à emporter en cours.
  await tables.getByRole('button', { name: 'T6, libre' }).click()
  await tablette
    .getByRole('dialog', { name: 'Ouvrir une note sur T6' })
    .getByRole('button', { name: 'Ouvrir la note' })
    .click()
  const carte = tablette.getByRole('list', { name: 'Produits' })
  await carte.getByRole('button', { name: /Poulet braisé/ }).click()
  await expect(note).toContainText('4 500 FCFA')
  await note.getByRole('button', { name: /Envoyer 1 article/ }).click()
  await expect(note).toContainText('1 article à servir')
  await capturer(tablette, '45-note-a-servir')
  await note.getByRole('button', { name: 'Plan de salle' }).click()
  await tablette.getByRole('button', { name: 'Vente au comptoir' }).click()
  await carte.getByRole('button', { name: /Poulet braisé/ }).click()
  await note.getByRole('button', { name: /Envoyer 1 article/ }).click()
  await expect(note).toContainText('1 article à servir')
  await note.getByRole('button', { name: 'Plan de salle' }).click()
  await tablette.getByRole('button', { name: 'À emporter' }).click()
  await tablette.getByRole('textbox', { name: /Nom du client/ }).fill('Yao')
  await tablette.getByRole('button', { name: 'Ouvrir la note' }).click()
  await carte.getByRole('button', { name: /Poulet braisé/ }).click()
  await expect(note).toContainText('4 500 FCFA')
  await note.getByRole('button', { name: 'Plan de salle' }).click()
  await expect(tablette.getByRole('list', { name: 'À servir' })).toContainText('T6')
  await expect(tablette.getByRole('list', { name: 'À remettre' })).toContainText(
    'À encaisser 4 500 F',
  )
  await expect(tablette.getByRole('list', { name: 'Comptoir et à emporter' })).toContainText('Yao')
  await capturer(tablette, '46-plan-service-charge')
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '46-plan-service-charge-telephone')
  await tablette.setViewportSize({ width: 820, height: 1180 })
  await capturer(tablette, '46-plan-service-charge-portrait')
  await tablette.setViewportSize({ width: 1280, height: 800 })

  // Addition partagée à T6 : un client paie son poulet, les deux autres se partagent le reste.
  await tables.getByRole('button', { name: /^T6, note de/ }).click()
  await carte.getByRole('button', { name: /Poulet braisé/ }).click()
  await carte.getByRole('button', { name: /Poulet braisé/ }).click()
  await expect(note).toContainText('13 500 FCFA')
  await note.getByRole('button', { name: /Encaisser/ }).click()
  const partage = tablette.getByRole('radiogroup', { name: 'Partager l’addition' })
  await partage.getByRole('radio', { name: /Par articles/ }).click()
  await tablette
    .getByRole('list', { name: 'Articles à payer' })
    .getByRole('button', { name: 'Un Poulet braisé de plus' })
    .first()
    .click()
  await expect(tablette.getByRole('status', { name: 'Sélection' })).toContainText('4 500 F')
  await modes.getByRole('radio', { name: /Carte/ }).click()
  await capturer(tablette, '55-partage-par-articles')
  await tablette.getByRole('button', { name: /^Valider 4\s500\sF en carte/ }).click()
  await expect(recap).toContainText('1× Poulet braisé, carte')
  await partage.getByRole('radio', { name: /Parts égales/ }).click()
  const parts = tablette.getByRole('list', { name: 'Parts' })
  await expect(parts).toContainText('Part 1En cours4 500')
  await expect(parts).toContainText('Part 2À payer4 500')
  await modes.getByRole('radio', { name: /Carte/ }).click()
  await capturer(tablette, '56-partage-parts-egales')
  await tablette.getByRole('button', { name: /^Valider 4\s500\sF en carte/ }).click()
  await expect(recap).toContainText('Part 1, carte')
  await modes.getByRole('radio', { name: /Mobile Money/ }).click()
  await tablette.getByRole('radio', { name: /^Flooz/ }).click()
  await tablette.getByLabel(/^Référence de la transaction/).fill('9KQ2M1')
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '56-partage-parts-egales-telephone')
  await tablette.setViewportSize({ width: 1280, height: 800 })
  await tablette.getByRole('button', { name: /^Valider 4\s500\sF en Mobile Money/ }).click()
  await expect(tablette.getByRole('heading', { name: 'T6 est libre' })).toBeVisible()
  const recuT6 = await envoyerParWhatsApp(tablette, '91 22 33 44')
  await tablette.getByRole('button', { name: 'Retour au plan de salle' }).click()

  // Un poulet de T6 n'était pas bon : la gérante le rembourse, sur la carte qui l'a payé.
  await tablette.getByRole('button', { name: 'Caisse', exact: true }).click()
  await tablette.getByRole('tab', { name: 'Notes encaissées' }).click()
  await tablette
    .getByRole('list', { name: 'Notes encaissées' })
    .getByRole('button', { name: /, T6/ })
    .click()
  await expect(tablette.getByRole('button', { name: 'Rembourser' })).toBeVisible()
  await capturer(tablette, '57-notes-encaissees')
  // Le client revient chercher son reçu : la réimpression est un duplicata, comptée côté serveur.
  await tablette.getByRole('button', { name: 'Réimprimer le reçu' }).click()
  await expect.poll(() => impressions(tablette)).toBe(2)
  await tablette.getByRole('button', { name: 'Rembourser' }).click()
  await tablette
    .getByRole('list', { name: 'Articles à rembourser' })
    .getByRole('button', { name: 'Un Poulet braisé de plus' })
    .first()
    .click()
  await expect(tablette.getByRole('status', { name: 'À rembourser' })).toContainText('4 500 F')
  // La note a été payée en partie par carte : le remboursement s'y fait d'abord, avant les espèces.
  await expect(tablette.getByRole('region', { name: 'Rendre l’argent en' })).toContainText(
    /Carte.*4\s500\sF/,
  )
  await tablette.getByRole('radio', { name: 'Article non conforme' }).click()
  await capturer(tablette, '58-rembourser')
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '58-rembourser-telephone')
  await tablette.setViewportSize({ width: 1280, height: 800 })
  await tablette.getByRole('button', { name: /^Rembourser 4\s500\sF en carte/ }).click()
  // Le remboursement fait, l'avoir numéroté se remet au client avec l'argent.
  const fait = tablette.getByRole('region', { name: 'Remboursement fait' })
  await expect(fait).toContainText(/Avoir BE-AV-\d{6}/)
  await capturer(tablette, '59-avoir')
  await fait.getByRole('button', { name: 'Imprimer l’avoir' }).click()
  await expect.poll(() => impressions(tablette)).toBe(3)
  await fait.getByRole('button', { name: 'Retour aux notes' }).click()
  await expect(tablette.getByRole('region', { name: /, T6$/ })).toContainText(
    '1× Poulet braisé, carte',
  )
  await capturer(tablette, '59-note-remboursee')
  // Le reçu en ligne de T6, rouvert par le client, mentionne le remboursement ; le reçu lui-même ne change pas.
  await client.goto(recuT6)
  await expect(client.getByRole('article', { name: /^Reçu BE-/ })).toContainText(
    /Remboursé le .*, carte \(avoir BE-AV-\d{6}\)−4\s500/,
  )
  await capturer(client, '59-recu-en-ligne-rembourse')
  await telephoneClient.close()
  await tablette.getByRole('tab', { name: 'Situation' }).click()
  await expect(tablette.getByRole('region', { name: 'Ventes de la caisse' })).toContainText(
    'Remboursements−4 500',
  )

  // Le stock suit la vente : le Flag, de nouveau en vente, sort à l'envoi et revient s'il n'est pas servi.
  await tablette.getByRole('button', { name: 'Plan de salle' }).click()
  await navigation.getByRole('link', { name: 'Par établissement' }).click()
  await page.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await page.getByRole('button', { name: 'Remettre Flag 65 cl en vente' }).click()
  await expect(page.getByText('« Flag 65 cl » est de nouveau en vente.')).toBeVisible()
  await tablette.getByRole('button', { name: 'Vente au comptoir' }).click()
  const flag = carte.getByRole('button', { name: /Flag 65 cl/ })
  await expect(flag).toContainText('33 restants')
  await capturer(tablette, '67-tuile-stock-faible')
  await flag.click()
  await flag.click()
  await note.getByRole('button', { name: /Envoyer 2 articles/ }).click()
  // Tant que l'envoi n'est pas fini, la ligne est encore un brouillon : son menu ne propose pas « Annuler ».
  await expect(note.getByRole('button', { name: /Envoyer \d+ article/ })).toHaveCount(0)
  await tablette.getByRole('button', { name: 'Actions sur Flag 65 cl' }).click()
  await tablette
    .getByRole('dialog', { name: 'Flag 65 cl' })
    .getByRole('button', { name: /^Annuler/ })
    .click()
  const annulationFlag = tablette.getByRole('dialog', { name: 'Annuler Flag 65 cl ?' })
  await annulationFlag.getByRole('radio', { name: 'Non servie (trop d’attente)' }).click()
  await expect(
    annulationFlag.getByRole('radiogroup', { name: 'L’article' }).getByRole('radio', {
      name: /Revient en stock/,
    }),
  ).toHaveAttribute('aria-checked', 'true')
  await capturer(tablette, '68-annulation-retour-stock')
  await annulationFlag.getByRole('button', { name: 'Annuler 1 article' }).click()
  await expect(annulationFlag).toHaveCount(0)
  await note.getByRole('button', { name: 'Plan de salle' }).click()
  await tablette.getByRole('button', { name: 'Caisse', exact: true }).click()

  await navigation.getByRole('link', { name: /Stock/ }).click()
  await page.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await expect(page.getByRole('table', { name: 'Stock de Bè Kpota' })).toBeVisible()
  await page.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }).click()
  await page.getByRole('menuitem', { name: 'Historique' }).click()
  const historiqueFlag = page.getByRole('dialog', { name: 'Historique de Flag 65 cl' })
  await expect(historiqueFlag.getByRole('listitem').first()).toContainText('Retour')
  await expect(historiqueFlag.getByRole('listitem').nth(1)).toContainText('Vente')
  await expect(historiqueFlag).toContainText('32 en stock')
  await capturer(page, '69-historique-vente')
  await historiqueFlag.getByRole('button', { name: 'Fermer' }).click()

  // Ardoise : Tanti ouvre un compte à un habitué ; au comptoir, sa bière dépasse le plafond, la gérante confirme.
  await navigation.getByRole('link', { name: 'Ardoises' }).click()
  await page.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await page.getByRole('button', { name: 'Nouveau client' }).click()
  const nouveauClient = page.getByRole('dialog', { name: 'Nouveau client' })
  await nouveauClient.getByLabel(/^Nom/).fill('Komlan D.')
  // Sans indicatif : le numéro se lit au Togo, le pays de l'entreprise.
  await nouveauClient.getByLabel(/^Téléphone/).fill('90 12 34 56')
  await nouveauClient.getByLabel(/^Plafond/).fill('1000')
  await nouveauClient.getByLabel(/^Note interne/).fill('Paie chaque fin de mois.')
  await capturer(page, '70-ardoise-nouveau-client')
  await nouveauClient.getByRole('button', { name: 'Ouvrir l’ardoise' }).click()
  await expect(page.getByText('Ardoise ouverte pour Komlan D.')).toBeVisible()

  await tablette.getByRole('button', { name: 'Plan de salle' }).click()
  await tablette.getByRole('button', { name: 'Vente au comptoir' }).click()
  await carte.getByRole('button', { name: /Flag 65 cl/ }).click()
  await note.getByRole('button', { name: /Encaisser/ }).click()
  await modes.getByRole('radio', { name: /Ardoise/ }).click()
  await tablette
    .getByRole('radiogroup', { name: 'Client' })
    .getByRole('radio', { name: /Komlan D\./ })
    .click()
  await expect(tablette.getByRole('alert')).toContainText('Plafond dépassé de 200 F')
  await capturer(tablette, '71-encaisser-ardoise')
  await tablette
    .getByRole('button', { name: /^Dépasser le plafond : 1\s200\sF sur l’ardoise de Komlan D\./ })
    .click()
  await expect(tablette.getByRole('heading', { name: /est encaissée/ })).toBeVisible()
  await tablette.getByRole('button', { name: 'Sans reçu' }).click()

  await page.getByRole('button', { name: /Tous les clients/ }).click()
  await page.getByRole('link', { name: 'Komlan D.' }).click()
  const ficheKomlan = page.getByRole('region', { name: 'Ce que doit Komlan D.' })
  await expect(ficheKomlan).toContainText('1 200 F')
  await expect(page.getByText('+22890123456, Bè Kpota')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Mouvements de l’ardoise' })).toContainText(
    'Vente à crédit',
  )
  await capturer(page, '72-fiche-client')
  await page.getByRole('link', { name: 'Ardoises' }).last().click()
  await expect(page.getByRole('region', { name: 'Résumé des ardoises' })).toContainText('1 200 F')
  await capturer(page, '73-ardoises')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '73-ardoises-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })

  // Komlan revient régler son ardoise : la gérante encaisse en espèces, depuis la caisse de la tablette.
  await tablette.getByRole('button', { name: 'Caisse', exact: true }).click()
  await tablette.getByRole('tab', { name: 'Ardoises' }).click()
  await tablette
    .getByRole('list', { name: 'Clients qui doivent' })
    .getByRole('button', { name: /Komlan D\./ })
    .click()
  const reglement = tablette.getByRole('region', { name: 'Règlement de Komlan D.' })
  await reglement.getByRole('button', { name: /^Tout : 1\s200/ }).click()
  await reglement.getByLabel(/^Espèces reçues/).fill('2000')
  await expect(reglement).toContainText('Monnaie à rendre : 800 F')
  await capturer(tablette, '74-reglement-ardoise')
  await reglement.getByRole('button', { name: /^Encaisser 1\s200\sF en espèces/ }).click()
  await expect(
    tablette.getByText('Règlement de 1 200 F encaissé. L’ardoise de Komlan D. est soldée.'),
  ).toBeVisible()
  await tablette.getByRole('tab', { name: 'Situation' }).click()
  await expect(tablette.getByRole('region', { name: 'Règlements d’ardoise' })).toContainText(
    'dont espèces1 200',
  )
  await tablette.getByRole('button', { name: 'Plan de salle' }).click()

  // Kossi prend la tablette laissée sur l'écran de la caisse : il arrive sur le plan, pas sur une erreur.
  await tablette.getByRole('banner').getByRole('button', { name: 'Changer d’utilisateur' }).click()
  await tablette.getByRole('button', { name: /Kossi A\./ }).click()
  await taperCode(tablette, '4827')
  await tablette.getByRole('button', { name: 'Ouvrir la caisse' }).click()
  await expect(tables).toBeVisible()
  await tablette.getByRole('banner').getByRole('button', { name: 'Changer d’utilisateur' }).click()
  await tablette.getByRole('button', { name: /Afi M\./ }).click()
  await taperCode(tablette, '6194')
  await tablette.getByRole('button', { name: 'Ouvrir la caisse' }).click()
  await expect(tables).toBeVisible()

  // Fin de service : la gérante sort 10 000 F vers le coffre, puis clôture en comptant à l'aveugle.
  await tablette.getByRole('button', { name: 'Caisse', exact: true }).click()
  const ventes = tablette.getByRole('region', { name: 'Ventes de la caisse' })
  await expect(ventes).toContainText('3 notes encaissées')
  await expect(ventes).toContainText('Ardoise1 200')
  await expect(ventes).toContainText('Ventes nettes14 700 F')
  const especes = tablette.getByRole('region', { name: 'Espèces dans le tiroir' })
  await expect(especes).toContainText('Attendu23 700 F')
  await tablette.getByRole('button', { name: /Mouvement de caisse/ }).click()
  const mouvement = tablette.getByRole('dialog', { name: 'Mouvement de caisse' })
  await mouvement.getByRole('radio', { name: /Retrait/ }).click()
  await mouvement.getByRole('textbox', { name: /^Montant/ }).fill('10000')
  await mouvement.getByRole('textbox', { name: /^Motif/ }).fill('Vers le coffre')
  await capturer(tablette, '47-mouvement-de-caisse')
  await mouvement.getByRole('button', { name: /^Sortir 10\s000\sF du tiroir/ }).click()
  await expect(ventes).toContainText('RetraitVers le coffre')
  await expect(especes).toContainText('Attendu13 700 F')
  await capturer(tablette, '48-caisse-de-la-tablette')
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '48-caisse-de-la-tablette-telephone')
  await tablette.setViewportSize({ width: 1280, height: 800 })

  await tablette.getByRole('button', { name: 'Clôturer la caisse' }).click()
  await expect(tablette.getByText(/Attendu/)).toHaveCount(0)
  await tablette.getByRole('textbox', { name: /^Nombre de billets de 10\s000\sF$/ }).fill('1')
  await tablette.getByRole('button', { name: /^Un de plus : 2\s000\sF$/ }).click()
  await tablette.getByRole('button', { name: /^Un de plus : 1\s000\sF$/ }).click()
  await tablette.getByRole('button', { name: /^Un de plus : 200\sF$/ }).click()
  await expect(tablette.getByRole('status', { name: 'Espèces comptées' })).toContainText('13 200 F')
  await capturer(tablette, '49-cloture-comptage')
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '49-cloture-comptage-telephone')
  await tablette.setViewportSize({ width: 1280, height: 800 })
  await tablette.getByRole('button', { name: 'Valider le comptage' }).click()
  const ecart = tablette.getByRole('region', { name: 'Écart' })
  await expect(ecart).toContainText('Manque−500 F')
  await expect(tablette.getByRole('button', { name: 'Clôturer la caisse' })).toBeDisabled()
  await tablette
    .getByRole('textbox', { name: /^Explication de l’écart/ })
    .fill('Monnaie rendue en trop')
  await expect(tablette.getByRole('button', { name: 'Clôturer la caisse' })).toBeEnabled()
  await capturer(tablette, '50-cloture-ecart')
  await tablette.getByRole('button', { name: 'Clôturer la caisse' }).click()
  const z = tablette.getByRole('region', { name: 'Rapport Z n°1' })
  await expect(z).toContainText('Écart−500')
  await expect(z).toContainText('Retraits−10 000')
  await expect(z).toContainText('Remboursements−4 500')
  await expect(z).toContainText('dont carte4 500')
  await expect(z).toContainText('dont ardoise1 200')
  await expect(z).toContainText('Règlements d’ardoise1 200')
  await expect(z).toContainText('Ventes nettes14 700')
  await capturer(tablette, '51-rapport-z')
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '51-rapport-z-telephone')
  await tablette.setViewportSize({ width: 1280, height: 800 })
  await z.getByRole('button', { name: 'Terminer' }).click()

  // Caisse fermée : la réouverture propose le fond laissé à la clôture.
  await tablette.getByRole('button', { name: 'Caisse', exact: true }).click()
  // Réouverture : on recompte à l'aveugle, puis on compare au fond laissé à la clôture.
  await expect(tablette.getByText(/20\s000/)).toHaveCount(0)
  await tablette.getByRole('textbox', { name: /^Nombre de billets de 10\s000\sF$/ }).fill('1')
  await tablette.getByRole('button', { name: /^Un de plus : 5\s000\sF$/ }).click()
  await capturer(tablette, '52-reouverture-comptage')
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '52-reouverture-comptage-telephone')
  await tablette.setViewportSize({ width: 1280, height: 800 })
  await tablette.getByRole('button', { name: 'Valider le comptage' }).click()
  const controle = tablette.getByRole('region', { name: 'Contrôle du fond' })
  await expect(controle).toContainText('Laissé à la clôture20 000 F')
  await expect(controle).toContainText('Manque−5 000 F')
  await tablette
    .getByRole('textbox', { name: /^Explication de l’écart/ })
    .fill('Monnaie prêtée au bar')
  await expect(
    tablette.getByRole('button', { name: /^Ouvrir la caisse avec 15\s000/ }),
  ).toBeEnabled()
  await capturer(tablette, '53-reouverture-ecart')
  await tablette.getByRole('button', { name: /^Ouvrir la caisse avec 15\s000/ }).click()
  await expect(tablette.getByRole('region', { name: 'Ventes de la caisse' })).toContainText(
    '0 note encaissée',
  )
  await tablette.getByRole('button', { name: 'Plan de salle' }).click()

  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '33-plan-de-salle-telephone')
  await contexteTablette.close()

  // Le propriétaire retrouve l'annulation, son motif et qui l'a validée.
  await navigation.getByRole('link', { name: 'Activité' }).click()
  const activite = page.getByRole('region', { name: 'Activité' })
  await expect(activite).toContainText('Kossi A. a annulé Poulet braisé à Bè Kpota')
  await expect(activite).toContainText('Motif : Non servie (trop d’attente). Validé par Afi M.')
  await expect(activite).toContainText('Kossi A. a annulé la note T5 à Bè Kpota')
  await expect(activite).toContainText('Motif : Le client est parti. Validé par Afi M.')
  await expect(activite).toContainText('Kossi A. a accordé une remise sur Poulet braisé à Bè Kpota')
  await expect(activite).toContainText('Motif : Réclamation. Validé par Afi M.')
  await expect(activite).toContainText('Afi M. a retiré des espèces de la caisse à Bè Kpota')
  await expect(activite).toContainText(
    'Afi M. a clôturé la caisse avec un écart à Bè Kpota (Z n°1)',
  )
  await expect(activite).toContainText(': Monnaie rendue en trop')
  await expect(activite).toContainText('Afi M. a ouvert la caisse avec un écart à Bè Kpota')
  await expect(activite).toContainText('écart −5 000 F : Monnaie prêtée au bar')
  await expect(activite).toContainText(/Afi M\. a remboursé la note n°\d+ à Bè Kpota/)
  await expect(activite).toContainText('en carte, T6')
  await expect(activite).toContainText(
    'Afi M. a dépassé le plafond de l’ardoise de Komlan D. à Bè Kpota',
  )
  await capturer(page, '40-activite-caisse')

  // Le soir, Tanti regarde ses ventes de la semaine, puis ses caisses : l'écart du Z n°1 ressort tout de suite.
  await navigation.getByRole('link', { name: 'Ventes' }).click()
  const indicateurs = page.getByRole('list', { name: 'Indicateurs' })
  await expect(indicateurs).toContainText('Chiffre d’affaires')
  // Le Flag a été reçu à 650 : ses ventes ont un coût figé, la marge brute apparaît.
  await expect(indicateurs).toContainText('Marge brute')
  await expect(page.getByRole('list', { name: 'Chiffre d’affaires par jour' })).toBeVisible()
  const vigilance = page.getByRole('region', { name: 'À surveiller' })
  // Les écarts de caisse se suivent au tableau de bord et dans Caisses, plus dans les ventes.
  await expect(vigilance).not.toContainText('Écarts de caisse')
  await expect(vigilance).toContainText(/Remboursements : −/)
  await expect(vigilance).toContainText(/vendus sur l’ardoise/)
  await expect(page.getByRole('table', { name: 'Par produit' })).toContainText('Poulet braisé')
  await capturer(page, '80-ventes')
  await page.getByRole('button', { name: 'Par heure' }).click()
  await expect(page.getByRole('list', { name: 'Chiffre d’affaires par heure' })).toBeVisible()
  await page.getByRole('button', { name: 'Catégories' }).click()
  await capturer(page, '80-ventes-heures-categories')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '80-ventes-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })

  await navigation.getByRole('link', { name: 'Caisses', exact: true }).click()
  const listeCaisses = page.getByRole('table', { name: 'Caisses de la période' })
  await expect(listeCaisses.getByRole('row', { name: /Z n°1/ })).toContainText('−500')
  await expect(listeCaisses.getByRole('row', { name: /En cours/ })).toBeVisible()
  await capturer(page, '81-caisses')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '81-caisses-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })
  await listeCaisses.getByRole('row', { name: /Z n°1/ }).getByRole('link').click()
  await expect(page.getByRole('heading', { name: /^Rapport Z n°1, / })).toBeVisible()
  const detailZ = page.getByRole('region', { name: 'Rapport Z' })
  await expect(detailZ).toContainText('Monnaie rendue en trop')
  await expect(page.getByRole('region', { name: 'Mouvements de caisse' })).toContainText('−10 000')
  await expect(page.getByRole('region', { name: 'Remboursements' })).toContainText(
    'Article non conforme',
  )
  await capturer(page, '82-detail-z')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '82-detail-z-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })

  // Le tableau de bord : ce qui est à traiter, et ce qui se passe en ce moment à Bè Kpota.
  await navigation.getByRole('link', { name: 'Tableau de bord' }).click()
  await expect(page.getByRole('region', { name: 'Vendu aujourd’hui' })).toContainText(/F/)
  const maintenant = page.getByRole('region', { name: 'Bè Kpota en ce moment' })
  await expect(maintenant).toContainText('Caisses ouvertes')
  await expect(maintenant).toContainText(/Afi M\., depuis/)
  await expect(page.getByRole('region', { name: 'À traiter' })).toContainText(
    /Écart à la clôture : −500/,
  )
  await capturer(page, '83-tableau-de-bord')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '83-tableau-de-bord-telephone')
})

test('L’équipe plateforme ouvre la fiche de Maquis Chez Tanti, la modifie et la suspend', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await seConnecter(page, ADMIN.identifiant, ADMIN.motDePasse)
  await expect(page).toHaveURL(/\/plateforme$/)

  // La recherche porte aussi sur le propriétaire ; la liste ne montre qu'une date de vente, aucun montant.
  await page.getByRole('searchbox', { name: 'Rechercher' }).fill('Tanti')
  await page.getByRole('searchbox', { name: 'Rechercher' }).press('Enter')
  const ligne = page.getByRole('row', { name: /Maquis Chez Tanti/ })
  await expect(ligne).toContainText('Togo, XOF')
  await expect(ligne).not.toContainText('Aucune vente')
  await capturer(page, '90-plateforme-liste')
  await ligne.getByRole('link', { name: 'Ouvrir la fiche de Maquis Chez Tanti' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Maquis Chez Tanti' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Utilisation' })).toContainText(
    'Notes encaissées, 7 jours',
  )
  await expect(page.getByRole('region', { name: 'Propriétaire' })).toContainText('Tanti')
  await expect(page.getByRole('table', { name: 'Établissements de l’entreprise' })).toContainText(
    'Bè Kpota',
  )
  await capturer(page, '91-plateforme-fiche')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '91-plateforme-fiche-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })

  // Pays et devise sont figés : Maquis Chez Tanti a déjà vendu.
  await page.getByRole('button', { name: 'Modifier' }).click()
  const modification = page.getByRole('dialog', { name: 'Modifier Maquis Chez Tanti' })
  await expect(modification.getByLabel('Devise')).toBeDisabled()
  await modification.getByLabel(/^Numéro fiscal/).fill('1000123456')
  await capturer(page, '92-plateforme-modifier')
  await modification.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('status')).toContainText('Les modifications sont enregistrées.')
  await expect(page.getByRole('region', { name: 'Identité' })).toContainText('1000123456')

  await page.getByRole('button', { name: 'Suspendre' }).click()
  const suspension = page.getByRole('dialog', { name: 'Suspendre Maquis Chez Tanti ?' })
  await suspension.getByLabel(/^Raison/).selectOption({ label: 'Demande du client' })
  await suspension.getByLabel(/^Précision/).fill('Fermeture pour travaux')
  await capturer(page, '93-plateforme-suspendre')
  await suspension.getByRole('button', { name: 'Suspendre l’entreprise' }).click()
  await expect(page.getByRole('region', { name: 'Suspension' })).toContainText(
    'Demande du client : Fermeture pour travaux',
  )
  await capturer(page, '94-plateforme-suspendue')

  // Redonner un mot de passe : la fenêtre demande d'abord de vérifier qui appelle (annulée ici).
  await page
    .getByRole('region', { name: 'Propriétaire' })
    .getByRole('button', { name: 'Redonner un mot de passe temporaire' })
    .click()
  const motDePasse = page.getByRole('dialog', { name: /^Redonner un mot de passe à / })
  await expect(motDePasse).toContainText('rappelez-la au')
  await capturer(page, '95-plateforme-mot-de-passe')
  await motDePasse.getByRole('button', { name: 'Annuler' }).click()

  // Réactivée aussitôt : le parcours peut être rejoué sur la même base.
  await page.getByRole('button', { name: 'Réactiver' }).click()
  await page.getByRole('button', { name: 'Réactiver l’entreprise' }).click()
  await expect(page.getByRole('status')).toContainText('Maquis Chez Tanti est de nouveau active.')

  // L'équipe : un membre ajouté reçoit un mot de passe temporaire, affiché une seule fois.
  await page.setViewportSize({ width: 1280, height: 800 })
  const onglets = page.getByRole('navigation', { name: 'Espace plateforme' })
  await onglets.getByRole('link', { name: 'Équipe' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Équipe plateforme' })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter un membre' }).click()
  const ajout = page.getByRole('dialog', { name: 'Ajouter un membre à l’équipe' })
  await ajout.getByLabel(/^Prénom/).fill('Akossiwa')
  await ajout.getByLabel(/^Nom/).fill('Dogbe')
  await ajout.getByLabel(/^E-mail/).fill(`akossiwa.${String(Date.now())}@tonti.africa`)
  await ajout.getByRole('button', { name: 'Ajouter le membre' }).click()
  const secretMembre = page.getByRole('dialog', {
    name: 'Mot de passe temporaire de Akossiwa Dogbe',
  })
  await expect(secretMembre).toBeVisible()
  await secretMembre.getByRole('button', { name: 'J’ai transmis le mot de passe' }).click()
  await expect(page.getByRole('row', { name: /Akossiwa Dogbe/ })).toContainText(
    'Mot de passe à choisir',
  )
  await capturer(page, '97-plateforme-equipe')

  // L'activité : chaque action de l'équipe, avec son auteur.
  await onglets.getByRole('link', { name: 'Activité' }).click()
  const activite = page.getByRole('table', { name: 'Activité de la plateforme' })
  await expect(activite).toContainText('Membre ajouté')
  await expect(activite).toContainText('Suspension')
  await capturer(page, '98-plateforme-activite')

  // Le support : les erreurs renvoyées pendant le parcours, puis un code introuvable.
  await onglets.getByRole('link', { name: 'Support' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Support' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Erreurs récentes' })).toContainText(
    'Maquis Chez Tanti',
  )
  await capturer(page, '96-plateforme-support')
  await page.getByLabel(/^Code de l’erreur/).fill('deadbeef')
  await page.getByLabel(/^Code de l’erreur/).press('Enter')
  await expect(page.getByRole('heading', { name: 'Aucune erreur avec ce code' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '96-plateforme-support-telephone')
})
