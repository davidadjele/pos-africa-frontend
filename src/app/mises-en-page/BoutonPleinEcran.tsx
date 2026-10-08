import { Maximize, Minimize } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePleinEcran } from '../../partage/ui/usePleinEcran'
import { CLASSES_CONTROLE_BARRE } from './MenuCompte'

/** Masque le navigateur sur la tablette de caisse ou de cuisine ; absent là où le navigateur ne le permet pas. */
export function BoutonPleinEcran() {
  const { t } = useTranslation()
  const { disponible, actif, basculer } = usePleinEcran()
  if (!disponible) return null
  const Icone = actif ? Minimize : Maximize
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={t('commun.pleinEcran')}
      className={CLASSES_CONTROLE_BARRE}
      onClick={() => void basculer()}
    >
      <Icone aria-hidden="true" size={18} />
      {/* Sur téléphone, l'icône seule : la barre garde la place de la marque. */}
      <span className="hidden sm:inline">
        {actif ? t('commun.quitterPleinEcran') : t('commun.pleinEcran')}
      </span>
    </button>
  )
}
