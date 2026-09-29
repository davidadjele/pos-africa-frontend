import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DemandeEtablissement,
  DemandeModificationEtablissement,
  EtablissementResume,
} from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { placerErreursServeur, texteOptionnel } from '../../partage/formulaires/erreursServeur'
import { messageErreur } from '../../partage/i18n/messageErreur'
import { optionsFuseaux } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'

// Les messages sont des clés de traduction, traduites à l'affichage.
const schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, 'validation.codeFormat'),
  nom: z.string().trim().min(1, 'validation.obligatoire').max(150, 'validation.tropLong'),
  ville: z.string().max(100, 'validation.tropLong'),
  adresse: z.string().max(255, 'validation.tropLong'),
  fuseauHoraire: z.string().min(1, 'validation.obligatoire'),
})

type Saisie = z.input<typeof schema>
type Valide = z.output<typeof schema>

const CHAMPS = ['code', 'nom', 'ville', 'adresse', 'fuseauHoraire'] as const

function valeursDe(etablissement: EtablissementResume): Saisie {
  return {
    code: etablissement.code,
    nom: etablissement.nom,
    ville: etablissement.ville ?? '',
    adresse: etablissement.adresse ?? '',
    fuseauHoraire: etablissement.fuseauHoraire,
  }
}

function demandeDe(saisie: Valide): DemandeEtablissement {
  const ville = texteOptionnel(saisie.ville)
  const adresse = texteOptionnel(saisie.adresse)
  return {
    code: saisie.code,
    nom: saisie.nom,
    ...(ville === undefined ? {} : { ville }),
    ...(adresse === undefined ? {} : { adresse }),
    fuseauHoraire: saisie.fuseauHoraire,
  }
}

/**
 * Création ou modification d'un établissement. En cas de conflit de version, l'établissement est
 * rechargé dans le formulaire : jamais d'écrasement de la modification faite ailleurs.
 */
export function FormulaireEtablissement({
  etablissement,
  fuseauParDefaut,
  recharger,
  surEnregistre,
  surAnnuler,
}: Readonly<{
  etablissement?: EtablissementResume
  fuseauParDefaut: string
  /** Relit l'établissement depuis le serveur (après un conflit), ou undefined s'il n'existe plus. */
  recharger: (id: string) => Promise<EtablissementResume | undefined>
  surEnregistre: (etablissement: EtablissementResume) => void
  surAnnuler: () => void
}>) {
  const { t } = useTranslation()
  const idTitre = useId()
  const [version, setVersion] = useState(etablissement?.version)
  const [erreur, setErreur] = useState<unknown>(null)
  const [conflit, setConflit] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Saisie, unknown, Valide>({
    resolver: zodResolver(schema),
    defaultValues: etablissement
      ? valeursDe(etablissement)
      : { code: '', nom: '', ville: '', adresse: '', fuseauHoraire: fuseauParDefaut },
  })

  async function envoyer(saisie: Valide) {
    setErreur(null)
    setConflit(false)
    try {
      const enregistre =
        etablissement === undefined || version === undefined
          ? await appelerApi<EtablissementResume>('/etablissements', {
              methode: 'POST',
              corps: demandeDe(saisie),
            })
          : await appelerApi<EtablissementResume>(`/etablissements/${etablissement.id}`, {
              methode: 'PUT',
              corps: { ...demandeDe(saisie), version } satisfies DemandeModificationEtablissement,
            })
      surEnregistre(enregistre)
    } catch (erreurEnvoi) {
      if (
        etablissement !== undefined &&
        erreurEnvoi instanceof ErreurApi &&
        erreurEnvoi.code === 'CONFLIT_MODIFICATION'
      ) {
        await rechargerApresConflit(etablissement.id)
        return
      }
      const restants = placerErreursServeur(erreurEnvoi, setError, {
        champs: CHAMPS,
        codesParChamp: { CODE_ETABLISSEMENT_DEJA_UTILISE: 'code' },
      })
      const dejaSousLeChamp =
        erreurEnvoi instanceof ErreurApi && erreurEnvoi.code === 'CODE_ETABLISSEMENT_DEJA_UTILISE'
      if (!dejaSousLeChamp || restants.length > 0) setErreur(erreurEnvoi)
    }
  }

  async function rechargerApresConflit(id: string) {
    const frais = await recharger(id)
    if (frais === undefined) {
      setErreur(new ErreurApi({ statut: 404, code: 'RESSOURCE_INTROUVABLE', message: '' }))
      return
    }
    reset(valeursDe(frais))
    setVersion(frais.version)
    setConflit(true)
  }

  const message = (cle: string | undefined) => (cle === undefined ? undefined : t(cle))
  const titre =
    etablissement === undefined
      ? t('etablissements.formulaire.titreCreation')
      : t('etablissements.formulaire.titreModification', { nom: etablissement.nom })

  return (
    <form
      noValidate
      aria-labelledby={idTitre}
      onSubmit={(evenement) => void handleSubmit(envoyer)(evenement)}
      className="flex flex-col gap-4 rounded-moyen border border-trait bg-surface p-4 md:p-6"
    >
      <h2 id={idTitre} className="m-0 text-titre-carte text-encre">
        {titre}
      </h2>
      {conflit && (
        <Alerte ton="alerte">
          {messageErreur(new ErreurApi({ statut: 409, code: 'CONFLIT_MODIFICATION', message: '' }))}
        </Alerte>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <ChampSaisie
          libelle={t('etablissements.formulaire.code')}
          aide={t('etablissements.formulaire.codeAide')}
          obligatoire
          autoCapitalize="characters"
          maxLength={10}
          className="uppercase"
          erreur={message(errors.code?.message)}
          {...register('code')}
        />
        <ChampSaisie
          libelle={t('etablissements.formulaire.nom')}
          obligatoire
          maxLength={150}
          erreur={message(errors.nom?.message)}
          {...register('nom')}
        />
        <ChampSaisie
          libelle={t('etablissements.formulaire.ville')}
          maxLength={100}
          erreur={message(errors.ville?.message)}
          {...register('ville')}
        />
        <ChampSaisie
          libelle={t('etablissements.formulaire.adresse')}
          maxLength={255}
          erreur={message(errors.adresse?.message)}
          {...register('adresse')}
        />
        <ChampSelection
          libelle={t('etablissements.formulaire.fuseau')}
          obligatoire
          options={optionsFuseaux()}
          erreur={message(errors.fuseauHoraire?.message)}
          {...register('fuseauHoraire')}
        />
      </div>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <div className="flex flex-wrap justify-end gap-2">
        <Bouton onClick={surAnnuler}>{t('commun.annuler')}</Bouton>
        <Bouton variante="principal" type="submit" enCours={isSubmitting}>
          {etablissement === undefined
            ? t('etablissements.formulaire.creer')
            : t('etablissements.formulaire.enregistrer')}
        </Bouton>
      </div>
    </form>
  )
}
