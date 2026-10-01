import type { Devise } from './formaterMontant'

/** Billets et pièces en circulation, en unités mineures, les plus gros d'abord. */
export interface Coupures {
  billets: number[]
  pieces: number[]
}

export type NatureCoupure = 'billet' | 'piece'

// Fixées par devise pour l'instant ; elles deviendront configurables (une coupure retirée de la circulation, une
// nouvelle émise) sans attendre une version de l'application.
const PAR_DEVISE: Partial<Record<Devise, Coupures>> = {
  // BCEAO : Bénin, Burkina Faso, Côte d'Ivoire, Guinée-Bissau, Mali, Niger, Sénégal, Togo.
  XOF: { billets: [10_000, 5000, 2000, 1000, 500], pieces: [500, 250, 200, 100, 50, 25, 10, 5, 1] },
  // BEAC : Cameroun, Centrafrique, Congo, Gabon, Guinée équatoriale, Tchad.
  XAF: { billets: [10_000, 5000, 2000, 1000, 500], pieces: [500, 100, 50, 25, 10, 5, 2, 1] },
  GNF: { billets: [20_000, 10_000, 5000, 2000, 1000, 500, 100], pieces: [50, 25, 10, 5, 1] },
  // Cedi : 100 pesewas ; naira : 100 kobo.
  GHS: {
    billets: [20_000, 10_000, 5000, 2000, 1000, 500, 200, 100],
    pieces: [200, 100, 50, 20, 10, 5, 1],
  },
  NGN: {
    billets: [100_000, 50_000, 20_000, 10_000, 5000, 2000, 1000, 500],
    pieces: [200, 100, 50],
  },
}

/** La grille de comptage de la devise ; null hors Afrique (le total se saisit directement). */
export function coupuresDe(devise: Devise): Coupures | null {
  return PAR_DEVISE[devise] ?? null
}

/** Clé d'une ligne de comptage : le billet et la pièce de 500 F se comptent à part. */
export function cleCoupure(nature: NatureCoupure, valeur: number): string {
  return `${nature}:${String(valeur)}`
}

/** Total d'un comptage « clé de coupure → nombre ». */
export function totalCompte(comptage: Readonly<Record<string, number>>): number {
  return Object.entries(comptage).reduce(
    (somme, [cle, nombre]) => somme + Number(cle.split(':')[1]) * nombre,
    0,
  )
}
