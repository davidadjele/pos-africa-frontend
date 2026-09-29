import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AlerteErreur } from '../partage/ui/Alerte'
import { BarreHaute } from '../partage/ui/BarreHaute'
import { Bouton } from '../partage/ui/Bouton'

/** Panne au chargement d'un écran : jamais présentée comme un état vide. */
export function PageErreur({ error }: ErrorComponentProps) {
  const { t } = useTranslation()
  const routeur = useRouter()
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 md:p-6">
        <h1 className="m-0 text-titre-page text-encre">{t('erreurPage.titre')}</h1>
        <AlerteErreur erreur={error} />
        <div>
          <Bouton icone={RotateCw} onClick={() => void routeur.invalidate()}>
            {t('commun.reessayer')}
          </Bouton>
        </div>
      </main>
    </div>
  )
}
