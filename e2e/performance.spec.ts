import { expect, test, type Page, type TestInfo } from '@playwright/test'
import type { CommandeDetail, LigneCarteEtablissement, LigneNote } from '../src/partage/api/contrat'
import { BIERES, FLAG, GRILLADES, NOTE_VIDE, POULET, POULET_A_ENVOYER } from '../tests/commandes'
import { simulerApi } from './simulation'

// Réactivité mesurée sur le build de production, processeur ralenti comme une tablette bas de gamme. Les
// plafonds sont larges : un runner partagé est bruité, ils attrapent une régression nette, pas 10 ms.
const RALENTISSEMENT_CPU = 4
const ESSAIS = 5
/** Environ 200, 90 et 250 ms sur un poste de développement ; un runner GitHub est plusieurs fois plus lent. */
const PLAFONDS_MS = { ouvertureNote: 1500, ajoutArticle: 400, ouvertureGuide: 1500 }
/**
 * Mesuré à 2,5 s de LCP. Le blocage dépend surtout de la machine : 80 ms sur un poste de développement, 340 à
 * 500 ms sur un runner GitHub, déjà lent avant le ralentissement ×4. Le plafond attrape une vraie régression.
 */
const PLAFONDS_CHARGEMENT = { lcpMs: 3500, cls: 0.1, tbtMs: 800 }

/** Une carte réaliste : 40 produits, sans options ni variantes pour qu'un toucher ajoute directement. */
const CARTE: LigneCarteEtablissement[] = Array.from({ length: 40 }, (_, rang) => {
  const modele = rang % 2 === 0 ? POULET : FLAG
  return {
    ...modele,
    produitId: `9d000000-0000-4000-8000-${String(rang).padStart(12, '0')}`,
    nom: `${modele === POULET ? 'Grillade' : 'Boisson'} n°${String(rang + 1)}`,
    categorie: modele === POULET ? GRILLADES : BIERES,
  }
})

function ligne(produit: LigneCarteEtablissement, rang: number): LigneNote {
  return {
    ...POULET_A_ENVOYER,
    id: `1e000000-0000-4000-8000-${String(rang).padStart(12, '0')}`,
    produitId: produit.produitId,
    nomProduit: produit.nom,
    prixUnitaire: produit.prix,
    quantite: 1,
    montant: produit.prix,
    montantBrut: produit.prix,
  }
}

/** La caisse de Bè Kpota : Kossi prend la main par PIN, la note du comptoir grossit à chaque ajout. */
async function simulerCaisse(page: Page) {
  await simulerApi(page, { connecte: false })
  let note: CommandeDetail = NOTE_VIDE
  await page.route('**/api/appareil/connexion', (route) =>
    route.fulfill({ json: { statut: 'CONNECTE', jetonAcces: 'eyJ.caisse' } }),
  )
  await page.route('**/api/caisse/moi', (route) =>
    route.fulfill({
      json: {
        utilisateurId: '0d6a8f3e-0000-4c1b-9a51-5d7b9b0e0201',
        prenom: 'Kossi',
        nomCourt: 'Kossi A.',
        role: 'SERVEUR',
        permissions: ['COMMANDE_CREER'],
        plafondRemise: 0,
      },
    }),
  )
  await page.route('**/api/caisse/plan', (route) =>
    route.fulfill({ json: { salles: [], sansTable: [], enService: [] } }),
  )
  await page.route('**/api/caisse/stock', (route) =>
    route.fulfill({ json: { politique: 'SOUPLE', articles: [] } }),
  )
  await page.route('**/api/caisse/carte', (route) => route.fulfill({ json: CARTE }))
  await page.route('**/api/caisse/commandes', (route) => route.fulfill({ json: note }))
  await page.route(`**/api/caisse/commandes/${NOTE_VIDE.id}`, (route) =>
    route.fulfill({ json: note }),
  )
  await page.route(`**/api/caisse/commandes/${NOTE_VIDE.id}/lignes`, (route) => {
    const { produitId } = route.request().postDataJSON() as { produitId: string }
    const produit = CARTE.find((candidat) => candidat.produitId === produitId) ?? CARTE[0]
    if (produit === undefined) return route.abort()
    const lignes = [...note.lignes, ligne(produit, note.lignes.length)]
    const total = lignes.reduce((somme, { montant }) => somme + montant, 0)
    note = {
      ...note,
      lignes,
      total,
      sousTotal: total,
      articles: lignes.length,
      version: note.version + 1,
    }
    return route.fulfill({ json: note })
  })
}

async function ralentirProcesseur(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RALENTISSEMENT_CPU })
}

/** Réseau « 4G lent » du profil mobile de Lighthouse : 150 ms de latence, 1,6 Mbit/s descendant. */
async function ralentirReseau(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
}

interface SignauxWeb {
  lcp: number
  cls: number
  tbt: number
}

/**
 * Les signaux que Lighthouse rapporte, lus dans la page par les API de performance du navigateur :
 * plus grand affichage (LCP), décalages de mise en page (CLS), temps de blocage des tâches longues (TBT).
 */
