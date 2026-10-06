// Vérifie que le build ne dépasse pas les budgets de poids de budgets-perf.json : node scripts/verifier-poids.ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { verifierBudgets, type Budgets } from './poids/budgets.ts'

// Les polices de marque sont copiées depuis public/ : elles ne passent pas par dist/assets.
const DOSSIERS = ['dist/assets', 'dist/polices']
const budgets = JSON.parse(readFileSync('budgets-perf.json', 'utf8')) as Budgets
const fichiers = DOSSIERS.flatMap((dossier) =>
  readdirSync(dossier).map((nom) => ({
    nom,
    octetsGzip: gzipSync(readFileSync(join(dossier, nom)), { level: 9 }).length,
  })),
)
const { lignes, depasse } = verifierBudgets(fichiers, budgets)

console.table(
  lignes.map(({ critere, mesureKo, plafondKo, depasse: horsBudget }) => ({
    Critère: critere,
    'Mesuré (Ko gzip)': mesureKo,
    'Plafond (Ko gzip)': plafondKo,
    État: horsBudget ? 'DÉPASSÉ' : 'ok',
  })),
)
if (depasse) {
  console.error(
    'Budget de poids dépassé : allégez le code chargé, ou relevez le plafond en le justifiant.',
  )
  process.exitCode = 1
}
