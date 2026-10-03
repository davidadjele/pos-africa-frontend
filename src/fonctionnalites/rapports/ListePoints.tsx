import { clsx } from 'clsx'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type TonPoint = 'danger' | 'alerte' | 'info'

export interface ElementPoint {
  identifiant: string
  ton: TonPoint
  icone: LucideIcon
  titre: string
  detail: string
  /** L'action à droite, sur ordinateur : « Voir le stock ». */
  action?: string | undefined
  /** Le lien vers l'écran où l'on agit ; sans lui, la ligne s'affiche seulement. */
  lien?: ((contenu: ReactNode, className: string) => ReactNode) | undefined
}

/** Pastille pleine et vive : le niveau se lit avant le texte. */
const FONDS: Record<TonPoint, string> = {
  danger: 'bg-danger-vif text-accent-texte',
  alerte: 'bg-alerte text-encre',
  info: 'bg-info text-accent-texte',
}

/** Une liste de points à regarder, du plus grave au moins grave, chacun menant où l'on agit. */
export function ListePoints({ points, vide }: Readonly<{ points: ElementPoint[]; vide: string }>) {
  if (points.length === 0) return <p className="m-0 py-3 text-corps text-attenue">{vide}</p>
  return (
    <ul className="m-0 list-none p-0">
      {points.map((point) => {
        const Icone = point.icone
        const contenu = (
          <>
            <span
              aria-hidden="true"
              className={clsx(
                'flex size-9 shrink-0 items-center justify-center rounded-normal',
                FONDS[point.ton],
              )}
            >
              <Icone className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-corps-fort">{point.titre}</span>
              <span className="text-legende text-attenue">{point.detail}</span>
            </span>
            {point.action !== undefined && point.lien !== undefined && (
              <span className="hidden shrink-0 text-libelle font-bold sm:inline">
                {point.action}
              </span>
            )}
            {point.lien !== undefined && (
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-bordure-controle" />
            )}
          </>
        )
        const classes = 'flex min-h-cible-caisse items-center gap-3 py-2 text-encre no-underline'
        return (
          <li key={point.identifiant} className="border-b border-trait last:border-b-0">
            {point.lien === undefined ? (
              <div className={classes}>{contenu}</div>
            ) : (
              point.lien(contenu, classes)
            )}
          </li>
        )
      })}
    </ul>
  )
}
