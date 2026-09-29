import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { appelerApi } from '../../partage/api/appelerApi'
import type { DemandeChangementMotDePasse } from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { useSession } from '../../partage/auth/useSession'
import { placerErreursServeur } from '../../partage/formulaires/erreursServeur'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { MiseEnPageEntree } from './MiseEnPageEntree'

const schema = z
  .object({
    motDePasseActuel: z.string().min(1, 'validation.obligatoire'),
    nouveauMotDePasse: z
      .string()
      .min(8, 'validation.motDePasseCourt')
      .max(128, 'validation.tropLong'),
    confirmation: z.string(),
  })
  .refine(({ nouveauMotDePasse, confirmation }) => nouveauMotDePasse === confirmation, {
    path: ['confirmation'],
    message: 'motDePasse.different',
  })

type Saisie = z.infer<typeof schema>

const CHAMPS = ['motDePasseActuel', 'nouveauMotDePasse'] as const

/**
 * Première connexion avec un mot de passe temporaire : il faut le remplacer avant tout le reste.
 * Le serveur ferme alors toutes les sessions du compte, celle-ci comprise : retour à la connexion.
 */
export function PageChangerMotDePasse() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { deconnecter } = useSession()
  const [erreur, setErreur] = useState<unknown>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Saisie>({
    resolver: zodResolver(schema),
    defaultValues: { motDePasseActuel: '', nouveauMotDePasse: '', confirmation: '' },
  })

  async function envoyer({ motDePasseActuel, nouveauMotDePasse }: Saisie) {
    setErreur(null)
    try {
      await appelerApi('/moi/mot-de-passe', {
        methode: 'POST',
        corps: { motDePasseActuel, nouveauMotDePasse } satisfies DemandeChangementMotDePasse,
      })
    } catch (erreurEnvoi) {
      const restants = placerErreursServeur(erreurEnvoi, setError, { champs: CHAMPS })
      // Une erreur placée sous son champ suffit ; sinon (réseau, verrouillage…) elle s'affiche en tête.
      const nombreDeChamps =
        erreurEnvoi instanceof ErreurApi ? (erreurEnvoi.reponse.champs?.length ?? 0) : 0
      if (nombreDeChamps === 0 || restants.length > 0) setErreur(erreurEnvoi)
      return
    }
    await deconnecter()
    await navigate({ to: '/connexion', search: { motDePasseChange: true }, replace: true })
  }

  const message = (cle: string | undefined) => (cle === undefined ? undefined : t(cle))

  return (
    <MiseEnPageEntree titre={t('motDePasse.titre')} phrase={t('motDePasse.phrase')}>
      <form
        noValidate
        onSubmit={(evenement) => void handleSubmit(envoyer)(evenement)}
        className="flex flex-col gap-4 rounded-moyen border border-trait bg-surface p-4 sm:p-6"
      >
        <ChampSaisie
          libelle={t('motDePasse.actuel')}
          type="password"
          autoComplete="current-password"
          obligatoire
          erreur={message(errors.motDePasseActuel?.message)}
          {...register('motDePasseActuel')}
        />
        <ChampSaisie
          libelle={t('motDePasse.nouveau')}
          type="password"
          autoComplete="new-password"
          obligatoire
          aide={t('motDePasse.nouveauAide')}
          erreur={message(errors.nouveauMotDePasse?.message)}
          {...register('nouveauMotDePasse')}
        />
        <ChampSaisie
          libelle={t('motDePasse.confirmation')}
          type="password"
          autoComplete="new-password"
          obligatoire
          erreur={message(errors.confirmation?.message)}
          {...register('confirmation')}
        />
        {erreur !== null && <AlerteErreur erreur={erreur} />}
        <Bouton variante="principal" type="submit" enCours={isSubmitting} className="w-full">
          {isSubmitting ? t('motDePasse.enCours') : t('motDePasse.envoyer')}
        </Bouton>
        <p className="m-0 text-center text-legende text-attenue">{t('motDePasse.sessions')}</p>
      </form>
    </MiseEnPageEntree>
  )
}
