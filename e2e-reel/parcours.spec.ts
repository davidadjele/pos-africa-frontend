import { mkdirSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'

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

/** Captures du manuel (/aide), prises seulement par `npm run manuel:captures`. */
const DOSSIER_MANUEL = process.env.CAPTURES_MANUEL

/**
 * L'écran tel que le voit l'utilisateur (pas la page entière), l'élément à toucher entouré de la couleur du
 * focus. En JPEG : une capture d'écran pèse quatre à cinq fois moins qu'en PNG.
 */
async function capturerManuel(page: Page, fichier: string, cible?: Locator) {
  if (DOSSIER_MANUEL === undefined) return
  // L'anneau de focus du dernier champ saisi se confondrait avec l'élément entouré.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  if (cible !== undefined) {
    await cible.scrollIntoViewIfNeeded()
    // Contour à l'intérieur : un parent qui coupe ce qui dépasse ne le masque pas.
    await cible.evaluate((element: HTMLElement) => {
      element.style.outline = '3px solid #ED4F28'
      element.style.outlineOffset = '-3px'
    })
  }
  await page.screenshot({
    path: `${DOSSIER_MANUEL}/${fichier}.jpg`,
    type: 'jpeg',
    quality: 80,
    animations: 'disabled',
  })
  if (cible !== undefined) {
    await cible.evaluate((element: HTMLElement) => {
      element.style.outline = ''
      element.style.outlineOffset = ''
    })
  }
}

/** Les tablettes du terrain, avec la hauteur laissée par la barre du navigateur (environ 88 px). */
const FORMATS_TABLETTE = [
  { nom: '10-paysage', width: 1280, height: 712 },
  { nom: '10-portrait', width: 800, height: 1192 },
  { nom: '7-paysage', width: 1024, height: 552 },
  { nom: '7-portrait', width: 600, height: 976 },
  { nom: 'ipad-paysage', width: 1180, height: 770 },
]

/**
 * Ce qui déborde dans la page : défilement horizontal, contrôle hors de l'écran sans défilement pour l'atteindre,
 * contenu coupé par un conteneur qui ne défile pas.
 */
async function debordements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problemes: string[] = []
    const racine = document.documentElement
    if (racine.scrollWidth > racine.clientWidth + 1) {
      problemes.push(
        `défilement horizontal de ${String(racine.scrollWidth - racine.clientWidth)} px`,
      )
    }
    const decrire = (element: Element) => {
      const nom = element.getAttribute('aria-label') ?? element.textContent.trim().slice(0, 40)
      return `${element.tagName.toLowerCase()} « ${nom} »`
    }
    const defile = (element: Element, axe: 'x' | 'y') => {
      const style = getComputedStyle(element)
      const debord = axe === 'x' ? style.overflowX : style.overflowY
      const plus =
        axe === 'x'
          ? element.scrollWidth > element.clientWidth + 1
          : element.scrollHeight > element.clientHeight + 1
      return (debord === 'auto' || debord === 'scroll') && plus
    }
    const pageDefile = racine.scrollHeight > window.innerHeight + 1
    for (const controle of document.querySelectorAll('button, a[href], input, select, textarea')) {
      const rect = controle.getBoundingClientRect()
      if (
        rect.width === 0 ||
        rect.height === 0 ||
        getComputedStyle(controle).visibility === 'hidden'
      ) {
        continue
      }
      const horsEcranX = rect.right > window.innerWidth + 1 || rect.left < -1
      const horsEcranY = rect.bottom > window.innerHeight + 1
      if (!horsEcranX && !horsEcranY) continue
      let ancetre = controle.parentElement
      let atteignable = horsEcranY && pageDefile && !horsEcranX
      while (ancetre && !atteignable) {
        if ((horsEcranX && defile(ancetre, 'x')) || (horsEcranY && defile(ancetre, 'y')))
          atteignable = true
        ancetre = ancetre.parentElement
      }
      if (!atteignable) problemes.push(`${decrire(controle)} hors de l’écran, inatteignable`)
    }
    // Un texte plus large que son bouton déborde de la tuile, même si rien ne le coupe.
    for (const controle of document.querySelectorAll('button, [role="radio"], [role="tab"]')) {
      if (controle.clientWidth > 0 && controle.scrollWidth > controle.clientWidth + 1) {
        problemes.push(
          `${decrire(controle)} : texte plus large que le bouton de ${String(controle.scrollWidth - controle.clientWidth)} px`,
        )
      }
    }
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element)
      const coupeX =
        (style.overflowX === 'hidden' || style.overflowX === 'clip') &&
        element.scrollWidth > element.clientWidth + 2 &&
        style.textOverflow !== 'ellipsis'
      if (coupeX && element.clientWidth > 0 && element.querySelector('button, input, a[href]')) {
        problemes.push(
          `${decrire(element)} coupé à droite de ${String(element.scrollWidth - element.clientWidth)} px`,
        )
      }
    }
    return [...new Set(problemes)]
  })
}

/** Rejoue l'écran courant dans chaque format de tablette ; chaque débordement est une erreur, capture à l'appui. */
async function verifierFormatsTablette(page: Page, ecran: string, principale?: Locator) {
  const initial = page.viewportSize() ?? { width: 1280, height: 800 }
  for (const format of FORMATS_TABLETTE) {
    await page.setViewportSize({ width: format.width, height: format.height })
    // Le temps d'un rendu : les mises en page changent de colonnes à certaines largeurs.
    await page.waitForTimeout(150)
    await page.screenshot({
      path: `${DOSSIER_CAPTURES}/formats/${ecran}-${format.nom}.png`,
      animations: 'disabled',
    })
    const problemes = await debordements(page)
    // En caisse, l'action principale reste à l'écran : on ne fait pas défiler pour encaisser.
    if (principale !== undefined) {
      const boite = await principale.filter({ visible: true }).first().boundingBox()
      if (
        boite === null ||
        boite.y < 0 ||
        boite.x < 0 ||
        boite.y + boite.height > format.height + 1 ||
        boite.x + boite.width > format.width + 1
      ) {
        problemes.push('action principale hors de l’écran sans défiler')
      }
    }
    // FORMATS_RAPPORT=1 relève tout sans arrêter le parcours : utile pour faire l'inventaire avant de corriger.
    if (process.env.FORMATS_RAPPORT === undefined) {
      expect.soft(problemes, `${ecran}, tablette ${format.nom}`).toEqual([])
    } else if (problemes.length > 0) {
      console.log(`FORMAT ${ecran} ${format.nom} : ${problemes.join(' ; ')}`)
    }
  }
  await page.setViewportSize(initial)
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

/** L'administrateur arrive sur le tableau de bord ; la liste des entreprises est l'onglet suivant. */
async function ouvrirEntreprisesPlateforme(page: Page) {
  await expect(page).toHaveURL(/\/plateforme\/tableau-de-bord$/)
  await page
    .getByRole('navigation', { name: 'Espace plateforme' })
    .getByRole('link', { name: 'Entreprises' })
    .click()
  await expect(page).toHaveURL(/\/plateforme$/)
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
  await ouvrirEntreprisesPlateforme(page)
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
  await allerA(page, 'Réglages', 'Établissements')
  const tableau = page.getByRole('table', { name: 'Établissements de l’entreprise' })
  await expect(tableau).toContainText('Bè Kpota')

  await page.getByRole('button', { name: 'Ajouter un établissement' }).click()
  const formulaire = page.getByRole('form', { name: 'Nouvel établissement' })
  await formulaire.getByLabel(/^Code/).fill('ag')
  await formulaire.getByLabel(/^Nom/).fill('Agbalépédo')
  await formulaire.getByLabel(/^Ville/).fill('Lomé')
  await capturer(page, '05-etablissements-formulaire')
  await capturerManuel(
    page,
    'premier-jour/etablissement',
    page.getByRole('button', { name: 'Créer l’établissement' }),
  )
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
  await ouvrirEntreprisesPlateforme(page)
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
  await allerA(page, 'Réglages', 'Établissements')
  const tableau = page.getByRole('table', { name: 'Établissements de l’entreprise' })
  await expect(tableau).toContainText('Tokoin')
  await expect(tableau).not.toContainText('Bè Kpota')
  await capturer(page, '06-gestion-autre-entreprise')
})

