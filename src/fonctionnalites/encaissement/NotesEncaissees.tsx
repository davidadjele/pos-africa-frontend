import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft, Printer, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type {
  AvoirCaisse,
  DemandeRemboursement,
  EtatRemboursement,
  ModePaiement,
  MotifRemboursement,
  NoteEncaissee,
  OperateurMobileMoney,
  PartRemboursement,
  RecuCaisse,
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
import { ChoixRetourStock } from '../commande/DialoguesLigne'
import { requeteStockCaisse, stockDuProduit } from '../commande/requetes'
import { ChoixArticles, ChoixOperateur } from './ChoixArticles'
import { ORDRE_REMBOURSEMENT, repartirRemboursement } from './repartition'
import { formaterJournee } from '../rapports/periodes'
import { TicketAvoir } from './TicketAvoir'
import { TicketRecu } from './TicketRecu'
import { useImpression } from '../../partage/impression/useImpression'
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
/** Ce que fait le remboursement dans chaque mode : en espèces il sort du tiroir, sur l'ardoise il réduit la dette. */
const AIDES_REMBOURSEMENT: Record<ModePaiement, string> = {
  ESPECES: 'remboursement.aideEspeces',
  MOBILE_MONEY: 'remboursement.aidePaye',
  CARTE: 'remboursement.aidePaye',
  ARDOISE: 'remboursement.aideArdoise',
}

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
        fuseauHoraire={fuseauHoraire}
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
        <AutreJour
          surTrouvee={(note) => {
            setChoisie(note.id)
          }}
        />
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
  fuseauHoraire,
  surFermer,
}: Readonly<{ commandeId: string; devise: Devise; fuseauHoraire: string; surFermer: () => void }>) {
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
      fuseauHoraire={fuseauHoraire}
      operateurs={caisse?.operateurs ?? []}
      surFermer={surFermer}
    />
  )
}

