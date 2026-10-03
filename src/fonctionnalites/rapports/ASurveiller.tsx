import { Link } from '@tanstack/react-router'
import { NotebookPen, Percent, RotateCcw, Undo2, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ListePoints } from './ListePoints'
import type { CleVigilance, PointVigilance } from './vigilance'

const ICONES: Record<CleVigilance, LucideIcon> = {
  remboursements: RotateCcw,
  annulations: Undo2,
  remises: Percent,
  ardoise: NotebookPen,
}

/** Où regarder ensuite : l'activité pour ce qui a été fait sur les notes, les ardoises pour le crédit. */
const DESTINATIONS: Record<CleVigilance, '/gestion/activite' | '/gestion/ardoises'> = {
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
      <ListePoints
        vide={t('rapports.vigilance.rien')}
        points={points.map((point) => {
          const valeurs = formater(point)
          return {
            identifiant: point.cle,
            ton: point.ton,
            icone: ICONES[point.cle],
            titre: t(`rapports.vigilance.${point.cle}.titre`, valeurs),
            detail: t(`rapports.vigilance.${point.cle}.detail`, valeurs),
            lien: (contenu, className) => (
              <Link to={DESTINATIONS[point.cle]} className={className}>
                {contenu}
              </Link>
            ),
          }
        })}
      />
    </section>
  )
}
