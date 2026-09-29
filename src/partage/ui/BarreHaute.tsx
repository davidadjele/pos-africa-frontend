import type { ReactNode } from 'react'

/** Où l'on se trouve : entreprise et ville, ou espace (administration de la plateforme). */
export interface ContexteBarre {
  titre: string
  detail?: string | undefined
}

export function BarreHaute({
  contexte,
  children,
}: Readonly<{
  contexte?: ContexteBarre
  children?: ReactNode
}>) {
  return (
    <header
      data-zone="barre"
      className="flex h-barre-hauteur shrink-0 items-center gap-3 bg-barre-fond px-4 text-barre-texte sm:gap-5 sm:px-5"
    >
      <span className="text-marque uppercase">TONTI</span>
      {contexte && (
        <div className="flex min-w-0 flex-col border-l border-barre-trait pl-3 sm:pl-5">
          <span className="truncate text-libelle font-semibold">{contexte.titre}</span>
          {contexte.detail !== undefined && (
            <span className="truncate text-legende text-barre-attenue">{contexte.detail}</span>
          )}
        </div>
      )}
      {children && <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>}
    </header>
  )
}
