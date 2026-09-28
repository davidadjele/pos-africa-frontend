import { Link, Outlet } from '@tanstack/react-router'
import { LayoutDashboard, Store, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { ETABLISSEMENT_PROVISOIRE } from '../etablissementProvisoire'

interface EntreeNavigation {
  vers: '/gestion' | '/caisse'
  cle: string
  icone: LucideIcon
}

// Les autres entrées (Ventes, Produits, Stock…) arriveront avec leurs modules : pas de lien mort.
const ENTREES: EntreeNavigation[] = [
  { vers: '/gestion', cle: 'gestion.menu.tableauDeBord', icone: LayoutDashboard },
  { vers: '/caisse', cle: 'gestion.menu.caisse', icone: Store },
]

export function MiseEnPageGestion() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute etablissement={ETABLISSEMENT_PROVISOIRE} />
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label={t('commun.navigationPrincipale')}
          className="shrink-0 border-b border-trait bg-surface md:w-58 md:border-r md:border-b-0"
        >
          <div className="hidden border-b border-trait px-4 py-4 md:block">
            <p className="m-0 text-corps-fort text-encre">{ETABLISSEMENT_PROVISOIRE.nom}</p>
            <p className="m-0 text-legende text-attenue">{ETABLISSEMENT_PROVISOIRE.quartier}</p>
          </div>
          <ul className="m-0 flex list-none gap-1 overflow-x-auto p-2 md:flex-col">
            {ENTREES.map(({ vers, cle, icone: Icone }) => (
              <li key={vers}>
                <Link
                  to={vers}
                  activeOptions={{ exact: true }}
                  className="flex min-h-cible-min items-center gap-3 whitespace-nowrap rounded-normal px-3 text-[14px] text-encre hover:bg-fond aria-[current=page]:bg-accent-doux aria-[current=page]:font-semibold aria-[current=page]:text-accent-lisible"
                >
                  <Icone aria-hidden="true" size={18} />
                  {t(cle)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
