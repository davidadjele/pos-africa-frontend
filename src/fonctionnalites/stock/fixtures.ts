import type { EtablissementResume, EtatStock, LigneStock } from '../../partage/api/contrat'

export const BE_KPOTA: EtablissementResume = {
  id: '9a1f0c2e-0000-4b8e-8f6a-000000000001',
  code: 'BE',
  nom: 'Bè Kpota',
  ville: 'Lomé',
  fuseauHoraire: 'Africa/Lome',
  delaiVerrouillageMinutes: 3,
  actif: true,
  version: 0,
}

export const CASTEL: LigneStock = {
  produitId: 'b0000000-0000-4000-8000-000000000011',
  nom: 'Castel 65 cl',
  categorie: 'Bières',
  quantite: -2,
  seuil: 24,
  etat: 'NEGATIF',
  dernierMouvement: {
    id: 'd0000000-0000-4000-8000-000000000001',
    type: 'VENTE',
    quantite: -1,
    quantiteApres: -2,
    par: 'Kossi A.',
    le: '2026-10-01T20:12:00Z',
  },
}
export const FLAG: LigneStock = {
  produitId: 'b0000000-0000-4000-8000-000000000012',
  nom: 'Flag 65 cl',
  categorie: 'Bières',
  quantite: 3,
  seuil: 24,
  etat: 'FAIBLE',
  dernierMouvement: {
    id: 'd0000000-0000-4000-8000-000000000002',
    type: 'RECEPTION',
    quantite: 24,
    quantiteApres: 27,
    reference: 'BL 2231',
    par: 'Afi M.',
    le: '2026-10-01T10:15:00Z',
  },
}
export const YOUKI: LigneStock = {
  produitId: 'b0000000-0000-4000-8000-000000000013',
  nom: 'Youki 35 cl',
  categorie: 'Sucreries',
  quantite: 40,
  seuil: 24,
  etat: 'EN_STOCK',
}
export const EAU: LigneStock = {
  produitId: 'b0000000-0000-4000-8000-000000000014',
  nom: 'Eau minérale 1,5 L',
  categorie: 'Eaux',
  seuil: 0,
  etat: 'A_COMPTER',
}

export const STOCK: EtatStock = { politique: 'SOUPLE', lignes: [YOUKI, FLAG, EAU, CASTEL] }
