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
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        {erreur !== null && <AlerteErreur erreur={erreur} />}
        <div className="flex flex-wrap items-center gap-2.5">
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
          <p className="m-0 text-corps text-attenue">{t('caisse.plan.lectureSeule')}</p>
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
  const classes = clsx(
    'flex min-h-36 w-full flex-col justify-between gap-2 rounded-moyen border border-trait p-3.5 text-left text-encre',
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
        <span className="flex flex-col gap-1">
          <span className="chiffres text-touche font-bold">
            {formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' })}
          </span>
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
      className={clsx(classes, 'hover:border-bordure-controle')}
    >
      {contenu}
    </button>
  )
}

function ResumeNotes({
  notes,
  sansTable,
  occupees,
  tables,
  devise,
  fuseauHoraire,
}: Readonly<{
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
  return (
    <section
      aria-label={t('caisse.plan.totalOuvertes')}
      className="flex shrink-0 flex-col gap-1 rounded-moyen border border-trait bg-surface p-5 lg:w-ticket-largeur"
    >
      <span className="text-legende text-attenue">{t('caisse.plan.totalOuvertes')}</span>
      <span className="chiffres text-montant-total text-encre">
        {formaterMontant({ unitesMineures: total, devise })}
      </span>
      <span className="text-legende text-attenue">
        {t('caisse.plan.notes', { count: notes.length })}
        {tables > 0 && `, ${t('caisse.plan.tablesOccupees', { count: occupees, total: tables })}`}
      </span>
      <h2 className="m-0 mt-5 text-libelle font-bold text-encre">{t('caisse.plan.sansTable')}</h2>
      {sansTable.length === 0 ? (
        <p className="m-0 mt-1 text-legende text-attenue">{t('caisse.plan.aucuneSansTable')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {sansTable.map((note) => (
            <li key={note.id} className="border-b border-trait last:border-b-0">
              <Link
                to="/caisse/notes/$commandeId"
                params={{ commandeId: note.id }}
                className="flex min-h-cible-caisse items-center gap-2.5 py-3 text-encre no-underline"
              >
                <span className="flex flex-1 flex-col">
                  <span className="text-libelle font-bold">
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
                </span>
                <span className="chiffres text-montant-ligne">
                  {formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
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
