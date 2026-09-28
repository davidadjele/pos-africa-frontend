import type { ReactNode } from 'react'

export function EtatVide({
  titre,
  phrase,
  action,
  niveauTitre = 2,
}: {
  titre: string
  phrase: ReactNode
  /** Une seule action, celle qui fait sortir de l'état vide. */
  action?: ReactNode
  niveauTitre?: 1 | 2 | 3
}) {
  const Titre = `h${String(niveauTitre)}` as 'h1' | 'h2' | 'h3'
  return (
    <div className="flex max-w-xl flex-col items-start gap-2">
      <Titre className="m-0 text-titre-carte text-encre">{titre}</Titre>
      <p className="m-0 text-corps text-attenue">{phrase}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
