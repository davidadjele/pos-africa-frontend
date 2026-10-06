import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Bouton } from '../partage/ui/Bouton'

// Mise à jour à la demande (registerType « prompt ») : recharger d'office pourrait interrompre
// un encaissement en cours.
export function BandeauMiseAJour() {
  const { t } = useTranslation()
  const {
    needRefresh: [nouvelleVersion],
    updateServiceWorker,
  } = useRegisterSW()

  if (!nouvelleVersion) return null
  return (
    <div
      role="status"
      // Au-dessus du menu latéral fixe (z-20), sous les dialogues (z-40) : il n'interrompt pas un encaissement.
      className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-between gap-2 border-t border-trait bg-surface px-4 py-2"
    >
      <p className="m-0 text-corps text-encre">{t('miseAJour.message')}</p>
      <Bouton onClick={() => void updateServiceWorker(true)}>{t('miseAJour.recharger')}</Bouton>
    </div>
  )
}
