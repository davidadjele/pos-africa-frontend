import type { CheminGestion } from '../../app/mises-en-page/navigationGestion'
import { ardoise } from './contenu/ardoise'
import { cloturerLaCaisse } from './contenu/cloturerLaCaisse'
import { depannage } from './contenu/depannage'
import { ecranCuisine } from './contenu/ecranCuisine'
import { encaisser } from './contenu/encaisser'
import { laCarte } from './contenu/laCarte'
import { optionsEtVariantes } from './contenu/optionsEtVariantes'
import { ouvrirSaCaisse } from './contenu/ouvrirSaCaisse'
import { partagerLAddition } from './contenu/partagerLAddition'
import { personnel } from './contenu/personnel'
import { premierJour } from './contenu/premierJour'
import { prendreUneCommande } from './contenu/prendreUneCommande'
import { rembourser } from './contenu/rembourser'
import { remisesEtAnnulations } from './contenu/remisesEtAnnulations'
import { sallesEtTables } from './contenu/sallesEtTables'
import { stock } from './contenu/stock'
import { suivreLesVentes } from './contenu/suivreLesVentes'
import { tablettes } from './contenu/tablettes'

export type IdGuide =
  | 'premier-jour'
  | 'personnel'
  | 'tablettes'
  | 'la-carte'
  | 'options-et-variantes'
  | 'salles-et-tables'
  | 'stock'
  | 'suivre-les-ventes'
  | 'ouvrir-sa-caisse'
  | 'prendre-une-commande'
  | 'remises-et-annulations'
  | 'encaisser'
  | 'partager-l-addition'
  | 'ardoise'
  | 'rembourser'
  | 'cloturer-la-caisse'
  | 'ecran-cuisine'
  | 'depannage'

export type RoleGuide = 'gestion' | 'caisse' | 'cuisine' | 'depannage'

/** Une capture de `public/manuel/`, régénérée par `npm run manuel:captures`. */
export interface Capture {
  /** Chemin sans extension sous `public/manuel/` : « encaisser/mobile-money ». */
  fichier: string
  /** Ce que montre l'écran, pour qui ne le voit pas. */
  legende: string
}

export interface Etape {
  /** Quelques mots, repris dans le sommaire et la liste du premier jour. */
  titre: string
  /** Le geste ; un libellé de l'interface s'écrit **ainsi**. */
  texte: string
  capture?: Capture
}

export interface Guide {
  id: IdGuide
  titre: string
  role: RoleGuide
  /** Qui s'en sert : « Caissier », « Gérant »… */
  pour: string[]
  /** Ce que le guide permet de faire, en une phrase. */
  objectif: string
  /** Un cas réel, avec les données des captures. */
  exemple: string
  etapes: Etape[]
  bonASavoir: string[]
  problemes: { question: string; reponse: string }[]
  suivant?: IdGuide
}

/** Dans l'ordre du sommaire : celui où l'on découvre Tonti, rôle par rôle. */
export const GUIDES: Guide[] = [
  premierJour,
  personnel,
  tablettes,
  laCarte,
  optionsEtVariantes,
  sallesEtTables,
  stock,
  suivreLesVentes,
  ouvrirSaCaisse,
  prendreUneCommande,
  remisesEtAnnulations,
  encaisser,
  partagerLAddition,
  ardoise,
  rembourser,
  cloturerLaCaisse,
  ecranCuisine,
  depannage,
]

/** L'ordre du sommaire ; l'accueil n'a une carte que pour les trois rôles, le dépannage a son encadré. */
export const ROLES: RoleGuide[] = ['gestion', 'caisse', 'cuisine', 'depannage']

export function trouverGuide(id: string): Guide | undefined {
  return GUIDES.find((guide) => guide.id === id)
}

/** Le guide de chaque page du menu de gestion : le type oblige à en choisir un pour toute nouvelle page. */
const GUIDE_DES_PAGES: Record<CheminGestion, IdGuide> = {
  '/gestion': 'suivre-les-ventes',
  '/caisse': 'prendre-une-commande',
  '/gestion/activite': 'suivre-les-ventes',
  '/gestion/produits': 'la-carte',
  '/gestion/carte-etablissement': 'la-carte',
  '/gestion/taxes': 'la-carte',
  '/gestion/options': 'options-et-variantes',
  '/gestion/etablissements': 'premier-jour',
  '/gestion/salles': 'salles-et-tables',
  '/gestion/personnel': 'personnel',
  '/gestion/tablettes': 'tablettes',
  '/gestion/stock': 'stock',
  '/gestion/ventes': 'suivre-les-ventes',
  '/gestion/caisses': 'suivre-les-ventes',
  '/gestion/ardoises': 'ardoise',
  '/gestion/entreprise': 'premier-jour',
}

/** Le guide à ouvrir depuis un écran : le bouton « Aide » mène directement à ce qu'on est en train de faire. */
export function guideDe(chemin: string): IdGuide {
  if (/^\/caisse\/notes\/[^/]+\/encaisser/.test(chemin)) return 'encaisser'
  if (chemin.startsWith('/caisse/tiroir')) return 'cloturer-la-caisse'
  if (chemin.startsWith('/cuisine')) return 'ecran-cuisine'
  // Le chemin le plus long d'abord : « /gestion/produits/7a00 » relève de « /gestion/produits », pas de « /gestion ».
  const page = (Object.keys(GUIDE_DES_PAGES) as CheminGestion[])
    .sort((a, b) => b.length - a.length)
    .find((vers) => chemin === vers || chemin.startsWith(`${vers}/`))
  return page === undefined ? 'premier-jour' : GUIDE_DES_PAGES[page]
}

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Les guides dont le titre, l'objectif, l'exemple ou une étape contient la recherche. */
export function chercherGuides(recherche: string): Guide[] {
  const cherche = normaliser(recherche)
  if (cherche === '') return GUIDES
  return GUIDES.filter((guide) =>
    normaliser(
      [
        guide.titre,
        guide.objectif,
        guide.exemple,
        ...guide.etapes.flatMap((etape) => [etape.titre, etape.texte]),
      ].join(' '),
    ).includes(cherche),
  )
}
