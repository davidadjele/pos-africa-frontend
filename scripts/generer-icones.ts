// Génère les icônes PNG du manifeste à partir d'un dessin SVG, avec le Chromium de Playwright.
// À relancer après un changement de couleur de marque : node scripts/generer-icones.ts
import { chromium } from '@playwright/test'

const NAVY = '#00102b'
const BLANC = '#ffffff'

// « T » en rectangles sur une grille de 32 : aucune police à charger.
function dessin(taille: number, masquable: boolean): string {
  // L'icône masquable est rognée en cercle par Android : fond plein et lettre dans la zone sûre.
  const echelle = masquable ? 0.7 : 1
  const decalage = (32 - 32 * echelle) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(taille)}" height="${String(taille)}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${masquable ? '0' : '6'}" fill="${NAVY}"/>
  <path transform="translate(${String(decalage)} ${String(decalage)}) scale(${String(echelle)})" fill="${BLANC}" d="M8 8h16v4h-6v12h-4V12H8z"/>
</svg>`
}

const navigateur = await chromium.launch()
const page = await navigateur.newPage()
for (const [fichier, taille, masquable] of [
  ['icone-192.png', 192, false],
  ['icone-512.png', 512, false],
  ['icone-masquable-512.png', 512, true],
] as const) {
  await page.setViewportSize({ width: taille, height: taille })
  await page.setContent(
    `<body style="margin:0;background:transparent">${dessin(taille, masquable)}</body>`,
  )
  await page.locator('svg').screenshot({ path: `public/icones/${fichier}`, omitBackground: true })
}
await navigateur.close()
