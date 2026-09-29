import { useTranslation } from 'react-i18next'
import { EtatVide } from '../../partage/ui/EtatVide'

export function TableauDeBord() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-titre-page text-encre">{t('gestion.tableauDeBord.titre')}</h1>
      <section className="rounded-moyen border border-trait bg-surface p-6">
        <EtatVide
          titre={t('gestion.tableauDeBord.vide.titre')}
          phrase={t('gestion.tableauDeBord.vide.phrase')}
        />
      </section>
    </div>
  )
}
