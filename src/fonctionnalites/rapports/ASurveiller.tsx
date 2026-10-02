import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import {
  ChevronRight,
  NotebookPen,
  Percent,
  RotateCcw,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CleVigilance, PointVigilance, TonVigilance } from './vigilance'

const ICONES: Record<CleVigilance, LucideIcon> = {
  ecarts: Wallet,
  remboursements: RotateCcw,
  annulations: Undo2,
  remises: Percent,
  ardoise: NotebookPen,
}

/** Pastille pleine et vive : le niveau se lit avant le texte. */
const FONDS: Record<TonVigilance, string> = {
  danger: 'bg-danger-vif text-accent-texte',
  alerte: 'bg-alerte text-encre',
  info: 'bg-info text-accent-texte',
}

/** Où regarder ensuite : les caisses pour un écart, l'activité pour le reste. */
const DESTINATIONS: Record<
  CleVigilance,
  '/gestion/caisses' | '/gestion/activite' | '/gestion/ardoises'
> = {
  ecarts: '/gestion/caisses',
  remboursements: '/gestion/activite',
  annulations: '/gestion/activite',
  remises: '/gestion/activite',
  ardoise: '/gestion/ardoises',
}

export function ASurveiller({
  points,
  formater,
}: Readonly<{
  points: PointVigilance[]
  /** Formate les montants des valeurs (« −2 100 ») ; les autres valeurs passent telles quelles. */
  formater: (point: PointVigilance) => Record<string, string | number>
}>) {
  const { t } = useTranslation()
  return (
    <section
      aria-label={t('rapports.vigilance.titre')}
      className="flex flex-col rounded-moyen border border-trait bg-surface px-4 py-3"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-titre-carte text-encre">{t('rapports.vigilance.titre')}</h2>
        <span className="chiffres text-corps text-attenue">{points.length}</span>
      </div>
      {points.length === 0 ? (
        <p className="m-0 py-3 text-corps text-attenue">{t('rapports.vigilance.rien')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {points.map((point) => {
            const Icone = ICONES[point.cle]
            const valeurs = formater(point)
            return (
              <li key={point.cle} className="border-b border-trait last:border-b-0">
                <Link
                  to={DESTINATIONS[point.cle]}
                  className="flex min-h-cible-caisse items-center gap-3 py-2 text-encre no-underline"
                >
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
                    <span className="text-corps-fort">
                      {t(`rapports.vigilance.${point.cle}.titre`, valeurs)}
                    </span>
                    <span className="text-legende text-attenue">
                      {t(`rapports.vigilance.${point.cle}.detail`, valeurs)}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-bordure-controle"
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
