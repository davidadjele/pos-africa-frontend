import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type {
  DemandeValidation,
  PermissionCaisse,
  ProfilCaisse,
  ValidationAccordee,
} from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { usePiegeFocus } from '../../partage/ui/usePiegeFocus'
import { Pastille } from '../caisse/Pastille'
import { LONGUEUR_MIN_PIN, SaisieCode } from '../caisse/SaisieCode'

function requeteValidateurs(permission: PermissionCaisse) {
  return {
    queryKey: ['caisse', 'validateurs', permission],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      appelerCaisse<ProfilCaisse[]>(
        `/caisse/validateurs?permission=${encodeURIComponent(permission)}`,
        { signal },
      ),
    staleTime: 0,
  }
}

/**
 * Action sensible demandée sur la caisse d'un employé qui n'en a pas le droit : un gérant présent
 * tape son PIN. La validation obtenue ne vaut que pour cette permission et cet objet, 60 secondes ;
 * l'appelant la joint à l'action.
 */
export function DialogueValidationGerant({
  titre,
  contexte,
  permission,
  objetId,
  libelleAnnuler,
  surValide,
  surAnnuler,
}: Readonly<{
  titre: string
  /** Ce qui est demandé, où, et par qui : « T4, Terrasse. Ligne déjà envoyée en cuisine… » */
  contexte: string
  permission: PermissionCaisse
  objetId: string
  libelleAnnuler: string
  surValide: (validation: ValidationAccordee) => void
  surAnnuler: () => void
}>) {
  const { t } = useTranslation()
  const id = useId()
  const cadre = useRef<HTMLElement>(null)
  const boutonAnnuler = useRef<HTMLButtonElement>(null)
  usePiegeFocus(cadre, boutonAnnuler, surAnnuler)
  const clientRequetes = useQueryClient()
  const validateurs = useQuery(requeteValidateurs(permission))
  const [choisi, setChoisi] = useState<ProfilCaisse | null>(null)
  const [code, setCode] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function valider(validateur: ProfilCaisse) {
    setEnCours(true)
    setErreur(null)
    try {
      surValide(
        await appelerCaisse<ValidationAccordee>('/caisse/validations', {
          methode: 'POST',
          corps: {
            permission,
            objetId,
            validateurId: validateur.utilisateurId,
            pin: code,
          } satisfies DemandeValidation,
        }),
      )
    } catch (refus) {
      setErreur(refus)
      setCode('')
      setEnCours(false)
      // Profil tout juste bloqué : la liste le montre désormais comme tel.
      if (refus instanceof ErreurApi && refus.code === 'PROFIL_BLOQUE') {
        setChoisi(null)
        void clientRequetes.invalidateQueries({ queryKey: ['caisse', 'validateurs'] })
      }
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-voile sm:items-center sm:p-4">
      <section
        ref={cadre}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titre`}
        aria-describedby={`${id}-contexte`}
        className="flex max-h-dvh w-full max-w-[880px] flex-col overflow-auto rounded-t-moyen bg-surface shadow-dialogue sm:rounded-moyen md:flex-row"
      >
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="flex flex-col items-start gap-2">
            <BadgeStatut ton="alerte">{t('validation.badge')}</BadgeStatut>
            <h2 id={`${id}-titre`} className="m-0 text-titre-section text-encre">
              {titre}
            </h2>
            <p id={`${id}-contexte`} className="m-0 text-corps text-attenue">
              {contexte}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-libelle font-semibold text-attenue">{t('validation.qui')}</span>
            {validateurs.isPending ? (
              <Chargement texte={t('validation.chargement')} />
            ) : validateurs.isError ? (
              <AlerteErreur erreur={validateurs.error} />
            ) : validateurs.data.length === 0 ? (
              <p className="m-0 text-corps text-attenue">{t('validation.aucun')}</p>
            ) : (
              validateurs.data.map((validateur) => (
                <button
                  key={validateur.utilisateurId}
                  type="button"
                  disabled={validateur.bloque}
                  aria-pressed={validateur.utilisateurId === choisi?.utilisateurId}
                  onClick={() => {
                    setChoisi(validateur)
                    setCode('')
                    setErreur(null)
                  }}
                  className={clsx(
                    'flex min-h-cible-caisse w-full items-center gap-3 rounded-moyen bg-surface px-3 text-left text-encre disabled:text-attenue',
                    validateur.utilisateurId === choisi?.utilisateurId
                      ? 'border-2 border-accent'
                      : 'border border-trait',
                  )}
                >
                  <Pastille nomCourt={validateur.nomCourt} />
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-corps-fort">{validateur.nomCourt}</span>
                    {validateur.bloque ? (
                      <BadgeStatut ton="danger">{t('caisse.prise.bloque')}</BadgeStatut>
                    ) : (
                      <span className="text-legende text-attenue">
                        {t(`roles.${validateur.role}`)}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
          <p className="m-0 text-legende text-attenue">{t('validation.note')}</p>
          <Bouton ref={boutonAnnuler} className="mt-auto" onClick={surAnnuler}>
            {libelleAnnuler}
          </Bouton>
        </div>
        <div className="flex w-full flex-col gap-4 border-t border-trait bg-fond p-6 md:w-[380px] md:border-t-0 md:border-l">
          {erreur !== null && <AlerteErreur erreur={erreur} />}
          {choisi === null ? (
            <p className="m-0 my-auto text-center text-corps text-attenue">
              {t('validation.choisir')}
            </p>
          ) : (
            <>
              <SaisieCode
                libelle={t('validation.code', { nom: choisi.nomCourt })}
                code={code}
                surChanger={setCode}
                desactive={enCours}
              />
              <Bouton
                variante="principal"
                disabled={code.length < LONGUEUR_MIN_PIN}
                enCours={enCours}
                onClick={() => void valider(choisi)}
              >
                {t('validation.valider')}
              </Bouton>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
