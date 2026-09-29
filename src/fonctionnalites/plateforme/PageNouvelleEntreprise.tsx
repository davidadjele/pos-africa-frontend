import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { EntrepriseCreee } from '../../partage/api/contrat'
import { classesBouton } from '../../partage/ui/Bouton'
import { CodeSecret } from '../../partage/ui/CodeSecret'
import { Dialogue } from '../../partage/ui/Dialogue'
import { demandeDepuis, FormulaireEntreprise } from '../entreprises/FormulaireEntreprise'

/** Mot de passe temporaire du nouveau propriétaire, à noter avant de revenir à la liste. */
interface CodesProprietaire {
  proprietaire: string
  identifiant: string
  motDePasse: string
  entreprise: string
}

export function PageNouvelleEntreprise() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const clientRequetes = useQueryClient()
  const [codes, setCodes] = useState<CodesProprietaire | null>(null)

  async function revenirALaListe(creee: Pick<EntrepriseCreee, 'nom' | 'compteExistant'>) {
    await navigate({
      to: '/plateforme',
      search: { creee: creee.nom, ...(creee.compteExistant ? { compteExistant: true } : {}) },
    })
  }

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
          if (creee.motDePasseTemporaire === undefined) {
            await revenirALaListe(creee)
            return
          }
          const { prenom, nom, telephone, email } = saisie.proprietaire
          setCodes({
            proprietaire: `${prenom} ${nom}`,
            identifiant: telephone === '' ? email : telephone,
            motDePasse: creee.motDePasseTemporaire,
            entreprise: creee.nom,
          })
        }}
      />
      {codes !== null && (
        <Dialogue
          titre={t('personnel.codes.titre', { nom: codes.proprietaire })}
          consequence={t('personnel.codes.consequence')}
          libelleConfirmer={t('personnel.codes.noter')}
          surConfirmer={() =>
            void revenirALaListe({ nom: codes.entreprise, compteExistant: false })
          }
        >
          <div className="flex flex-col gap-1">
            <CodeSecret libelle={t('personnel.codes.motDePasse')} code={codes.motDePasse} />
            <p className="m-0 text-legende text-attenue">
              {t('personnel.codes.identifiant', { identifiant: codes.identifiant })}
            </p>
          </div>
        </Dialogue>
      )}
    </div>
  )
}
