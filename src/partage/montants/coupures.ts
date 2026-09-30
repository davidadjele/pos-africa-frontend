import type { Devise } from './formaterMontant'

/** Billets et pièces en circulation, en unités mineures (devises sans décimales). */
export interface Coupures {
  billets: number[]
  pieces: number[]
}

const PAR_DEVISE: Partial<Record<Devise, Coupures>> = {
  XOF: { billets: [10_000, 5000, 2000, 1000], pieces: [500, 250, 200, 100, 50, 25, 10, 5] },
  XAF: { billets: [10_000, 5000, 2000, 1000], pieces: [500, 100, 50, 25, 10, 5] },
  GNF: { billets: [20_000, 10_000, 5000, 2000, 1000, 500], pieces: [] },
}

/** La grille de comptage de la devise ; vide pour une devise non décrite (le total se saisit directement). */
export function coupuresDe(devise: Devise): Coupures | null {
  return PAR_DEVISE[devise] ?? null
}

/** Total d'un comptage « coupure → nombre ». */
export function totalCompte(comptage: Readonly<Record<number, number>>): number {
  return Object.entries(comptage).reduce(
    (somme, [valeur, nombre]) => somme + Number(valeur) * nombre,
    0,
  )
}
