import type { ReactNode } from 'react'

/** Un chiffre clé en tête de page : son libellé, sa valeur, et ce qu'elle recouvre. */
export function Chiffre({
  libelle,
  valeur,
  sous,
}: Readonly<{ libelle: string; valeur: ReactNode; sous?: ReactNode }>) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-moyen border border-trait bg-surface px-4 py-3">
      <span className="text-legende font-semibold text-attenue">{libelle}</span>
      <span className="chiffres text-montant-total text-encre">{valeur}</span>
      {sous !== undefined && <span className="text-legende text-attenue">{sous}</span>}
    </div>
  )
}
