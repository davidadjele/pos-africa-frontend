import type { ReactNode } from 'react'

export interface Etablissement {
  nom: string
  quartier: string
}

export function BarreHaute({
  etablissement,
  children,
}: {
  etablissement?: Etablissement
  children?: ReactNode
}) {
  return (
    <header
      data-zone="barre"
      className="flex h-barre-hauteur shrink-0 items-center gap-5 bg-barre-fond px-5 text-barre-texte"
    >
      <span className="text-marque uppercase">TONTI</span>
      {etablissement && (
        <div className="flex min-w-0 flex-col border-l border-barre-trait pl-5">
          <span className="truncate text-libelle font-semibold">{etablissement.nom}</span>
          <span className="truncate text-legende text-barre-attenue">{etablissement.quartier}</span>
        </div>
      )}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </header>
  )
}