test('Tanti ajoute son personnel, et la gérante ne voit que le sien', async ({ page }) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()
  await expect(page).toHaveURL(/\/gestion$/)
  await allerA(page, 'Réglages', 'Personnel')
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
  await capturerManuel(
    page,
    'premier-jour/employe',
    page.getByRole('button', { name: 'Enregistrer l’employé' }),
  )
  await page.getByRole('button', { name: 'Enregistrer l’employé' }).click()
  await expect(page.getByRole('dialog')).toContainText('Mot de passe temporaire du back-office')
  await capturer(page, '08-personnel-codes')
  await capturerManuel(
    page,
    'personnel/codes',
    page.getByRole('dialog').getByRole('button', { name: 'J’ai noté les codes' }),
  )
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
  await capturerManuel(
    page,
    'personnel/actions',
    page.getByRole('menuitem', { name: 'Réinitialiser le PIN' }),
  )
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
  await capturerManuel(
    page,
    'personnel/mot-de-passe',
    page.getByRole('button', { name: 'Enregistrer et me reconnecter' }),
  )
  await remplacerMotDePasse(page, AFI.telephone, motDePasseAfi, AFI.motDePasse)
  await expect(page).toHaveURL(/\/gestion$/)
  await allerA(page, 'Réglages', 'Personnel')
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
  await capturerManuel(
    page,
    'personnel/vue-gerante',
    page.getByRole('menuitem', { name: 'Réinitialiser le PIN' }),
  )
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
  await allerA(page, 'Réglages', 'Tablettes')
  await page.getByRole('button', { name: 'Enregistrer une tablette' }).click()
  const formulaire = page.getByRole('form', { name: 'Enregistrer une tablette' })
  await formulaire.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await formulaire.getByLabel(/^Nom de la caisse/).fill('Caisse 1, bar')
  await formulaire.getByRole('button', { name: 'Générer le code' }).click()
  const panneau = page.getByRole('region', { name: 'Code d’enregistrement' })
  const code = ((await panneau.locator('[data-code]').textContent()) ?? '').replace(/\D/g, '')
  expect(code).toMatch(/^\d{6}$/)
  await capturer(page, '12-tablettes-code')
  await capturerManuel(page, 'premier-jour/tablette', panneau.locator('[data-code]'))

  // Une autre fenêtre joue la tablette : aucune session, seulement le code.
  const contexteTablette = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const tablette = await contexteTablette.newPage()
  await tablette.goto('/caisse')
  await expect(tablette).toHaveURL(/\/enregistrement-tablette$/)
  await capturer(tablette, '13-tablette-enregistrement')
  await capturerManuel(tablette, 'tablettes/saisie-code')
  await taperCode(tablette, code)
  await expect(tablette).toHaveURL(/\/caisse$/)
  await expect(tablette.getByRole('banner')).toContainText('Bè Kpota, Caisse 1, bar')
  await expect(
    tablette.getByRole('heading', { level: 1, name: 'Qui prend la caisse ?' }),
  ).toBeVisible()
  await capturer(tablette, '14-tablette-qui-prend-la-caisse')
  await capturerManuel(
    tablette,
    'premier-jour/qui-prend-la-caisse',
    tablette.getByRole('button', { name: /Kossi A\./ }),
  )

  // Kossi tape le PIN temporaire donné par Tanti, puis choisit le sien, tapé deux fois.
  await tablette.getByRole('button', { name: /Kossi A\./ }).click()
  await taperCode(tablette, pinTemporaireKossi)
  await capturer(tablette, '14-tablette-pin')
  await capturerManuel(
    tablette,
    'ouvrir-sa-caisse/pin',
    tablette.getByRole('button', { name: 'Ouvrir la caisse' }),
  )
  await tablette.getByRole('button', { name: 'Ouvrir la caisse' }).click()
  await expect(
    tablette.getByRole('heading', { level: 1, name: 'Choisissez votre code personnel' }),
  ).toBeVisible()
  await taperCode(tablette, '4827')
  await tablette.getByRole('button', { name: 'Continuer' }).click()
  await taperCode(tablette, '4827')
  await capturer(tablette, '14-tablette-nouveau-pin')
  await capturerManuel(
    tablette,
    'ouvrir-sa-caisse/nouveau-code',
    tablette.getByRole('button', { name: 'Enregistrer mon code' }),
  )
  await tablette.getByRole('button', { name: 'Enregistrer mon code' }).click()
  const barreTablette = tablette.getByRole('banner')
  await expect(barreTablette).toContainText('Kossi A.')
  await capturer(tablette, '14-tablette-caisse-ouverte')
  await capturerManuel(
    tablette,
    'ouvrir-sa-caisse/caisse-ouverte',
    barreTablette.getByRole('button', { name: 'Changer d’utilisateur' }),
  )

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
  await capturerManuel(
    page,
    'tablettes/liste',
    page.getByRole('button', { name: 'Plus d’actions pour Caisse 1, bar' }),
  )
  // La révocation se confirme : la tablette est gardée, la suite du parcours s'en sert.
  await page.getByRole('button', { name: 'Plus d’actions pour Caisse 1, bar' }).click()
  await page.getByRole('menuitem', { name: 'Révoquer' }).click()
  const revocation = page.getByRole('dialog', { name: 'Révoquer « Caisse 1, bar » ?' })
  await capturerManuel(
    page,
    'tablettes/revoquer',
    revocation.getByRole('button', { name: 'Révoquer la tablette' }),
  )
  await revocation.getByRole('button', { name: 'Garder la tablette' }).click()
  await expect(revocation).toHaveCount(0)

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

  // La TVA saisie à la création de l'entreprise est là.
  await allerA(page, 'Carte', 'Taxes')
  const taxes = page.getByRole('table', { name: 'Taxes de l’entreprise' })
  await expect(taxes.getByRole('row', { name: /TVA/ })).toContainText('18 %')
  await capturer(page, '16-taxes')
  await capturerManuel(page, 'premier-jour/taxes', taxes.getByRole('row', { name: /TVA/ }))

  // Deux catégories, la seconde remontée en tête.
  await allerA(page, 'Carte', 'Produits')
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
    // Les bières sont servies au bar : elles ne passent pas par l'écran cuisine.
    if (nom === 'Bières') {
      await formulaire.getByRole('checkbox', { name: 'Envoyée en cuisine' }).uncheck()
    }
    await formulaire.getByRole('button', { name: 'Ajouter la catégorie' }).click()
    await expect(dialogue.getByRole('list', { name: 'Catégories' })).toContainText(nom)
  }
  await expect(dialogue.getByRole('listitem').filter({ hasText: 'Bières' })).toContainText(
    'Pas en cuisine',
  )
  await dialogue.getByRole('button', { name: 'Monter Bières' }).click()
  await expect(dialogue.getByRole('listitem').first()).toContainText('Bières')
  await capturer(page, '17-categories')
  await capturerManuel(
    page,
    'premier-jour/categories',
    dialogue.getByRole('list', { name: 'Catégories' }),
  )
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
  await capturerManuel(
    page,
    'premier-jour/produit',
    page.getByRole('button', { name: 'Enregistrer le produit' }),
  )
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
  await allerA(page, 'Carte', 'Par établissement')
  await page.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await expect(page.getByRole('heading', { level: 1, name: 'Carte de Bè Kpota' })).toBeVisible()

  await page.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }).click()
  await page.getByRole('menuitem', { name: 'Prix dans cet établissement' }).click()
  const dialogue = page.getByRole('dialog', { name: 'Prix de « Flag 65 cl » à Bè Kpota' })
  await dialogue.getByLabel(/^Prix TTC à Bè Kpota/).fill('1200')
  await capturer(page, '20-prix-etablissement')
  await capturerManuel(
    page,
    'la-carte/prix-etablissement',
    dialogue.getByRole('button', { name: 'Enregistrer le prix' }),
  )
  await dialogue.getByRole('button', { name: 'Enregistrer le prix' }).click()
  const carte = page.getByRole('table', { name: 'Carte de l’établissement' })
  await expect(carte.getByRole('row', { name: /Flag 65 cl/ })).toContainText('Prix propre')
  await capturer(page, '21-carte-etablissement')
  await capturerManuel(
    page,
    'la-carte/carte-etablissement',
    carte.getByRole('row', { name: /Flag 65 cl/ }),
  )
  await capturerManuel(
    page,
    'la-carte/epuise',
    carte.getByRole('button', { name: 'Déclarer Flag 65 cl épuisé ce jour' }),
  )
  await seDeconnecter(page)

  // La gérante, sur son téléphone : seule la rupture lui est proposée.
  await page.setViewportSize({ width: 390, height: 844 })
  await seConnecter(page, AFI.telephone, AFI.motDePasse)
  await allerA(page, 'Carte', 'Par établissement')
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
  await allerA(page, 'Stock')
  const stock = page.getByRole('table', { name: 'Stock de Bè Kpota' })
  await expect(stock.getByRole('row', { name: /Flag 65 cl/ })).toContainText('À compter')
  await capturer(page, '60-stock-a-compter')
  await capturerManuel(page, 'stock/a-compter', stock.getByRole('row', { name: /Flag 65 cl/ }))

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
  await capturerManuel(
    page,
    'stock/reception',
    page.getByRole('button', { name: 'Enregistrer : 1 produit, 24 unités' }),
  )
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
  await capturerManuel(
    page,
    'stock/perte',
    perte.getByRole('button', { name: 'Retirer 2 du stock' }),
  )
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
  await capturerManuel(
    page,
    'stock/inventaire-ecarts',
    ecarts.getByRole('combobox', { name: 'Motif de l’écart : Flag 65 cl' }),
  )
  await page.getByRole('button', { name: 'Valider l’inventaire' }).click()
  await expect(page.getByText('Inventaire enregistré : 1 écart.')).toBeVisible()

  await page.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }).click()
  await page.getByRole('menuitem', { name: 'Historique' }).click()
  const historique = page.getByRole('dialog', { name: 'Historique de Flag 65 cl' })
  await expect(historique.getByRole('listitem')).toHaveCount(4)
  await expect(historique).toContainText('BL 2240')
  await capturer(page, '66-stock-historique')
  await capturerManuel(page, 'stock/historique')
  await historique.getByRole('button', { name: 'Fermer' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '63-stock-telephone')
})