/** Une note d'un autre jour, retrouvée par le numéro de son reçu ou le lien de son QR code. */
function AutreJour({ surTrouvee }: Readonly<{ surTrouvee: (note: NoteEncaissee) => void }>) {
  const { t } = useTranslation()
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const introuvable = erreur instanceof ErreurApi && erreur.statut === 404

  async function retrouver() {
    setEnCours(true)
    setErreur(null)
    try {
      surTrouvee(
        await appelerCaisse<NoteEncaissee>(
          `/caisse/notes-encaissees/recherche?recu=${encodeURIComponent(saisie.trim())}`,
        ),
      )
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form
      aria-label={t('remboursement.autreJour.titre')}
      onSubmit={(evenement) => {
        evenement.preventDefault()
        void retrouver()
      }}
      className="flex flex-col gap-2 border-b border-trait bg-fond px-4 py-3"
    >
      <span className="text-corps-fort text-encre">{t('remboursement.autreJour.titre')}</span>
      <span className="text-legende text-attenue">{t('remboursement.autreJour.aide')}</span>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-48 flex-1">
          <ChampSaisie
            libelle={t('remboursement.autreJour.champ')}
            libelleMasque
            placeholder="BE-000127"
            autoComplete="off"
            value={saisie}
            erreur={introuvable ? t('remboursement.autreJour.introuvable') : undefined}
            onChange={(evenement) => {
              setSaisie(evenement.target.value)
            }}
          />
        </div>
        <Bouton type="submit" enCours={enCours} disabled={saisie.trim() === ''}>
          {t('remboursement.autreJour.retrouver')}
        </Bouton>
      </div>
      {erreur !== null && !introuvable && <AlerteErreur erreur={erreur} />}
    </form>
  )
}

/** L'avoir d'un remboursement, imprimé par le navigateur : l'original, puis des duplicatas. */
function useImpressionAvoir(
  devise: Devise,
  fuseauHoraire: string,
  operateurs: OperateurMobileMoney[],
) {
  const { imprimer, zone } = useImpression()
  const [etat, setEtat] = useState<{ enCours: boolean; erreur: unknown }>({
    enCours: false,
    erreur: null,
  })

  async function imprimerAvoir(operationId: string) {
    setEtat({ enCours: true, erreur: null })
    try {
      const avoir = await appelerCaisse<AvoirCaisse>(
        `/caisse/remboursements/${operationId}/avoir/impressions`,
        { methode: 'POST' },
      )
      imprimer(
        <TicketAvoir
          avoir={avoir}
          operateurs={operateurs}
          devise={devise}
          fuseauHoraire={fuseauHoraire}
        />,
      )
      setEtat({ enCours: false, erreur: null })
      return true
    } catch (echec) {
      setEtat({ enCours: false, erreur: echec })
      return false
    }
  }

  return { imprimerAvoir, ...etat, zone }
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
  const { imprimer, zone } = useImpression()
  const avoirs = useImpressionAvoir(devise, fuseauHoraire, caisse?.operateurs ?? [])
  const [impression, setImpression] = useState<{ enCours: boolean; erreur: unknown }>({
    enCours: false,
    erreur: null,
  })
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })

  async function reimprimer() {
    setImpression({ enCours: true, erreur: null })
    try {
      const recu = await appelerCaisse<RecuCaisse>(
        `/caisse/commandes/${commandeId}/recu/impressions`,
        {
          methode: 'POST',
        },
      )
      imprimer(
        <TicketRecu
          recu={recu}
          operateurs={caisse?.operateurs ?? []}
          devise={devise}
          fuseauHoraire={fuseauHoraire}
        />,
      )
      setImpression({ enCours: false, erreur: null })
    } catch (echec) {
      setImpression({ enCours: false, erreur: echec })
    }
  }

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
      {note.autreJour && (
        <span className="self-start">
          <BadgeStatut ton="alerte">
            {t('remboursement.autreJour.badge', { jour: formaterJournee(note.journee) })}
          </BadgeStatut>
        </span>
      )}
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
                  , {libelleParts(remboursement.parts, operateurs, nombre, t)}
                </span>
                <span className="text-legende text-attenue">
                  {formaterHeure(remboursement.rembourseLe, fuseauHoraire)},{' '}
                  {remboursement.remboursePar},{' '}
                  {t(`remboursement.motifs.${remboursement.motif}`).toLowerCase()}
                  {remboursement.approuvePar === undefined
                    ? ''
                    : `. ${t('remboursement.validePar', { nom: remboursement.approuvePar })}`}
                </span>
                {remboursement.avoir !== undefined && (
                  <button
                    type="button"
                    onClick={() => void avoirs.imprimerAvoir(remboursement.id)}
                    className="mt-1 flex min-h-cible-min items-center gap-1.5 self-start text-libelle font-bold text-encre"
                  >
                    <Printer aria-hidden="true" className="size-4" />
                    {t('avoir.reimprimer', { numero: remboursement.avoir })}
                  </button>
                )}
              </span>
              <span className="chiffres text-montant-ligne text-encre">
                −{nombre(remboursement.montant)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <span className="mt-auto pt-4" />
      {impression.erreur !== null && <AlerteErreur erreur={impression.erreur} />}
      {avoirs.erreur !== null && <AlerteErreur erreur={avoirs.erreur} />}
      {avoirs.zone}
      <Bouton
        className="min-h-cible-caisse"
        enCours={impression.enCours}
        onClick={() => void reimprimer()}
      >
        {t('recu.reimprimer')}
      </Bouton>
      {zone}
      {note.remboursable && resteARembourser ? (
        <Bouton className="min-h-cible-caisse" onClick={surRembourser}>
          {t('remboursement.rembourser')}
        </Bouton>
      ) : (
        <p className="m-0 text-legende text-attenue">
          {t(note.remboursable ? 'remboursement.toutRembourse' : 'remboursement.tropAncien')}
        </p>
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

/** « espèces », ou « 500 sur ardoise, 600 en espèces » quand le remboursement s'est réparti. */
function libelleParts(
  parts: readonly PartRemboursement[],
  operateurs: OperateurMobileMoney[],
  nombre: (valeur: number) => string,
  t: TFunction,
) {
  const [seule] = parts
  if (parts.length === 1 && seule !== undefined) {
    return libelleMode(seule.mode, seule.operateur, operateurs, t)
  }
  return parts
    .map((part) =>
      t('remboursement.partEn', {
        montant: nombre(part.montant),
        mode: libelleMode(part.mode, part.operateur, operateurs, t),
      }),
    )
    .join(', ')
}

function Rembourser({
  etat,
  titre,
  devise,
  fuseauHoraire,
  operateurs,
  surFermer,
}: Readonly<{
  etat: EtatRemboursement
  titre: string
  devise: Devise
  fuseauHoraire: string
  operateurs: OperateurMobileMoney[]
  surFermer: () => void
}>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const validation = useValidation()
  const session = useSessionCaisse()
  // Dans l'ordre où le remboursement s'y répartit.
  const disponibles = etat.modes
    .filter((candidat) => candidat.remboursable > 0)
    .sort((a, b) => ORDRE_REMBOURSEMENT.indexOf(a.mode) - ORDRE_REMBOURSEMENT.indexOf(b.mode))
  const [selection, setSelection] = useState<Record<string, number>>({})
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
  const [fait, setFait] = useState<EtatRemboursement['remboursements'][number] | null>(null)
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })
  // Le remboursement se calcule comme le paiement par articles : ce qui est déjà remboursé est « réglé ».
  const articles = etat.articles.map((article) => ({
    ...article,
    payees: article.rembourses,
    paye: article.rembourse,
  }))
  const montant = totalSelection(articles, selection)
  const stock = useQuery(requeteStockCaisse)
  // La question du stock ne vaut que pour les articles choisis qui y sont suivis (boissons, articles revendus).
  const suiviEnStock = etat.articles.some(
    (article) =>
      (selection[article.ligneId] ?? 0) > 0 &&
      stockDuProduit(stock.data, article.produitId) !== undefined,
  )
  const [retour, setRetour] = useState<boolean | null>(null)
  const revient = retour ?? (motif === 'ERREUR_ENCAISSEMENT' || motif === 'ARTICLE_NON_SERVI')
  // Le montant se répartit entre les modes de la note, comme le serveur le fera.
  const parts = repartirRemboursement(montant, etat.modes)
  const enMobile = parts?.some((part) => part.mode === 'MOBILE_MONEY') ?? false
  const parCarte = parts?.some((part) => part.mode === 'CARTE') ?? false
  const remboursable = disponibles.reduce((somme, candidat) => somme + candidat.remboursable, 0)
  const libelleRepartition =
    parts?.length === 1 && parts[0] !== undefined
      ? libelleMode(parts[0].mode, operateur ?? undefined, operateurs, t)
      : null
  const manques = [
    ...(montant === 0 ? [t('remboursement.manques.articles')] : []),
    ...(parts === null
      ? [t('remboursement.manques.plafond', { montant: courte(remboursable) })]
      : []),
    ...(motif === null ? [t('remboursement.manques.motif')] : []),
    ...(motif === 'AUTRE' && detail.trim() === '' ? [t('remboursement.manques.detail')] : []),
    ...(enMobile && (operateur === null || reference.trim() === '')
      ? [t('remboursement.manques.transfert')]
      : []),
  ]

  async function rembourser() {
    if (motif === null || manques.length > 0) return
    setEnCours(true)
    setErreur(null)
    const demande: DemandeRemboursement = {
      id,
      montant,
      articles: Object.entries(selection)
        .filter(([, quantite]) => quantite > 0)
        .map(([ligneId, quantite]) => ({ ligneId, quantite })),
      motif,
      ...(motif === 'AUTRE' ? { detail: detail.trim() } : {}),
      ...(suiviEnStock ? { retourEnStock: revient } : {}),
      ...(enMobile && operateur !== null ? { operateur } : {}),
      ...((enMobile || parCarte) && reference.trim() !== '' ? { reference: reference.trim() } : {}),
    }
    try {
      const nouvel = await validation.executer(
        (validationId) =>
          appelerCaisse<EtatRemboursement>(`/caisse/commandes/${etat.commandeId}/remboursements`, {
            methode: 'POST',
            corps: validationId === undefined ? demande : { ...demande, validationId },
          }),
        {
          // Une note d'un autre jour demande l'accord de l'encadrement, pas seulement le droit de rembourser.
          permission: etat.autreJour ? 'REMBOURSEMENT_JOURNEE_PASSEE' : 'PAIEMENT_REMBOURSER',
          objetId: etat.commandeId,
          titre:
            libelleRepartition === null
              ? t('remboursement.validationTitreReparti', { montant: courte(montant) })
              : t('remboursement.validationTitre', {
                  montant: courte(montant),
                  mode: libelleRepartition,
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
        setFait(
          nouvel.remboursements.find((remboursement) => remboursement.id === id) ??
            nouvel.remboursements.at(-1) ??
            null,
        )
      }
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  if (fait !== null) {
    return (
      <FinRemboursement
        remboursement={fait}
        devise={devise}
        fuseauHoraire={fuseauHoraire}
        operateurs={operateurs}
        surFermer={surFermer}
      />
    )
  }

  return (
    <section
      aria-label={t('remboursement.titreRembourser', { note: titre })}
      className="flex min-h-0 flex-1 flex-col rounded-moyen border border-trait bg-surface"
    >
      {/* Comme à l'encaissement : le contenu défile, le bouton de remboursement reste en bas. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Bouton icone={ArrowLeft} onClick={surFermer}>
            {t('remboursement.retour')}
          </Bouton>
          <h2 className="m-0 text-titre-section text-encre">
            {t('remboursement.titreRembourser', { note: titre })}
          </h2>
        </div>
        {etat.autreJour && (
          <p className="m-0 flex flex-col gap-1 rounded-normal border border-alerte-bord bg-alerte-fond px-3 py-2 text-corps text-alerte-texte">
            <span className="font-bold">
              {t('remboursement.autreJour.badge', { jour: formaterJournee(etat.journee) })}
            </span>
            {t('remboursement.autreJour.avertissement')}
          </p>
        )}
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
            <section aria-label={t('remboursement.mode')} className="flex flex-col gap-2">
              <h3 className="m-0 text-corps-fort text-encre">{t('remboursement.mode')}</h3>
              <ul className="m-0 flex list-none flex-col overflow-hidden rounded-moyen border border-trait p-0">
                {disponibles.map((candidat) => {
                  const part = parts?.find((rendue) => rendue.mode === candidat.mode)
                  return (
                    <li
                      key={candidat.mode}
                      className={clsx(
                        'flex items-center gap-3 border-b border-trait px-3 py-2.5 last:border-b-0',
                        part === undefined ? 'bg-surface' : 'bg-fond',
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-corps-fort text-encre">
                          {t(`encaissement.modes.${candidat.mode}`)}
                        </span>
                        <span className="text-legende text-attenue">
                          {t(AIDES_REMBOURSEMENT[candidat.mode], {
                            montant: courte(candidat.remboursable),
                          })}
                        </span>
                      </span>
                      <span className="chiffres text-montant-ligne text-encre">
                        {part === undefined ? '—' : courte(part.montant)}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {disponibles.length > 1 && (
                <p className="m-0 text-legende text-attenue">{t('remboursement.ordre')}</p>
              )}
            </section>
            {enMobile && (
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
            {parCarte && !enMobile && (
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
            {suiviEnStock && motif !== null && (
              <ChoixRetourStock
                libelle={t('caisse.stock.articles')}
                revient={revient}
                surChoisir={setRetour}
              />
            )}
          </div>
        </div>
      </div>
      {/* Sur une tablette en portrait, la page défile : le pied reste collé en bas, marge de la page comprise. */}
      <div className="sticky -bottom-4 flex shrink-0 flex-wrap items-center justify-end gap-3 rounded-b-moyen border-t border-trait bg-surface px-5 py-3">
        <p className="m-0 min-w-0 flex-1 text-legende text-attenue">
          {manques.length > 0
            ? t('remboursement.manques.pour', { liste: manques.join(', ') })
            : t('remboursement.trace')}
        </p>
        <Bouton
          variante="principal"
          className="min-h-bouton-encaisser w-full px-6 text-titre-carte sm:w-auto"
          disabled={manques.length > 0}
          enCours={enCours}
          onClick={() => void rembourser()}
        >
          {libelleRepartition === null
            ? t('remboursement.validerSeul', { montant: courte(montant) })
            : t('remboursement.valider', { montant: courte(montant), mode: libelleRepartition })}
        </Bouton>
      </div>
      {validation.dialogue}
    </section>
  )
}

/** Le remboursement fait : on remet l'avoir au client, ou on s'en passe, comme pour le reçu. */
function FinRemboursement({
  remboursement,
  devise,
  fuseauHoraire,
  operateurs,
  surFermer,
}: Readonly<{
  remboursement: EtatRemboursement['remboursements'][number]
  devise: Devise
  fuseauHoraire: string
  operateurs: OperateurMobileMoney[]
  surFermer: () => void
}>) {
  const { t } = useTranslation()
  const { imprimerAvoir, enCours, erreur, zone } = useImpressionAvoir(
    devise,
    fuseauHoraire,
    operateurs,
  )
  const [imprime, setImprime] = useState(false)
  return (
    <section
      aria-label={t('remboursement.fait.titre')}
      className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-3.5 rounded-moyen border border-trait bg-surface p-8 text-center"
    >
      <BadgeStatut ton="succes">{t('remboursement.fait.titre')}</BadgeStatut>
      <h2 className="m-0 text-titre-page text-encre">
        {t('remboursement.fait.montant', {
          montant: formaterMontant(
            { unitesMineures: remboursement.montant, devise },
            { forme: 'courte' },
          ),
        })}
      </h2>
      {remboursement.avoir !== undefined && (
        <span className="text-titre-carte text-encre">
          {t('avoir.numeroCourt', { numero: remboursement.avoir })}
        </span>
      )}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      {imprime || remboursement.avoir === undefined ? (
        <Bouton
          variante="principal"
          className="min-h-bouton-encaisser w-full text-titre-carte"
          onClick={surFermer}
        >
          {t('remboursement.fait.retour')}
        </Bouton>
      ) : (
        <div className="grid w-full gap-2 sm:grid-cols-2">
          <Bouton
            variante="principal"
            icone={Printer}
            className="min-h-bouton-encaisser text-titre-carte"
            enCours={enCours}
            onClick={() =>
              void imprimerAvoir(remboursement.id).then((reussi) => {
                setImprime(reussi)
              })
            }
          >
            {t('avoir.imprimer')}
          </Bouton>
          <Bouton className="min-h-bouton-encaisser text-titre-carte" onClick={surFermer}>
            {t('avoir.sans')}
          </Bouton>
        </div>
      )}
      {zone}
    </section>
  )
}
