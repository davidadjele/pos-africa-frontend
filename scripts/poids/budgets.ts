/** Un fichier du build et sa taille une fois compressé, comme le servent Vercel et le service worker. */
export interface FichierCompresse {
  nom: string
  octetsGzip: number
}

/** Plafonds en kilo-octets compressés (1 Ko = 1 000 octets). */
export interface Budgets {
  jsTotalKo: number
  /** Le point d'entrée seul : ce qu'une tablette télécharge avant d'afficher quoi que ce soit. */
  jsPremierChargementKo: number
  plusGrosJsKo: number
  cssKo: number
  policesKo: number
}

export interface LigneBudget {
  critere: string
  mesureKo: number
  plafondKo: number
  depasse: boolean
}

const ko = (octets: number) => Math.round(octets / 100) / 10

export function verifierBudgets(
  fichiers: readonly FichierCompresse[],
  budgets: Budgets,
): { lignes: LigneBudget[]; depasse: boolean } {
  const tailles = (extension: string) =>
    fichiers.filter(({ nom }) => nom.endsWith(extension)).map(({ octetsGzip }) => octetsGzip)
  const somme = (valeurs: number[]) => valeurs.reduce((total, valeur) => total + valeur, 0)
  const js = tailles('.js')
  const lignes = (
    [
      ['JavaScript, total', somme(js), budgets.jsTotalKo],
      [
        'JavaScript, premier chargement',
        somme(
          fichiers
            .filter(({ nom }) => /^index-.*\.js$/.test(nom))
            .map(({ octetsGzip }) => octetsGzip),
        ),
        budgets.jsPremierChargementKo,
      ],
      ['JavaScript, plus gros fichier', Math.max(0, ...js), budgets.plusGrosJsKo],
      ['CSS', somme(tailles('.css')), budgets.cssKo],
      // Les .woff ne servent qu'aux navigateurs anciens : Chrome télécharge le .woff2, et Neulis est en .otf.
      [
        'Polices (woff2 et otf)',
        somme([...tailles('.woff2'), ...tailles('.otf')]),
        budgets.policesKo,
      ],
    ] as const
  ).map(([critere, octets, plafondKo]) => ({
    critere,
    mesureKo: ko(octets),
    plafondKo,
    depasse: ko(octets) > plafondKo,
  }))
  return { lignes, depasse: lignes.some((ligne) => ligne.depasse) }
}
