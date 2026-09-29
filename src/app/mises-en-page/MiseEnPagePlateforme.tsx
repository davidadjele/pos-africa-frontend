import { Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { MenuCompte } from './MenuCompte'

export function MiseEnPagePlateforme() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute contexte={{ titre: t('plateforme.titreBarre') }}>
        <MenuCompte />
      </BarreHaute>
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