test('Tanti retrouve dans l’activité les changements de la journée et l’historique des prix', async ({
  page,
}) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()
  await allerA(page, 'Activité')

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

  await allerA(page, 'Carte', 'Produits')
  await page.getByRole('button', { name: 'Plus d’actions pour Flag 65 cl' }).click()
  await page.getByRole('menuitem', { name: 'Historique des prix' }).click()
  const historique = page.getByRole('dialog', { name: 'Historique des prix de « Flag 65 cl »' })
  await expect(historique.getByRole('listitem')).toHaveCount(2)
  await expect(historique).toContainText('Bè Kpota')
  await capturer(page, '25-historique-prix')
  await capturerManuel(
    page,
    'la-carte/historique-prix',
    historique.getByRole('list', { name: 'Changements de prix' }),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await historique.getByRole('button', { name: 'Fermer' }).click()
  await allerA(page, 'Activité')
  await expect(activite).toContainText('Flag 65 cl')
  await capturer(page, '24-activite-telephone')
})

test('La gérante crée les salles de Bè Kpota et leurs tables', async ({ page }) => {
  await seConnecter(page, AFI.telephone, AFI.motDePasse)
  await allerA(page, 'Réglages', 'Salles et tables')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Salles et tables de Bè Kpota' }),
  ).toBeVisible()

  for (const nom of ['Terrasse', 'Bar']) {
    await page.getByRole('button', { name: 'Nouvelle salle' }).click()
    const dialogue = page.getByRole('dialog', { name: 'Nouvelle salle' })
    await dialogue.getByLabel(/^Nom/).fill(nom)
    if (nom === 'Terrasse') {
      await capturerManuel(
        page,
        'salles-et-tables/nouvelle-salle',
        dialogue.getByRole('button', { name: 'Créer la salle' }),
      )
    }
    await dialogue.getByRole('button', { name: 'Créer la salle' }).click()
    await expect(page.getByText(`La salle « ${nom} » est créée.`)).toBeVisible()
  }

  const onglets = page.getByRole('tablist', { name: 'Salles' })
  await onglets.getByRole('tab', { name: /Terrasse/ }).click()
  // Le menu d'une salle règle sa place parmi les onglets de la caisse ; refermé sans rien changer.
  await page.getByRole('button', { name: /^Plus d’actions pour la salle Terrasse/ }).click()
  await capturerManuel(
    page,
    'salles-et-tables/ordre',
    page.getByRole('menuitem', { name: 'Descendre' }),
  )
  await page.keyboard.press('Escape')
  await page.getByRole('heading', { level: 1 }).click()
  await expect(page.getByRole('menuitem', { name: 'Descendre' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ajouter des tables' }).click()
  const lot = page.getByRole('dialog', { name: 'Ajouter des tables à « Terrasse »' })
  await lot.getByLabel(/^Nombre/).fill('8')
  await expect(lot.getByRole('status')).toContainText('T1, T2, T3, T4, T5, T6, T7, T8')
  await capturer(page, '26-tables-en-lot')
  await capturerManuel(
    page,
    'premier-jour/tables',
    lot.getByRole('button', { name: 'Ajouter 8 tables' }),
  )
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
  await capturerManuel(page, 'salles-et-tables/plan', grille.getByRole('listitem', { name: 'T7' }))
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '27-salles-et-tables-telephone')
})

test('Kossi ouvre une note sur T4 depuis une tablette de la terrasse et la remplit', async ({
  page,
  browser,
}) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()

  // Un plat à vendre, à côté de la bière déclarée épuisée par la gérante.
  await allerA(page, 'Carte', 'Produits')
  await page.getByRole('link', { name: 'Ajouter un produit' }).click()
  await page.getByLabel(/^Nom/).fill('Poulet braisé')
  await page.getByLabel(/^Catégorie/).selectOption({ label: 'Grillades' })
  await page.getByRole('radio', { name: 'Plat' }).check({ force: true })
  await page.getByLabel(/^Prix TTC/).fill('4500')
  await page.getByRole('button', { name: 'Enregistrer le produit' }).click()
  await expect(page.getByText('« Poulet braisé » est enregistré.')).toBeVisible()

  await allerA(page, 'Réglages', 'Tablettes')
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
  await capturerManuel(
    tablette,
    'prendre-une-commande/ouvrir',
    ouverture.getByRole('button', { name: 'Ouvrir la note' }),
  )
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
  await capturerManuel(
    tablette,
    'prendre-une-commande/ajouter',
    produits.getByRole('button', { name: /Poulet braisé/ }),
  )
  await capturerManuel(
    tablette,
    'prendre-une-commande/envoyer',
    note.getByRole('button', { name: 'Envoyer 2 articles en préparation' }),
  )
  await verifierFormatsTablette(
    tablette,
    'note-en-cours',
    tablette.getByRole('button', { name: /^(Envoyer 2 articles en préparation|Voir la note)/ }),
  )

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
  await capturerManuel(
    tablette,
    'remises-et-annulations/annuler-article',
    annulation.getByRole('button', { name: 'Annuler 1 article' }),
  )
  await annulation.getByRole('button', { name: 'Annuler 1 article' }).click()
  const validation = tablette.getByRole('dialog', { name: 'Annuler 1 Poulet braisé ?' })
  await validation.getByRole('button', { name: /Afi M\./ }).click()
  await capturerManuel(
    tablette,
    'remises-et-annulations/validation-gerante',
    validation.getByRole('button', { name: 'Valider' }),
  )
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
  await verifierFormatsTablette(tablette, 'plan-de-salle')

  // Le client de T4 demande l'addition, puis la table déménage en T5 : la salle le voit dans « À traiter ».
  await tables.getByRole('button', { name: /T4, note de/ }).click()
  await note.getByRole('button', { name: 'Actions sur la note' }).click()
  await tablette.getByRole('menuitem', { name: 'Addition demandée' }).click()
  await expect(note).toContainText('Addition demandée à')
  await capturer(tablette, '34-addition-demandee')
  await capturerManuel(
    tablette,
    'remises-et-annulations/addition-demandee',
    note.getByText(/^Addition demandée à/),
  )
  await note.getByRole('button', { name: 'Actions sur la note' }).click()
  await tablette.getByRole('menuitem', { name: 'Transférer vers une autre table' }).click()
  const transfert = tablette.getByRole('dialog', { name: 'Transférer la note de T4' })
  await transfert.getByRole('button', { name: /^T5/ }).click()
  await capturer(tablette, '35-transfert')
  await capturerManuel(
    tablette,
    'remises-et-annulations/transfert',
    transfert.getByRole('button', { name: 'Transférer vers T5' }),
  )
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
  await capturerManuel(
    tablette,
    'remises-et-annulations/remise',
    remise.getByRole('button', { name: /^Appliquer/ }),
  )
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
  // Sur téléphone, la carte occupe l'écran ; la barre du bas rappelle le total et ouvre la note.
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '38-commande-telephone')
  await tablette.getByRole('button', { name: 'Voir la note' }).click()
  await expect(note).toBeVisible()
  await capturer(tablette, '38-note-remisee-telephone')
  await tablette.getByRole('button', { name: 'Continuer la commande' }).click()
  await tablette.setViewportSize({ width: 1280, height: 800 })
  await note.getByRole('button', { name: 'Plan de salle' }).click()

  // Le client part sans consommer : la note entière est annulée, validée par la gérante.
  await tables.getByRole('button', { name: /T5, note de/ }).click()
  await note.getByRole('button', { name: 'Actions sur la note' }).click()
  await tablette.getByRole('menuitem', { name: 'Annuler la note' }).click()
  const annulationNote = tablette.getByRole('dialog', { name: 'Annuler la note de T5 ?' })
  await annulationNote.getByRole('radio', { name: 'Le client est parti' }).check()
  await capturer(tablette, '39-annuler-la-note')
  await capturerManuel(
    tablette,
    'remises-et-annulations/annuler-la-note',
    annulationNote.getByRole('button', { name: 'Annuler la note' }),
  )
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
  await capturerManuel(tablette, 'encaisser/note', note.getByRole('button', { name: /Encaisser/ }))
  await note.getByRole('button', { name: /Encaisser/ }).click()
  // Première ouverture : la gérante compte le fond, billet par billet.
  await tablette.getByRole('textbox', { name: /^Nombre de billets de 10\s000\sF$/ }).fill('1')
  await tablette.getByRole('button', { name: /^Un de plus : 5\s000\sF$/ }).click()
  await tablette.getByRole('button', { name: /^Un de plus : 2\s000\sF$/ }).click()
  await tablette.getByRole('button', { name: /^Un de plus : 2\s000\sF$/ }).click()
  await tablette.getByRole('textbox', { name: /^Nombre de pièces de 500\sF$/ }).fill('2')
  await expect(tablette.getByRole('status', { name: 'Espèces comptées' })).toContainText('20 000 F')
  await capturer(tablette, '40b-ouverture-comptage')
  await capturerManuel(
    tablette,
    'encaisser/fond-de-caisse',
    tablette.getByRole('button', { name: /^Ouvrir la caisse avec 20\s000/ }),
  )
  await verifierFormatsTablette(
    tablette,
    'ouverture-comptage',
    tablette.getByRole('button', { name: /^Ouvrir la caisse avec/ }),
  )
  await tablette.getByRole('button', { name: /^Ouvrir la caisse avec 20\s000/ }).click()
  const modes = tablette.getByRole('radiogroup', { name: 'Mode de paiement' })
  await modes.getByRole('radio', { name: /Mobile Money/ }).click()
  await tablette.getByRole('radio', { name: /^Flooz/ }).click()
  await tablette.getByLabel(/^Montant payé/).fill('2000')
  await tablette.getByLabel(/^Référence de la transaction/).fill('7F3K29')
  await capturer(tablette, '41-encaisser-mobile-money')
  await capturerManuel(
    tablette,
    'encaisser/mobile-money',
    tablette.getByRole('button', { name: /^Valider 2\s000\sF en Mobile Money/ }),
  )
  await verifierFormatsTablette(
    tablette,
    'encaisser-mobile-money',
    tablette.getByRole('button', { name: /^Valider / }),
  )
  await tablette.getByRole('button', { name: /^Valider 2\s000\sF en Mobile Money/ }).click()
  const recap = tablette.getByRole('region', { name: 'Note à encaisser' })
  await expect(recap).toContainText('Reste à payer2 500 F')
  await modes.getByRole('radio', { name: /Espèces/ }).click()
  await tablette.getByLabel(/^Espèces reçues/).fill('5000')
  await expect(tablette.getByRole('status', { name: 'Monnaie à rendre' })).toContainText('2 500 F')
  await capturer(tablette, '42-encaisser-especes')
  await capturerManuel(
    tablette,
    'encaisser/especes',
    tablette.getByRole('status', { name: 'Monnaie à rendre' }),
  )
  await verifierFormatsTablette(
    tablette,
    'encaisser-especes',
    tablette.getByRole('button', { name: /^Valider / }),
  )
  await tablette.getByRole('button', { name: /^Valider 2\s500\sF en espèces/ }).click()
  await expect(tablette.getByRole('heading', { name: 'n°3 est encaissée' })).toBeVisible()
  // Le reçu est numéroté dès l'encaissement ; on l'imprime, sans ouvrir la boîte d'impression du navigateur.
  await expect(tablette.getByRole('heading', { name: /^Reçu n° / })).toBeVisible()
  await capturer(tablette, '43-note-encaissee')
  await capturerManuel(
    tablette,
    'encaisser/recu',
    tablette.getByRole('button', { name: 'Imprimer le reçu' }),
  )
  await verifierFormatsTablette(
    tablette,
    'note-encaissee',
    tablette.getByRole('button', { name: 'Imprimer le reçu' }),
  )
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
  await capturerManuel(
    tablette,
    'partager-l-addition/par-articles',
    tablette.getByRole('button', { name: /^Valider 4\s500\sF en carte/ }),
  )
  await verifierFormatsTablette(
    tablette,
    'partage-par-articles',
    tablette.getByRole('button', { name: /^Valider / }),
  )
  await tablette.getByRole('button', { name: /^Valider 4\s500\sF en carte/ }).click()
  await expect(recap).toContainText('1× Poulet braisé, carte')
  await partage.getByRole('radio', { name: /Parts égales/ }).click()
  const parts = tablette.getByRole('list', { name: 'Parts' })
  await expect(parts).toContainText('Part 1En cours4 500')
  await expect(parts).toContainText('Part 2À payer4 500')
  await modes.getByRole('radio', { name: /Carte/ }).click()
  await capturer(tablette, '56-partage-parts-egales')
  await capturerManuel(tablette, 'partager-l-addition/parts-egales', parts)
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
  await capturerManuel(
    tablette,
    'rembourser/notes-encaissees',
    tablette.getByRole('button', { name: 'Rembourser' }),
  )
  await verifierFormatsTablette(tablette, 'notes-encaissees')
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
  await capturerManuel(
    tablette,
    'rembourser/rembourser',
    tablette.getByRole('region', { name: 'Rendre l’argent en' }),
  )
  await capturerManuel(
    tablette,
    'rembourser/valider',
    tablette.getByRole('button', { name: /^Rembourser 4\s500\sF en carte/ }),
  )
  await verifierFormatsTablette(
    tablette,
    'rembourser',
    tablette.getByRole('button', { name: /^Rembourser 4\s500/ }),
  )
  await tablette.setViewportSize({ width: 390, height: 844 })
  await capturer(tablette, '58-rembourser-telephone')
  await tablette.setViewportSize({ width: 1280, height: 800 })
  await tablette.getByRole('button', { name: /^Rembourser 4\s500\sF en carte/ }).click()
  // Le remboursement fait, l'avoir numéroté se remet au client avec l'argent.
  const fait = tablette.getByRole('region', { name: 'Remboursement fait' })
  await expect(fait).toContainText(/Avoir BE-AV-\d{6}/)
  await capturer(tablette, '59-avoir')
  await capturerManuel(
    tablette,
    'rembourser/avoir',
    fait.getByRole('button', { name: 'Imprimer l’avoir' }),
  )
  await fait.getByRole('button', { name: 'Imprimer l’avoir' }).click()
  await expect.poll(() => impressions(tablette)).toBe(3)
  await fait.getByRole('button', { name: 'Retour aux notes' }).click()
  await expect(tablette.getByRole('region', { name: /, T6$/ })).toContainText(
    '1× Poulet braisé, carte',
  )
  await capturer(tablette, '59-note-remboursee')
  await capturerManuel(
    tablette,
    'rembourser/note-remboursee',
    tablette.getByRole('region', { name: /, T6$/ }),
  )
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
  await allerA(page, 'Carte', 'Par établissement')
  await page.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await page.getByRole('button', { name: 'Remettre Flag 65 cl en vente' }).click()
  await expect(page.getByText('« Flag 65 cl » est de nouveau en vente.')).toBeVisible()
  await tablette.getByRole('button', { name: 'Vente au comptoir' }).click()
  const flag = carte.getByRole('button', { name: /Flag 65 cl/ })
  await expect(flag).toContainText('33 restants')
  await capturer(tablette, '67-tuile-stock-faible')
  await capturerManuel(tablette, 'stock/tuile-stock-faible', flag)
  await flag.click()
  await flag.click()
  // Les bières se servent au bar : rien ne part en cuisine, la caisse dit « Valider ».
  await note.getByRole('button', { name: 'Valider 2 articles' }).click()
  // Tant que l'envoi n'est pas fini, la ligne est encore un brouillon : son menu ne propose pas « Annuler ».
  await expect(note.getByRole('button', { name: /Valider \d+ article/ })).toHaveCount(0)
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

  await allerA(page, 'Stock')
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
  await allerA(page, 'Ventes', 'Ardoises')
  await page.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await page.getByRole('button', { name: 'Nouveau client' }).click()
  const nouveauClient = page.getByRole('dialog', { name: 'Nouveau client' })
  await nouveauClient.getByLabel(/^Nom/).fill('Komlan D.')
  // Sans indicatif : le numéro se lit au Togo, le pays de l'entreprise.
  await nouveauClient.getByLabel(/^Téléphone/).fill('90 12 34 56')
  await nouveauClient.getByLabel(/^Plafond/).fill('1000')
  await nouveauClient.getByLabel(/^Note interne/).fill('Paie chaque fin de mois.')
  await capturer(page, '70-ardoise-nouveau-client')
  await capturerManuel(
    page,
    'ardoise/nouveau-client',
    nouveauClient.getByRole('button', { name: 'Ouvrir l’ardoise' }),
  )
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
  await capturerManuel(
    tablette,
    'ardoise/encaisser',
    tablette.getByRole('button', { name: /^Dépasser le plafond/ }),
  )
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
  await capturerManuel(page, 'ardoise/fiche-client', ficheKomlan)
  await page.getByRole('link', { name: 'Ardoises' }).last().click()
  await expect(page.getByRole('region', { name: 'Résumé des ardoises' })).toContainText('1 200 F')
  await capturer(page, '73-ardoises')
  await capturerManuel(
    page,
    'ardoise/ardoises',
    page.getByRole('region', { name: 'Résumé des ardoises' }),
  )
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
  await capturerManuel(
    tablette,
    'ardoise/reglement',
    reglement.getByRole('button', { name: /^Encaisser 1\s200\sF en espèces/ }),
  )
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
  await capturerManuel(
    tablette,
    'cloturer-la-caisse/mouvement',
    mouvement.getByRole('button', { name: /^Sortir 10\s000\sF du tiroir/ }),
  )
  await mouvement.getByRole('button', { name: /^Sortir 10\s000\sF du tiroir/ }).click()
  await expect(ventes).toContainText('RetraitVers le coffre')
  await expect(especes).toContainText('Attendu13 700 F')
  await capturer(tablette, '48-caisse-de-la-tablette')
  await capturerManuel(tablette, 'cloturer-la-caisse/caisse', especes)
  await verifierFormatsTablette(
    tablette,
    'caisse-de-la-tablette',
    tablette.getByRole('button', { name: 'Clôturer la caisse' }),
  )
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
  await capturerManuel(
    tablette,
    'cloturer-la-caisse/comptage',
    tablette.getByRole('button', { name: 'Valider le comptage' }),
  )
  await verifierFormatsTablette(
    tablette,
    'cloture-comptage',
    tablette.getByRole('button', { name: 'Valider le comptage' }),
  )
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
  await capturerManuel(tablette, 'cloturer-la-caisse/ecart', ecart)
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
  await capturerManuel(tablette, 'premier-jour/rapport-z')
  await verifierFormatsTablette(tablette, 'rapport-z')
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
  await capturerManuel(
    tablette,
    'cloturer-la-caisse/reouverture',
    tablette.getByRole('button', { name: 'Valider le comptage' }),
  )
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
  await allerA(page, 'Activité')
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
  await capturerManuel(
    page,
    'suivre-les-ventes/activite',
    page.getByRole('button', { name: 'Critiques seulement' }),
  )

  // Le soir, Tanti regarde ses ventes de la semaine, puis ses caisses : l'écart du Z n°1 ressort tout de suite.
  await allerA(page, 'Ventes', 'Rapports')
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
  await capturerManuel(
    page,
    'suivre-les-ventes/ventes',
    page.getByRole('group', { name: 'Période' }),
  )
  await page.getByRole('button', { name: 'Par heure' }).click()
  await expect(page.getByRole('list', { name: 'Chiffre d’affaires par heure' })).toBeVisible()
  await page.getByRole('button', { name: 'Catégories' }).click()
  await capturer(page, '80-ventes-heures-categories')
  await capturerManuel(
    page,
    'suivre-les-ventes/categories',
    page.getByRole('button', { name: 'Catégories' }),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '80-ventes-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })

  await allerA(page, 'Ventes', 'Caisses')
  const listeCaisses = page.getByRole('table', { name: 'Caisses de la période' })
  await expect(listeCaisses.getByRole('row', { name: /Z n°1/ })).toContainText('−500')
  await expect(listeCaisses.getByRole('row', { name: /En cours/ })).toBeVisible()
  await capturer(page, '81-caisses')
  await capturerManuel(
    page,
    'suivre-les-ventes/caisses',
    listeCaisses.getByRole('row', { name: /Z n°1/ }),
  )
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
  await capturerManuel(
    page,
    'suivre-les-ventes/detail-z',
    page.getByRole('button', { name: 'Imprimer le Z' }),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '82-detail-z-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })

  // Le tableau de bord : ce qui est à traiter, et ce qui se passe en ce moment à Bè Kpota.
  await allerA(page, 'Tableau de bord')
  await expect(page.getByRole('region', { name: 'Vendu aujourd’hui' })).toContainText(/F/)
  const maintenant = page.getByRole('region', { name: 'Bè Kpota en ce moment' })
  await expect(maintenant).toContainText('Caisses ouvertes')
  await expect(maintenant).toContainText(/Afi M\., depuis/)
  await expect(page.getByRole('region', { name: 'À traiter' })).toContainText(
    /Écart à la clôture : −500/,
  )
  await capturer(page, '83-tableau-de-bord')
  await capturerManuel(
    page,
    'suivre-les-ventes/tableau-de-bord',
    page.getByRole('region', { name: 'À traiter' }),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '83-tableau-de-bord-telephone')
})

/** Génère un code d'enregistrement depuis la page Tablettes de la gestion et le renvoie. */
async function codeDeTablette(page: Page, nom: string, usage = 'Caisse'): Promise<string> {
  await page.getByRole('button', { name: 'Enregistrer une tablette' }).click()
  const formulaire = page.getByRole('form', { name: 'Enregistrer une tablette' })
  await formulaire.getByLabel(/^Établissement/).selectOption({ label: 'Bè Kpota' })
  await formulaire.getByLabel(/^Usage/).selectOption({ label: usage })
  await formulaire.getByLabel(/^Nom de la caisse/).fill(nom)
  await formulaire.getByRole('button', { name: 'Générer le code' }).click()
  return (
    (await page
      .getByRole('region', { name: 'Code d’enregistrement' })
      .locator('[data-code]')
      .textContent()) ?? ''
  ).replace(/\D/g, '')
}

test('La cuisine de Bè Kpota reçoit les bons, les commence et les marque prêts ; Kossi le voit', async ({
  page,
  browser,
}) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()
  await allerA(page, 'Réglages', 'Tablettes')

  // Une tablette de la cuisine, enregistrée comme écran cuisine : pas de PIN, elle va droit aux bons.
  const codeCuisine = await codeDeTablette(page, 'Cuisine', 'Écran cuisine')
  await capturer(page, '84-tablette-cuisine-code')
  await capturerManuel(
    page,
    'tablettes/ecran-cuisine',
    page.getByRole('region', { name: 'Code d’enregistrement' }).locator('[data-code]'),
  )
  const contexteCuisine = await browser.newContext({ viewport: { width: 1280, height: 960 } })
  const cuisine = await contexteCuisine.newPage()
  await cuisine.goto('/caisse')
  await taperCode(cuisine, codeCuisine)
  await expect(cuisine).toHaveURL(/\/cuisine$/)
  await expect(cuisine.getByRole('banner')).toContainText('Bè Kpota, Cuisine')
  const panneau = page.getByRole('region', { name: 'Code d’enregistrement' })
  await expect(panneau).toContainText('La tablette « Cuisine » est enregistrée.')
  await panneau.getByRole('button', { name: 'Terminer' }).click()
  await expect(
    page.getByRole('table', { name: 'Tablettes de l’entreprise' }).getByRole('row', {
      name: /^Cuisine/,
    }),
  ).toContainText('Écran cuisine')

  // Kossi prend une nouvelle caisse de la salle et envoie deux poulets sur une table libre.
  const codeCaisse = await codeDeTablette(page, 'Caisse 3, salle')
  const contexteCaisse = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const caisse = await contexteCaisse.newPage()
  await caisse.goto('/caisse')
  await taperCode(caisse, codeCaisse)
  await caisse.getByRole('button', { name: /Kossi A\./ }).click()
  await taperCode(caisse, '4827')
  await caisse.getByRole('button', { name: 'Ouvrir la caisse' }).click()
  const tables = caisse.getByRole('list', { name: 'Tables' })
  const libre = tables.getByRole('button', { name: /, libre$/ }).first()
  const table = ((await libre.getAttribute('aria-label')) ?? '').split(',')[0] ?? ''
  await libre.click()
  await caisse
    .getByRole('dialog', { name: `Ouvrir une note sur ${table}` })
    .getByRole('button', { name: 'Ouvrir la note' })
    .click()
  const note = caisse.getByRole('region', { name: 'Note en cours' })
  const carte = caisse.getByRole('list', { name: 'Produits' })
  await carte.getByRole('button', { name: /Poulet braisé/ }).click()
  await carte.getByRole('button', { name: /Poulet braisé/ }).click()
  await expect(note).toContainText('9 000 FCFA')
  await note.getByRole('button', { name: /Envoyer 2 articles/ }).click()
  await note.getByRole('button', { name: 'Plan de salle' }).click()
  const tuile = tables.getByRole('button', { name: new RegExp(`^${table}, note de`) })
  await expect(tuile).toContainText('En attente en cuisine')

  // La cuisine voit le bon arriver, le commence : le serveur sait que c'est en préparation.
  const bon = cuisine.getByRole('region', { name: `Bon ${table}` })
  await expect(bon).toContainText('Poulet braisé', { timeout: 10_000 })
  await expect(bon).toContainText('Kossi A.')
  await capturer(cuisine, '85-cuisine-bons')
  await capturerManuel(
    cuisine,
    'ecran-cuisine/bons',
    bon.getByRole('button', { name: 'Commencer' }),
  )
  await verifierFormatsTablette(cuisine, 'cuisine')
  await bon.getByRole('button', { name: 'Commencer' }).click()
  await expect(bon).toContainText('En préparation')
  await capturer(cuisine, '86-cuisine-en-preparation')
  await capturerManuel(
    cuisine,
    'ecran-cuisine/en-preparation',
    bon.getByRole('button', { name: 'Tout est prêt' }),
  )
  await expect(tuile).toContainText('En préparation', { timeout: 20_000 })
  await capturer(caisse, '87-plan-en-preparation')

  // « Tout est prêt » : le bon passe dans « Prêts », la table devient verte côté caisse.
  await bon.getByRole('button', { name: 'Tout est prêt' }).click()
  await expect(bon).toHaveCount(0)
  await expect(tuile).toContainText('2 prêts à servir', { timeout: 20_000 })
  await expect(
    caisse.getByRole('list', { name: 'À servir' }).getByRole('link').first(),
  ).toContainText('2 prêts')
  await capturer(caisse, '88-plan-prets-a-servir')
  await capturerManuel(
    caisse,
    'prendre-une-commande/servir',
    caisse.getByRole('list', { name: 'À servir' }),
  )
  await cuisine.getByRole('tab', { name: /Prêts/ }).click()
  await expect(bon.getByRole('button', { name: 'Rappeler' })).toBeVisible()
  await capturer(cuisine, '89-cuisine-prets')
  await capturerManuel(
    cuisine,
    'ecran-cuisine/prets',
    bon.getByRole('button', { name: 'Rappeler' }),
  )
  await cuisine.setViewportSize({ width: 390, height: 844 })
  await cuisine.getByRole('tab', { name: /À préparer/ }).click()
  await capturer(cuisine, '85-cuisine-telephone')

  // Kossi sert la table : plus rien à apporter.
  await tuile.click()
  await note.getByRole('button', { name: 'Tout servi' }).click()
  await note.getByRole('button', { name: 'Plan de salle' }).click()
  await expect(tuile).not.toContainText('prêts à servir')
  await contexteCuisine.close()
  await contexteCaisse.close()
})

