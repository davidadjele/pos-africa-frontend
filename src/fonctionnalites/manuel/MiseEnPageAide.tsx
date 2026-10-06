import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CLASSES_CONTROLE_BARRE } from '../../app/mises-en-page/MenuCompte'
import { BarreHaute } from '../../partage/ui/BarreHaute'

/**
 * L'aide se lit sans session, depuis la caisse, la cuisine ou la gestion : « Retour » ramène à l'écran
 * d'où l'on vient, une caisse comprise, plutôt qu'à une page d'accueil qui demanderait une connexion.
 */
export function MiseEnPageAide({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useTranslation()
  const routeur = useRouter()
  const peutRevenir = useCanGoBack()
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute contexte={{ titre: t('aide.titre') }}>
        {peutRevenir ? (
          <button
            type="button"
            className={CLASSES_CONTROLE_BARRE}
            onClick={() => {
              routeur.history.back()
            }}
          >
            <ArrowLeft aria-hidden="true" size={18} />
            {t('aide.retour')}
          </button>
        ) : (
          <Link to="/" className={CLASSES_CONTROLE_BARRE}>
            <ArrowLeft aria-hidden="true" size={18} />
            {t('aide.retour')}
          </Link>
        )}
      </BarreHaute>
      {children}
    </div>
  )
}
