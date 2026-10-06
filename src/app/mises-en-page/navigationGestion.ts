import {
  Activity,
  ChartColumn,
  LayoutDashboard,
  Package,
  Settings,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '../../partage/auth/useSession'

export type CheminGestion =
  | '/gestion'
  | '/caisse'
  | '/gestion/activite'
  | '/gestion/produits'
  | '/gestion/carte-etablissement'
  | '/gestion/taxes'
  | '/gestion/options'
  | '/gestion/etablissements'
  | '/gestion/salles'
  | '/gestion/personnel'
  | '/gestion/tablettes'
  | '/gestion/stock'
  | '/gestion/ventes'
  | '/gestion/caisses'
  | '/gestion/ardoises'
  | '/gestion/entreprise'

export type Compteur = 'stock' | 'ardoises'

export interface Onglet {
  vers: CheminGestion
  cle: string
  /** Onglet masqué sans l'une de ces permissions : l'écran ne servirait qu'à afficher un refus. */
  permission?: Permission | Permission[]
  /** Nombre à côté de l'onglet : ce qui attend une action. */
  compteur?: Compteur
}

/** Une entrée du menu : une seule page, ou plusieurs pages rangées en onglets. */
export interface Section {
  cle: string
  icone: LucideIcon
  onglets: Onglet[]
}

export const SECTIONS: Section[] = [
  {
    cle: 'tableauDeBord',
    icone: LayoutDashboard,
    onglets: [{ vers: '/gestion', cle: 'tableauDeBord' }],
  },
  { cle: 'caisse', icone: Store, onglets: [{ vers: '/caisse', cle: 'caisse' }] },
  {
    cle: 'ventes',
    icone: ChartColumn,
    onglets: [
      { vers: '/gestion/ventes', cle: 'rapports', permission: 'RAPPORT_VENTES' },
      { vers: '/gestion/caisses', cle: 'caisses', permission: 'RAPPORT_FINANCIER' },
      {
        vers: '/gestion/ardoises',
        cle: 'ardoises',
        permission: 'CLIENT_CREDIT',
        compteur: 'ardoises',
      },
    ],
  },
  {
    cle: 'carte',
    icone: UtensilsCrossed,
    // La carte se consulte par tout le back-office ; les taxes seulement par qui les règle.
    onglets: [
      { vers: '/gestion/produits', cle: 'produits' },
      { vers: '/gestion/options', cle: 'options', permission: 'CATALOGUE_GERER' },
      { vers: '/gestion/carte-etablissement', cle: 'parEtablissement' },
      { vers: '/gestion/taxes', cle: 'taxes', permission: 'CATALOGUE_GERER' },
    ],
  },
  {
    cle: 'stock',
    icone: Package,
    onglets: [
      {
        vers: '/gestion/stock',
        cle: 'stock',
        permission: ['STOCK_RECEPTIONNER', 'STOCK_AJUSTER'],
        compteur: 'stock',
      },
    ],
  },
  {
    cle: 'activite',
    icone: Activity,
    onglets: [{ vers: '/gestion/activite', cle: 'activite', permission: 'ACTIVITE_CONSULTER' }],
  },
  {
    cle: 'reglages',
    icone: Settings,
    onglets: [
      { vers: '/gestion/entreprise', cle: 'entreprise', permission: 'ETABLISSEMENT_GERER' },
      { vers: '/gestion/etablissements', cle: 'etablissements', permission: 'ETABLISSEMENT_GERER' },
      { vers: '/gestion/salles', cle: 'salles', permission: 'SALLE_GERER' },
      { vers: '/gestion/personnel', cle: 'personnel', permission: 'PERSONNEL_GERER' },
      { vers: '/gestion/tablettes', cle: 'tablettes', permission: 'APPAREIL_GERER' },
    ],
  },
]

export function ongletsVisibles(
  section: Section,
  aLaPermission: (permission: Permission) => boolean,
): Onglet[] {
  return section.onglets.filter(
    ({ permission }) =>
      permission === undefined ||
      (Array.isArray(permission) ? permission.some(aLaPermission) : aLaPermission(permission)),
  )
}

/** Les entrées du menu, chacune menant à son premier onglet visible ; sans onglet visible, pas d'entrée. */
export function sectionsVisibles(
  aLaPermission: (permission: Permission) => boolean,
): (Section & { vers: CheminGestion; visibles: Onglet[] })[] {
  return SECTIONS.flatMap((section) => {
    const visibles = ongletsVisibles(section, aLaPermission)
    const premier = visibles[0]
    return premier === undefined ? [] : [{ ...section, vers: premier.vers, visibles }]
  })
}

/** La section d'une page : celle dont un onglet est le chemin, ou son début (fiche, sous-page). */
export function sectionDe(chemin: string): Section | undefined {
  const dans = (vers: string) =>
    vers === '/gestion'
      ? chemin === '/gestion' || chemin === '/gestion/'
      : chemin === vers || chemin.startsWith(`${vers}/`)
  return SECTIONS.find((section) => section.onglets.some(({ vers }) => dans(vers)))
}

/** L'onglet de la page, pour le marquer actif sur une fiche ou une sous-page. */
export function ongletDe(chemin: string, section: Section): Onglet | undefined {
  return section.onglets.find(({ vers }) => chemin === vers || chemin.startsWith(`${vers}/`))
}
