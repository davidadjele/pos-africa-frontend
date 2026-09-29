import { zodResolver } from '@hookform/resolvers/zod'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { DemandeCreationEntreprise, DemandeInscription } from '../../partage/api/contrat'
import { placerErreursServeur, texteOptionnel } from '../../partage/formulaires/erreursServeur'
import {
  optionsDevises,
  optionsFuseaux,
  nomPays,
  optionsPays,
  PAYS_PAR_DEFAUT,
  reglagesDuPays,
  telephoneDuPays,
} from '../../partage/referentiel/pays'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'

/**
 * Plateforme : l'équipe Tonti crée l'entreprise ; le serveur génère un mot de passe temporaire pour un
 * nouveau propriétaire (celui qui a déjà un compte le garde). Inscription : il choisit son mot de passe.
 */
export type ModeFormulaire = 'plateforme' | 'inscription'

const obligatoire = (max: number) =>
  z.string().trim().min(1, 'validation.obligatoire').max(max, 'validation.tropLong')
const facultatif = (max: number) => z.string().trim().max(max, 'validation.tropLong')

function creerSchema(mode: ModeFormulaire) {
  return z
    .object({
      entreprise: z.object({
        nom: obligatoire(150),
        pays: z.string().min(1, 'validation.obligatoire'),
        devise: z.string().min(1, 'validation.obligatoire'),
        fuseauHoraire: z.string().min(1, 'validation.obligatoire'),
        langue: z.enum(['fr', 'en']),
      }),
      proprietaire: z.object({
        prenom: obligatoire(100),
        nom: obligatoire(100),
        telephone: facultatif(32),
        email: facultatif(254).refine(
          (email) => email === '' || z.email().safeParse(email).success,
          'validation.email',
        ),
        motDePasse: z.string().max(128, 'validation.tropLong'),
      }),
      etablissement: z.object({
        nom: obligatoire(150),
        code: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9]{2,10}$/, 'validation.codeFormat'),
        ville: facultatif(100),
        adresse: facultatif(255),
      }),
    })
    .superRefine(({ proprietaire }, contexte) => {
      if (proprietaire.telephone === '' && proprietaire.email === '') {
        contexte.addIssue({
          code: 'custom',
          path: ['proprietaire', 'telephone'],
          message: 'validation.contact',
        })
      }
      if (mode === 'inscription' && proprietaire.motDePasse.length < 8) {
        contexte.addIssue({
          code: 'custom',
          path: ['proprietaire', 'motDePasse'],
          message: 'validation.motDePasseCourt',
        })
      }
    })
}

type Schema = ReturnType<typeof creerSchema>
type Saisie = z.input<Schema>
type Valide = z.output<Schema>

const CHAMPS = [
  'entreprise.nom',
  'entreprise.pays',
  'entreprise.devise',
  'entreprise.fuseauHoraire',
  'entreprise.langue',
  'proprietaire.prenom',
  'proprietaire.nom',
  'proprietaire.telephone',
  'proprietaire.email',
  'proprietaire.motDePasse',
  'etablissement.nom',
  'etablissement.code',
  'etablissement.ville',
  'etablissement.adresse',
] as const

function sansVides<T extends Record<string, string>>(valeurs: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(valeurs).flatMap(([cle, valeur]) => {
      const texte = texteOptionnel(valeur)
      return texte === undefined ? [] : [[cle, texte]]
    }),
  ) as Partial<T>
}

