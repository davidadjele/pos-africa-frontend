import { Link, Outlet } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../partage/auth/useSession'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { CLASSES_CONTROLE_BARRE } from './MenuCompte'

export function MiseEnPageCaisse() {
  const { t } = useTranslation()
  const { moi } = useSession()
  const entreprise = moi?.entrepriseCourante
  return (
    <div className="flex h-dvh flex-col bg-fond">
      <BarreHaute {...(entreprise ? { contexte: { titre: entreprise.nom } } : {})}>
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
