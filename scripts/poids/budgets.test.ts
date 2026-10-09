import { describe, expect, it } from 'vitest'
import { verifierBudgets, type Budgets } from './budgets'

const BUDGETS: Budgets = {
  jsTotalKo: 380,
  jsPremierChargementKo: 365,
  plusGrosJsKo: 370,
  cssKo: 12,
  policesKo: 200,
}

describe('budgets de poids du build', () => {
  it('additionne chaque famille de fichiers compressés et la compare à son plafond', () => {
    const resultat = verifierBudgets(
      [
        { nom: 'index-a1.js', octetsGzip: 360_000 },
        { nom: 'workbox-window-b2.js', octetsGzip: 2_000 },
        // Un espace chargé à la demande : il compte dans le total, pas dans le premier chargement.
        { nom: 'gestion-f6.js', octetsGzip: 1_000 },
        { nom: 'index-c3.css', octetsGzip: 9_400 },
        { nom: 'barlow-600-d4.woff2', octetsGzip: 20_000 },
        { nom: 'Neulis-Regular.otf', octetsGzip: 40_000 },
        // Les .woff ne servent qu'aux vieux navigateurs : Chrome télécharge le .woff2.
        { nom: 'neulis-400-e5.woff', octetsGzip: 90_000 },
        { nom: 'logo.svg', octetsGzip: 800 },
      ],
      BUDGETS,
    )

    expect(resultat.depasse).toBe(false)
    expect(resultat.lignes).toEqual([
      { critere: 'JavaScript, total', mesureKo: 363, plafondKo: 380, depasse: false },
      { critere: 'JavaScript, premier chargement', mesureKo: 360, plafondKo: 365, depasse: false },
      { critere: 'JavaScript, plus gros fichier', mesureKo: 360, plafondKo: 370, depasse: false },
      { critere: 'CSS', mesureKo: 9.4, plafondKo: 12, depasse: false },
      { critere: 'Polices (woff2 et otf)', mesureKo: 60, plafondKo: 200, depasse: false },
    ])
  })

  it('signale le critère dépassé', () => {
    const resultat = verifierBudgets([{ nom: 'index-a1.js', octetsGzip: 390_500 }], BUDGETS)

    expect(resultat.depasse).toBe(true)
    expect(resultat.lignes.filter((ligne) => ligne.depasse).map((ligne) => ligne.critere)).toEqual([
      'JavaScript, total',
      'JavaScript, premier chargement',
      'JavaScript, plus gros fichier',
    ])
  })
})
