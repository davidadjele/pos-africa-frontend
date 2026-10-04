import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Pencil, Plus, RotateCw, TabletSmartphone } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  AppareilResume,
  CodeGenere,
  EtablissementResume,
  PageAppareils,
  StatutCode,
  TypeAppareil,
} from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterDateHeure } from '../../partage/dates/formaterDate'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { CodeSecret } from '../../partage/ui/CodeSecret'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions } from '../../partage/ui/MenuActions'
import { Pagination, Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { requeteEtablissements } from '../etablissements/requetes'

const TAILLE_PAGE = 50
// Le gérant attend, téléphone en main, que la tablette tape le code : un suivi rapproché suffit.
const SUIVI_DU_CODE_MS = 2000

function requeteAppareils(page: number) {
  return queryOptions({
    queryKey: ['appareils', page],
    queryFn: ({ signal }) =>
      appelerApi<PageAppareils>(`/appareils?page=${String(page)}&taille=${String(TAILLE_PAGE)}`, {
        signal,
      }),
  })
}

type Etape = { etape: 'formulaire' } | { etape: 'code'; code: CodeGenere; nom: string }

export function PageTablettes() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { moi } = useSession()
  const fuseau = moi?.entrepriseCourante?.fuseauHoraire ?? 'Africa/Lome'
  const [page, setPage] = useState(0)
  const requete = useQuery(requeteAppareils(page))
  const etablissements = useQuery(requeteEtablissements(0))
  const [enregistrement, setEnregistrement] = useState<Etape | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [aRevoquer, setARevoquer] = useState<AppareilResume | null>(null)
  const [aRenommer, setARenommer] = useState<AppareilResume | null>(null)

  const nomsEtablissements = new Map(
    (etablissements.data?.elements ?? []).map((etablissement) => [
      etablissement.id,
      etablissement.nom,
    ]),
  )

  async function actualiser() {
    await clientRequetes.invalidateQueries({ queryKey: ['appareils'] })
  }

  const colonnes: ColonneTableau<AppareilResume>[] = [
    {
      cle: 'nom',
      entete: t('tablettes.colonnes.nom'),
      rendu: (a) => <span className="font-semibold">{a.nom}</span>,
    },
    {
      cle: 'usage',
      entete: t('tablettes.colonnes.usage'),
      rendu: (a) => t(`tablettes.types.${a.type}`),
    },
    {
      cle: 'etablissement',
      entete: t('tablettes.colonnes.etablissement'),
      rendu: (a) => nomsEtablissements.get(a.etablissementId) ?? '…',
    },
    {
      cle: 'activite',
      entete: t('tablettes.colonnes.activite'),
      masqueeSurTelephone: true,
      rendu: (a) =>
        a.derniereActiviteLe === undefined ? '' : formaterDateHeure(a.derniereActiviteLe, fuseau),
    },
    {
      cle: 'statut',
      entete: t('tablettes.colonnes.statut'),
      rendu: (a) => (
        <BadgeStatut ton={a.revoquee ? 'neutre' : 'succes'}>
          {a.revoquee ? t('tablettes.statut.revoquee') : t('tablettes.statut.active')}
        </BadgeStatut>
      ),
    },
    {
      cle: 'actions',
      entete: t('tablettes.colonnes.actions'),
      rendu: (a) =>
        a.revoquee ? null : (
          <div className="flex justify-end gap-2">
            <Bouton
              icone={Pencil}
              aria-label={t('tablettes.modifierNomme', { nom: a.nom })}
              onClick={() => {
                setConfirmation(null)
                setARenommer(a)
              }}
            >
              {t('tablettes.modifier')}
            </Bouton>
            <MenuActions
              libelle={t('tablettes.plusDActions', { nom: a.nom })}
              actions={[
                {
                  libelle: t('tablettes.revoquer'),
                  icone: Ban,
                  ton: 'danger',
                  surChoisir: () => {
                    setConfirmation(null)
                    setARevoquer(a)
                  },
                },
              ]}
            />
          </div>
        ),
    },
  ]

  const liste = requete.data
  const vide = liste?.total === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-titre-page text-encre">{t('tablettes.titre')}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('tablettes.phrase')}</p>
        </div>
        {enregistrement === null && etablissements.data !== undefined && (
          <Bouton
            variante="principal"
            icone={Plus}
            onClick={() => {
              setConfirmation(null)
              setEnregistrement({ etape: 'formulaire' })
            }}
          >
            {t('tablettes.enregistrer')}
          </Bouton>
        )}
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}

      {enregistrement?.etape === 'formulaire' && etablissements.data !== undefined && (
        <FormulaireCode
          etablissements={etablissements.data.elements}
          surGenere={(code, nom) => {
            setEnregistrement({ etape: 'code', code, nom })
          }}
          surAnnuler={() => {
            setEnregistrement(null)
          }}
        />
      )}

      {enregistrement?.etape === 'code' && (
        <PanneauCode
          code={enregistrement.code}
          nom={enregistrement.nom}
          surFermer={() => {
            setEnregistrement(null)
            void actualiser()
          }}
          surNouveauCode={() => {
            setEnregistrement({ etape: 'formulaire' })
          }}
        />
      )}

      {requete.isPending && <Chargement texte={t('tablettes.chargement')} />}
      {requete.isError && (
        <AlerteErreur
          erreur={requete.error}
          action={
            <Bouton icone={RotateCw} onClick={() => void requete.refetch()}>
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}

      {vide && enregistrement === null && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide titre={t('tablettes.vide.titre')} phrase={t('tablettes.vide.phrase')} />
        </section>
      )}

      {liste !== undefined && !vide && (
        <>
          <Tableau
            libelle={t('tablettes.tableau')}
            colonnes={colonnes}
            lignes={liste.elements}
            cleLigne={(a) => a.id}
          />
          <Pagination
            page={page}
            taille={TAILLE_PAGE}
            total={liste.total}
            surChangerPage={setPage}
          />
        </>
      )}

      {aRevoquer !== null && (
        <DialogueRevocation
          appareil={aRevoquer}
          surFermer={() => {
            setARevoquer(null)
          }}
          surRevoque={() => {
            setConfirmation(t('tablettes.revocation.faite', { nom: aRevoquer.nom }))
            setARevoquer(null)
            void actualiser()
          }}
        />
      )}

      {aRenommer !== null && (
        <DialogueRenommage
          appareil={aRenommer}
          surFermer={() => {
            setARenommer(null)
          }}
          surRenomme={(nom) => {
            setConfirmation(t('tablettes.renommage.fait', { nom }))
            setARenommer(null)
            void actualiser()
          }}
        />
      )}
    </div>
  )
}

