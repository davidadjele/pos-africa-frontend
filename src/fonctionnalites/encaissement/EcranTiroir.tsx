import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ArrowLeft, Lock, Plus, RotateCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type {
  DemandeCloture,
  DemandeMouvement,
  EspecesCaisse,
  MouvementResume,
  RapportZ,
  RemboursementsCaisse,
  ResultatComptage,
  SituationCaisse,
  TypeMouvement,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, symboleDe, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { useSessionCaisse } from '../caisse/requetes'
import { useValidation } from '../commande/useValidation'
import { requeteAppareil } from '../tablette/requetes'
import { EtapeComptage, ResultatEcart, useComptage } from './Comptage'
import { OuvertureCaisse } from './EcranEncaissement'
import { NotesEncaissees } from './NotesEncaissees'
import { requeteOuvertureCaisse } from './requetes'

const TYPES: TypeMouvement[] = ['RETRAIT', 'DEPENSE', 'APPORT']
const TONS: Record<TypeMouvement, 'neutre' | 'alerte' | 'info'> = {
  RETRAIT: 'neutre',
  DEPENSE: 'alerte',
  APPORT: 'info',
}

export const requeteSituation = {
  queryKey: ['caisse', 'situation'],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    appelerCaisse<SituationCaisse>('/caisse/situation', { signal }),
  retry: false,
}

/**
 * La caisse de la tablette pendant la journée : ce qu'elle a encaissé, ses mouvements d'espèces,
 * et sa clôture. Les espèces attendues ne se montrent qu'au gérant : le caissier compte à l'aveugle.
 */
export function EcranTiroir() {
  const permissions = useSessionCaisse()?.permissions
  // La tablette reste sur l'écran courant quand on change d'utilisateur : un serveur n'a rien à faire ici.
  if (
    permissions !== undefined &&
    !permissions.includes('PAIEMENT_ENCAISSER') &&
    !permissions.includes('CAISSE_FERMER')
  ) {
    return <Navigate to="/caisse" />
  }
  return <Tiroir />
}

function Tiroir() {
  const { t } = useTranslation()
  const naviguer = useNavigate()
  const clientRequetes = useQueryClient()
  const { data: appareil } = useQuery(requeteAppareil)
  const devise = (appareil?.entreprise.devise ?? 'XOF') as Devise
  const fuseauHoraire = appareil?.etablissement.fuseauHoraire ?? 'Africa/Lome'
  const session = useSessionCaisse()
  const permissions = session?.permissions ?? []
  const situation = useQuery(requeteSituation)
  const caisse = useQuery(requeteOuvertureCaisse)
  const [etape, setEtape] = useState<'situation' | 'mouvement' | 'cloture'>('situation')
  const [vue, setVue] = useState<'situation' | 'notes'>('situation')
  const nomCaisse = appareil?.nom ?? ''
  const retour = (
    <Bouton icone={ArrowLeft} onClick={() => void naviguer({ to: '/caisse' })}>
      {t('tiroir.retourPlan')}
    </Bouton>
  )

  if (situation.isPending) return <Chargement texte={t('tiroir.chargement')} />
  if (situation.isError) {
    if (situation.error instanceof ErreurApi && situation.error.code === 'CAISSE_FERMEE') {
      // Le fond se préremplit à la création du champ : on attend l'état à jour de la caisse.
      if (caisse.isPending || caisse.isFetching) {
        return <Chargement texte={t('tiroir.chargement')} />
      }
      return (
        <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
          <div className="flex">{retour}</div>
          <OuvertureCaisse
            devise={devise}
            peutOuvrir={permissions.includes('CAISSE_OUVRIR')}
            {...(caisse.data?.dernierFond === undefined
              ? {}
              : { dernierFond: caisse.data.dernierFond })}
            surOuverte={(etat) => {
              clientRequetes.setQueryData(requeteOuvertureCaisse.queryKey, etat)
              void situation.refetch()
            }}
          />
        </div>
      )
    }
    return (
      <AlerteErreur
        erreur={situation.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void situation.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  }

  if (etape === 'cloture') {
    return (
      <Cloture
        nomCaisse={nomCaisse}
        situation={situation.data}
        devise={devise}
        fuseauHoraire={fuseauHoraire}
        surAbandon={() => {
          setEtape('situation')
        }}
        surTermine={() => {
          void clientRequetes.invalidateQueries({ queryKey: ['caisse'] })
          void naviguer({ to: '/caisse' })
        }}
      />
    )
  }

  const { ouverture, ventes, mouvements, especes, notesOuvertes } = situation.data
  // Une note mise sur l'ardoise est vendue sans être encaissée.
  const totalVentes = ventes.ardoise > 0 ? 'tiroir.ventes.totalVendu' : 'tiroir.ventes.total'
  const courte = (montant: number) =>
    formaterMontant({ unitesMineures: montant, devise }, { forme: 'courte' })
  const nombre = (montant: number) =>
    formaterMontant({ unitesMineures: montant, devise }, { forme: 'nombre' })

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <div className="flex flex-col gap-3 rounded-moyen border border-trait bg-surface px-4 py-3 md:flex-row md:items-center">
        <span className="self-start md:self-auto">{retour}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 text-titre-page text-encre">
            {t('tiroir.titre', { caisse: nomCaisse })}
          </h1>
          <span className="text-legende text-attenue">
            {t('tiroir.ouverte', {
              heure: formaterHeure(ouverture.ouverteLe, fuseauHoraire),
              nom: ouverture.ouvertePar,
              fond: courte(ouverture.fondInitial),
            })}
          </span>
        </span>
        <span className="flex flex-col gap-2 sm:flex-row md:[&>*]:flex-none">
          {permissions.includes('PAIEMENT_ENCAISSER') && (
            <Bouton
              icone={Plus}
              onClick={() => {
                setEtape('mouvement')
              }}
            >
              {t('tiroir.mouvement')}
            </Bouton>
          )}
          {permissions.includes('CAISSE_FERMER') && (
            <Bouton
              variante="principal"
              icone={Lock}
              onClick={() => {
                setEtape('cloture')
              }}
            >
              {t('tiroir.cloturer')}
            </Bouton>
          )}
        </span>
      </div>
      <div role="tablist" aria-label={t('tiroir.vues.titre')} className="flex gap-2">
        {(['situation', 'notes'] as const).map((candidat) => (
          <button
            key={candidat}
            type="button"
            role="tab"
            aria-selected={vue === candidat}
            onClick={() => {
              setVue(candidat)
            }}
            className={clsx(
              'min-h-cible-min rounded-normal bg-surface px-4 text-corps text-encre',
              vue === candidat ? 'border-2 border-accent font-bold' : 'border border-trait',
            )}
          >
            {t(`tiroir.vues.${candidat}`)}
          </button>
        ))}
      </div>
      {vue === 'notes' ? (
        <NotesEncaissees devise={devise} fuseauHoraire={fuseauHoraire} />
      ) : (
        <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:flex-row">
          <section
            aria-label={t('tiroir.ventes.titre')}
            className="flex min-w-0 flex-1 flex-col gap-1 rounded-moyen lg:overflow-y-auto border border-trait bg-surface p-5"
          >
            <h2 className="m-0 text-titre-carte text-encre">{t('tiroir.ventes.titre')}</h2>
            <span className="text-legende text-attenue">
              {t('tiroir.ventes.notes', { count: ventes.notes })}
            </span>
            <Montant libelle={t('encaissement.modes.ESPECES')} valeur={nombre(ventes.especes)} />
            <Montant
              libelle={t('encaissement.modes.MOBILE_MONEY')}
              valeur={nombre(ventes.mobileMoney)}
            />
            <Montant libelle={t('encaissement.modes.CARTE')} valeur={nombre(ventes.carte)} />
            {ventes.ardoise > 0 && (
              <Montant libelle={t('encaissement.modes.ARDOISE')} valeur={nombre(ventes.ardoise)} />
            )}
            {ventes.remboursements.total > 0 && (
              <>
                <Montant libelle={t(totalVentes)} valeur={nombre(ventes.total)} />
                <LignesRemboursements remboursements={ventes.remboursements} nombre={nombre} />
              </>
            )}
            <span className="mt-1 flex items-baseline justify-between border-t border-encre pt-2">
              <span className="text-corps-fort text-encre">
                {t(ventes.remboursements.total > 0 ? 'tiroir.ventes.nettes' : totalVentes)}
              </span>
              <span className="chiffres text-montant-total text-encre">
                {courte(ventes.total - ventes.remboursements.total)}
              </span>
            </span>
            <h2 className="m-0 mt-5 text-titre-carte text-encre">{t('tiroir.mouvements.titre')}</h2>
            {mouvements.length === 0 ? (
              <p className="m-0 text-corps text-attenue">{t('tiroir.mouvements.aucun')}</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {mouvements.map((mouvement) => (
                  <LigneMouvement
                    key={mouvement.id}
                    mouvement={mouvement}
                    devise={devise}
                    fuseauHoraire={fuseauHoraire}
                  />
                ))}
              </ul>
            )}
            {notesOuvertes > 0 && (
              <p className="m-0 mt-4 text-legende text-attenue">
                {t('tiroir.notesOuvertes', { count: notesOuvertes })}
              </p>
            )}
          </section>
          {especes === undefined ? (
            <p className="m-0 rounded-moyen border border-trait bg-surface p-5 text-corps text-attenue lg:w-ticket-largeur">
              {t('tiroir.especes.reserve')}
            </p>
          ) : (
            <section
              aria-label={t('tiroir.especes.titre')}
              className="flex shrink-0 flex-col gap-1 rounded-moyen border border-trait bg-surface p-5 lg:w-ticket-largeur"
            >
              <h2 className="m-0 text-titre-carte text-encre">{t('tiroir.especes.titre')}</h2>
              <DetailEspeces especes={especes} nombre={nombre} />
              <span className="mt-1 flex items-baseline justify-between border-t border-encre pt-2">
                <span className="text-corps-fort text-encre">{t('tiroir.especes.attendu')}</span>
                <span className="chiffres text-montant-total text-encre">
                  {courte(especes.attendu)}
                </span>
              </span>
            </section>
          )}
        </div>
      )}
      {etape === 'mouvement' && (
        <DialogueMouvement
          ouvertureId={ouverture.id}
          nomCaisse={nomCaisse}
          demandeur={session?.nomCourt ?? ''}
          devise={devise}
          surFermer={() => {
            setEtape('situation')
          }}
          surFait={(nouvelle) => {
            clientRequetes.setQueryData(requeteSituation.queryKey, nouvelle)
            setEtape('situation')
          }}
        />
      )}
    </div>
  )
}

/** « +5 000 », « −2 500 », mais « 0 » tout court. */
function signe(prefixe: '+' | '−', valeur: number, nombre: (valeur: number) => string): string {
  return valeur === 0 ? nombre(0) : `${prefixe}${nombre(valeur)}`
}

/** Une partie du rapport Z, sous son titre : chaque partie répond à une seule question. */
function SectionZ({ titre, children }: Readonly<{ titre: string; children: ReactNode }>) {
  return (
    <div className="mt-3 flex flex-col border-t border-trait pt-3">
      <h2 className="m-0 mb-1 text-libelle font-bold uppercase tracking-wide text-attenue">
        {titre}
      </h2>
      {children}
    </div>
  )
}

/**
 * Les remboursements, puis leur détail par mode : tous réduisent les ventes, seuls ceux en espèces sortent du
 * tiroir.
 */
function LignesRemboursements({
  remboursements,
  nombre,
}: Readonly<{ remboursements: RemboursementsCaisse; nombre: (valeur: number) => string }>) {
  const { t } = useTranslation()
  if (remboursements.total === 0) return null
  const parMode = [
    ['ESPECES', remboursements.especes],
    ['MOBILE_MONEY', remboursements.mobileMoney],
    ['CARTE', remboursements.carte],
  ] as const
  return (
    <>
      <Montant
        libelle={t('tiroir.ventes.remboursements')}
        valeur={signe('−', remboursements.total, nombre)}
      />
      {parMode
        .filter(([, montant]) => montant > 0)
        .map(([mode, montant]) => (
          <Montant
            key={mode}
            retrait
            libelle={t('cloture.z.dontMode', { mode: t(`encaissement.modesEn.${mode}`) })}
            valeur={nombre(montant)}
          />
        ))}
    </>
  )
}

/** D'où vient l'attendu : le même détail sur l'écran de la caisse et sur le rapport Z. */
function DetailEspeces({
  especes,
  nombre,
}: Readonly<{ especes: EspecesCaisse; nombre: (valeur: number) => string }>) {
  const { t } = useTranslation()
  return (
    <>
      <Montant libelle={t('tiroir.especes.fond')} valeur={nombre(especes.fond)} />
      <Montant libelle={t('tiroir.especes.recues')} valeur={signe('+', especes.recues, nombre)} />
      <Montant libelle={t('tiroir.especes.rendues')} valeur={signe('−', especes.rendues, nombre)} />
      {especes.remboursements > 0 && (
        <Montant
          libelle={t('tiroir.especes.remboursements')}
          valeur={signe('−', especes.remboursements, nombre)}
        />
      )}
      <Montant libelle={t('tiroir.especes.apports')} valeur={signe('+', especes.apports, nombre)} />
      <Montant
        libelle={t('tiroir.especes.retraits')}
        valeur={signe('−', especes.retraits, nombre)}
      />
      <Montant
        libelle={t('tiroir.especes.depenses')}
        valeur={signe('−', especes.depenses, nombre)}
      />
    </>
  )
}

function Montant({
  libelle,
  valeur,
  retrait = false,
}: Readonly<{ libelle: string; valeur: string; retrait?: boolean }>) {
  return (
    <span
      className={clsx('flex justify-between gap-3 py-1 text-corps text-attenue', retrait && 'pl-4')}
    >
      <span>{libelle}</span>
      <span className="chiffres text-encre">{valeur}</span>
    </span>
  )
}

function LigneMouvement({
  mouvement,
  devise,
  fuseauHoraire,
}: Readonly<{ mouvement: MouvementResume; devise: Devise; fuseauHoraire: string }>) {
  const { t } = useTranslation()
  const heure = formaterHeure(mouvement.effectueLe, fuseauHoraire)
  const signe = mouvement.type === 'APPORT' ? '+' : '−'
  return (
    <li className="flex items-center gap-2.5 border-b border-trait py-2.5 last:border-b-0">
      <BadgeStatut ton={TONS[mouvement.type]}>{t(`tiroir.types.${mouvement.type}`)}</BadgeStatut>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-libelle font-bold text-encre">{mouvement.motif}</span>
        <span className="text-legende text-attenue">
          {mouvement.approuvePar === undefined
            ? t('tiroir.mouvements.par', { heure, nom: mouvement.effectuePar })
            : t('tiroir.mouvements.valide', {
                heure,
                nom: mouvement.effectuePar,
                validateur: mouvement.approuvePar,
              })}
        </span>
      </span>
      <span className="chiffres text-montant-ligne text-encre">
        {signe}
        {formaterMontant({ unitesMineures: mouvement.montant, devise }, { forme: 'nombre' })}
      </span>
    </li>
  )
}

function DialogueMouvement({
  ouvertureId,
  nomCaisse,
  demandeur,
  devise,
  surFermer,
  surFait,
}: Readonly<{
  ouvertureId: string
  nomCaisse: string
  demandeur: string
  devise: Devise
  surFermer: () => void
  surFait: (situation: SituationCaisse) => void
}>) {
  const { t } = useTranslation()
  const validation = useValidation()
  const [type, setType] = useState<TypeMouvement>('RETRAIT')
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const montantLu = lireMontant(montant, devise)
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })
  // Les manques ne s'affichent qu'après un essai : pas de rouge pendant la saisie.
  const [essaye, setEssaye] = useState(false)
  const montantManquant = montantLu === null || montantLu === 0
  const motifManquant = motif.trim() === ''

  async function valider() {
    setEssaye(true)
    if (montantLu === null || montantManquant || motifManquant) return
    setEnCours(true)
    setErreur(null)
    const demande: DemandeMouvement = { type, montant: montantLu, motif: motif.trim() }
    try {
      const reponse = await validation.executer(
        (validationId) =>
          appelerCaisse<SituationCaisse>('/caisse/mouvements', {
            methode: 'POST',
            corps: validationId === undefined ? demande : { ...demande, validationId },
          }),
        {
          permission: 'CAISSE_MOUVEMENT',
          objetId: ouvertureId,
          titre: t('tiroir.dialogue.validationTitre', {
            type: t(`tiroir.types.${type}`),
            montant: courte(montantLu),
          }),
          contexte: t('tiroir.dialogue.validationContexte', {
            caisse: nomCaisse,
            demandeur,
            motif: motif.trim(),
          }),
        },
      )
      if (reponse !== undefined) surFait(reponse)
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  if (validation.dialogue !== null) return validation.dialogue
  return (
    <Dialogue
      titre={t('tiroir.dialogue.titre')}
      consequence={t('tiroir.dialogue.phrase')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={
        montantLu === null
          ? t('tiroir.dialogue.valider')
          : t(type === 'APPORT' ? 'tiroir.dialogue.ajouter' : 'tiroir.dialogue.sortir', {
              montant: courte(montantLu),
            })
      }
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void valider()}
    >
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <div
        role="radiogroup"
        aria-label={t('tiroir.dialogue.type')}
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {TYPES.map((candidat) => (
          <button
            key={candidat}
            type="button"
            role="radio"
            aria-checked={type === candidat}
            onClick={() => {
              setType(candidat)
            }}
            className={clsx(
              'flex min-h-16 flex-col items-start justify-center rounded-normal bg-surface px-3 text-left text-encre',
              type === candidat ? 'border-2 border-accent' : 'border border-trait',
            )}
          >
            <span className="text-corps-fort">{t(`tiroir.types.${candidat}`)}</span>
            <span className="text-legende text-attenue">{t(`tiroir.aides.${candidat}`)}</span>
          </button>
        ))}
      </div>
      <ChampSaisie
        libelle={t('tiroir.dialogue.montant')}
        inputMode="numeric"
        suffixe={symboleDe(devise)}
        value={montant}
        erreur={essaye && montantManquant ? t('tiroir.dialogue.montantRequis') : undefined}
        onChange={(evenement) => {
          setMontant(evenement.target.value.replace(/[^\d\s]/gu, ''))
        }}
      />
      <ChampSaisie
        libelle={t('tiroir.dialogue.motif')}
        obligatoire
        maxLength={120}
        value={motif}
        erreur={essaye && motifManquant ? t('tiroir.dialogue.motifRequis') : undefined}
        onChange={(evenement) => {
          setMotif(evenement.target.value)
        }}
      />
    </Dialogue>
  )
}

/** Clôture en trois temps : compter à l'aveugle, voir et expliquer l'écart, puis le rapport Z. */
function Cloture({
  nomCaisse,
  situation,
  devise,
  fuseauHoraire,
  surAbandon,
  surTermine,
}: Readonly<{
  nomCaisse: string
  situation: SituationCaisse
  devise: Devise
  fuseauHoraire: string
  surAbandon: () => void
  surTermine: () => void
}>) {
  const { t } = useTranslation()
  const comptage = useComptage(devise)
  const [resultat, setResultat] = useState<ResultatComptage | null>(null)
  const [explication, setExplication] = useState('')
  const [fondLaisse, setFondLaisse] = useState(String(situation.ouverture.fondInitial))
  const [rapport, setRapport] = useState<RapportZ | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const compte = comptage.total

  async function envoyer<T>(chemin: string, corps: object): Promise<T | null> {
    setEnCours(true)
    setErreur(null)
    try {
      return await appelerCaisse<T>(chemin, { methode: 'POST', corps })
    } catch (echec) {
      setErreur(echec)
      return null
    } finally {
      setEnCours(false)
    }
  }

  const titre = (
    <div className="flex flex-wrap items-center gap-3 rounded-moyen border border-trait bg-surface px-4 py-3">
      <Bouton icone={ArrowLeft} onClick={surAbandon}>
        {t('commun.annuler')}
      </Bouton>
      <span className="flex flex-col">
        <h1 className="m-0 text-titre-page text-encre">
          {t('cloture.titre', { caisse: nomCaisse })}
        </h1>
        <span className="text-legende text-attenue">{t('cloture.etapes')}</span>
      </span>
    </div>
  )

  if (rapport !== null) {
    return (
      <RapportDeCloture
        rapport={rapport}
        devise={devise}
        fuseauHoraire={fuseauHoraire}
        surTermine={surTermine}
      />
    )
  }

  if (resultat !== null) {
    const fondLu = lireMontant(fondLaisse, devise)
    const ecart = resultat.ecart
    const aExpliquer = ecart !== 0 && explication.trim() === ''
    return (
      <div className="flex flex-col gap-3">
        {titre}
        <section
          aria-label={t('cloture.z.ecart')}
          className="mx-auto flex w-full max-w-[640px] flex-col gap-3.5 rounded-moyen border border-trait bg-surface p-6"
        >
          {erreur !== null && <AlerteErreur erreur={erreur} />}
          <ResultatEcart
            libelleAttendu={t('cloture.attendu')}
            attendu={resultat.attendu}
            compte={resultat.compte}
            devise={devise}
          />
          {ecart !== 0 && (
            <ChampSaisie
              libelle={t('cloture.explication')}
              obligatoire
              maxLength={200}
              value={explication}
              onChange={(evenement) => {
                setExplication(evenement.target.value)
              }}
            />
          )}
          <ChampSaisie
            libelle={t('cloture.fondLaisse')}
            inputMode="numeric"
            suffixe={symboleDe(devise)}
            value={fondLaisse}
            onChange={(evenement) => {
              setFondLaisse(evenement.target.value)
            }}
          />
          {resultat.notesOuvertes > 0 && (
            <p className="m-0 text-legende text-attenue">
              {t('tiroir.notesOuvertes', { count: resultat.notesOuvertes })}
            </p>
          )}
          {aExpliquer && (
            <p className="m-0 text-legende text-danger">{t('cloture.explicationRequise')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Bouton
              className="flex-1"
              onClick={() => {
                setResultat(null)
              }}
            >
              {t('cloture.recompter')}
            </Bouton>
            <Bouton
              variante="principal"
              className="flex-[2]"
              disabled={aExpliquer || fondLu === null}
              enCours={enCours}
              onClick={() =>
                void envoyer<RapportZ>('/caisse/cloture', {
                  especesComptees: resultat.compte,
                  fondLaisse: fondLu ?? 0,
                  ...(ecart === 0 ? {} : { explication: explication.trim() }),
                } satisfies DemandeCloture).then((z) => {
                  if (z !== null) setRapport(z)
                })
              }
            >
              {t('cloture.cloturer')}
            </Bouton>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      {titre}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <EtapeComptage
        comptage={comptage}
        aide={t('cloture.aveugle')}
        action={
          <Bouton
            variante="principal"
            enCours={enCours}
            onClick={() =>
              void envoyer<ResultatComptage>('/caisse/cloture/comptage', {
                especesComptees: compte,
              }).then((reponse) => {
                if (reponse !== null) setResultat(reponse)
              })
            }
          >
            {t('cloture.valider')}
          </Bouton>
        }
      />
    </div>
  )
}

function RapportDeCloture({
  rapport,
  devise,
  fuseauHoraire,
  surTermine,
}: Readonly<{
  rapport: RapportZ
  devise: Devise
  fuseauHoraire: string
  surTermine: () => void
}>) {
  const { t } = useTranslation()
  const titre = t('cloture.z.titre', { numero: rapport.numero })
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })
  return (
    <section
      aria-label={titre}
      className="mx-auto flex w-full max-w-[560px] flex-col gap-1.5 rounded-moyen border border-trait bg-surface p-7"
    >
      <span className="self-start">
        <BadgeStatut ton="succes">{t('cloture.z.badge')}</BadgeStatut>
      </span>
      <h1 className="m-0 mt-1 text-titre-page text-encre">{titre}</h1>
      <span className="text-legende text-attenue">
        {t('cloture.z.periode', {
          ouverture: formaterHeure(rapport.ouverteLe, fuseauHoraire),
          cloture: formaterHeure(rapport.clotureeLe, fuseauHoraire),
          nom: rapport.clotureePar,
        })}
      </span>
      <SectionZ titre={t('cloture.z.sections.ventes')}>
        <Montant
          libelle={t(
            rapport.ventes.ardoise > 0 ? 'cloture.z.ventesAvecArdoise' : 'cloture.z.ventes',
            { count: rapport.ventes.notes },
          )}
          valeur={nombre(rapport.ventes.total)}
        />
        {(
          [
            ['ESPECES', rapport.ventes.especes],
            ['MOBILE_MONEY', rapport.ventes.mobileMoney],
            ['CARTE', rapport.ventes.carte],
            ['ARDOISE', rapport.ventes.ardoise],
          ] as const
        )
          // L'ardoise n'apparaît que les jours où l'on a vendu à crédit.
          .filter(([mode, montant]) => mode !== 'ARDOISE' || montant > 0)
          .map(([mode, montant]) => (
            <Montant
              key={mode}
              retrait
              libelle={t('cloture.z.dontMode', { mode: t(`encaissement.modesEn.${mode}`) })}
              valeur={nombre(montant)}
            />
          ))}
        <LignesRemboursements remboursements={rapport.ventes.remboursements} nombre={nombre} />
        <span className="mt-1 flex justify-between gap-3 border-t border-trait pt-1.5 text-corps-fort text-encre">
          <span>{t('tiroir.ventes.nettes')}</span>
          <span className="chiffres">
            {nombre(rapport.ventes.total - rapport.ventes.remboursements.total)}
          </span>
        </span>
      </SectionZ>
      <SectionZ titre={t('cloture.z.sections.information')}>
        <Montant libelle={t('cloture.z.remises')} valeur={signe('−', rapport.remises, nombre)} />
        <Montant
          libelle={t('cloture.z.annulations', { nombre: rapport.articlesAnnules })}
          valeur={signe('−', rapport.annulations, nombre)}
        />
        <Montant libelle={t('cloture.z.tva')} valeur={nombre(rapport.tva)} />
      </SectionZ>
      <SectionZ titre={t('cloture.z.sections.tiroir')}>
        <DetailEspeces especes={rapport.especes} nombre={nombre} />
        <span className="mt-1 flex justify-between gap-3 border-t border-trait pt-1.5 text-corps-fort text-encre">
          <span>{t('cloture.z.attendu')}</span>
          <span className="chiffres">{nombre(rapport.especes.attendu)}</span>
        </span>
      </SectionZ>
      <SectionZ titre={t('cloture.z.sections.comptage')}>
        <Montant libelle={t('cloture.z.compte')} valeur={nombre(rapport.compte)} />
        <Montant
          libelle={t('cloture.z.ecart')}
          valeur={`${rapport.ecart > 0 ? '+' : rapport.ecart < 0 ? '−' : ''}${nombre(Math.abs(rapport.ecart))}`}
        />
        <Montant libelle={t('cloture.z.fondLaisse')} valeur={nombre(rapport.fondLaisse)} />
      </SectionZ>
      <p className="m-0 mt-2 text-legende text-attenue">{t('cloture.z.fige')}</p>
      <Bouton variante="principal" className="mt-2 min-h-cible-caisse" onClick={surTermine}>
        {t('cloture.z.terminer')}
      </Bouton>
    </section>
  )
}
