import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type {
  DemandeRemboursement,
  EtatRemboursement,
  ModePaiement,
  MotifRemboursement,
  NoteEncaissee,
  OperateurMobileMoney,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { totalSelection } from '../../partage/montants/partage'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { useSessionCaisse } from '../caisse/requetes'
import { useValidation } from '../commande/useValidation'
import { ChoixArticles, ChoixOperateur } from './ChoixArticles'
import { requeteNotesEncaissees, requeteOuvertureCaisse, requeteRemboursement } from './requetes'

const MOTIFS: MotifRemboursement[] = [
  'ERREUR_ENCAISSEMENT',
  'ARTICLE_NON_CONFORME',
  'ARTICLE_NON_SERVI',
  'AUTRE',
]

/** « n°42, T4 », « n°41, Comptoir », « n°40, À emporter, Yao ». */
function nomDe(
  note: Pick<NoteEncaissee, 'numero' | 'canal' | 'table' | 'clientNom'>,
  t: TFunction,
) {
  const ou =
    note.table ??
    [
      t(`remboursement.canaux.${note.canal}`),
      ...(note.clientNom === undefined ? [] : [note.clientNom]),
    ].join(', ')
  return `${t('caisse.note.numero', { numero: note.numero })}, ${ou}`
}

/**
 * Les notes encaissées de la journée : on retrouve une note (numéro, table, client), on voit ce qui en a été
 * remboursé, et on rembourse des articles dans le mode où le client a payé.
 */
export function NotesEncaissees({
  devise,
  fuseauHoraire,
}: Readonly<{ devise: Devise; fuseauHoraire: string }>) {
  const { t } = useTranslation()
  const notes = useQuery(requeteNotesEncaissees)
  const [recherche, setRecherche] = useState('')
  const [choisie, setChoisie] = useState<string | null>(null)
  const [aRembourser, setARembourser] = useState<string | null>(null)
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })

  if (notes.isPending) return <Chargement texte={t('remboursement.chargement')} />
  if (notes.isError) {
    return (
      <AlerteErreur
        erreur={notes.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void notes.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  }
  if (aRembourser !== null) {
    return (
      <RembourserNote
        commandeId={aRembourser}
        devise={devise}
        surFermer={() => {
          setARembourser(null)
        }}
      />
    )
  }
  const filtre = recherche.trim().toLowerCase()
  const visibles = notes.data.filter((note) =>
    `${nomDe(note, t)} ${String(note.numero)}`.toLowerCase().includes(filtre),
  )

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-moyen border border-trait bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-trait px-4 py-3">
          <input
            type="search"
            aria-label={t('remboursement.chercher')}
            placeholder={t('remboursement.chercherAide')}
            value={recherche}
            onChange={(evenement) => {
              setRecherche(evenement.target.value)
            }}
            className="min-h-cible-min w-full min-w-0 rounded-normal border border-bordure-controle bg-surface px-3 text-corps text-encre sm:w-auto sm:flex-1"
          />
          <span className="text-legende text-attenue">
            {t('remboursement.nombre', { count: notes.data.length })}
          </span>
        </div>
        {notes.data.length === 0 ? (
          <div className="p-6">
            <EtatVide
              titre={t('remboursement.vide.titre')}
              phrase={t('remboursement.vide.message')}
            />
          </div>
        ) : (
          <ul
            aria-label={t('remboursement.titre')}
            className="m-0 list-none p-0 lg:overflow-y-auto"
          >
            {visibles.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  aria-current={choisie === note.id}
                  onClick={() => {
                    setChoisie(note.id)
                  }}
                  className={clsx(
                    'grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-trait px-4 py-3 text-left',
                    choisie === note.id ? 'bg-fond' : 'bg-surface',
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-corps-fort text-encre">{nomDe(note, t)}</span>
                    <span className="text-legende text-attenue">
                      {note.clotureeLe === undefined
                        ? ''
                        : formaterHeure(note.clotureeLe, fuseauHoraire)}
                    </span>
                  </span>
                  <span>
                    {note.rembourse > 0 && (
                      <BadgeStatut ton={note.rembourse >= note.total ? 'danger' : 'alerte'}>
                        {t(
                          note.rembourse >= note.total
                            ? 'remboursement.rembourseeTotale'
                            : 'remboursement.rembourseePartielle',
                        )}
                      </BadgeStatut>
                    )}
                  </span>
                  <span className="chiffres text-right text-montant-ligne text-encre">
                    {nombre(note.total)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {choisie === null ? (
        <p className="m-0 rounded-moyen border border-trait bg-surface p-5 text-corps text-attenue lg:w-[420px]">
          {t('remboursement.choisir')}
        </p>
      ) : (
        <DetailNote
          key={choisie}
          commandeId={choisie}
          devise={devise}
          fuseauHoraire={fuseauHoraire}
          surRembourser={() => {
            setARembourser(choisie)
          }}
        />
      )}
    </div>
  )
}

function RembourserNote({
  commandeId,
  devise,
  surFermer,
}: Readonly<{ commandeId: string; devise: Devise; surFermer: () => void }>) {
  const { t } = useTranslation()
  const etat = useQuery(requeteRemboursement(commandeId))
  const { data: caisse } = useQuery(requeteOuvertureCaisse)
  if (etat.isPending) return <Chargement texte={t('remboursement.chargementNote')} />
  if (etat.isError) return <AlerteErreur erreur={etat.error} />
  return (
    <Rembourser
      etat={etat.data}
      titre={titreDe(etat.data, t)}
      devise={devise}
      operateurs={caisse?.operateurs ?? []}
      surFermer={surFermer}
    />
  )
}

function titreDe(etat: EtatRemboursement, t: TFunction) {
  const numero = t('caisse.note.numero', { numero: etat.numero })
  return etat.table === undefined ? numero : `${numero}, ${etat.table}`
}

function DetailNote({
  commandeId,
  devise,
  fuseauHoraire,
  surRembourser,
}: Readonly<{
  commandeId: string
  devise: Devise
  fuseauHoraire: string
  surRembourser: () => void
}>) {
  const { t } = useTranslation()
  const etat = useQuery(requeteRemboursement(commandeId))
  const { data: caisse } = useQuery(requeteOuvertureCaisse)
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })

  if (etat.isPending) return <Chargement texte={t('remboursement.chargementNote')} />
  if (etat.isError) return <AlerteErreur erreur={etat.error} />
  const note = etat.data
  const operateurs = caisse?.operateurs ?? []
  const titre = titreDe(note, t)

  const resteARembourser = note.articles.some((article) => article.rembourses < article.quantite)
  return (
    <section
      aria-label={titre}
      className="flex shrink-0 flex-col gap-1 rounded-moyen border border-trait bg-surface p-5 lg:w-[420px] lg:overflow-y-auto"
    >
      <h2 className="m-0 text-titre-section text-encre">{titre}</h2>
      <ul className="m-0 mt-2 list-none p-0">
        {note.articles.map((article) => (
          <li
            key={article.ligneId}
            className="flex justify-between gap-3 py-1 text-corps text-encre"
          >
            <span>
              {article.quantite}× {article.nom}
            </span>
            <span className="chiffres">{nombre(article.montant)}</span>
          </li>
        ))}
      </ul>
      <span className="mt-1 flex items-baseline justify-between border-t border-encre pt-2">
        <span className="text-corps-fort text-encre">{t('encaissement.total')}</span>
        <span className="chiffres text-montant-total text-encre">
          {formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' })}
        </span>
      </span>
      {note.remboursements.length > 0 && (
        <ul aria-label={t('remboursement.faits')} className="m-0 mt-3 list-none p-0">
          {note.remboursements.map((remboursement) => (
            <li
              key={remboursement.id}
              className="flex items-center gap-2.5 border-b border-trait py-2 last:border-b-0"
            >
              <BadgeStatut ton="danger">{t('remboursement.badge')}</BadgeStatut>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-libelle font-bold text-encre">
                  {remboursement.articles
                    .map((article) => `${String(article.quantite)}× ${article.nom}`)
                    .join(', ')}
                  , {libelleMode(remboursement.mode, remboursement.operateur, operateurs, t)}
                </span>
                <span className="text-legende text-attenue">
                  {formaterHeure(remboursement.rembourseLe, fuseauHoraire)},{' '}
                  {remboursement.remboursePar},{' '}
                  {t(`remboursement.motifs.${remboursement.motif}`).toLowerCase()}
                  {remboursement.approuvePar === undefined
                    ? ''
                    : `. ${t('remboursement.validePar', { nom: remboursement.approuvePar })}`}
                </span>
              </span>
              <span className="chiffres text-montant-ligne text-encre">
                −{nombre(remboursement.montant)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <span className="mt-auto pt-4" />
      {!note.remboursable ? (
        <p className="m-0 text-legende text-attenue">{t('remboursement.horsJournee')}</p>
      ) : resteARembourser ? (
        <Bouton className="min-h-cible-caisse" onClick={surRembourser}>
          {t('remboursement.rembourser')}
        </Bouton>
      ) : (
        <p className="m-0 text-legende text-attenue">{t('remboursement.toutRembourse')}</p>
      )}
    </section>
  )
}

function libelleMode(
  mode: ModePaiement,
  operateur: string | undefined,
  operateurs: OperateurMobileMoney[],
  t: TFunction,
) {
  return mode === 'MOBILE_MONEY'
    ? (operateurs.find((candidat) => candidat.code === operateur)?.libelle ?? operateur ?? '')
    : t(`encaissement.modesEn.${mode}`)
}

function Rembourser({
  etat,
  titre,
  devise,
  operateurs,
  surFermer,
}: Readonly<{
  etat: EtatRemboursement
  titre: string
  devise: Devise
  operateurs: OperateurMobileMoney[]
  surFermer: () => void
}>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const validation = useValidation()
  const session = useSessionCaisse()
  const disponibles = etat.modes.filter((candidat) => candidat.paye > candidat.rembourse)
  const [selection, setSelection] = useState<Record<string, number>>({})
  const [mode, setMode] = useState<ModePaiement | null>(disponibles[0]?.mode ?? null)
  const [operateur, setOperateur] = useState<string | null>(
    etat.modes.find((candidat) => candidat.mode === 'MOBILE_MONEY')?.operateur ?? null,
  )
  const [reference, setReference] = useState('')
  const [motif, setMotif] = useState<MotifRemboursement | null>(null)
  const [detail, setDetail] = useState('')
  // Tiré une fois : renvoyé après la validation du gérant ou une coupure, il n'est pas compté deux fois.
  const [id] = useState(() => globalThis.crypto.randomUUID())
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })
  // Le remboursement se calcule comme le paiement par articles : ce qui est déjà remboursé est « réglé ».
  const articles = etat.articles.map((article) => ({
    ...article,
    payees: article.rembourses,
    paye: article.rembourse,
  }))
  const montant = totalSelection(articles, selection)
  const choisi = disponibles.find((candidat) => candidat.mode === mode)
  const manques = [
    ...(montant === 0 ? [t('remboursement.manques.articles')] : []),
    ...(choisi !== undefined && montant > choisi.paye - choisi.rembourse
      ? [t('remboursement.manques.plafond', { montant: courte(choisi.paye - choisi.rembourse) })]
      : []),
    ...(motif === null ? [t('remboursement.manques.motif')] : []),
    ...(motif === 'AUTRE' && detail.trim() === '' ? [t('remboursement.manques.detail')] : []),
    ...(mode === 'MOBILE_MONEY' && (operateur === null || reference.trim() === '')
      ? [t('remboursement.manques.transfert')]
      : []),
  ]

  async function rembourser() {
    if (mode === null || motif === null || manques.length > 0) return
    setEnCours(true)
    setErreur(null)
    const demande: DemandeRemboursement = {
      id,
      mode,
      montant,
      articles: Object.entries(selection)
        .filter(([, quantite]) => quantite > 0)
        .map(([ligneId, quantite]) => ({ ligneId, quantite })),
      motif,
      ...(motif === 'AUTRE' ? { detail: detail.trim() } : {}),
      ...(mode === 'MOBILE_MONEY' && operateur !== null ? { operateur } : {}),
      ...(mode !== 'ESPECES' && reference.trim() !== '' ? { reference: reference.trim() } : {}),
    }
    try {
      const nouvel = await validation.executer(
        (validationId) =>
          appelerCaisse<EtatRemboursement>(`/caisse/commandes/${etat.commandeId}/remboursements`, {
            methode: 'POST',
            corps: validationId === undefined ? demande : { ...demande, validationId },
          }),
        {
          permission: 'PAIEMENT_REMBOURSER',
          objetId: etat.commandeId,
          titre: t('remboursement.validationTitre', {
            montant: courte(montant),
            mode: libelleMode(mode, operateur ?? undefined, operateurs, t),
          }),
          contexte: t('remboursement.validationContexte', {
            note: titre,
            demandeur: session?.nomCourt ?? '',
            motif: motif === 'AUTRE' ? detail.trim() : t(`remboursement.motifs.${motif}`),
          }),
        },
      )
      if (nouvel !== undefined) {
        clientRequetes.setQueryData(requeteRemboursement(etat.commandeId).queryKey, nouvel)
        void clientRequetes.invalidateQueries({ queryKey: requeteNotesEncaissees.queryKey })
        void clientRequetes.invalidateQueries({ queryKey: ['caisse', 'situation'] })
        surFermer()
      }
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section
      aria-label={t('remboursement.titreRembourser', { note: titre })}
      className="flex flex-col gap-4 rounded-moyen border border-trait bg-surface p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Bouton icone={ArrowLeft} onClick={surFermer}>
          {t('remboursement.retour')}
        </Bouton>
        <h2 className="m-0 text-titre-section text-encre">
          {t('remboursement.titreRembourser', { note: titre })}
        </h2>
      </div>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChoixArticles
          articles={articles}
          selection={selection}
          devise={devise}
          libelles={{
            titre: t('remboursement.articles'),
            liste: t('remboursement.articles'),
            tout: t('remboursement.toutLaNote'),
            total: t('remboursement.aRembourser'),
            regle: t('remboursement.badge'),
            tonRegle: 'danger',
          }}
          sousTitre={(article) =>
            t('remboursement.surLaNote', { count: article.quantite, rembourses: article.payees })
          }
          surChanger={setSelection}
        />
        <div className="flex flex-col gap-4">
          <div
            role="radiogroup"
            aria-label={t('remboursement.mode')}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <span className="text-corps-fort text-encre sm:col-span-2">
              {t('remboursement.mode')}
            </span>
            {disponibles.map((candidat) => (
              <button
                key={candidat.mode}
                type="button"
                role="radio"
                aria-checked={mode === candidat.mode}
                onClick={() => {
                  setMode(candidat.mode)
                }}
                className={clsx(
                  'flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-moyen bg-surface px-3 py-1.5 text-left text-encre',
                  mode === candidat.mode ? 'border-2 border-accent' : 'border border-trait',
                )}
              >
                <span className="text-corps-fort">{t(`encaissement.modes.${candidat.mode}`)}</span>
                <span className="text-legende text-attenue">
                  {t(
                    candidat.mode === 'ESPECES'
                      ? 'remboursement.aideEspeces'
                      : 'remboursement.aidePaye',
                    { montant: courte(candidat.paye - candidat.rembourse) },
                  )}
                </span>
              </button>
            ))}
          </div>
          {mode === 'MOBILE_MONEY' && (
            <>
              <ChoixOperateur
                operateurs={operateurs}
                valeur={operateur}
                surChoisir={setOperateur}
              />
              <ChampSaisie
                libelle={t('remboursement.referenceRetour')}
                obligatoire
                maxLength={60}
                value={reference}
                onChange={(evenement) => {
                  setReference(evenement.target.value)
                }}
              />
            </>
          )}
          {mode === 'CARTE' && (
            <ChampSaisie
              libelle={t('remboursement.referenceCarte')}
              maxLength={60}
              value={reference}
              onChange={(evenement) => {
                setReference(evenement.target.value)
              }}
            />
          )}
          <div
            role="radiogroup"
            aria-label={t('remboursement.motif')}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <span className="text-corps-fort text-encre sm:col-span-2">
              {t('remboursement.motif')}
            </span>
            {MOTIFS.map((candidat) => (
              <button
                key={candidat}
                type="button"
                role="radio"
                aria-checked={motif === candidat}
                onClick={() => {
                  setMotif(candidat)
                }}
                className={clsx(
                  'flex min-h-cible-caisse items-center rounded-normal bg-surface px-3 text-left text-corps text-encre',
                  motif === candidat ? 'border-2 border-accent font-bold' : 'border border-trait',
                )}
              >
                {t(`remboursement.motifs.${candidat}`)}
              </button>
            ))}
          </div>
          {motif === 'AUTRE' && (
            <ChampSaisie
              libelle={t('remboursement.detail')}
              obligatoire
              maxLength={120}
              value={detail}
              onChange={(evenement) => {
                setDetail(evenement.target.value)
              }}
            />
          )}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-end gap-3 border-t border-trait pt-4">
        <p className="m-0 min-w-0 flex-1 text-legende text-attenue">
          {manques.length > 0
            ? t('remboursement.manques.pour', { liste: manques.join(', ') })
            : t('remboursement.trace')}
        </p>
        <Bouton
          variante="principal"
          className="min-h-bouton-encaisser w-full px-6 text-titre-carte sm:w-auto"
          disabled={mode === null || manques.length > 0}
          enCours={enCours}
          onClick={() => void rembourser()}
        >
          {t('remboursement.valider', {
            montant: courte(montant),
            mode: mode === null ? '' : libelleMode(mode, operateur ?? undefined, operateurs, t),
          })}
        </Bouton>
      </div>
      {validation.dialogue}
    </section>
  )
}