test('Tanti crée des options, les attache aux côtelettes, et Kossi les choisit en caisse', async ({
  page,
  browser,
}) => {
  await seConnecter(page, TANTI.saisie, TANTI.motDePasse)
  await page.getByRole('button', { name: 'Maquis Chez Tanti' }).click()

  // Un plat à options.
  await allerA(page, 'Carte', 'Produits')
  await page.getByRole('link', { name: 'Ajouter un produit' }).click()
  await page.getByLabel(/^Nom/).fill('Côtelettes d’agneau')
  await page.getByLabel(/^Catégorie/).selectOption({ label: 'Grillades' })
  await page.getByRole('radio', { name: 'Plat' }).check({ force: true })
  await page.getByLabel(/^Prix TTC/).fill('5000')
  await page.getByRole('button', { name: 'Enregistrer le produit' }).click()
  await expect(page.getByText('« Côtelettes d’agneau » est enregistré.')).toBeVisible()

  // Deux groupes : la cuisson, obligatoire ; les suppléments, deux au plus, dont un lié à la Flag (stock et coût).
  await allerA(page, 'Carte', 'Options')
  for (const [nom, multiple, obligatoire, choix] of [
    [
      'Cuisson',
      false,
      true,
      [
        ['Saignant', ''],
        ['À point', ''],
      ],
    ],
    [
      'Suppléments',
      true,
      false,
      [
        ['Œuf', '200'],
        ['Piment', ''],
      ],
    ],
  ] as const) {
    await page.getByRole('button', { name: 'Nouveau groupe' }).click()
    const dialogue = page.getByRole('dialog', { name: 'Nouveau groupe d’options' })
    await dialogue.getByLabel(/^Nom du groupe/).fill(nom)
    if (multiple) {
      await dialogue.getByRole('radio', { name: /Plusieurs choix/ }).click()
      await dialogue.getByLabel('Au plus').fill('2')
    }
    if (obligatoire) await dialogue.getByRole('switch', { name: /Obligatoire/ }).click()
    // La ligne vide du bas devient le choix suivant dès qu'on y tape.
    for (const [rang, [libelle, supplement]] of choix.entries()) {
      const ligne = dialogue.getByRole('group', { name: `Choix ${String(rang + 1)}` })
      await ligne.getByLabel('Nom', { exact: true }).fill(libelle)
      await ligne.getByLabel('Prix en plus').fill(supplement)
    }
    if (nom === 'Suppléments') {
      await capturer(page, '90-groupe-options')
      await capturerManuel(
        page,
        'options-et-variantes/groupe',
        dialogue.getByRole('radio', { name: /Plusieurs choix/ }),
      )
      // « Lier au stock » s'ouvre sous le choix ; refermé sans lier, la suite vend l'Œuf sans stock.
      const lier = dialogue.getByRole('button', { name: 'Lier au stock' }).first()
      await lier.click()
      await capturerManuel(
        page,
        'options-et-variantes/lier-au-stock',
        dialogue.getByLabel('Décompter le stock de'),
      )
      await lier.click()
      await expect(dialogue.getByLabel('Décompter le stock de')).toHaveCount(0)
    }
    await dialogue.getByRole('button', { name: 'Créer le groupe' }).click()
    await expect(page.getByText(`Le groupe « ${nom} » est créé.`)).toBeVisible()
  }
  const groupes = page.getByRole('table', { name: 'Groupes d’options' })
  await expect(groupes.getByRole('row', { name: /Cuisson/ })).toContainText(
    'Choix unique, obligatoire',
  )
  await capturer(page, '90-options')
  await capturerManuel(
    page,
    'options-et-variantes/groupes',
    groupes.getByRole('row', { name: /Cuisson/ }),
  )

  // Sur la fiche des côtelettes, dans l'ordre de la caisse.
  await allerA(page, 'Carte', 'Produits')
  await page.getByRole('link', { name: 'Modifier Côtelettes d’agneau' }).click()
  const section = page.getByRole('region', { name: 'Options' })
  for (const groupe of ['Cuisson', 'Suppléments']) {
    await section.getByLabel(/^Ajouter un groupe/).selectOption({ label: groupe })
    await expect(section.getByRole('list')).toContainText(groupe)
  }
  await capturer(page, '91-fiche-options')
  await capturerManuel(page, 'options-et-variantes/fiche-options', section)

  // Deux variantes : 2 ou 4 côtelettes, chacune à son prix.
  const variantes = page.getByRole('region', { name: 'Variantes' })
  for (const [libelle, prix] of [
    ['2 pièces', '5000'],
    ['4 pièces', '9000'],
  ] as const) {
    await variantes.getByLabel(/^Nouvelle variante/).fill(libelle)
    await variantes.getByLabel(/^Prix de la variante/).fill(prix)
    await variantes.getByRole('button', { name: 'Ajouter la variante' }).click()
    await expect(variantes.getByRole('row', { name: new RegExp(libelle) })).toBeVisible()
  }
  await capturer(page, '91-fiche-variantes')
  await capturerManuel(page, 'options-et-variantes/variantes', variantes)

  // Kossi, sur une nouvelle caisse : la cuisson est demandée avant l'ajout, le supplément s'ajoute au prix.
  await allerA(page, 'Réglages', 'Tablettes')
  const codeCaisse = await codeDeTablette(page, 'Caisse 4, grill')
  const contexteCaisse = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const caisse = await contexteCaisse.newPage()
  await caisse.goto('/caisse')
  await taperCode(caisse, codeCaisse)
  await caisse.getByRole('button', { name: /Kossi A\./ }).click()
  await taperCode(caisse, '4827')
  await caisse.getByRole('button', { name: 'Ouvrir la caisse' }).click()
  await caisse.getByRole('button', { name: 'Vente au comptoir' }).click()
  const note = caisse.getByRole('region', { name: 'Note en cours' })
  const tuile = caisse.getByRole('list', { name: 'Produits' }).getByRole('button', {
    name: /Côtelettes d’agneau/,
  })
  await expect(tuile).toContainText('dès')
  await tuile.click()
  // D'abord la variante, puis les options du produit.
  await capturer(caisse, '92-caisse-variantes')
  await capturerManuel(
    caisse,
    'options-et-variantes/caisse',
    caisse
      .getByRole('dialog', { name: 'Côtelettes d’agneau' })
      .getByRole('button', { name: /4 pièces/ }),
  )
  await caisse
    .getByRole('dialog', { name: 'Côtelettes d’agneau' })
    .getByRole('button', { name: /4 pièces/ })
    .click()
  const panneau = caisse.getByRole('dialog', { name: 'Côtelettes d’agneau, 4 pièces' })
  await panneau.getByRole('button', { name: /^Ajouter/ }).click()
  await expect(panneau).toContainText('Choisissez : Cuisson.')
  await panneau.getByRole('button', { name: /À point/ }).click()
  await panneau.getByRole('button', { name: /Œuf/ }).click()
  await expect(panneau.getByRole('button', { name: /^Ajouter/ })).toContainText('9 200')
  await capturer(caisse, '92-caisse-options')
  await capturerManuel(
    caisse,
    'prendre-une-commande/options',
    panneau.getByRole('button', { name: /^Ajouter/ }),
  )
  await verifierFormatsTablette(
    caisse,
    'caisse-options',
    caisse.getByRole('dialog').getByRole('button', { name: /^Ajouter/ }),
  )
  await caisse.setViewportSize({ width: 390, height: 844 })
  await capturer(caisse, '92-caisse-options-telephone')
  await caisse.setViewportSize({ width: 1280, height: 800 })
  await panneau.getByRole('button', { name: /^Ajouter/ }).click()
  await expect(note).toContainText('Œuf +200')
  await expect(note).toContainText('9 200 FCFA')
  await expect(note).toContainText('Côtelettes d’agneau, 4 pièces')
  await capturer(caisse, '93-note-options')
  await note.getByRole('button', { name: /Envoyer 1 article/ }).click()
  await expect(note.getByRole('button', { name: /Envoyer \d+ article/ })).toHaveCount(0)
  await contexteCaisse.close()
})

test('L’équipe plateforme ouvre la fiche de Maquis Chez Tanti, la modifie et la suspend', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await seConnecter(page, ADMIN.identifiant, ADMIN.motDePasse)
  // Le tableau de bord : des comptes, jamais de montants ; Maquis Chez Tanti a vendu, il n'est pas à relancer.
  await expect(page).toHaveURL(/\/plateforme\/tableau-de-bord$/)
  await expect(page.getByRole('list', { name: 'Indicateurs' })).toContainText('Entreprises actives')
  await expect(page.getByRole('region', { name: 'À relancer' })).not.toContainText(
    'Maquis Chez Tanti',
  )
  await capturer(page, '89-plateforme-tableau-de-bord')
  await page.setViewportSize({ width: 390, height: 844 })
  await capturer(page, '89-plateforme-tableau-de-bord-telephone')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page
    .getByRole('navigation', { name: 'Espace plateforme' })
    .getByRole('link', { name: 'Entreprises' })
    .click()

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
