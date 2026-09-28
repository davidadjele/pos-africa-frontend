import { useTranslation } from 'react-i18next'
import { EtatVide } from '../../partage/ui/EtatVide'

export function EcranCaisse() {
  const { t } = useTranslation()
  return (
    <section className="rounded-moyen border border-trait bg-surface p-6">
      <EtatVide niveauTitre={1} titre={t('caisse.vide.titre')} phrase={t('caisse.vide.phrase')} />
    </section>
  )
}
