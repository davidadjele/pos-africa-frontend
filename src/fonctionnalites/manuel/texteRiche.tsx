import type { ReactNode } from 'react'

/** Seul enrichissement du manuel : un libellé de l'interface entre doubles astérisques passe en gras. */
export function texteRiche(texte: string): ReactNode[] {
  // Avec une parenthèse capturante, `split` alterne texte simple (rangs pairs) et libellés (rangs impairs).
  return texte
    .split(/\*\*(.+?)\*\*/)
    .map((morceau, rang) =>
      rang % 2 === 1 ? <strong key={`${morceau}-${String(rang)}`}>{morceau}</strong> : morceau,
    )
}
