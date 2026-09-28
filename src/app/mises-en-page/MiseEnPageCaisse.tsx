import { Link, Outlet } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { ETABLISSEMENT_PROVISOIRE } from '../etablissementProvisoire'

export function MiseEnPageCaisse() {
  const { t } = useTranslation()
  return (
    <div className="flex h-dvh flex-col bg-fond">
      <BarreHaute etablissement={ETABLISSEMENT_PROVISOIRE}>
        <Link
          to="/gestion"
          className="inline-flex min-h-cible-min items-center gap-2 rounded-normal border border-barre-trait px-3 text-libelle text-barre-texte hover:bg-barre-trait"
        >
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
