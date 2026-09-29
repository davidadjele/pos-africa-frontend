import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { ReponseConnexion } from '../../partage/api/contrat'
import { ouvrirSession } from '../../partage/auth/session'
import { classesBouton } from '../../partage/ui/Bouton'
import { MiseEnPageEntree } from '../connexion/MiseEnPageEntree'
import { demandeDepuis, FormulaireEntreprise } from '../entreprises/FormulaireEntreprise'

export function PageInscription() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const clientRequetes = useQueryClient()

  return (
    <MiseEnPageEntree
      titre={t('inscription.titre')}
      phrase={t('inscription.phrase')}
      largeur="large"
    >
      <FormulaireEntreprise
        mode="inscription"
        libelleEnvoyer={t('inscription.envoyer')}
        surEnvoyer={async (saisie) => {
          // L'inscription répond comme une connexion (jeton et cookie) : la session s'ouvre directement.
          const reponse = await appelerApi<ReponseConnexion>('/inscription', {
            methode: 'POST',
            corps: demandeDepuis(saisie, 'inscription'),
          })
          ouvrirSession(reponse)
          clientRequetes.clear()
          await navigate({ to: '/' })
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-trait pt-4">
        <span className="text-corps text-attenue">{t('inscription.dejaCompte')}</span>
        <Link to="/connexion" className={classesBouton('secondaire')}>
          {t('inscription.connexion')}
        </Link>
      </div>
    </MiseEnPageEntree>
  )
}
