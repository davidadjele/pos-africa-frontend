import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { nomAffiche, useSession } from '../../partage/auth/useSession'

export const CLASSES_CONTROLE_BARRE =
  'inline-flex min-h-cible-min items-center gap-2 rounded-normal border border-barre-trait bg-barre-fond px-3 text-libelle text-barre-texte hover:bg-barre-trait'

/** Barre haute : entreprise courante (si le compte en a plusieurs), utilisateur, déconnexion. */
export function MenuCompte({ surErreur }: { surErreur?: (erreur: unknown) => void }) {
  const { t } = useTranslation()
  const idSelecteur = useId()
  const navigate = useNavigate()
  const { moi, choisirEntreprise, deconnecter } = useSession()
  const [enCours, setEnCours] = useState(false)
  if (moi === undefined) return null

  async function changerEntreprise(entrepriseId: string) {
    setEnCours(true)
    try {
      await choisirEntreprise(entrepriseId)
      await navigate({ to: '/gestion' })
    } catch (erreur) {
      surErreur?.(erreur)
    } finally {
      setEnCours(false)
    }
  }

  async function seDeconnecter() {
    setEnCours(true)
    await deconnecter()
    await navigate({ to: '/connexion' })
  }

  const entrepriseCourante = moi.entrepriseCourante
  return (
    <>
      {moi.portee === 'ENTREPRISE' && moi.entreprises.length > 1 && entrepriseCourante && (
        <>
          <label htmlFor={idSelecteur} className="sr-only">
            {t('barre.entreprise')}
          </label>
          <select
            id={idSelecteur}
            value={entrepriseCourante.id}
            disabled={enCours}
            onChange={(evenement) => void changerEntreprise(evenement.target.value)}
            className={`${CLASSES_CONTROLE_BARRE} max-w-40 sm:max-w-56`}
          >
            {moi.entreprises.map((entreprise) => (
              <option key={entreprise.id} value={entreprise.id}>
                {entreprise.nom}
              </option>
            ))}
          </select>
        </>
      )}
      <span className="hidden truncate text-libelle text-barre-texte lg:inline">
        {nomAffiche(moi)}
      </span>
      <button
        type="button"
        onClick={() => void seDeconnecter()}
        disabled={enCours}
        aria-label={t('barre.deconnexion')}
        className={CLASSES_CONTROLE_BARRE}
      >
        <LogOut aria-hidden="true" size={18} />
        <span className="hidden md:inline">{t('barre.deconnexion')}</span>
      </button>
    </>
  )
}
