import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DemandeChangementPin,
  ProfilCaisse,
  ResultatPriseDeCaisse,
} from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { codePinTropSimple } from './codePin'
import { Pastille } from './Pastille'
import { LONGUEUR_MIN_PIN, SaisieCode } from './SaisieCode'

/**
 * Première prise de caisse avec le PIN temporaire du gérant : l'employé choisit son code, tapé deux
 * fois. Le PIN temporaire, déjà vérifié, reste en mémoire le temps de cet écran seulement.
 */
export function EcranNouveauPin({
  profil,
  pinActuel,
  etablissement,
  surOuvert,
  surBloque,
  surAbandon,
}: Readonly<{
  profil: ProfilCaisse
  pinActuel: string
  etablissement: string
  surOuvert: (jeton: string) => void
  surBloque: () => void
  surAbandon: () => void
}>) {
  const { t } = useTranslation()
  const [premier, setPremier] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<{ message: string } | { api: unknown } | null>(null)

  function recommencer(message?: string) {
    setPremier(null)
    setCode('')
    setErreur(message === undefined ? null : { message })
  }

  function continuer() {
    if (codePinTropSimple(code)) {
      recommencer(t('caisse.nouveauPin.tropSimple'))
      return
    }
    setPremier(code)
    setCode('')
    setErreur(null)
  }

  async function enregistrer() {
    if (code !== premier) {
      recommencer(t('caisse.nouveauPin.different'))
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      const resultat = await appelerApi<ResultatPriseDeCaisse>('/appareil/pin', {
        methode: 'POST',
        corps: {
          utilisateurId: profil.utilisateurId,
          pinActuel,
          nouveauPin: code,
        } satisfies DemandeChangementPin,
      })
      if (resultat.jetonAcces !== undefined) surOuvert(resultat.jetonAcces)
    } catch (refus) {
      if (refus instanceof ErreurApi && refus.code === 'PROFIL_BLOQUE') {
        surBloque()
        return
      }
      // PIN temporaire devenu invalide (réinitialisé entre-temps) : retour au choix du profil.
      if (refus instanceof ErreurApi && refus.code === 'PIN_INCORRECT') {
        surAbandon()
        return
      }
      recommencer()
      setErreur({ api: refus })
      setEnCours(false)
    }
  }

  const confirmation = premier !== null
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto md:flex-row">
      <main className="flex flex-1 flex-col gap-4 p-6 md:px-12 md:py-10">
        <div className="flex items-center gap-3.5">
          <Pastille nomCourt={profil.nomCourt} active />
          <span className="flex flex-col">
            <span className="text-titre-carte text-encre">
              {t('caisse.nouveauPin.bienvenue', { prenom: profil.prenom })}
            </span>
            <span className="text-legende text-attenue">
              {t('caisse.nouveauPin.roleIci', { role: t(`roles.${profil.role}`), etablissement })}
            </span>
          </span>
        </div>
        <h1 className="m-0 mt-2 text-titre-ecran text-encre">{t('caisse.nouveauPin.titre')}</h1>
        <p className="m-0 max-w-xl text-corps text-attenue">{t('caisse.nouveauPin.phrase')}</p>
        <ol aria-label={t('caisse.nouveauPin.etapes')} className="m-0 flex list-none gap-2.5 p-0">
          <li
            aria-current={confirmation ? undefined : 'step'}
            className={clsx(
              'flex h-9 items-center gap-2 rounded-normal px-3 text-libelle font-bold',
              confirmation ? 'bg-succes-fond text-succes' : 'bg-accent text-accent-texte',
            )}
          >
            {confirmation && <Check aria-hidden="true" size={16} />}
            {t('caisse.nouveauPin.etape1')}
          </li>
          <li
            aria-current={confirmation ? 'step' : undefined}
            className={clsx(
              'flex h-9 items-center rounded-normal px-3 text-libelle font-bold',
              confirmation ? 'bg-accent text-accent-texte' : 'bg-fond text-attenue',
            )}
          >
            {t('caisse.nouveauPin.etape2')}
          </li>
        </ol>
        <p className="m-0 max-w-xl rounded-moyen border border-trait bg-surface px-4 py-3.5 text-legende text-attenue">
          {t('caisse.nouveauPin.regle')}
        </p>
      </main>
      <aside className="flex w-full flex-col gap-5 border-t border-trait bg-surface p-6 md:w-[460px] md:border-t-0 md:border-l md:p-9">
        {erreur !== null &&
          ('message' in erreur ? (
            <Alerte ton="danger">{erreur.message}</Alerte>
          ) : (
            <AlerteErreur erreur={erreur.api} />
          ))}
        <SaisieCode
          libelle={confirmation ? t('caisse.nouveauPin.confirmer') : t('caisse.nouveauPin.saisir')}
          code={code}
          surChanger={setCode}
          desactive={enCours}
        />
        <Bouton
          variante="principal"
          disabled={code.length < LONGUEUR_MIN_PIN}
          enCours={enCours}
          onClick={confirmation ? () => void enregistrer() : continuer}
        >
          {confirmation ? t('caisse.nouveauPin.enregistrer') : t('caisse.nouveauPin.continuer')}
        </Bouton>
        <Bouton
          onClick={() => {
            recommencer()
          }}
        >
          {t('caisse.nouveauPin.recommencer')}
        </Bouton>
      </aside>
    </div>
  )
}
