import { useTranslation } from 'react-i18next'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { EtatVide } from '../../partage/ui/EtatVide'

export function PageRecu({ jeton }: Readonly<{ jeton: string }>) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute />
      <main className="mx-auto w-full max-w-md p-4">
        <article className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide niveauTitre={1} titre={t('recu.titre')} phrase={t('recu.phrase')} />
          <dl className="m-0 mt-6 flex items-baseline justify-between gap-4 border-t border-trait pt-4">
            <dt className="text-libelle text-attenue">{t('recu.reference')}</dt>
            <dd className="m-0 chiffres text-montant-ligne break-all text-encre">{jeton}</dd>
          </dl>
        </article>
      </main>
    </div>
  )
}
