import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState, type ReactNode } from 'react'
import { useForm, useWatch, type FieldError } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  AffectationEmploye,
  DemandeEmploye,
  DemandeModificationEmploye,
  EmployeResume,
  EtablissementResume,
  ResultatEmploye,
  RoleAttribuable,
} from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { placerErreursServeur, texteOptionnel } from '../../partage/formulaires/erreursServeur'
import { nomPays, telephoneDuPays } from '../../partage/referentiel/pays'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { Case } from '../../partage/ui/Case'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'

const ADMIN = 'ADMIN'

const obligatoire = (max: number) =>
  z.string().trim().min(1, 'validation.obligatoire').max(max, 'validation.tropLong')

// Les messages sont des clés de traduction, traduites à l'affichage.
const schema = z
  .object({
    prenom: obligatoire(100),
    nom: obligatoire(100),
    /** Administrateur : toute l'entreprise ; sinon un rôle par établissement. */
    portee: z.enum(['etablissements', 'entreprise']),
    /** Rôle choisi pour chaque établissement (identifiant → code), vide s'il n'y travaille pas. */
    roles: z.record(z.string(), z.string()),
    acces: z.boolean(),
    telephone: z.string().trim().max(32, 'validation.tropLong'),
    email: z
      .string()
      .trim()
      .max(254, 'validation.tropLong')
      .refine((email) => email === '' || z.email().safeParse(email).success, 'validation.email'),
  })
  .superRefine(({ acces, telephone, email }, contexte) => {
    if (acces && telephone === '' && email === '') {
      contexte.addIssue({ code: 'custom', path: ['telephone'], message: 'validation.contact' })
    }
  })

type Saisie = z.input<typeof schema>
type Valide = z.output<typeof schema>

const CHAMPS = ['prenom', 'nom', 'roles', 'telephone', 'email'] as const

function valeursDe(employe: EmployeResume | undefined): Saisie {
  const roles: Record<string, string> = {}
  for (const affectation of employe?.affectations ?? []) {
    if (affectation.etablissementId !== undefined)
      roles[affectation.etablissementId] = affectation.role
  }
  return {
    prenom: employe?.prenom ?? '',
    nom: employe?.nom ?? '',
    portee: employe?.affectations.some((affectation) => affectation.role === ADMIN)
      ? 'entreprise'
      : 'etablissements',
    roles,
    acces: false,
    telephone: '',
    email: '',
  }
}

function affectationsDe({ portee, roles }: Valide): AffectationEmploye[] {
  if (portee === 'entreprise') return [{ role: ADMIN }]
  return Object.entries(roles)
    .filter(([, role]) => role !== '')
    .map(([etablissementId, role]) => ({ etablissementId, role }))
}

/**
 * Ajout ou modification d'un employé : un rôle par établissement, et un accès au back-office si
 * l'un de ces rôles l'ouvre. Les codes temporaires sont générés par le serveur, jamais saisis ici.
 */
