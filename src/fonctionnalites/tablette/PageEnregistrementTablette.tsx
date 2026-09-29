import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { AppareilCourant } from '../../partage/api/contrat'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { ClavierNumerique } from '../../partage/ui/ClavierNumerique'

const LONGUEUR = 6
const ETAPES = ['etape1', 'etape2', 'etape3'] as const

/**
 * Premier écran d'une tablette : le gérant génère un code dans la gestion (Tablettes), on le tape ici.
 * Son mot de passe n'est jamais saisi sur l'appareil partagé.
 */
export function PageEnregistrementTablette() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const clientRequetes = useQueryClient()
  const [code, setCode] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function envoyer(complet: string) {
    setEnCours(true)
    setErreur(null)
    try {
      const appareil = await appelerApi<AppareilCourant>('/appareil/appairage', {
        methode: 'POST',
        corps: { code: complet },
      })
      clientRequetes.setQueryData(['appareil'], appareil)
      await navigate({ to: '/caisse', replace: true })
    } catch (refus) {
      setErreur(refus)
      setCode('')
      setEnCours(false)
    }
  }

  function ajouter(chiffre: string) {
    if (enCours || code.length >= LONGUEUR) return
    const suivant = code + chiffre
    setCode(suivant)
    // Pas de bouton « Valider » : le code part au 6e chiffre, comme sur un terminal de paiement.
    if (suivant.length === LONGUEUR) void envoyer(suivant)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute contexte={{ titre: t('tablette.nonEnregistree') }} />
      <div className="flex flex-1 flex-col md:flex-row">
        <main className="flex flex-1 flex-col gap-5 p-6 md:p-12">
          <h1 className="m-0 text-titre-ecran text-encre">{t('tablette.titre')}</h1>
          <p className="m-0 max-w-xl text-corps text-attenue">{t('tablette.phrase')}</p>
          <ol className="m-0 flex max-w-xl list-none flex-col gap-3 p-0">
            {ETAPES.map((etape, rang) => (
              <li key={etape} className="flex items-start gap-3 text-corps text-encre">
                <span className="chiffres flex size-7 shrink-0 items-center justify-center rounded-rond bg-accent text-accent-texte">
                  {rang + 1}
                </span>
                <span className="pt-0.5">{t(`tablette.${etape}`)}</span>
              </li>
            ))}
          </ol>
          <p className="m-0 mt-auto text-legende text-attenue">{t('tablette.motDePasse')}</p>
        </main>
        <aside className="flex w-full flex-col gap-5 border-t border-trait bg-surface p-6 md:w-[460px] md:border-t-0 md:border-l md:p-9">
          <span className="text-libelle font-semibold text-attenue">{t('tablette.code')}</span>
          <div
            role="status"
            aria-label={t('tablette.chiffresSaisis', { count: code.length, total: LONGUEUR })}
            className="grid grid-cols-6 gap-2"
          >
            {Array.from({ length: LONGUEUR }, (_, rang) => (
              <span
                key={rang}
                aria-hidden="true"
                className={`chiffres flex h-16 items-center justify-center rounded-normal border-2 text-montant-total text-encre ${
                  rang < code.length
                    ? 'border-accent'
                    : rang === code.length
                      ? 'border-accent-vif'
                      : 'border-trait'
                }`}
              >
                {code[rang] ?? ''}
              </span>
            ))}
          </div>
          {erreur !== null && <AlerteErreur erreur={erreur} />}
          <ClavierNumerique
            desactive={enCours}
            surChiffre={ajouter}
            surEffacer={() => {
              setCode((actuel) => actuel.slice(0, -1))
            }}
          />
          <p className="m-0 text-center text-legende text-attenue">{t('tablette.aide')}</p>
        </aside>
      </div>
    </div>
  )
}
