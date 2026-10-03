import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { MenuCompte } from './MenuCompte'

function classesOnglet(actif: boolean) {
  return clsx(
    'inline-flex min-h-cible-min items-center border-b-2 px-1 text-libelle text-encre',
    actif ? 'border-barre-fond font-bold' : 'border-transparent',
  )
}

export function MiseEnPagePlateforme() {
  const { t } = useTranslation()
  // La liste et les fiches d'entreprise forment un même onglet ; le support est à part.
  const enSupport = useRouterState({
    select: (etat) => etat.location.pathname.startsWith('/plateforme/support'),
  })
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute contexte={{ titre: t('plateforme.titreBarre') }}>
        <MenuCompte />
      </BarreHaute>
      <nav
        aria-label={t('plateforme.navigation.titre')}
        className="flex gap-6 border-b border-trait bg-surface px-4 md:px-6"
      >
        <Link
          to="/plateforme"
          aria-current={enSupport ? undefined : 'page'}
          className={classesOnglet(!enSupport)}
        >
          {t('plateforme.navigation.entreprises')}
        </Link>
        <Link
          to="/plateforme/support"
          aria-current={enSupport ? 'page' : undefined}
          className={classesOnglet(enSupport)}
        >
          {t('plateforme.navigation.support')}
        </Link>
      </nav>
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
