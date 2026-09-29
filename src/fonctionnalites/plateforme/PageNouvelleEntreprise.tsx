import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { EntrepriseCreee } from '../../partage/api/contrat'
import { classesBouton } from '../../partage/ui/Bouton'
import { demandeDepuis, FormulaireEntreprise } from '../entreprises/FormulaireEntreprise'

export function PageNouvelleEntreprise() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const clientRequetes = useQueryClient()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-2">
        <Link
          to="/plateforme"
          className="inline-flex min-h-cible-min items-center gap-1 text-libelle text-accent-lisible hover:underline"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          {t('plateforme.nouvelle.retour')}
        </Link>
        <h1 className="m-0 text-titre-page text-encre">{t('plateforme.nouvelle.titre')}</h1>
      </div>
      <FormulaireEntreprise
        mode="plateforme"
        libelleEnvoyer={t('formulaireEntreprise.creer')}
        actionSecondaire={
          <Link to="/plateforme" className={classesBouton('secondaire')}>
            {t('commun.annuler')}
          </Link>
        }
        surEnvoyer={async (saisie) => {
          const creee = await appelerApi<EntrepriseCreee>('/plateforme/entreprises', {
            methode: 'POST',
            corps: demandeDepuis(saisie, 'plateforme'),
          })
          await clientRequetes.invalidateQueries({ queryKey: ['plateforme', 'entreprises'] })
          await navigate({
            to: '/plateforme',
            search: { creee: creee.nom, ...(creee.compteExistant ? { compteExistant: true } : {}) },
          })
        }}
      />
    </div>
  )
}
