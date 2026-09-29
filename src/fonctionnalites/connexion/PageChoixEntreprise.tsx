import { useNavigate } from '@tanstack/react-router'
import { Building2, ChevronRight, LogOut } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../partage/auth/useSession'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { MiseEnPageEntree } from './MiseEnPageEntree'

export function PageChoixEntreprise() {
  const { t } = useTranslation()
  const idListe = useId()
  const navigate = useNavigate()
  const { etat, choisirEntreprise, deconnecter } = useSession()
  const [choisie, setChoisie] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const entreprises = etat.statut === 'choixEntreprise' ? etat.entreprises : []

  async function choisir(entrepriseId: string) {
    setChoisie(entrepriseId)
    setErreur(null)
    try {
      await choisirEntreprise(entrepriseId)
      await navigate({ to: '/' })
    } catch (erreurChoix) {
      setErreur(erreurChoix)
      setChoisie(null)
    }
  }

  async function seDeconnecter() {
    await deconnecter()
    await navigate({ to: '/connexion' })
  }

  return (
    <MiseEnPageEntree titre={t('choixEntreprise.titre')} phrase={t('choixEntreprise.phrase')}>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <p id={idListe} className="sr-only">
        {t('choixEntreprise.liste')}
      </p>
      <ul aria-labelledby={idListe} className="m-0 flex list-none flex-col gap-2 p-0">
        {entreprises.map((entreprise) => (
          <li key={entreprise.id}>
            <button
              type="button"
              disabled={choisie !== null}
              aria-busy={choisie === entreprise.id || undefined}
              onClick={() => void choisir(entreprise.id)}
              className="flex min-h-cible-caisse w-full items-center gap-3 rounded-normal border border-bordure-controle bg-surface px-4 text-left text-corps-fort text-encre hover:bg-fond disabled:cursor-wait"
            >
              <Building2 aria-hidden="true" size={20} className="text-attenue" />
              <span className="flex-1 truncate">{entreprise.nom}</span>
              <ChevronRight aria-hidden="true" size={18} className="text-attenue" />
            </button>
          </li>
        ))}
      </ul>
      <div>
        <Bouton icone={LogOut} onClick={() => void seDeconnecter()}>
          {t('barre.deconnexion')}
        </Bouton>
      </div>
    </MiseEnPageEntree>
  )
}
