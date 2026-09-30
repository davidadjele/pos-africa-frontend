import type { TFunction } from 'i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { Plus, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type {
  CommandeDetail,
  DemandeOuverture,
  NoteEnService,
  NoteOuverte,
  SallePlan,
  TablePlan,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { useSessionCaisse } from '../caisse/requetes'
import { requeteAppareil } from '../tablette/requetes'
import { dureeDepuis } from './duree'
import { requeteCommande, requetePlan } from './requetes'

type Ouverture = { canal: 'SUR_PLACE'; table: TablePlan; salle: string } | { canal: 'EMPORTER' }

/** Accueil de la caisse : les tables et leur note ouverte, la vente au comptoir et à emporter. */
export function EcranPlan() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const naviguer = useNavigate()
  const { data: appareil } = useQuery(requeteAppareil)
  const devise = (appareil?.entreprise.devise ?? 'XOF') as Devise
  const fuseauHoraire = appareil?.etablissement.fuseauHoraire ?? 'Africa/Lome'
  const peutCommander = useSessionCaisse()?.permissions.includes('COMMANDE_CREER') ?? false
  const plan = useQuery(requetePlan)
  const [salleId, setSalleId] = useState<string | null>(null)
  const [mesTables, setMesTables] = useState(false)
  const [ouverture, setOuverture] = useState<Ouverture | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  function allerALaNote(id: string) {
    void naviguer({ to: '/caisse/notes/$commandeId', params: { commandeId: id } })
  }

  async function ouvrir(demande: DemandeOuverture) {
    setErreur(null)
    setEnCours(true)
    try {
      const note = await appelerCaisse<CommandeDetail>('/caisse/commandes', {
        methode: 'POST',
        corps: demande,
      })
      clientRequetes.setQueryData(requeteCommande(note.id).queryKey, note)
      void clientRequetes.invalidateQueries({ queryKey: requetePlan.queryKey })
      allerALaNote(note.id)
    } catch (refus) {
      // Table prise entre-temps : le plan relu la montre occupée.
      setErreur(refus)
      setOuverture(null)
      void clientRequetes.invalidateQueries({ queryKey: requetePlan.queryKey })
    } finally {
      setEnCours(false)
    }
  }

  if (plan.isPending) return <Chargement texte={t('caisse.plan.chargement')} />
  if (plan.isError) {
    return (
      <AlerteErreur
        erreur={plan.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void plan.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  }

  const { salles, sansTable } = plan.data
  const salle = salles.find((candidate) => candidate.id === salleId) ?? salles[0]
  const toutes = salles.flatMap((une) => une.tables)
  const occupees = toutes.filter((table) => table.note !== undefined)
  const miennes = occupees.filter((table) => table.note?.mienne === true)
  const visibles = (salle?.tables ?? []).filter(
    (table) => !mesTables || table.note?.mienne === true,
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      {/* Écran étroit : la barre d'actions, puis ce qui attend un geste, puis les tables. */}
      <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-3.5">
        {erreur !== null && (
          <div className="order-first lg:order-none">
            <AlerteErreur erreur={erreur} />
          </div>
        )}
        <div className="order-first flex flex-wrap items-center gap-2.5 lg:order-none">
          {salles.length > 0 && (
            <OngletsSalles salles={salles} courante={salle?.id} surChoisir={setSalleId} />
          )}
          {miennes.length > 0 && (
            <button
              type="button"
              aria-pressed={mesTables}
              onClick={() => {
                setMesTables(!mesTables)
              }}
              className={clsx(
                'flex min-h-cible-caisse items-center gap-2 rounded-normal border px-4 text-libelle font-semibold',
                mesTables
                  ? 'border-accent bg-accent text-accent-texte'
                  : 'border-trait bg-surface text-encre',
              )}
            >
              {t('caisse.plan.mesTables')}
              <span className="chiffres opacity-70">{miennes.length}</span>
            </button>
          )}
          <span className="flex-1" />
          {peutCommander && (
            <>
              <Bouton
                className="min-h-cible-caisse"
                onClick={() => {
                  setOuverture({ canal: 'EMPORTER' })
                }}
              >
                {t('caisse.plan.emporter')}
              </Bouton>
              <Bouton
                variante="principal"
                icone={Plus}
                enCours={enCours && ouverture === null}
                onClick={() => void ouvrir({ canal: 'COMPTOIR' })}
              >
                {t('caisse.plan.comptoir')}
              </Bouton>
            </>
          )}
        </div>
        {!peutCommander && (
          <p className="order-first m-0 text-corps text-attenue lg:order-none">
            {t('caisse.plan.lectureSeule')}
          </p>
        )}

        {salles.length === 0 ? (
          <section className="rounded-moyen border border-trait bg-surface p-6">
            <EtatVide
              niveauTitre={1}
              titre={t('caisse.plan.vide.titre')}
              phrase={t('caisse.plan.vide.phrase')}
            />
          </section>
        ) : (
          <>
            <ul
              aria-label={t('caisse.plan.tables')}
              className="m-0 grid list-none grid-cols-2 content-start gap-3 overflow-y-auto p-0 sm:grid-cols-3 xl:grid-cols-4"
            >
              {visibles.map((table) => (
                <li key={table.id}>
                  <TuileTable
                    table={table}
                    devise={devise}
                    interactive={peutCommander}
                    surToucher={() => {
                      if (table.note === undefined) {
                        setOuverture({ canal: 'SUR_PLACE', table, salle: salle?.nom ?? '' })
                      } else {
                        allerALaNote(table.note.id)
                      }
                    }}
                  />
                </li>
              ))}
            </ul>
            {visibles.length === 0 && (
              <p className="m-0 text-corps text-attenue">{t('caisse.plan.mesTablesVide')}</p>
            )}
          </>
        )}
      </div>

      <ResumeNotes
        aTraiter={aTraiter(salles, sansTable, t)}
        enService={plan.data.enService}
        notes={[...occupees.flatMap((table) => (table.note ? [table.note] : [])), ...sansTable]}
        sansTable={sansTable}
        occupees={occupees.length}
        tables={toutes.length}
        devise={devise}
        fuseauHoraire={fuseauHoraire}
      />

      {ouverture !== null && (
        <DialogueOuverture
          ouverture={ouverture}
          enCours={enCours}
          surAnnuler={() => {
            setOuverture(null)
          }}
          surOuvrir={(demande) => void ouvrir(demande)}
        />
      )}
    </div>
  )
}

function OngletsSalles({
  salles,
  courante,
  surChoisir,
}: Readonly<{
  salles: SallePlan[]
  courante: string | undefined
  surChoisir: (id: string) => void
}>) {
  const { t } = useTranslation()
  return (
    <div
      role="tablist"
      aria-label={t('caisse.plan.salles')}
      className="flex flex-wrap gap-0.5 rounded-moyen bg-trait p-0.5"
    >
      {salles.map((salle) => {
        const occupees = salle.tables.filter((table) => table.note !== undefined).length
        const active = salle.id === courante
        return (
          <button
            key={salle.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              surChoisir(salle.id)
            }}
            className={clsx(
              'flex min-h-cible-caisse items-center gap-1.5 rounded-normal px-3.5 text-corps',
              active ? 'bg-surface font-bold text-encre' : 'font-semibold text-encre',
            )}
          >
            {salle.nom}
            <span className="chiffres font-medium text-attenue">
              {occupees}/{salle.tables.length}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TuileTable({
  table,
  devise,
  interactive,
  surToucher,
}: Readonly<{
  table: TablePlan
  devise: Devise
  interactive: boolean
  surToucher: () => void
}>) {
  const { t } = useTranslation()
  const { note } = table
  const aEnvoyer = note?.aEnvoyer ?? 0
  const addition = note?.additionDemandeeLe !== undefined
  // Articles pris mais pas partis en préparation : couleur d'alerte, l'accent reste à l'action principale.
  const classes = clsx(
    'flex min-h-36 w-full flex-col justify-between gap-2 rounded-moyen p-3.5 text-left text-encre',
    aEnvoyer > 0
      ? 'border-2 border-alerte-bord'
      : addition
        ? 'border-2 border-info'
        : 'border border-trait',
    note === undefined ? 'bg-fond' : 'bg-surface',
  )
  const contenu =
    note === undefined ? (
      <>
        <span className="flex items-start justify-between gap-2">
          <span className="text-titre-section font-bold text-attenue">{table.nom}</span>
          <span className="text-libelle text-attenue">
            {t('caisse.plan.places', { count: table.places })}
          </span>
        </span>
        {interactive && (
          <span className="flex items-center gap-1.5 text-libelle font-semibold">
            <Plus aria-hidden="true" size={16} />
            {t('caisse.plan.ouvrirNote')}
          </span>
        )}
      </>
    ) : (
      <>
        <span className="flex items-start gap-1.5">
          <span className="text-titre-section font-extrabold">{table.nom}</span>
          {note.mienne && <BadgeStatut ton="info">{t('caisse.plan.maTable')}</BadgeStatut>}
          <span className="chiffres ml-auto text-corps text-attenue">
            {dureeDepuis(note.ouverteLe)}
          </span>
        </span>
        <span className="flex flex-col items-start gap-1">
          {addition && <BadgeStatut ton="info">{t('caisse.plan.additionDemandee')}</BadgeStatut>}
          {note.aServir > 0 && (
            <BadgeStatut ton="neutre">
              {t('caisse.plan.badgeAServir', { count: note.aServir })}
            </BadgeStatut>
          )}
          {aEnvoyer > 0 && (
            <BadgeStatut ton="alerte">{t('caisse.plan.aEnvoyer', { count: aEnvoyer })}</BadgeStatut>
          )}
          <span className="chiffres text-touche font-bold">
            {formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' })}
          </span>
          {note.totalPaye > 0 && (
            <span className="chiffres text-legende font-semibold text-succes">
              {t('caisse.plan.paye', {
                paye: formaterMontant(
                  { unitesMineures: note.totalPaye, devise },
                  { forme: 'courte' },
                ),
                total: formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' }),
              })}
            </span>
          )}
          <span className="text-legende text-attenue">
            {note.couverts === undefined
              ? note.serveur
              : `${note.serveur}, ${t('caisse.plan.couverts', { count: note.couverts })}`}
          </span>
        </span>
      </>
    )
  if (!interactive) return <div className={classes}>{contenu}</div>
  return (
    <button
      type="button"
      aria-label={
        note === undefined
          ? t('caisse.plan.libre', { table: table.nom })
          : t('caisse.plan.occupee', {
              table: table.nom,
              montant: formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' }),
            })
      }
      onClick={surToucher}
      className={clsx(classes, aEnvoyer === 0 && !addition && 'hover:border-bordure-controle')}
    >
      {contenu}
    </button>
  )
}

interface NoteATraiter {
  note: NoteOuverte
  /** « T3, Terrasse » ou « n°43, Comptoir » */
  libelle: string
}

/**
 * Ce qui attend un geste : les additions demandées d'abord (le client attend pour payer), puis les
 * articles pris mais pas envoyés, les plus anciens en premier.
 */
function aTraiter(salles: SallePlan[], sansTable: NoteOuverte[], t: TFunction): NoteATraiter[] {
  const toutes: NoteATraiter[] = [
    ...salles.flatMap((salle) =>
      salle.tables.flatMap((table) =>
        table.note === undefined
          ? []
          : [{ note: table.note, libelle: `${table.nom}, ${salle.nom}` }],
      ),
    ),
    ...sansTable.map((note) => ({
      note,
      libelle: `${t('caisse.note.numero', { numero: note.numero })}, ${t(`caisse.canaux.${note.canal}`)}`,
    })),
  ]
  const additions = toutes
    .filter(({ note }) => note.additionDemandeeLe !== undefined)
    .sort((a, b) =>
      (a.note.additionDemandeeLe ?? '').localeCompare(b.note.additionDemandeeLe ?? ''),
    )
  const aEnvoyer = toutes
    .filter(({ note }) => note.additionDemandeeLe === undefined && note.aEnvoyer > 0)
    .sort((a, b) => (a.note.aEnvoyerDepuis ?? '').localeCompare(b.note.aEnvoyerDepuis ?? ''))
  return [...additions, ...aEnvoyer]
}

function ResumeNotes({
  aTraiter,
  enService,
  notes,
  sansTable,
  occupees,
  tables,
  devise,
  fuseauHoraire,
}: Readonly<{
  aTraiter: NoteATraiter[]
  enService: NoteEnService[]
  notes: NoteOuverte[]
  sansTable: NoteOuverte[]
  occupees: number
  tables: number
  devise: Devise
  fuseauHoraire: string
}>) {
  const { t } = useTranslation()
  // Montants entiers en unités mineures : la somme reste exacte.
  const total = notes.reduce((somme, note) => somme + note.total, 0)
  // Une commande déjà « à remettre » n'est pas répétée plus bas : son reste à encaisser y figure.
  const aRemettre = new Set(
    enService.filter((note) => note.canal !== 'SUR_PLACE').map((note) => note.id),
  )
  const restes = new Map(sansTable.map((note) => [note.id, note.total - note.totalPaye]))
  const comptoir = sansTable.filter((note) => !aRemettre.has(note.id))
  return (
    <section
      aria-label={t('caisse.plan.totalOuvertes')}
      className="-order-1 flex min-h-0 shrink-0 flex-col gap-1 overflow-y-auto rounded-moyen border border-trait bg-surface p-5 pb-0 lg:order-none lg:w-ticket-largeur"
    >
      {aTraiter.length > 0 && (
        <div className="mb-5 flex flex-col">
          <h2 className="m-0 text-libelle font-bold text-encre">
            {t('caisse.plan.aTraiter')}{' '}
            <span className="chiffres font-medium text-attenue">{aTraiter.length}</span>
          </h2>
          <ul aria-label={t('caisse.plan.aTraiter')} className="m-0 list-none p-0">
            {aTraiter.map(({ note, libelle }) => (
              <li key={note.id} className="border-b border-trait last:border-b-0">
                <Link
                  to="/caisse/notes/$commandeId"
                  params={{ commandeId: note.id }}
                  className="flex min-h-cible-caisse items-center gap-2.5 py-2 text-encre no-underline"
                >
                  <span className="flex flex-1 flex-col">
                    <span className="text-libelle font-bold">{libelle}</span>
                    <span className="text-legende text-attenue">
                      {note.additionDemandeeLe === undefined
                        ? t('caisse.plan.prisA', {
                            serveur: note.serveur,
                            heure: formaterHeure(
                              note.aEnvoyerDepuis ?? note.ouverteLe,
                              fuseauHoraire,
                            ),
                          })
                        : t('caisse.plan.depuis', {
                            serveur: note.serveur,
                            heure: formaterHeure(note.additionDemandeeLe, fuseauHoraire),
                          })}
                    </span>
                  </span>
                  {note.additionDemandeeLe === undefined ? (
                    <BadgeStatut ton="alerte">
                      {t('caisse.plan.aEnvoyer', { count: note.aEnvoyer })}
                    </BadgeStatut>
                  ) : (
                    <BadgeStatut ton="info">{t('caisse.plan.additionDemandee')}</BadgeStatut>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <SuiviDuService
        enService={enService}
        restes={restes}
        devise={devise}
        fuseauHoraire={fuseauHoraire}
      />
      {/* Sans tuile sur le plan : les notes du comptoir et à emporter se voient ici, en évidence. */}
      {(sansTable.length === 0 || comptoir.length > 0) && (
        <h2 className="m-0 text-libelle font-bold text-encre">
          {t('caisse.plan.sansTable')}{' '}
          <span className="chiffres font-medium text-attenue">{comptoir.length}</span>
        </h2>
      )}
      {sansTable.length === 0 ? (
        <p className="m-0 mt-1 text-legende text-attenue">{t('caisse.plan.aucuneSansTable')}</p>
      ) : comptoir.length === 0 ? null : (
        <ul
          aria-label={t('caisse.plan.sansTable')}
          className="m-0 mt-1.5 flex list-none flex-col gap-2 p-0"
        >
          {comptoir.map((note) => (
            <li key={note.id}>
              <Link
                to="/caisse/notes/$commandeId"
                params={{ commandeId: note.id }}
                className={clsx(
                  'flex min-h-cible-caisse items-center gap-2.5 rounded-moyen bg-surface px-3 py-2.5 text-encre no-underline hover:bg-fond',
                  note.aEnvoyer > 0 ? 'border-2 border-alerte-bord' : 'border border-trait',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-corps-fort">
                    {[
                      t('caisse.note.numero', { numero: note.numero }),
                      t(`caisse.canaux.${note.canal}`),
                      ...(note.clientNom === undefined ? [] : [note.clientNom]),
                    ].join(', ')}
                  </span>
                  <span className="text-legende text-attenue">
                    {t('caisse.plan.ouverteA', {
                      serveur: note.serveur,
                      heure: formaterHeure(note.ouverteLe, fuseauHoraire),
                    })}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {note.additionDemandeeLe !== undefined && (
                      <BadgeStatut ton="info">{t('caisse.plan.additionDemandee')}</BadgeStatut>
                    )}
                    {note.total - note.totalPaye > 0 && (
                      <BadgeStatut ton="info">
                        {t('caisse.plan.aEncaisser', {
                          montant: formaterMontant(
                            { unitesMineures: note.total - note.totalPaye, devise },
                            { forme: 'courte' },
                          ),
                        })}
                      </BadgeStatut>
                    )}
                    {note.aEnvoyer > 0 && (
                      <BadgeStatut ton="alerte">
                        {t('caisse.plan.aEnvoyer', { count: note.aEnvoyer })}
                      </BadgeStatut>
                    )}
                  </span>
                </span>
                <span className="chiffres text-montant-tuile">
                  {formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {/* Collé en bas : il reste visible quand la liste défile. */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-1 border-t border-trait bg-surface py-4">
        <span className="text-legende text-attenue">{t('caisse.plan.totalOuvertes')}</span>
        <span className="chiffres text-montant-total text-encre">
          {formaterMontant({ unitesMineures: total, devise })}
        </span>
        <span className="text-legende text-attenue">
          {t('caisse.plan.notes', { count: notes.length })}
          {tables > 0 && `, ${t('caisse.plan.tablesOccupees', { count: occupees, total: tables })}`}
        </span>
      </div>
    </section>
  )
}

function DialogueOuverture({
  ouverture,
  enCours,
  surAnnuler,
  surOuvrir,
}: Readonly<{
  ouverture: Ouverture
  enCours: boolean
  surAnnuler: () => void
  surOuvrir: (demande: DemandeOuverture) => void
}>) {
  const { t } = useTranslation()
  const [couverts, setCouverts] = useState(
    ouverture.canal === 'SUR_PLACE' ? Math.min(2, ouverture.table.places) : 0,
  )
  const [client, setClient] = useState('')

  if (ouverture.canal === 'EMPORTER') {
    return (
      <Dialogue
        titre={t('caisse.ouverture.titreEmporter')}
        consequence={t('caisse.ouverture.phraseEmporter')}
        libelleAnnuler={t('commun.annuler')}
        libelleConfirmer={t('caisse.ouverture.ouvrir')}
        enCours={enCours}
        surAnnuler={surAnnuler}
        surConfirmer={() => {
          const nom = client.trim()
          surOuvrir(nom === '' ? { canal: 'EMPORTER' } : { canal: 'EMPORTER', clientNom: nom })
        }}
      >
        <ChampSaisie
          libelle={t('caisse.ouverture.client')}
          aide={t('caisse.ouverture.facultatif')}
          maxLength={60}
          value={client}
          onChange={(evenement) => {
            setClient(evenement.target.value)
          }}
        />
      </Dialogue>
    )
  }
  const { table, salle } = ouverture
  return (
    <Dialogue
      titre={t('caisse.ouverture.titreTable', { table: table.nom })}
      consequence={t('caisse.ouverture.phraseTable', { salle, count: table.places })}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('caisse.ouverture.ouvrir')}
      enCours={enCours}
      surAnnuler={surAnnuler}
      surConfirmer={() => {
        surOuvrir({ canal: 'SUR_PLACE', tableId: table.id, couverts })
      }}
    >
      <div className="flex flex-col gap-2">
        <span className="text-libelle text-encre">{t('caisse.ouverture.couverts')}</span>
        <div className="flex items-center gap-3">
          <Bouton
            aria-label={t('caisse.ouverture.moins')}
            disabled={couverts <= 1}
            className="h-16 w-16 text-titre-section"
            onClick={() => {
              setCouverts(couverts - 1)
            }}
          >
            −
          </Bouton>
          <output className="chiffres flex-1 text-center text-montant-total">{couverts}</output>
          <Bouton
            aria-label={t('caisse.ouverture.plus')}
            disabled={couverts >= 99}
            className="h-16 w-16 text-titre-section"
            onClick={() => {
              setCouverts(couverts + 1)
            }}
          >
            +
          </Bouton>
        </div>
      </div>
    </Dialogue>
  )
}

/** « T4 » ou « n°44, À emporter, Yao » : de quoi appeler le client. */
function libelleEnService(note: NoteEnService, t: TFunction): string {
  if (note.table !== undefined) return note.table
  return [
    t('caisse.note.numero', { numero: note.numero }),
    t(`caisse.canaux.${note.canal}`),
    ...(note.clientNom === undefined ? [] : [note.clientNom]),
  ].join(', ')
}

/**
 * Le suivi du service : à table, ce qui n'est pas encore servi ; au comptoir et à emporter, ce qui
 * n'est pas encore remis au client. Payées ou non, les notes restent là jusqu'au bout.
 */
function SuiviDuService({
  enService,
  restes,
  devise,
  fuseauHoraire,
}: Readonly<{
  enService: NoteEnService[]
  /** Reste à encaisser des notes ouvertes du comptoir et à emporter. */
  restes: ReadonlyMap<string, number>
  devise: Devise
  fuseauHoraire: string
}>) {
  const { t } = useTranslation()
  const [aRemettre, setARemettre] = useState<NoteEnService | null>(null)
  const tables = enService.filter((note) => note.canal === 'SUR_PLACE')
  const sansTable = enService.filter((note) => note.canal !== 'SUR_PLACE')
  const detail = (note: NoteEnService) =>
    t('caisse.plan.enPreparation', {
      serveur: note.serveur,
      heure: formaterHeure(note.aServirDepuis, fuseauHoraire),
    })
  return (
    <>
      {tables.length > 0 && (
        <div className="mb-5 flex flex-col">
          <h2 className="m-0 text-libelle font-bold text-encre">
            {t('caisse.plan.aServir')}{' '}
            <span className="chiffres font-medium text-attenue">{tables.length}</span>
          </h2>
          <ul aria-label={t('caisse.plan.aServir')} className="m-0 list-none p-0">
            {tables.map((note) => (
              <li key={note.id} className="border-b border-trait last:border-b-0">
                <Link
                  to="/caisse/notes/$commandeId"
                  params={{ commandeId: note.id }}
                  className="flex min-h-cible-caisse items-center gap-2.5 py-2 text-encre no-underline"
                >
                  <span className="flex flex-1 flex-col">
                    <span className="text-libelle font-bold">{libelleEnService(note, t)}</span>
                    <span className="text-legende text-attenue">{detail(note)}</span>
                  </span>
                  {note.payee && <BadgeStatut ton="succes">{t('caisse.plan.payee')}</BadgeStatut>}
                  <BadgeStatut ton="neutre">
                    {t('caisse.plan.badgeAServir', { count: note.aServir })}
                  </BadgeStatut>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sansTable.length > 0 && (
        <div className="mb-5 flex flex-col">
          <h2 className="m-0 text-libelle font-bold text-encre">
            {t('caisse.plan.aRemettre')}{' '}
            <span className="chiffres font-medium text-attenue">{sansTable.length}</span>
          </h2>
          <ul aria-label={t('caisse.plan.aRemettre')} className="m-0 list-none p-0">
            {sansTable.map((note) => (
              <li
                key={note.id}
                className="flex flex-col gap-1.5 border-b border-trait py-2.5 last:border-b-0"
              >
                <Link
                  to="/caisse/notes/$commandeId"
                  params={{ commandeId: note.id }}
                  className="flex flex-col text-encre no-underline"
                >
                  <span className="text-libelle font-bold">{libelleEnService(note, t)}</span>
                  <span className="text-legende text-attenue">{detail(note)}</span>
                </Link>
                <span className="flex items-center justify-between gap-2">
                  {note.payee ? (
                    <BadgeStatut ton="succes">{t('caisse.plan.payee')}</BadgeStatut>
                  ) : (
                    <BadgeStatut ton="info">
                      {(restes.get(note.id) ?? 0) > 0
                        ? t('caisse.plan.aEncaisser', {
                            montant: formaterMontant(
                              { unitesMineures: restes.get(note.id) ?? 0, devise },
                              { forme: 'courte' },
                            ),
                          })
                        : t('caisse.plan.aEncaisserCourt')}
                    </BadgeStatut>
                  )}
                  <Bouton
                    className="shrink-0"
                    onClick={() => {
                      setARemettre(note)
                    }}
                  >
                    {t('caisse.service.remettre')}
                  </Bouton>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {aRemettre !== null && (
        <DialogueRemettre
          note={aRemettre}
          surFermer={() => {
            setARemettre(null)
          }}
        />
      )}
    </>
  )
}

/** Remettre une commande au client : les articles sont rappelés pour vérifier avant de la donner. */
function DialogueRemettre({
  note,
  surFermer,
}: Readonly<{ note: NoteEnService; surFermer: () => void }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const detail = useQuery(requeteCommande(note.id))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const lignes = (detail.data?.lignes ?? []).filter(
    (ligne) => ligne.statut === 'ENVOYEE' && ligne.servieLe === undefined,
  )

  async function remettre() {
    setEnCours(true)
    setErreur(null)
    try {
      clientRequetes.setQueryData(
        requeteCommande(note.id).queryKey,
        await appelerCaisse<CommandeDetail>(`/caisse/commandes/${note.id}/service`, {
          methode: 'POST',
        }),
      )
      await clientRequetes.invalidateQueries({ queryKey: requetePlan.queryKey })
      surFermer()
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={t('caisse.remettre.titre', {
        numero: t('caisse.note.numero', { numero: note.numero }),
      })}
      consequence={t('caisse.remettre.phrase', { ou: libelleEnService(note, t) })}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('caisse.service.remettre')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void remettre()}
    >
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      {detail.isPending ? (
        <Chargement texte={t('caisse.remettre.chargement')} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 rounded-normal bg-fond px-3.5 py-3 text-corps text-encre">
          {lignes.map((ligne) => (
            <li key={ligne.id}>
              {ligne.quantite}× {ligne.nomProduit}
            </li>
          ))}
        </ul>
      )}
    </Dialogue>
  )
}