async function mesurerChargement(page: Page, chemin: string, titre: string): Promise<SignauxWeb> {
  await page.addInitScript(() => {
    const signaux = { lcp: 0, cls: 0, tbt: 0 }
    Object.assign(window, { signaux })
    new PerformanceObserver((liste) => {
      for (const entree of liste.getEntries()) signaux.lcp = entree.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((liste) => {
      for (const entree of liste.getEntries() as (PerformanceEntry & {
        value: number
        hadRecentInput: boolean
      })[]) {
        if (!entree.hadRecentInput) signaux.cls += entree.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((liste) => {
      for (const entree of liste.getEntries()) signaux.tbt += Math.max(0, entree.duration - 50)
    }).observe({ type: 'longtask', buffered: true })
  })
  await ralentirProcesseur(page)
  await ralentirReseau(page)
  await page.goto(chemin)
  await page.getByRole('heading', { level: 1, name: titre }).waitFor()
  // Laisse passer les dernières images : le LCP se fixe une fois la page stable.
  await page.waitForTimeout(1000)
  return page.evaluate(() => (window as unknown as { signaux: SignauxWeb }).signaux)
}

/** Durée entre le geste et l'état attendu, observé à chaque image par Playwright. */
async function chronometrer(geste: () => Promise<void>, attendu: () => Promise<unknown>) {
  const debut = Date.now()
  await Promise.all([attendu(), geste()])
  return Date.now() - debut
}

/** La mesure dans le rapport et dans le journal du CI : de quoi resserrer les plafonds sur des chiffres réels. */
function noter(testInfo: TestInfo, mesures: object) {
  const description = JSON.stringify(mesures)
  testInfo.annotations.push({ type: 'performance', description })
  console.log(`Performance, ${testInfo.title} : ${description}`)
}

function mediane(valeurs: number[]): number {
  const triees = [...valeurs].sort((a, b) => a - b)
  return triees[Math.floor(triees.length / 2)] ?? Number.POSITIVE_INFINITY
}

test.describe('performance sur tablette bas de gamme', () => {
  // Une mesure à la fois : deux pages ralenties en même temps se disputeraient le processeur.
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'tablette-paysage',
      'Mesurée une seule fois, sur le profil tablette, avec le ralentissement CPU de Chromium',
    )
  })

  test('la caisse ouvre une note et ajoute un article sans attente perceptible', async ({
    page,
  }, testInfo) => {
    await simulerCaisse(page)
    await page.goto('/caisse')
    await page.getByRole('button', { name: /Kossi A\./ }).click()
    for (const chiffre of '4827') {
      await page.getByRole('button', { name: chiffre, exact: true }).click()
    }
    await page.getByRole('button', { name: 'Ouvrir la caisse' }).click()
    await expect(page.getByRole('button', { name: 'Vente au comptoir' })).toBeVisible()
    await ralentirProcesseur(page)

    const produits = page.getByRole('list', { name: 'Produits' })
    const ouvertureNote = await chronometrer(
      () => page.getByRole('button', { name: 'Vente au comptoir' }).click(),
      () => produits.getByRole('button', { name: /Grillade n°1\b/ }).waitFor(),
    )

    const note = page.getByRole('region', { name: 'Note en cours' })
    const ajouts: number[] = []
    for (let rang = 0; rang < ESSAIS; rang++) {
      const nom = `Grillade n°${String(2 * rang + 1)}`
      ajouts.push(
        await chronometrer(
          () => produits.getByRole('button', { name: new RegExp(`${nom}\\b`) }).click(),
          // Playwright guette l'élément à chaque image : la mesure ne dépend pas d'un intervalle d'attente.
          () => note.getByText(nom, { exact: true }).waitFor(),
        ),
      )
    }
    await expect(note).toContainText(`Grillade n°${String(2 * ESSAIS - 1)}`)

    const mesures = { ouvertureNote, ajoutArticle: mediane(ajouts) }
    noter(testInfo, { ...mesures, ajouts })
    expect(mesures.ouvertureNote).toBeLessThanOrEqual(PLAFONDS_MS.ouvertureNote)
    expect(mesures.ajoutArticle).toBeLessThanOrEqual(PLAFONDS_MS.ajoutArticle)
  })

  for (const [chemin, titre] of [
    ['/connexion', 'Se connecter'],
    ['/aide', 'Comment pouvons-nous vous aider ?'],
  ] as const) {
    test(`${chemin} se charge vite sur un réseau lent`, async ({ page }, testInfo) => {
      await simulerApi(page, { connecte: false })
      const signaux = await mesurerChargement(page, chemin, titre)

      noter(testInfo, signaux)
      expect(signaux.lcp).toBeLessThanOrEqual(PLAFONDS_CHARGEMENT.lcpMs)
      expect(signaux.cls).toBeLessThanOrEqual(PLAFONDS_CHARGEMENT.cls)
      expect(signaux.tbt).toBeLessThanOrEqual(PLAFONDS_CHARGEMENT.tbtMs)
    })
  }

  test('un guide de l’aide s’ouvre vite, captures comprises', async ({ page }, testInfo) => {
    await simulerApi(page, { connecte: false })
    await page.goto('/aide')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Comment pouvons-nous vous aider ?' }),
    ).toBeVisible()
    await ralentirProcesseur(page)

    const ouvertureGuide = await chronometrer(
      () =>
        page
          .getByRole('region', { name: 'Je suis en caisse' })
          .getByRole('link', { name: 'Encaisser une note' })
          .click(),
      () => page.getByRole('heading', { level: 1, name: 'Encaisser une note' }).waitFor(),
    )

    noter(testInfo, { ouvertureGuide })
    expect(ouvertureGuide).toBeLessThanOrEqual(PLAFONDS_MS.ouvertureGuide)
  })
})
