import type { ModePaiement, ModeRemboursable } from '../../partage/api/contrat'

export interface PartRendue {
  mode: ModePaiement
  montant: number
}

/** Le même ordre que le serveur : l'ardoise (rien ne sort de la caisse), la carte, le Mobile Money, les espèces. */
export const ORDRE_REMBOURSEMENT: ModePaiement[] = ['ARDOISE', 'CARTE', 'MOBILE_MONEY', 'ESPECES']

/** Comment le montant se rendra entre les modes de la note ; null si elle ne permet pas de rendre autant. */
export function repartirRemboursement(
  montant: number,
  modes: readonly Pick<ModeRemboursable, 'mode' | 'remboursable'>[],
): PartRendue[] | null {
  const parts: PartRendue[] = []
  let reste = montant
  for (const mode of ORDRE_REMBOURSEMENT) {
    const part = Math.min(
      reste,
      modes.find((candidat) => candidat.mode === mode)?.remboursable ?? 0,
    )
    if (part > 0) {
      parts.push({ mode, montant: part })
      reste -= part
    }
  }
  return reste > 0 ? null : parts
}
