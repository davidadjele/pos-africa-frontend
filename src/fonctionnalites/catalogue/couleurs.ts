import type { CouleurCategorie } from '../../partage/api/contrat'

/** Classes écrites en entier : Tailwind ne génère que celles qu'il trouve telles quelles dans le code. */
export const COULEURS_CATEGORIE: Record<
  CouleurCategorie,
  { fond: string; texte: string; bord: string }
> = {
  OCRE: {
    fond: 'bg-categorie-ocre-fond',
    texte: 'text-categorie-ocre-texte',
    bord: 'border-categorie-ocre-texte',
  },
  BRIQUE: {
    fond: 'bg-categorie-brique-fond',
    texte: 'text-categorie-brique-texte',
    bord: 'border-categorie-brique-texte',
  },
  FEUILLE: {
    fond: 'bg-categorie-feuille-fond',
    texte: 'text-categorie-feuille-texte',
    bord: 'border-categorie-feuille-texte',
  },
  LAGUNE: {
    fond: 'bg-categorie-lagune-fond',
    texte: 'text-categorie-lagune-texte',
    bord: 'border-categorie-lagune-texte',
  },
  PRUNE: {
    fond: 'bg-categorie-prune-fond',
    texte: 'text-categorie-prune-texte',
    bord: 'border-categorie-prune-texte',
  },
  SABLE: {
    fond: 'bg-categorie-sable-fond',
    texte: 'text-categorie-sable-texte',
    bord: 'border-categorie-sable-texte',
  },
  MENTHE: {
    fond: 'bg-categorie-menthe-fond',
    texte: 'text-categorie-menthe-texte',
    bord: 'border-categorie-menthe-texte',
  },
  ARDOISE: {
    fond: 'bg-categorie-ardoise-fond',
    texte: 'text-categorie-ardoise-texte',
    bord: 'border-categorie-ardoise-texte',
  },
}

export const PALETTE: CouleurCategorie[] = [
  'OCRE',
  'BRIQUE',
  'FEUILLE',
  'LAGUNE',
  'PRUNE',
  'SABLE',
  'MENTHE',
  'ARDOISE',
]
