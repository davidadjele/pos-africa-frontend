import type {
  CommandeDetail,
  LigneNote,
  LigneCarteEtablissement,
  NoteOuverte,
  PlanDeSalle,
} from '../src/partage/api/contrat'

export const BIERES = {
  id: 'ca000000-0000-4000-8000-000000000002',
  nom: 'Bières',
  couleur: 'FEUILLE',
  ordre: 1,
} as const
export const GRILLADES = {
  id: 'ca000000-0000-4000-8000-000000000001',
  nom: 'Grillades',
  couleur: 'OCRE',
  ordre: 2,
} as const

export const FLAG: LigneCarteEtablissement = {
  produitId: 'b0000000-0000-4000-8000-000000000002',
  nom: 'Flag 65 cl',
  type: 'BOISSON',
  categorie: BIERES,
  prixBase: 1000,
  prix: 1200,
  prixPropre: true,
  nomTaxe: 'TVA',
  tauxTaxePointsDeBase: 1800,
  propose: true,
  epuise: false,
}
export const POULET: LigneCarteEtablissement = {
  ...FLAG,
  produitId: 'b0000000-0000-4000-8000-000000000001',
  nom: 'Poulet braisé',
  type: 'PLAT',
  categorie: GRILLADES,
  prixBase: 4500,
  prix: 4500,
  prixPropre: false,
}

export const NOTE_T4_RESUME: NoteOuverte = {
  id: 'c0000000-0000-4000-8000-000000000042',
  numero: 42,
  canal: 'SUR_PLACE',
  total: 13500,
  serveur: 'Kossi A.',
  mienne: true,
  couverts: 3,
  ouverteLe: '2026-09-29T18:55:00Z',
  aEnvoyer: 2,
}
export const NOTE_COMPTOIR: NoteOuverte = {
  id: 'c0000000-0000-4000-8000-000000000043',
  numero: 43,
  canal: 'COMPTOIR',
  total: 1500,
  serveur: 'Essi D.',
  mienne: false,
  ouverteLe: '2026-09-29T20:37:00Z',
  aEnvoyer: 0,
}

export const TERRASSE_ID = '5a000000-0000-4000-8000-000000000001'
export const T1_ID = '7a000000-0000-4000-8000-000000000001'
export const T4_ID = '7a000000-0000-4000-8000-000000000004'
export const T7_ID = '7a000000-0000-4000-8000-000000000007'

export const PLAN: PlanDeSalle = {
  salles: [
    {
      id: TERRASSE_ID,
      nom: 'Terrasse',
      tables: [
        { id: T1_ID, nom: 'T1', places: 4 },
        { id: T4_ID, nom: 'T4', places: 4, note: NOTE_T4_RESUME },
        {
          id: T7_ID,
          nom: 'T7',
          places: 2,
          note: {
            ...NOTE_T4_RESUME,
            id: 'c0000000-0000-4000-8000-000000000041',
            numero: 41,
            total: 4000,
            serveur: 'Essi D.',
            mienne: false,
            couverts: 2,
            aEnvoyer: 0,
          },
        },
      ],
    },
    {
      id: '5a000000-0000-4000-8000-000000000002',
      nom: 'Bar',
      tables: [{ id: '7a000000-0000-4000-8000-000000000011', nom: 'B1', places: 2 }],
    },
  ],
  sansTable: [NOTE_COMPTOIR],
}

export const FLAG_ENVOYE: LigneNote = {
  id: '1e000000-0000-4000-8000-000000000001',
  produitId: FLAG.produitId,
  nomProduit: 'Flag 65 cl',
  prixUnitaire: 1200,
  quantite: 1,
  statut: 'ENVOYEE',
  ajouteePar: 'Kossi A.',
  envoyeeLe: '2026-09-29T19:02:00Z',
  montant: 1200,
  montantBrut: 1200,
  remise: 0,
  offert: false,
}

export const POULET_A_ENVOYER: LigneNote = {
  id: '1e000000-0000-4000-8000-000000000002',
  produitId: POULET.produitId,
  nomProduit: 'Poulet braisé',
  prixUnitaire: 4500,
  quantite: 2,
  statut: 'BROUILLON',
  ajouteePar: 'Kossi A.',
  montant: 9000,
  montantBrut: 9000,
  remise: 0,
  offert: false,
}

/** T4 : un Flag envoyé en cuisine plus tôt, deux poulets pas encore envoyés. */
export const NOTE_T4: CommandeDetail = {
  id: NOTE_T4_RESUME.id,
  numero: 42,
  canal: 'SUR_PLACE',
  statut: 'OUVERTE',
  table: { id: T4_ID, nom: 'T4', salle: 'Terrasse' },
  couverts: 3,
  serveur: 'Kossi A.',
  mienne: true,
  ouverteLe: '2026-09-29T18:55:00Z',
  lignes: [FLAG_ENVOYE, POULET_A_ENVOYER],
  total: 10200,
  sousTotal: 10200,
  remises: 0,
  articles: 3,
  taxes: [{ nom: 'TVA', tauxPointsDeBase: 1800, montant: 1556 }],
  version: 3,
}

export const NOTE_VIDE: CommandeDetail = {
  id: 'c0000000-0000-4000-8000-000000000044',
  numero: 44,
  canal: 'COMPTOIR',
  statut: 'OUVERTE',
  serveur: 'Kossi A.',
  mienne: true,
  ouverteLe: '2026-09-29T20:39:00Z',
  lignes: [],
  total: 0,
  sousTotal: 0,
  remises: 0,
  articles: 0,
  taxes: [],
  version: 0,
}
