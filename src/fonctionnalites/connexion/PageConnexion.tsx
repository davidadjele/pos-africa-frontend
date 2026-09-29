import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { requeteConfiguration } from '../../app/gardes'
import { useSession } from '../../partage/auth/useSession'
import { nomPays, PAYS_PAR_DEFAUT } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton, classesBouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { MiseEnPageEntree } from './MiseEnPageEntree'

const schema = z.object({
  identifiant: z.string().trim().min(1, 'connexion.validation.identifiant'),
  motDePasse: z.string().min(1, 'connexion.validation.motDePasse'),
})

type Saisie = z.infer<typeof schema>

export function PageConnexion({
  motDePasseChange = false,
}: Readonly<{ motDePasseChange?: boolean }>) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { connecter } = useSession()
  const { data: configuration } = useQuery(requeteConfiguration)
  const [erreur, setErreur] = useState<unknown>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Saisie>({
    resolver: zodResolver(schema),
    defaultValues: { identifiant: '', motDePasse: '' },
  })

  async function envoyer({ identifiant, motDePasse }: Saisie) {
    setErreur(null)
    try {
      const etat = await connecter(identifiant, motDePasse)
      await navigate({ to: etat.statut === 'choixEntreprise' ? '/choix-entreprise' : '/' })
    } catch (erreurConnexion) {
      setErreur(erreurConnexion)
    }
  }

  const messageValidation = (cle: string | undefined) => (cle === undefined ? undefined : t(cle))

  return (
    <MiseEnPageEntree titre={t('connexion.titre')} phrase={t('connexion.phrase')}>
      {motDePasseChange && <Alerte ton="succes">{t('motDePasse.change')}</Alerte>}
      <form
        noValidate
        onSubmit={(evenement) => void handleSubmit(envoyer)(evenement)}
        className="flex flex-col gap-4 rounded-moyen border border-trait bg-surface p-4 sm:p-6"
      >
        <ChampSaisie
          libelle={t('connexion.identifiant')}
          autoComplete="username"
          autoCapitalize="none"
          obligatoire
          // Sans indicatif, le backend lit le numéro dans son pays par défaut, le même que PAYS_PAR_DEFAUT.
          aide={t('connexion.identifiantAide', {
            pays: nomPays(PAYS_PAR_DEFAUT.pays, i18n.language),
          })}
          erreur={messageValidation(errors.identifiant?.message)}
          {...register('identifiant')}
        />
        <ChampSaisie
          libelle={t('connexion.motDePasse')}
          type="password"
          autoComplete="current-password"
          obligatoire
          erreur={messageValidation(errors.motDePasse?.message)}
          {...register('motDePasse')}
        />
        {erreur !== null && <AlerteErreur erreur={erreur} />}
        <Bouton variante="principal" type="submit" enCours={isSubmitting} className="w-full">
          {isSubmitting ? t('connexion.enCours') : t('connexion.envoyer')}
        </Bouton>
        <p className="m-0 text-legende text-attenue">{t('connexion.oubli')}</p>
      </form>
      {configuration?.inscriptionOuverte === true && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-trait pt-4">
          <span className="text-corps text-attenue">{t('connexion.pasDeCompte')}</span>
          <Link to="/inscription" className={classesBouton('secondaire')}>
            {t('connexion.inscription')}
          </Link>
        </div>
      )}
    </MiseEnPageEntree>
  )
}