export function FormulaireEmploye({
  employe,
  etablissements,
  roles,
  pays,
  recharger,
  surEnregistre,
  surAnnuler,
}: Readonly<{
  employe?: EmployeResume
  etablissements: EtablissementResume[]
  roles: RoleAttribuable[]
  /** Pays de l'entreprise : un numéro saisi sans indicatif y est lu. */
  pays: string
  /** Relit l'employé depuis le serveur (après un conflit de version). */
  recharger: (id: string) => Promise<EmployeResume | undefined>
  surEnregistre: (resultat: ResultatEmploye) => void
  surAnnuler: () => void
}>) {
  const { t, i18n } = useTranslation()
  const idTitre = useId()
  const idErreurRoles = useId()
  const [erreur, setErreur] = useState<unknown>(null)
  const [conflit, setConflit] = useState(false)
  const [version, setVersion] = useState(employe?.version)
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Saisie, unknown, Valide>({
    resolver: zodResolver(schema),
    defaultValues: valeursDe(employe),
  })
  const [portee, rolesChoisis, acces, telephoneSaisi] = useWatch({
    control,
    name: ['portee', 'roles', 'acces', 'telephone'],
  })

  const parCode = new Map(roles.map((role) => [role.code, role]))
  const optionsRoles = [
    { valeur: '', libelle: t('personnel.formulaire.aucun') },
    ...roles
      .filter((role) => role.attribuable && !role.touteLEntreprise)
      .map((role) => ({ valeur: role.code, libelle: t(`roles.${role.code}`) })),
  ]
  const adminAttribuable = parCode.get(ADMIN)?.attribuable === true
  const codesChoisis =
    portee === 'entreprise' ? [ADMIN] : Object.values(rolesChoisis).filter((role) => role !== '')
  const ouvreBackOffice = codesChoisis.some((code) => parCode.get(code)?.backOffice === true)
  const identifiantExistant = employe?.telephone ?? employe?.email
  const telephonePays = telephoneDuPays(pays)

  // Vérifié ici et non dans le schéma : « roles » n'est pas un champ enregistré (seuls
  // « roles.<établissement> » le sont), et une erreur du schéma posée sur lui serait perdue.
  // Appelé aussi quand le reste est invalide, pour montrer tout ce qui manque d'un coup.
  function verifierRoles(saisie: Pick<Saisie, 'portee' | 'roles'>): boolean {
    const aUnRole =
      saisie.portee === 'entreprise' || Object.values(saisie.roles).some((role) => role !== '')
    if (!aUnRole) setError('roles', { type: 'manual', message: 'personnel.validation.role' })
    return aUnRole
  }

  function effacerErreurRoles() {
    clearErrors('roles')
  }

  async function envoyer(saisie: Valide) {
    setErreur(null)
    setConflit(false)
    if (!verifierRoles(saisie)) return
    const donnerAcces = saisie.acces && ouvreBackOffice && identifiantExistant === undefined
    const telephone = donnerAcces ? texteOptionnel(saisie.telephone) : undefined
    const email = donnerAcces ? texteOptionnel(saisie.email) : undefined
    const demande: DemandeEmploye = {
      prenom: saisie.prenom,
      nom: saisie.nom,
      affectations: affectationsDe(saisie),
      ...(telephone === undefined ? {} : { telephone }),
      ...(email === undefined ? {} : { email }),
    }
    try {
      const resultat =
        employe === undefined || version === undefined
          ? await appelerApi<ResultatEmploye>('/personnel', { methode: 'POST', corps: demande })
          : await appelerApi<ResultatEmploye>(`/personnel/${employe.id}`, {
              methode: 'PUT',
              corps: { ...demande, version } satisfies DemandeModificationEmploye,
            })
      surEnregistre(resultat)
    } catch (erreurEnvoi) {
      if (
        employe !== undefined &&
        erreurEnvoi instanceof ErreurApi &&
        erreurEnvoi.code === 'CONFLIT_MODIFICATION'
      ) {
        await rechargerApresConflit(employe.id)
        return
      }
      const restants = placerErreursServeur(erreurEnvoi, setError, {
        champs: CHAMPS,
        alias: { affectations: 'roles' },
      })
      if (
        !(erreurEnvoi instanceof ErreurApi) ||
        erreurEnvoi.reponse.champs === undefined ||
        restants.length > 0
      ) {
        setErreur(erreurEnvoi)
      }
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
  // « roles » est un dictionnaire : pour TypeScript, « message » pourrait y être un établissement.
  // L'erreur posée sur le bloc entier (aucun rôle choisi) est bien une FieldError.
  const messageRoles = (errors.roles as FieldError | undefined)?.message
  const titre =
    employe === undefined
      ? t('personnel.formulaire.titreCreation')
      : t('personnel.formulaire.titreModification', { nom: `${employe.prenom} ${employe.nom}` })

  return (
    <form
      noValidate
      aria-labelledby={idTitre}
      onSubmit={(evenement) =>
        void handleSubmit(envoyer, () => {
          verifierRoles(getValues())
        })(evenement)
      }
      className="flex flex-col gap-4 rounded-moyen border border-trait bg-surface p-4 md:p-6"
    >
      <h2 id={idTitre} className="m-0 text-titre-carte text-encre">
        {titre}
      </h2>
      {conflit && <Alerte ton="alerte">{t('personnel.formulaire.conflit')}</Alerte>}

      <Bloc titre={t('personnel.formulaire.identite')}>
        <div className="grid gap-4 md:grid-cols-2">
          <ChampSaisie
            libelle={t('personnel.formulaire.prenom')}
            obligatoire
            maxLength={100}
            autoComplete="off"
            erreur={message(errors.prenom?.message)}
            {...register('prenom')}
          />
          <ChampSaisie
            libelle={t('personnel.formulaire.nom')}
            obligatoire
            maxLength={100}
            autoComplete="off"
            erreur={message(errors.nom?.message)}
            {...register('nom')}
          />
        </div>
      </Bloc>

      <Bloc
        titre={t('personnel.formulaire.roles')}
        {...(messageRoles === undefined ? {} : { decritPar: idErreurRoles })}
      >
        {messageRoles !== undefined && (
          <p id={idErreurRoles} className="m-0 text-corps-fort text-danger">
            {t(messageRoles)}
          </p>
        )}
        {adminAttribuable && (
          <div
            role="radiogroup"
            aria-label={t('personnel.formulaire.portee')}
            className="flex flex-col gap-1 sm:flex-row sm:gap-6"
          >
            <Radio
              value="etablissements"
              libelle={t('personnel.formulaire.parEtablissement')}
              {...register('portee', { onChange: effacerErreurRoles })}
            />
            <Radio
              value="entreprise"
              libelle={t('personnel.formulaire.touteLEntreprise')}
              {...register('portee', { onChange: effacerErreurRoles })}
            />
          </div>
        )}
        {portee === 'entreprise' ? (
          <p className="m-0 text-corps text-attenue">{t('personnel.formulaire.adminAide')}</p>
        ) : (
          <>
            <p className="m-0 text-legende text-attenue">{t('personnel.formulaire.rolesAide')}</p>
            <ul className="m-0 flex max-w-2xl list-none flex-col divide-y divide-trait rounded-normal border border-trait p-0">
              {etablissements.map((etablissement) => (
                <li
                  key={etablissement.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-corps-fort text-encre">{etablissement.nom}</span>
                    {etablissement.ville !== undefined && (
                      <span className="text-legende text-attenue">{etablissement.ville}</span>
                    )}
                  </span>
                  <div className="w-full sm:w-56">
                    <ChampSelection
                      libelle={t('personnel.formulaire.roleA', { lieu: etablissement.nom })}
                      libelleMasque
                      options={optionsRoles}
                      {...register(`roles.${etablissement.id}`, { onChange: effacerErreurRoles })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Bloc>

      <Bloc titre={t('personnel.formulaire.acces')}>
        {identifiantExistant !== undefined && (
          <p className="m-0 text-corps text-encre">
            {t('personnel.formulaire.accesExistant', { identifiant: identifiantExistant })}
          </p>
        )}
        {identifiantExistant === undefined && !ouvreBackOffice && (
          <p className="m-0 text-corps text-attenue">
            {codesChoisis.length === 0
              ? t('personnel.formulaire.accesSansRole', {
                  roles: roles
                    .filter((role) => role.backOffice && role.attribuable)
                    .map((role) => t(`roles.${role.code}`))
                    .join(` ${t('personnel.formulaire.ou')} `),
                })
              : t('personnel.formulaire.accesImpossible')}
          </p>
        )}
        {identifiantExistant === undefined && ouvreBackOffice && (
          <>
            <Case
              libelle={t('personnel.formulaire.donnerAcces')}
              aide={t('personnel.formulaire.accesAide')}
              {...register('acces')}
            />
            {acces && (
              <div className="grid gap-4 md:grid-cols-2">
                <ChampSaisie
                  libelle={t('formulaireEntreprise.telephone')}
                  type="tel"
                  autoComplete="off"
                  maxLength={32}
                  prefixe={
                    telephoneSaisi.trim().startsWith('+') ? undefined : telephonePays?.indicatif
                  }
                  placeholder={telephonePays?.exemple}
                  aide={t('formulaireEntreprise.telephoneAide', {
                    pays: nomPays(pays, i18n.language),
                  })}
                  erreur={message(errors.telephone?.message)}
                  {...register('telephone')}
                />
                <ChampSaisie
                  libelle={t('formulaireEntreprise.email')}
                  type="email"
                  autoComplete="off"
                  maxLength={254}
                  aide={t('formulaireEntreprise.contactAide')}
                  erreur={message(errors.email?.message)}
                  {...register('email')}
                />
              </div>
            )}
          </>
        )}
      </Bloc>

      {employe === undefined && (
        <p className="m-0 text-legende text-attenue">{t('personnel.formulaire.codesInfo')}</p>
      )}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <div className="flex flex-wrap justify-end gap-2">
        <Bouton onClick={surAnnuler}>{t('commun.annuler')}</Bouton>
        <Bouton variante="principal" type="submit" enCours={isSubmitting}>
          {employe === undefined
            ? t('personnel.formulaire.creer')
            : t('personnel.formulaire.enregistrer')}
        </Bouton>
      </div>
    </form>
  )
}

function Bloc({
  titre,
  decritPar,
  children,
}: Readonly<{ titre: string; decritPar?: string; children: ReactNode }>) {
  return (
    <fieldset
      aria-describedby={decritPar}
      className="m-0 flex min-w-0 flex-col gap-3 rounded-normal border border-trait p-4"
    >
      <legend className="px-1 text-corps-fort text-encre">{titre}</legend>
      {children}
    </fieldset>
  )
}

/** Case à cocher : le libellé la nomme, l'aide la décrit (lue après le nom par un lecteur d'écran). */

function Radio({
  libelle,
  ...reste
}: Readonly<
  { libelle: string } & React.InputHTMLAttributes<HTMLInputElement> & {
      ref?: React.Ref<HTMLInputElement>
    }
>) {
  return (
    <label className="flex min-h-cible-min cursor-pointer items-center gap-3 text-corps text-encre">
      <input type="radio" className="size-5 shrink-0 cursor-pointer accent-accent" {...reste} />
      {libelle}
    </label>
  )
}
