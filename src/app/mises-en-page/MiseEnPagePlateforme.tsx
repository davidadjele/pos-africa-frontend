import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { MenuCompte } from './MenuCompte'

function classesOnglet(actif: boolean) {
  return clsx(
    'inline-flex min-h-cible-min shrink-0 items-center border-b-2 px-1 text-libelle text-encre',
    actif ? 'border-barre-fond font-bold' : 'border-transparent',
  )
}

const ONGLETS = [
  { chemin: '/plateforme/activite', cle: 'activite' },
  { chemin: '/plateforme/equipe', cle: 'equipe' },
  { chemin: '/plateforme/support', cle: 'support' },
] as const

export function MiseEnPagePlateforme() {
  const { t } = useTranslation()
  // La liste et les fiches d'entreprise forment l'onglet « Entreprises » : tout ce qui n'est pas un autre onglet.
  const ongletActif = useRouterState({
    select: (etat) =>
      ONGLETS.find(({ chemin }) => etat.location.pathname.startsWith(chemin))?.cle ?? 'entreprises',
  })
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute contexte={{ titre: t('plateforme.titreBarre') }}>
        <MenuCompte />
      </BarreHaute>
      <nav
        aria-label={t('plateforme.navigation.titre')}
        className="flex gap-6 overflow-x-auto border-b border-trait bg-surface px-4 md:px-6"
      >
        <Link
          to="/plateforme"
          aria-current={ongletActif === 'entreprises' ? 'page' : undefined}
          className={classesOnglet(ongletActif === 'entreprises')}
        >
          {t('plateforme.navigation.entreprises')}
        </Link>
        {ONGLETS.map(({ chemin, cle }) => (
          <Link
            key={cle}
            to={chemin}
            aria-current={ongletActif === cle ? 'page' : undefined}
            className={classesOnglet(ongletActif === cle)}
          >
            {t(`plateforme.navigation.${cle}`)}
          </Link>
        ))}
      </nav>
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