function FormulaireCode({
  etablissements,
  surGenere,
  surAnnuler,
}: Readonly<{
  etablissements: EtablissementResume[]
  surGenere: (code: CodeGenere, nom: string) => void
  surAnnuler: () => void
}>) {
  const { t } = useTranslation()
  const idTitre = useId()
  const [etablissementId, setEtablissementId] = useState(etablissements[0]?.id ?? '')
  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeAppareil>('CAISSE')
  const [erreurNom, setErreurNom] = useState<string | undefined>()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function envoyer() {
    if (nom.trim() === '') {
      setErreurNom(t('validation.obligatoire'))
      return
    }
    setEnCours(true)
    setErreur(null)
    try {
      const code = await appelerApi<CodeGenere>('/appareils/codes', {
        methode: 'POST',
        corps: { etablissementId, nom: nom.trim(), type },
      })
      surGenere(code, nom.trim())
    } catch (refus) {
      setErreur(refus)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form
      noValidate
      aria-labelledby={idTitre}
      onSubmit={(evenement) => {
        evenement.preventDefault()
        void envoyer()
      }}
      className="flex flex-col gap-4 rounded-moyen border border-trait bg-surface p-4 md:p-6"
    >
      <h2 id={idTitre} className="m-0 text-titre-carte text-encre">
        {t('tablettes.enregistrer')}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <ChampSelection
          libelle={t('tablettes.formulaire.etablissement')}
          obligatoire
          value={etablissementId}
          options={etablissements.map((etablissement) => ({
            valeur: etablissement.id,
            libelle: etablissement.nom,
          }))}
          onChange={(evenement) => {
            setEtablissementId(evenement.target.value)
          }}
        />
        <ChampUsage valeur={type} surChanger={setType} />
        <ChampSaisie
          libelle={t('tablettes.formulaire.nom')}
          obligatoire
          maxLength={60}
          aide={t('tablettes.formulaire.nomAide')}
          erreur={erreurNom}
          value={nom}
          onChange={(evenement) => {
            setErreurNom(undefined)
            setNom(evenement.target.value)
          }}
        />
      </div>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <div className="flex flex-wrap justify-end gap-2">
        <Bouton onClick={surAnnuler}>{t('commun.annuler')}</Bouton>
        <Bouton variante="principal" type="submit" enCours={enCours}>
          {t('tablettes.formulaire.generer')}
        </Bouton>
      </div>
    </form>
  )
}

const TYPES: TypeAppareil[] = ['CAISSE', 'CUISINE']

/** Caisse prise par PIN, ou écran cuisine sans PIN. */
function ChampUsage({
  valeur,
  surChanger,
}: Readonly<{ valeur: TypeAppareil; surChanger: (type: TypeAppareil) => void }>) {
  const { t } = useTranslation()
  return (
    <ChampSelection
      libelle={t('tablettes.formulaire.usage')}
      obligatoire
      aide={t(`tablettes.formulaire.usageAide.${valeur}`)}
      value={valeur}
      options={TYPES.map((type) => ({ valeur: type, libelle: t(`tablettes.types.${type}`) }))}
      onChange={(evenement) => {
        surChanger(evenement.target.value as TypeAppareil)
      }}
    />
  )
}

/** « 9:42 » : temps restant avant que le code expire. */
function formaterReste(millisecondes: number): string {
  const secondes = Math.max(0, Math.ceil(millisecondes / 1000))
  return `${String(Math.floor(secondes / 60))}:${String(secondes % 60).padStart(2, '0')}`
}

function PanneauCode({
  code,
  nom,
  surFermer,
  surNouveauCode,
}: Readonly<{ code: CodeGenere; nom: string; surFermer: () => void; surNouveauCode: () => void }>) {
  const { t } = useTranslation()
  const idTitre = useId()
  const [reste, setReste] = useState(() => Date.parse(code.expireLe) - Date.now())
  const [erreur, setErreur] = useState<unknown>(null)
  const suivi = useQuery({
    queryKey: ['appareils', 'codes', code.id],
    queryFn: ({ signal }) => appelerApi<StatutCode>(`/appareils/codes/${code.id}`, { signal }),
    refetchInterval: (requete) =>
      requete.state.data?.statut === 'EN_ATTENTE' ? SUIVI_DU_CODE_MS : false,
  })
  const statut =
    reste <= 0 && suivi.data?.statut !== 'UTILISE' ? 'EXPIRE' : (suivi.data?.statut ?? 'EN_ATTENTE')

  useEffect(() => {
    const minuterie = window.setInterval(() => {
      setReste(Date.parse(code.expireLe) - Date.now())
    }, 1000)
    return () => {
      window.clearInterval(minuterie)
    }
  }, [code.expireLe])

  async function annuler() {
    try {
      await appelerApi(`/appareils/codes/${code.id}`, { methode: 'DELETE' })
      surFermer()
    } catch (refus) {
      setErreur(refus)
    }
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="flex max-w-xl flex-col gap-4 rounded-moyen border border-trait bg-surface p-4 md:p-6"
    >
      <h2 id={idTitre} className="m-0 text-titre-carte text-encre">
        {t('tablettes.code.titre')}
      </h2>
      <p className="m-0 text-corps text-attenue">{t('tablettes.code.pour', { nom })}</p>
      {statut === 'EN_ATTENTE' && (
        <>
          <CodeSecret libelle={t('tablettes.code.aTaper')} code={code.code} copiable={false} />
          <p className="m-0 text-corps text-encre">
            {t('tablettes.code.valable')}{' '}
            <span className="chiffres font-semibold">{formaterReste(reste)}</span>
          </p>
          <Alerte ton="info">
            <span className="inline-flex items-center gap-2">
              <TabletSmartphone aria-hidden="true" size={18} />
              {t('tablettes.code.attente')}
            </span>
          </Alerte>
          {erreur !== null && <AlerteErreur erreur={erreur} />}
          <div>
            <Bouton onClick={() => void annuler()}>{t('tablettes.code.annuler')}</Bouton>
          </div>
        </>
      )}
      {statut === 'UTILISE' && (
        <>
          <Alerte ton="succes">{t('tablettes.code.enregistree', { nom })}</Alerte>
          <div>
            <Bouton variante="principal" onClick={surFermer}>
              {t('tablettes.code.terminer')}
            </Bouton>
          </div>
        </>
      )}
      {statut === 'EXPIRE' && (
        <>
          <Alerte ton="alerte">{t('tablettes.code.expire')}</Alerte>
          <div className="flex flex-wrap gap-2">
            <Bouton variante="principal" onClick={surNouveauCode}>
              {t('tablettes.code.nouveau')}
            </Bouton>
            <Bouton onClick={surFermer}>{t('commun.annuler')}</Bouton>
          </div>
        </>
      )}
    </section>
  )
}

function DialogueRevocation({
  appareil,
  surFermer,
  surRevoque,
}: Readonly<{ appareil: AppareilResume; surFermer: () => void; surRevoque: () => void }>) {
  const { t } = useTranslation()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function revoquer() {
    setEnCours(true)
    try {
      await appelerApi(`/appareils/${appareil.id}/revocation`, { methode: 'POST' })
      surRevoque()
    } catch (refus) {
      setErreur(refus)
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={t('tablettes.revocation.titre', { nom: appareil.nom })}
      consequence={t('tablettes.revocation.consequence')}
      libelleAnnuler={t('tablettes.revocation.annuler')}
      libelleConfirmer={t('tablettes.revocation.confirmer')}
      tonConfirmation="danger"
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void revoquer()}
    >
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}

function DialogueRenommage({
  appareil,
  surFermer,
  surRenomme,
}: Readonly<{
  appareil: AppareilResume
  surFermer: () => void
  surRenomme: (nom: string) => void
}>) {
  const { t } = useTranslation()
  const [nom, setNom] = useState(appareil.nom)
  const [type, setType] = useState<TypeAppareil>(appareil.type)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function renommer() {
    if (nom.trim() === '') return
    setEnCours(true)
    try {
      const renomme = await appelerApi<AppareilResume>(`/appareils/${appareil.id}`, {
        methode: 'PUT',
        corps: { nom: nom.trim(), type, version: appareil.version },
      })
      surRenomme(renomme.nom)
    } catch (refus) {
      setErreur(refus)
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={t('tablettes.renommage.titre', { nom: appareil.nom })}
      consequence={t('tablettes.renommage.consequence')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('commun.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void renommer()}
    >
      <ChampSaisie
        libelle={t('tablettes.formulaire.nom')}
        obligatoire
        maxLength={60}
        value={nom}
        onChange={(evenement) => {
          setNom(evenement.target.value)
        }}
      />
      <ChampUsage valeur={type} surChanger={setType} />
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}