export function demandeDepuis(saisie: Valide, mode: 'plateforme'): DemandeCreationEntreprise
export function demandeDepuis(saisie: Valide, mode: 'inscription'): DemandeInscription
export function demandeDepuis(
  { entreprise, proprietaire, etablissement }: Valide,
  mode: ModeFormulaire,
): DemandeCreationEntreprise | DemandeInscription {
  const { motDePasse, prenom, nom, ...contact } = proprietaire
  const etablissementComplet = {
    nom: etablissement.nom,
    code: etablissement.code,
    ...sansVides({ ville: etablissement.ville, adresse: etablissement.adresse }),
  }
  if (mode === 'inscription') {
    return {
      entreprise,
      proprietaire: { prenom, nom, ...sansVides(contact), motDePasse },
      etablissement: etablissementComplet,
    }
  }
  return {
    entreprise,
    proprietaire: { prenom, nom, ...sansVides(contact) },
    etablissement: etablissementComplet,
  }
}

function Section({ titre, children }: Readonly<{ titre: string; children: ReactNode }>) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 rounded-moyen border border-trait bg-surface p-4 md:p-6">
      <legend className="float-left mb-1 w-full p-0 text-titre-carte text-encre">{titre}</legend>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  )
}

export function FormulaireEntreprise({
  mode,
  libelleEnvoyer,
  surEnvoyer,
  actionSecondaire,
}: Readonly<{
  mode: ModeFormulaire
  libelleEnvoyer: string
  /** Appelle l'API ; une erreur levée est affichée sous les champs ou en tête. */
  surEnvoyer: (saisie: Valide) => Promise<void>
  actionSecondaire?: ReactNode
}>) {
  const { t, i18n } = useTranslation()
  const [erreur, setErreur] = useState<unknown>(null)
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Saisie, unknown, Valide>({
    resolver: zodResolver(creerSchema(mode)),
    defaultValues: {
      entreprise: { nom: '', ...PAYS_PAR_DEFAUT },
      proprietaire: { prenom: '', nom: '', telephone: '', email: '', motDePasse: '' },
      etablissement: { nom: '', code: '', ville: '', adresse: '' },
    },
  })

  async function envoyer(saisie: Valide) {
    setErreur(null)
    try {
      await surEnvoyer(saisie)
    } catch (erreurEnvoi) {
      placerErreursServeur(erreurEnvoi, setError, { champs: CHAMPS })
      setErreur(erreurEnvoi)
    }
  }

  const message = (cle: string | undefined) => (cle === undefined ? undefined : t(cle))
  const champPays = register('entreprise.pays')
  // Le backend lit un numéro sans indicatif dans le pays de l'entreprise : on le montre avant l'envoi.
  const [pays, telephoneSaisi] = useWatch({
    control,
    name: ['entreprise.pays', 'proprietaire.telephone'],
  })
  const telephonePays = telephoneDuPays(pays)

  return (
    <form
      noValidate
      onSubmit={(evenement) => void handleSubmit(envoyer)(evenement)}
      className="flex flex-col gap-4"
    >
      <Section titre={t('formulaireEntreprise.sections.entreprise')}>
        <ChampSaisie
          libelle={t('formulaireEntreprise.nomEntreprise')}
          obligatoire
          maxLength={150}
          erreur={message(errors.entreprise?.nom?.message)}
          {...register('entreprise.nom')}
        />
        <ChampSelection
          libelle={t('formulaireEntreprise.pays')}
          obligatoire
          options={optionsPays(i18n.language)}
          erreur={message(errors.entreprise?.pays?.message)}
          {...champPays}
          onChange={(evenement) => {
            void champPays.onChange(evenement)
            // Le pays propose sa devise et son fuseau habituels, que l'on peut encore changer.
            const reglages = reglagesDuPays(evenement.target.value)
            if (reglages) {
              setValue('entreprise.devise', reglages.devise)
              setValue('entreprise.fuseauHoraire', reglages.fuseauHoraire)
            }
          }}
        />
        <ChampSelection
          libelle={t('formulaireEntreprise.devise')}
          obligatoire
          options={optionsDevises(i18n.language)}
          erreur={message(errors.entreprise?.devise?.message)}
          {...register('entreprise.devise')}
        />
        <ChampSelection
          libelle={t('formulaireEntreprise.fuseau')}
          obligatoire
          options={optionsFuseaux()}
          erreur={message(errors.entreprise?.fuseauHoraire?.message)}
          {...register('entreprise.fuseauHoraire')}
        />
        <ChampSelection
          libelle={t('formulaireEntreprise.langue')}
          obligatoire
          options={[
            { valeur: 'fr', libelle: t('formulaireEntreprise.langues.fr') },
            { valeur: 'en', libelle: t('formulaireEntreprise.langues.en') },
          ]}
          erreur={message(errors.entreprise?.langue?.message)}
          {...register('entreprise.langue')}
        />
      </Section>

      <Section titre={t('formulaireEntreprise.sections.proprietaire')}>
        <ChampSaisie
          libelle={t('formulaireEntreprise.prenom')}
          obligatoire
          autoComplete={mode === 'inscription' ? 'given-name' : 'off'}
          maxLength={100}
          erreur={message(errors.proprietaire?.prenom?.message)}
          {...register('proprietaire.prenom')}
        />
        <ChampSaisie
          libelle={t('formulaireEntreprise.nom')}
          obligatoire
          autoComplete={mode === 'inscription' ? 'family-name' : 'off'}
          maxLength={100}
          erreur={message(errors.proprietaire?.nom?.message)}
          {...register('proprietaire.nom')}
        />
        <ChampSaisie
          libelle={t('formulaireEntreprise.telephone')}
          type="tel"
          autoComplete={mode === 'inscription' ? 'tel' : 'off'}
          maxLength={32}
          prefixe={telephoneSaisi.trim().startsWith('+') ? undefined : telephonePays?.indicatif}
          placeholder={telephonePays?.exemple}
          aide={t('formulaireEntreprise.telephoneAide', { pays: nomPays(pays, i18n.language) })}
          erreur={message(errors.proprietaire?.telephone?.message)}
          {...register('proprietaire.telephone')}
        />
        <ChampSaisie
          libelle={t('formulaireEntreprise.email')}
          type="email"
          autoComplete={mode === 'inscription' ? 'email' : 'off'}
          maxLength={254}
          aide={t('formulaireEntreprise.contactAide')}
          erreur={message(errors.proprietaire?.email?.message)}
          {...register('proprietaire.email')}
        />
        {mode === 'inscription' && (
          <ChampSaisie
            libelle={t('formulaireEntreprise.motDePasse')}
            type="password"
            autoComplete="new-password"
            obligatoire
            maxLength={128}
            aide={t('formulaireEntreprise.motDePasseAide')}
            erreur={message(errors.proprietaire?.motDePasse?.message)}
            {...register('proprietaire.motDePasse')}
          />
        )}
      </Section>

      <Section titre={t('formulaireEntreprise.sections.etablissement')}>
        <ChampSaisie
          libelle={t('formulaireEntreprise.nomEtablissement')}
          obligatoire
          maxLength={150}
          erreur={message(errors.etablissement?.nom?.message)}
          {...register('etablissement.nom')}
        />
        <ChampSaisie
          libelle={t('formulaireEntreprise.code')}
          obligatoire
          aide={t('formulaireEntreprise.codeAide')}
          autoCapitalize="characters"
          maxLength={10}
          className="uppercase"
          erreur={message(errors.etablissement?.code?.message)}
          {...register('etablissement.code')}
        />
        <ChampSaisie
          libelle={t('formulaireEntreprise.ville')}
          maxLength={100}
          erreur={message(errors.etablissement?.ville?.message)}
          {...register('etablissement.ville')}
        />
        <ChampSaisie
          libelle={t('formulaireEntreprise.adresse')}
          maxLength={255}
          erreur={message(errors.etablissement?.adresse?.message)}
          {...register('etablissement.adresse')}
        />
      </Section>

      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actionSecondaire}
        <Bouton variante="principal" type="submit" enCours={isSubmitting}>
          {libelleEnvoyer}
        </Bouton>
      </div>
    </form>
  )
}
