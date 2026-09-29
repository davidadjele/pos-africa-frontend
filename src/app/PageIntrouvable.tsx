import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { classesBouton } from '../partage/ui/Bouton'
import { BarreHaute } from '../partage/ui/BarreHaute'
import { EtatVide } from '../partage/ui/EtatVide'

export function PageIntrouvable() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute />
      <main className="p-4 md:p-6">
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            niveauTitre={1}
            titre={t('introuvable.titre')}
            phrase={t('introuvable.phrase', { chemin: pathname })}
            action={
              <Link to="/caisse" className={classesBouton('principal')}>
                {t('introuvable.retour')}
              </Link>
            }
          />
        </section>
      </main>
    </div>
  )
}
