import type { ReactNode } from 'react'
import { BarreHaute } from '../../partage/ui/BarreHaute'

/** Écrans d'entrée (connexion, choix d'entreprise, inscription) : une colonne lisible sur téléphone. */
export function MiseEnPageEntree({
  titre,
  phrase,
  largeur = 'etroite',
  children,
}: Readonly<{
  titre: string
  phrase?: string
  largeur?: 'etroite' | 'large'
  children: ReactNode
}>) {
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute />
      <main
        className={`mx-auto flex w-full flex-col gap-6 px-4 py-8 md:py-12 ${largeur === 'large' ? 'max-w-3xl' : 'max-w-md'}`}
      >
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-titre-page text-encre">{titre}</h1>
          {phrase !== undefined && <p className="m-0 text-corps text-attenue">{phrase}</p>}
        </div>
        {children}
      </main>
    </div>
  )
}
