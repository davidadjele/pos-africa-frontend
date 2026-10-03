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
  { chemin: '/plateforme/tableau-de-bord', cle: 'tableau' },
  { chemin: '/plateforme', cle: 'entreprises' },
  { chemin: '/plateforme/activite', cle: 'activite' },
  { chemin: '/plateforme/equipe', cle: 'equipe' },
  { chemin: '/plateforme/support', cle: 'support' },
] as const

/** « Entreprises » couvre la liste et les fiches : tout ce qu'aucun autre onglet ne revendique. */
function ongletDe(chemin: string): (typeof ONGLETS)[number]['cle'] {
  return (
    ONGLETS.find((onglet) => onglet.cle !== 'entreprises' && chemin.startsWith(onglet.chemin))
      ?.cle ?? 'entreprises'
  )
}

export function MiseEnPagePlateforme() {
  const { t } = useTranslation()
  const ongletActif = useRouterState({ select: (etat) => ongletDe(etat.location.pathname) })
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute contexte={{ titre: t('plateforme.titreBarre') }}>
        <MenuCompte />
      </BarreHaute>
      <nav
        aria-label={t('plateforme.navigation.titre')}
        className="flex gap-6 overflow-x-auto border-b border-trait bg-surface px-4 md:px-6"
      >
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
