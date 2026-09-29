import type { CategorieResume, ProduitResume, TaxeResume } from '../../partage/api/contrat'

export const TVA: TaxeResume = {
  id: '7a000000-0000-4000-8000-000000000001',
  nom: 'TVA',
  tauxPointsDeBase: 1800,
  active: true,
  nbProduits: 2,
  version: 0,
}

export const GRILLADES: CategorieResume = {
  id: 'ca000000-0000-4000-8000-000000000001',
  nom: 'Grillades',
  couleur: 'OCRE',
  ordre: 1,
  active: true,
  nbProduits: 1,
  version: 0,
}

export const BIERES: CategorieResume = {
  id: 'ca000000-0000-4000-8000-000000000002',
  nom: 'Bières',
  couleur: 'FEUILLE',
  ordre: 2,
  active: true,
  nbProduits: 1,
  version: 0,
}

export const POULET: ProduitResume = {
  id: 'b0000000-0000-4000-8000-000000000001',
  nom: 'Poulet braisé',
  type: 'PLAT',
  prix: 4500,
  suiviStock: false,
  actif: true,
  version: 0,
  categorie: { id: GRILLADES.id, nom: GRILLADES.nom, couleur: GRILLADES.couleur },
  taxe: { id: TVA.id, nom: TVA.nom, tauxPointsDeBase: TVA.tauxPointsDeBase },
}

export const FLAG: ProduitResume = {
  id: 'b0000000-0000-4000-8000-000000000002',
  nom: 'Flag 65 cl',
  type: 'BOISSON',
  prix: 1000,
  suiviStock: true,
  actif: true,
  version: 2,
  categorie: { id: BIERES.id, nom: BIERES.nom, couleur: BIERES.couleur },
  taxe: { id: TVA.id, nom: TVA.nom, tauxPointsDeBase: TVA.tauxPointsDeBase },
}
