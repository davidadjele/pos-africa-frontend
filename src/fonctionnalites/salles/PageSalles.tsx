import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowDown, ArrowUp, Pencil, Plus, Power, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DemandeSalle,
  DemandeTable,
  DemandeTablesEnLot,
  SalleResume,
  TableResume,
} from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { useSession } from '../../partage/auth/useSession'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions, type ActionMenu } from '../../partage/ui/MenuActions'
import { requeteEtablissements } from '../etablissements/requetes'
import { nomsDeTables, suivantDe } from './nomsDeTables'

type Dialogues =
  | { type: 'salle'; salle: SalleResume | null }
  | { type: 'lot'; salle: SalleResume }
  | { type: 'table'; table: TableResume }

/** Nouvel ordre après avoir déplacé l'élément d'un rang vers le haut (-1) ou vers le bas (+1). */
function deplacer(ids: string[], rang: number, pas: -1 | 1): string[] {
  const nouveaux = [...ids]
  const [deplace] = nouveaux.splice(rang, 1)
  if (deplace !== undefined) nouveaux.splice(rang + pas, 0, deplace)
  return nouveaux
}

/** Salles (onglets de la caisse) et tables d'un établissement. */
export function PageSalles() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { aLaPermission } = useSession()
  const peutGerer = aLaPermission('SALLE_GERER')
  const etablissements = useQuery(requeteEtablissements(0))
  const [etablissementChoisi, setEtablissementChoisi] = useState<string | null>(null)
  const etablissement =
    etablissements.data?.elements.find((candidat) => candidat.id === etablissementChoisi) ??
    etablissements.data?.elements[0]
  const salles = useQuery({
    queryKey: ['salles', etablissement?.id ?? ''],
    queryFn: ({ signal }) =>
      appelerApi<SalleResume[]>(`/etablissements/${etablissement?.id ?? ''}/salles`, { signal }),
    enabled: etablissement !== undefined,
  })
  const [salleChoisie, setSalleChoisie] = useState<string | null>(null)
  const [dialogue, setDialogue] = useState<Dialogues | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const salle = salles.data?.find((candidate) => candidate.id === salleChoisie) ?? salles.data?.[0]

  async function agir(
    action: () => Promise<unknown>,
    message?: string,
    refus?: (e: ErreurApi) => string | null,
  ) {
    setErreur(null)
    setConfirmation(null)
    try {
      await action()
      if (message !== undefined) setConfirmation(message)
      await clientRequetes.invalidateQueries({ queryKey: ['salles'] })
    } catch (probleme) {
      const message = probleme instanceof ErreurApi ? refus?.(probleme) : null
      setErreur(message == null ? probleme : new Error(message))
    }
  }

  function terminer(message: string) {
    setDialogue(null)
    setConfirmation(message)
    setErreur(null)
    void clientRequetes.invalidateQueries({ queryKey: ['salles'] })
  }

  function actionsSalle(courante: SalleResume, liste: SalleResume[]): ActionMenu[] {
    const rang = liste.findIndex((candidate) => candidate.id === courante.id)
    const ids = liste.map((candidate) => candidate.id)
    const ordonner = (pas: -1 | 1) =>
      void agir(() =>
        appelerApi(`/etablissements/${etablissement?.id ?? ''}/salles/ordre`, {
          methode: 'PUT',
          corps: { ids: deplacer(ids, rang, pas) },
        }),
      )
    const actions: ActionMenu[] = []
    if (rang > 0) {
      actions.push({
        libelle: t('salles.monter'),
        icone: ArrowUp,
        surChoisir: () => {
          ordonner(-1)
        },
      })
    }
    if (rang < liste.length - 1) {
      actions.push({
        libelle: t('salles.descendre'),
        icone: ArrowDown,
        surChoisir: () => {
          ordonner(1)
        },
      })
    }
    actions.push(
      activation(`/salles/${courante.id}`, courante.nom, courante.active, (probleme) =>
        probleme.code === 'SALLE_EN_USAGE'
          ? t('salles.enUsage', {
              nom: courante.nom,
              count: courante.tables.filter((table) => table.active).length,
            })
          : null,
      ),
    )
    return actions
  }

  function actionsTable(
    table: TableResume,
    tables: TableResume[],
    courante: SalleResume,
  ): ActionMenu[] {
    const rang = tables.findIndex((candidate) => candidate.id === table.id)
    const ids = tables.map((candidate) => candidate.id)
    const ordonner = (pas: -1 | 1) =>
      void agir(() =>
        appelerApi(`/salles/${courante.id}/tables/ordre`, {
          methode: 'PUT',
          corps: { ids: deplacer(ids, rang, pas) },
        }),
      )
    const actions: ActionMenu[] = [
      {
        libelle: t('salles.modifier'),
        icone: Pencil,
        surChoisir: () => {
          setDialogue({ type: 'table', table })
        },
      },
    ]
    if (rang > 0) {
      actions.push({
        libelle: t('salles.monter'),
        icone: ArrowUp,
        surChoisir: () => {
          ordonner(-1)
        },
      })
    }
    if (rang < tables.length - 1) {
      actions.push({
        libelle: t('salles.descendre'),
        icone: ArrowDown,
        surChoisir: () => {
          ordonner(1)
        },
      })
    }
    actions.push(activation(`/tables/${table.id}`, table.nom, table.active))
    return actions
  }

  function activation(
    chemin: string,
    nom: string,
    active: boolean,
    refus?: (e: ErreurApi) => string | null,
  ): ActionMenu {
    return {
      libelle: active ? t('salles.desactiver') : t('salles.reactiver'),
      icone: Power,
      ...(active ? { ton: 'danger' as const } : {}),
      surChoisir: () =>
        void agir(
          () =>
            appelerApi(`${chemin}/${active ? 'desactivation' : 'reactivation'}`, {
              methode: 'POST',
            }),
          t(active ? 'salles.fait.desactivee' : 'salles.fait.reactivee', { nom }),
          refus,
        ),
    }
  }

  const liste = salles.data ?? []
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="m-0 text-titre-page text-encre">
            {etablissement === undefined
              ? t('salles.titreSansEtablissement')
              : t('salles.titre', { etablissement: etablissement.nom })}
          </h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('salles.phrase')}</p>
        </div>
        {(etablissements.data?.elements.length ?? 0) > 1 && (
          <div className="w-60">
            <ChampSelection
              libelle={t('salles.etablissement')}
              options={(etablissements.data?.elements ?? []).map((candidat) => ({
                valeur: candidat.id,
                libelle: candidat.nom,
              }))}
              value={etablissement?.id ?? ''}
              onChange={(evenement) => {
                setEtablissementChoisi(evenement.target.value)
                setSalleChoisie(null)
              }}
            />
          </div>
        )}
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
      {erreur instanceof Error && !(erreur instanceof ErreurApi) ? (
        <Alerte ton="danger">{erreur.message}</Alerte>
      ) : (
        erreur !== null && <AlerteErreur erreur={erreur} />
      )}
      {(etablissements.isError || salles.isError) && (
        <AlerteErreur
          erreur={etablissements.error ?? salles.error}
          action={
            <Bouton icone={RotateCw} onClick={() => void salles.refetch()}>
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {(etablissements.isPending || (etablissement !== undefined && salles.isPending)) && (
        <Chargement texte={t('salles.chargement')} />
      )}

      {salles.data?.length === 0 && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            titre={t('salles.vide.titre')}
            phrase={t('salles.vide.phrase')}
            {...(peutGerer
              ? {
                  action: (
                    <Bouton
                      variante="principal"
                      icone={Plus}
                      onClick={() => {
                        setDialogue({ type: 'salle', salle: null })
                      }}
                    >
                      {t('salles.nouvelle')}
                    </Bouton>
                  ),
                }
              : {})}
          />
        </section>
      )}

      {salle !== undefined && (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="tablist"
              aria-label={t('salles.onglets')}
              className="flex max-w-full gap-0.5 overflow-x-auto rounded-moyen bg-trait p-0.75"
            >
              {liste.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="tab"
                  aria-selected={candidate.id === salle.id}
                  onClick={() => {
                    setSalleChoisie(candidate.id)
                  }}
                  className={clsx(
                    'flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-normal px-3.5 text-corps',
                    candidate.id === salle.id
                      ? 'bg-surface font-bold text-encre'
                      : 'font-semibold text-encre',
                    !candidate.active && 'text-attenue line-through',
                  )}
                >
                  {candidate.nom}
                  <span className="chiffres font-medium text-attenue">
                    {candidate.tables.filter((table) => table.active).length}
                  </span>
                </button>
              ))}
            </div>
            {peutGerer && (
              <>
                <Bouton
                  icone={Plus}
                  onClick={() => {
                    setDialogue({ type: 'salle', salle: null })
                  }}
                >
                  {t('salles.nouvelle')}
                </Bouton>
                <span className="flex-1" />
                <Bouton
                  onClick={() => {
                    setDialogue({ type: 'salle', salle })
                  }}
                >
                  {t('salles.renommer', { nom: salle.nom })}
                </Bouton>
                <MenuActions
                  libelle={t('salles.plusDActionsSalle', { nom: salle.nom })}
                  actions={actionsSalle(salle, liste)}
                />
                <Bouton
                  variante="principal"
                  icone={Plus}
                  onClick={() => {
                    setDialogue({ type: 'lot', salle })
                  }}
                >
                  {t('salles.ajouterTables')}
                </Bouton>
              </>
            )}
          </div>
          {salle.tables.length === 0 ? (
            <p className="m-0 rounded-moyen border border-trait bg-surface p-6 text-corps text-attenue">
              {t('salles.videSalle')}
            </p>
          ) : (
            <ul
              aria-label={t('salles.grille', { salle: salle.nom })}
              className="m-0 grid list-none grid-cols-3 gap-2 p-0 md:grid-cols-4 md:gap-3 lg:grid-cols-5"
            >
              {salle.tables.map((table) => (
                <li
                  key={table.id}
                  aria-label={table.nom}
                  className={clsx(
                    'flex h-24 flex-col justify-between rounded-moyen border border-trait p-3 md:h-30 md:p-3.5',
                    table.active ? 'bg-surface' : 'bg-fond',
                  )}
                >
                  <span className="flex items-start gap-2">
                    <span
                      className={clsx(
                        'text-titre-carte',
                        table.active ? 'text-encre' : 'text-attenue',
                      )}
                    >
                      {table.nom}
                    </span>
                    <span className="flex-1" />
                    {peutGerer && (
                      <MenuActions
                        libelle={t('salles.plusDActionsTable', { nom: table.nom })}
                        actions={actionsTable(table, salle.tables, salle)}
                      />
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-legende text-attenue">
                    <span className="chiffres">{t('salles.places', { count: table.places })}</span>
                    {!table.active && (
                      <BadgeStatut ton="neutre">{t('salles.desactivee')}</BadgeStatut>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {dialogue?.type === 'salle' && etablissement !== undefined && (
        <DialogueSalle
          salle={dialogue.salle}
          etablissementId={etablissement.id}
          surFermer={() => {
            setDialogue(null)
          }}
          surEnregistre={terminer}
        />
      )}
      {dialogue?.type === 'lot' && (
        <DialogueTablesEnLot
          salle={dialogue.salle}
          nomsExistants={liste.flatMap((candidate) => candidate.tables.map((table) => table.nom))}
          surFermer={() => {
            setDialogue(null)
          }}
          surEnregistre={terminer}
        />
      )}
      {dialogue?.type === 'table' && (
        <DialogueTable
          table={dialogue.table}
          salles={liste}
          salleActuelle={salle?.id ?? ''}
          surFermer={() => {
            setDialogue(null)
          }}
          surEnregistre={terminer}
        />
      )}
    </div>
  )
}

function useEnvoi(surEnregistre: (message: string) => void) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  async function envoyer(action: () => Promise<unknown>, message: string) {
    setEnCours(true)
    setErreur(null)
    try {
      await action()
      surEnregistre(message)
    } catch (refus) {
      setErreur(refus)
      setEnCours(false)
    }
  }
  return { enCours, erreur, envoyer }
}

function DialogueSalle({
  salle,
  etablissementId,
  surFermer,
  surEnregistre,
}: Readonly<{
  salle: SalleResume | null
  etablissementId: string
  surFermer: () => void
  surEnregistre: (message: string) => void
}>) {
  const { t } = useTranslation()
  const [nom, setNom] = useState(salle?.nom ?? '')
  const [erreurNom, setErreurNom] = useState<string | undefined>(undefined)
  const { enCours, erreur, envoyer } = useEnvoi(surEnregistre)

  function enregistrer() {
    const saisi = nom.trim()
    if (saisi === '') {
      setErreurNom(t('validation.obligatoire'))
      return
    }
    const corps: DemandeSalle = {
      nom: saisi,
      ...(salle === null ? {} : { version: salle.version }),
    }
    void envoyer(
      () =>
        appelerApi(
          salle === null ? `/etablissements/${etablissementId}/salles` : `/salles/${salle.id}`,
          {
            methode: salle === null ? 'POST' : 'PUT',
            corps,
          },
        ),
      t(salle === null ? 'salles.fait.salleCreee' : 'salles.fait.salleRenommee', { nom: saisi }),
    )
  }

  return (
    <Dialogue
      titre={
        salle === null
          ? t('salles.dialogueSalle.titreCreation')
          : t('salles.dialogueSalle.titreRenommage', { nom: salle.nom })
      }
      consequence={t('salles.dialogueSalle.consequence')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={
        salle === null ? t('salles.dialogueSalle.creer') : t('salles.dialogueSalle.enregistrer')
      }
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={enregistrer}
    >
      <ChampSaisie
        libelle={t('salles.dialogueSalle.nom')}
        obligatoire
        maxLength={40}
        value={nom}
        erreur={erreurNom}
        onChange={(evenement) => {
          setNom(evenement.target.value)
        }}
      />
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}

function DialogueTablesEnLot({
  salle,
  nomsExistants,
  surFermer,
  surEnregistre,
}: Readonly<{
  salle: SalleResume
  nomsExistants: string[]
  surFermer: () => void
  surEnregistre: (message: string) => void
}>) {
  const { t } = useTranslation()
  const [nombre, setNombre] = useState('4')
  const [premierNom, setPremierNom] = useState(suivantDe(nomsExistants))
  const [places, setPlaces] = useState('4')
  const [invalide, setInvalide] = useState(false)
  const { enCours, erreur, envoyer } = useEnvoi(surEnregistre)
  const nombreLu = Number(nombre)
  const placesLues = Number(places)
  const valides =
    Number.isInteger(nombreLu) &&
    nombreLu >= 1 &&
    nombreLu <= 50 &&
    Number.isInteger(placesLues) &&
    placesLues >= 1 &&
    placesLues <= 50 &&
    premierNom.trim() !== ''

  function enregistrer() {
    if (!valides) {
      setInvalide(true)
      return
    }
    const corps: DemandeTablesEnLot = {
      nombre: nombreLu,
      premierNom: premierNom.trim(),
      places: placesLues,
    }
    void envoyer(
      () => appelerApi(`/salles/${salle.id}/tables/lot`, { methode: 'POST', corps }),
      t('salles.fait.tablesAjoutees', { count: nombreLu }),
    )
  }

  return (
    <Dialogue
      titre={t('salles.lot.titre', { salle: salle.nom })}
      consequence={t('salles.lot.consequence')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('salles.lot.ajouter', { count: valides ? nombreLu : 0 })}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={enregistrer}
    >
      <div className="grid grid-cols-3 gap-3">
        <ChampSaisie
          libelle={t('salles.lot.nombre')}
          obligatoire
          inputMode="numeric"
          className="chiffres"
          value={nombre}
          erreur={
            invalide && !(nombreLu >= 1 && nombreLu <= 50) ? t('salles.lot.invalide') : undefined
          }
          onChange={(evenement) => {
            setNombre(evenement.target.value)
          }}
        />
        <ChampSaisie
          libelle={t('salles.lot.premierNom')}
          obligatoire
          maxLength={16}
          value={premierNom}
          onChange={(evenement) => {
            setPremierNom(evenement.target.value)
          }}
        />
        <ChampSaisie
          libelle={t('salles.lot.places')}
          obligatoire
          inputMode="numeric"
          className="chiffres"
          value={places}
          erreur={
            invalide && !(placesLues >= 1 && placesLues <= 50)
              ? t('salles.lot.invalide')
              : undefined
          }
          onChange={(evenement) => {
            setPlaces(evenement.target.value)
          }}
        />
      </div>
      {valides && (
        <p
          role="status"
          className="m-0 rounded-normal border border-trait bg-fond p-3 text-corps text-encre"
        >
          {t('salles.lot.apercu', {
            noms: nomsDeTables(premierNom.trim(), nombreLu).join(', '),
            places: t('salles.places', { count: placesLues }),
          })}
        </p>
      )}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}

function DialogueTable({
  table,
  salles,
  salleActuelle,
  surFermer,
  surEnregistre,
}: Readonly<{
  table: TableResume
  salles: SalleResume[]
  salleActuelle: string
  surFermer: () => void
  surEnregistre: (message: string) => void
}>) {
  const { t } = useTranslation()
  const [nom, setNom] = useState(table.nom)
  const [places, setPlaces] = useState(String(table.places))
  const [salleId, setSalleId] = useState(salleActuelle)
  const [invalide, setInvalide] = useState(false)
  const { enCours, erreur, envoyer } = useEnvoi(surEnregistre)
  const placesLues = Number(places)

  function enregistrer() {
    if (nom.trim() === '' || !Number.isInteger(placesLues) || placesLues < 1 || placesLues > 50) {
      setInvalide(true)
      return
    }
    const corps: DemandeTable = {
      nom: nom.trim(),
      places: placesLues,
      salleId,
      version: table.version,
    }
    void envoyer(
      () => appelerApi(`/tables/${table.id}`, { methode: 'PUT', corps }),
      t('salles.fait.tableModifiee', { nom: nom.trim() }),
    )
  }

  return (
    <Dialogue
      titre={t('salles.table.titre', { nom: table.nom })}
      consequence={t('salles.table.consequence')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('salles.table.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={enregistrer}
    >
      <div className="grid grid-cols-2 gap-3">
        <ChampSaisie
          libelle={t('salles.table.nom')}
          obligatoire
          maxLength={20}
          value={nom}
          erreur={invalide && nom.trim() === '' ? t('validation.obligatoire') : undefined}
          onChange={(evenement) => {
            setNom(evenement.target.value)
          }}
        />
        <ChampSaisie
          libelle={t('salles.table.places')}
          obligatoire
          inputMode="numeric"
          className="chiffres"
          value={places}
          erreur={
            invalide && !(placesLues >= 1 && placesLues <= 50)
              ? t('salles.lot.invalide')
              : undefined
          }
          onChange={(evenement) => {
            setPlaces(evenement.target.value)
          }}
        />
      </div>
      <ChampSelection
        libelle={t('salles.table.salle')}
        options={salles.map((salle) => ({ valeur: salle.id, libelle: salle.nom }))}
        value={salleId}
        onChange={(evenement) => {
          setSalleId(evenement.target.value)
        }}
      />
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}
