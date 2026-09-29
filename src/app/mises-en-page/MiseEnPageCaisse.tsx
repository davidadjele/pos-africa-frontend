import { useQuery } from '@tanstack/react-query'
import { Link, Outlet } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { requeteAppareil } from '../../fonctionnalites/tablette/requetes'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { CLASSES_CONTROLE_BARRE } from './MenuCompte'

/** Caisse plein écran d'une tablette enregistrée : la barre dit où l'on est (établissement, caisse). */
export function MiseEnPageCaisse() {
  const { t } = useTranslation()
  const { data: appareil } = useQuery(requeteAppareil)
  return (
    <div className="flex h-dvh flex-col bg-fond">
      <BarreHaute
        {...(appareil
          ? {
              contexte: {
                titre: appareil.entreprise.nom,
                detail: `${appareil.etablissement.nom}, ${appareil.nom}`,
              },
            }
          : {})}
      >
        <Link to="/gestion" className={CLASSES_CONTROLE_BARRE}>
          <LayoutDashboard aria-hidden="true" size={18} />
          {t('commun.gestion')}
        </Link>
      </BarreHaute>
      <main className="min-h-0 flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}
