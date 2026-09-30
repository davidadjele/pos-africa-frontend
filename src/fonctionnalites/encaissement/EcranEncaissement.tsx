import type { TFunction } from 'i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ArrowLeft, Delete, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type {
  CommandeDetail,
  DemandePaiement,
  EtatCaisse,
  EtatEncaissement,
  ModePaiement,
  OperateurMobileMoney,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, symboleDe, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { formaterTaux } from '../../partage/montants/taxes'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { useSessionCaisse } from '../caisse/requetes'
import { requeteCommande, requetePlan } from '../commande/requetes'
import { requeteAppareil } from '../tablette/requetes'
import { requeteEncaissement, requeteOuvertureCaisse } from './requetes'

const MODES: ModePaiement[] = ['ESPECES', 'MOBILE_MONEY', 'CARTE']
/** Billets courants : les montants rapides arrondissent au billet supérieur. */
const PALIERS = [1000, 2000, 5000, 10_000, 20_000]

/**
 * Encaisser une note, en un ou plusieurs paiements. Chaque paiement porte un identifiant tiré par la
 * tablette : renvoyé après un réseau coupé, il n'est pas compté deux fois.
 */
export function EcranEncaissement({ commandeId }: Readonly<{ commandeId: string }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const naviguer = useNavigate()
  const { data: appareil } = useQuery(requeteAppareil)
  const devise = (appareil?.entreprise.devise ?? 'XOF') as Devise
  const fuseauHoraire = appareil?.etablissement.fuseauHoraire ?? 'Africa/Lome'
  const session = useSessionCaisse()
  const note = useQuery(requeteCommande(commandeId))
  const caisse = useQuery(requeteOuvertureCaisse)
  const etat = useQuery(requeteEncaissement(commandeId))
  const [termine, setTermine] = useState<EtatEncaissement | null>(null)

  const chargement = note.isPending || caisse.isPending || etat.isPending
  const echec = note.error ?? caisse.error ?? etat.error
  if (echec !== null) {
    return (
      <AlerteErreur
        erreur={echec}
        action={
          <Bouton
            icone={RotateCw}
            onClick={() => {
              void note.refetch()
              void caisse.refetch()
              void etat.refetch()
            }}
          >
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  }
  if (
    chargement ||
    note.data === undefined ||
    caisse.data === undefined ||
    etat.data === undefined
  ) {
    return <Chargement texte={t('encaissement.chargement')} />
  }
  const ou = note.data.table?.nom ?? t('caisse.note.numero', { numero: note.data.numero })

  if (termine !== null) {
    return <FinEncaissement etat={termine} note={note.data} devise={devise} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-moyen border border-trait bg-surface px-4 py-3">
        <Bouton
          icone={ArrowLeft}
          onClick={() => void naviguer({ to: '/caisse/notes/$commandeId', params: { commandeId } })}
        >
          {t('encaissement.retourNote')}
        </Bouton>
        <h1 className="m-0 text-titre-page text-encre">{t('encaissement.titre', { ou })}</h1>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <Recapitulatif
          note={note.data}
          etat={etat.data}
          operateurs={caisse.data.operateurs}
          devise={devise}
          fuseauHoraire={fuseauHoraire}
        />
        {caisse.data.ouverture === undefined ? (
          <OuvertureCaisse
            key={caisse.data.dernierFond ?? 'sans-fond'}
            devise={devise}
            peutOuvrir={session?.permissions.includes('CAISSE_OUVRIR') ?? false}
            {...(caisse.data.dernierFond === undefined
              ? {}
              : { dernierFond: caisse.data.dernierFond })}
            surOuverte={(ouverte) => {
              clientRequetes.setQueryData(requeteOuvertureCaisse.queryKey, ouverte)
            }}
          />
        ) : (
          <Paiement
            key={etat.data.paiements.length}
            etat={etat.data}
            operateurs={caisse.data.operateurs}
            devise={devise}
            surPaye={(nouvel) => {
              clientRequetes.setQueryData(requeteEncaissement(commandeId).queryKey, nouvel)
              if (nouvel.payee) {
                void clientRequetes.invalidateQueries({ queryKey: requetePlan.queryKey })
                setTermine(nouvel)
              } else {
                void clientRequetes.invalidateQueries({
                  queryKey: requeteCommande(commandeId).queryKey,
                })
              }
            }}
            surCaisseFermee={() => void caisse.refetch()}
          />
        )}
      </div>
    </div>
  )
}

function Recapitulatif({
  note,
  etat,
  operateurs,
  devise,
  fuseauHoraire,
}: Readonly<{
  note: CommandeDetail
  etat: EtatEncaissement
  operateurs: OperateurMobileMoney[]
  devise: Devise
  fuseauHoraire: string
}>) {
  const { t } = useTranslation()
  const courte = (montant: number) =>
    formaterMontant({ unitesMineures: montant, devise }, { forme: 'courte' })
  const lignes = note.lignes.filter((ligne) => ligne.statut !== 'ANNULEE')
  return (
    <section
      aria-label={t('encaissement.recap')}
      className="flex shrink-0 flex-col gap-1 rounded-moyen border border-trait bg-surface p-4 lg:w-ticket-largeur"
    >
      {lignes.map((ligne) => (
        <span key={ligne.id} className="flex justify-between gap-3 text-corps text-encre">
          <span>
            {ligne.quantite}× {ligne.nomProduit}
          </span>
          <span className="chiffres">
            {formaterMontant({ unitesMineures: ligne.montant, devise }, { forme: 'nombre' })}
          </span>
        </span>
      ))}
      {note.remiseNote !== undefined && (
        <span className="flex justify-between gap-3 text-corps font-semibold text-info">
          <span>{t('caisse.note.actions.remise')}</span>
          <span className="chiffres">−{courte(note.remiseNote.montant)}</span>
        </span>
      )}
      {note.taxes.map((taxe) => (
        <span key={taxe.nom} className="flex justify-between gap-3 text-libelle text-attenue">
          <span>
            {t('caisse.note.dont', { taxe: `${taxe.nom} ${formaterTaux(taxe.tauxPointsDeBase)}` })}
          </span>
          <span className="chiffres">{courte(taxe.montant)}</span>
        </span>
      ))}
      <span className="mt-1 flex items-baseline justify-between border-t border-encre pt-2">
        <span className="text-corps-fort text-encre">{t('encaissement.total')}</span>
        <span className="chiffres text-montant-total text-encre">
          {formaterMontant({ unitesMineures: etat.total, devise })}
        </span>
      </span>
      {etat.paiements.length > 0 && (
        <ul
          aria-label={t('encaissement.paiements')}
          className="m-0 mt-3 flex list-none flex-col p-0"
        >
          {etat.paiements.map((paiement) => (
            <li
              key={paiement.id}
              className="flex items-center gap-2.5 border-b border-trait py-2 last:border-b-0"
            >
              <BadgeStatut ton="succes">{t('encaissement.paye')}</BadgeStatut>
              <span className="flex flex-1 flex-col">
                <span className="text-libelle font-bold text-encre">
                  {libellePaiement(
                    paiement.mode,
                    paiement.operateur,
                    paiement.reference,
                    operateurs,
                    t,
                  )}
                </span>
                <span className="text-legende text-attenue">
                  {formaterHeure(paiement.encaisseLe, fuseauHoraire)}, {paiement.encaissePar}
                </span>
              </span>
              <span className="chiffres text-montant-ligne text-encre">
                {formaterMontant({ unitesMineures: paiement.montant, devise }, { forme: 'nombre' })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <span className="mt-auto flex items-baseline justify-between pt-3">
        <span className="text-corps-fort text-encre">{t('encaissement.reste')}</span>
        <span className="chiffres text-montant-total text-encre">{courte(etat.reste)}</span>
      </span>
    </section>
  )
}

function libellePaiement(
  mode: ModePaiement,
  operateur: string | undefined,
  reference: string | undefined,
  operateurs: OperateurMobileMoney[],
  t: TFunction,
): string {
  const nom =
    mode === 'MOBILE_MONEY'
      ? (operateurs.find((candidat) => candidat.code === operateur)?.libelle ?? operateur ?? '')
      : t(`encaissement.modes.${mode}`)
  return reference === undefined
    ? nom
    : t('encaissement.paiementDe', {
        mode: nom,
        detail: t('encaissement.referenceCourte', { reference }),
      })
}

/** Montants rapides en espèces : l'exact, puis les billets supérieurs courants. */
function montantsRapides(du: number): number[] {
  const suivants = new Set<number>()
  for (const palier of PALIERS) {
    const arrondi = Math.ceil(du / palier) * palier
    if (arrondi > du) suivants.add(arrondi)
  }
  return [...suivants].sort((a, b) => a - b).slice(0, 3)
}

function Paiement({
  etat,
  operateurs,
  devise,
  surPaye,
  surCaisseFermee,
}: Readonly<{
  etat: EtatEncaissement
  operateurs: OperateurMobileMoney[]
  devise: Devise
  surPaye: (etat: EtatEncaissement) => void
  surCaisseFermee: () => void
}>) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<ModePaiement>('ESPECES')
  const [montant, setMontant] = useState(String(etat.reste))
  const [recu, setRecu] = useState(String(etat.reste))
  const [actif, setActif] = useState<'montant' | 'recu'>('recu')
  // Un seul opérateur proposé (pays sans opérateur configuré) : il est choisi d'office.
  const [operateur, setOperateur] = useState<string | null>(
    operateurs.length === 1 ? (operateurs[0]?.code ?? null) : null,
  )
  const [reference, setReference] = useState('')
  // Tiré une fois par paiement : un nouvel essai après une coupure réseau garde le même.
  const [id] = useState(() => globalThis.crypto.randomUUID())
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })

  const montantLu = lireMontant(montant, devise)
  const recuLu = lireMontant(recu, devise)
  const montantValide = montantLu !== null && montantLu > 0 && montantLu <= etat.reste
  const manque =
    mode === 'ESPECES' && montantLu !== null && (recuLu ?? 0) < montantLu
      ? montantLu - (recuLu ?? 0)
      : 0
  const aCompleter =
    mode === 'MOBILE_MONEY'
      ? [
          ...(operateur === null ? [t('encaissement.manques.operateur')] : []),
          ...(reference.trim() === '' ? [t('encaissement.manques.reference')] : []),
        ]
      : []
  const valide = montantValide && manque === 0 && aCompleter.length === 0

  function toucher(touche: string) {
    const modifier = actif === 'montant' ? setMontant : setRecu
    modifier((valeur) => (touche === 'effacer' ? valeur.slice(0, -1) : `${valeur}${touche}`))
  }

  async function valider() {
    if (!valide) return
    setEnCours(true)
    setErreur(null)
    const demande: DemandePaiement = {
      id,
      mode,
      montant: montantLu,
      ...(mode === 'ESPECES' ? { montantRecu: recuLu ?? montantLu } : {}),
      ...(mode === 'MOBILE_MONEY' && operateur !== null ? { operateur } : {}),
      ...(mode !== 'ESPECES' && reference.trim() !== '' ? { reference: reference.trim() } : {}),
    }
    try {
      surPaye(
        await appelerCaisse<EtatEncaissement>(`/caisse/commandes/${etat.commandeId}/paiements`, {
          methode: 'POST',
          corps: demande,
        }),
      )
    } catch (echec) {
      setErreur(echec)
      if (echec instanceof ErreurApi && echec.code === 'CAISSE_FERMEE') {
        surCaisseFermee()
      }
    } finally {
      setEnCours(false)
    }
  }

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-moyen border border-trait bg-surface p-4">
        {erreur !== null && <AlerteErreur erreur={erreur} />}
        <div
          role="radiogroup"
          aria-label={t('encaissement.modes.titre')}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {[...MODES, 'ARDOISE' as const].map((candidat) => (
            <button
              key={candidat}
              type="button"
              role="radio"
              aria-checked={mode === candidat}
              disabled={candidat === 'ARDOISE'}
              onClick={() => {
                if (candidat !== 'ARDOISE') {
                  setMode(candidat)
                  setActif(candidat === 'ESPECES' ? 'recu' : 'montant')
                }
              }}
              className={clsx(
                'flex min-h-18 flex-col items-start justify-center gap-0.5 rounded-moyen px-3 text-left text-encre',
                mode === candidat ? 'border-2 border-accent' : 'border border-trait',
                candidat === 'ARDOISE' ? 'bg-fond opacity-50' : 'bg-surface',
              )}
            >
              <span className="text-corps-fort">{t(`encaissement.modes.${candidat}`)}</span>
              <span className="text-legende text-attenue">
                {t(`encaissement.aides.${candidat}`)}
              </span>
            </button>
          ))}
        </div>
        <ChampSaisie
          libelle={t('encaissement.montant')}
          inputMode="numeric"
          suffixe={symboleDe(devise)}
          value={montant}
          onFocus={() => {
            setActif('montant')
          }}
          onChange={(evenement) => {
            setMontant(evenement.target.value)
          }}
        />
        {mode === 'ESPECES' && (
          <>
            <ChampSaisie
              libelle={t('encaissement.recu')}
              inputMode="numeric"
              suffixe={symboleDe(devise)}
              value={recu}
              onFocus={() => {
                setActif('recu')
              }}
              onChange={(evenement) => {
                setRecu(evenement.target.value)
              }}
            />
            {montantLu !== null && montantLu > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {[montantLu, ...montantsRapides(montantLu)].map((valeur, rang) => (
                  <Bouton
                    key={valeur}
                    aria-label={
                      rang === 0 ? `${t('encaissement.exact')} ${courte(valeur)}` : undefined
                    }
                    className="chiffres min-h-cible-caisse text-corps-fort"
                    onClick={() => {
                      setRecu(String(valeur))
                    }}
                  >
                    {formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })}
                  </Bouton>
                ))}
              </div>
            )}
            {manque > 0 ? (
              <p className="m-0 text-corps text-danger">
                {t('encaissement.manque', { montant: courte(manque) })}
              </p>
            ) : (
              montantLu !== null &&
              recuLu !== null && (
                <div
                  role="status"
                  aria-label={t('encaissement.rendu')}
                  className="flex items-center justify-between rounded-moyen bg-succes-fond px-4 py-3 text-succes"
                >
                  <span className="flex flex-col">
                    <span className="text-corps-fort">{t('encaissement.rendu')}</span>
                    <span className="text-legende">
                      {t('encaissement.renduDetail', {
                        recu: courte(recuLu),
                        du: courte(montantLu),
                      })}
                    </span>
                  </span>
                  <span className="chiffres text-montant-total">{courte(recuLu - montantLu)}</span>
                </div>
              )
            )}
          </>
        )}
        {mode === 'MOBILE_MONEY' && (
          <>
            <div
              role="radiogroup"
              aria-label={t('encaissement.operateur')}
              className="grid grid-cols-2 gap-2"
            >
              {operateurs.map((candidat) => (
                <button
                  key={candidat.code}
                  type="button"
                  role="radio"
                  aria-checked={operateur === candidat.code}
                  onClick={() => {
                    setOperateur(candidat.code)
                  }}
                  className={clsx(
                    'min-h-cible-caisse rounded-normal bg-surface px-3 text-corps text-encre',
                    operateur === candidat.code
                      ? 'border-2 border-accent font-bold'
                      : 'border border-bordure-controle',
                  )}
                >
                  {candidat.libelle}
                </button>
              ))}
            </div>
            <ChampSaisie
              libelle={t('encaissement.reference')}
              obligatoire
              maxLength={60}
              value={reference}
              onChange={(evenement) => {
                setReference(evenement.target.value)
              }}
            />
            <p className="m-0 text-legende text-attenue">{t('encaissement.verifier')}</p>
          </>
        )}
        {mode === 'CARTE' && (
          <ChampSaisie
            libelle={t('encaissement.referenceFacultative')}
            maxLength={60}
            value={reference}
            onChange={(evenement) => {
              setReference(evenement.target.value)
            }}
          />
        )}
        <div className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-2">
          <span className="flex-1 text-legende text-attenue">
            {aCompleter.length > 0
              ? t('encaissement.manques.pourValider', { liste: aCompleter.join(', ') })
              : t('encaissement.aide')}
          </span>
          <Bouton
            variante="principal"
            disabled={!valide}
            enCours={enCours}
            className="min-h-bouton-encaisser px-6 text-titre-carte"
            onClick={() => void valider()}
          >
            {t('encaissement.valider', {
              montant: courte(montantLu ?? 0),
              mode: t(`encaissement.modesEn.${mode}`),
            })}
          </Bouton>
        </div>
      </section>
      <ClavierMontant surToucher={toucher} />
    </>
  )
}

function ClavierMontant({ surToucher }: Readonly<{ surToucher: (touche: string) => void }>) {
  const { t } = useTranslation()
  return (
    <div
      role="group"
      aria-label={t('encaissement.clavier')}
      className="hidden shrink-0 grid-cols-3 content-start gap-2 lg:grid lg:w-rail-largeur"
    >
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'].map((touche) => (
        <button
          key={touche}
          type="button"
          onClick={() => {
            surToucher(touche)
          }}
          className="chiffres min-h-16 rounded-moyen border border-trait bg-surface text-touche text-encre"
        >
          {touche}
        </button>
      ))}
      <button
        type="button"
        aria-label={t('encaissement.effacer')}
        onClick={() => {
          surToucher('effacer')
        }}
        className="flex min-h-16 items-center justify-center rounded-moyen border border-trait bg-fond text-encre"
      >
        <Delete aria-hidden="true" size={22} />
      </button>
    </div>
  )
}

export function OuvertureCaisse({
  devise,
  peutOuvrir,
  dernierFond,
  surOuverte,
}: Readonly<{
  devise: Devise
  peutOuvrir: boolean
  dernierFond?: number
  surOuverte: (etat: EtatCaisse) => void
}>) {
  const { t } = useTranslation()
  const [fond, setFond] = useState(dernierFond === undefined ? '' : String(dernierFond))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const fondLu = lireMontant(fond, devise)
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })

  async function ouvrir() {
    if (fondLu === null) return
    setEnCours(true)
    setErreur(null)
    try {
      surOuverte(
        await appelerCaisse<EtatCaisse>('/caisse/ouverture', {
          methode: 'POST',
          corps: { fond: fondLu },
        }),
      )
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-moyen border border-trait bg-surface p-5">
      <h2 className="m-0 text-titre-section text-encre">{t('encaissement.ouverture.titre')}</h2>
      <p className="m-0 text-corps text-attenue">{t('encaissement.ouverture.phrase')}</p>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      {peutOuvrir ? (
        <>
          <ChampSaisie
            libelle={t('encaissement.ouverture.fond')}
            inputMode="numeric"
            suffixe={symboleDe(devise)}
            value={fond}
            onChange={(evenement) => {
              setFond(evenement.target.value)
            }}
          />
          {dernierFond !== undefined && (
            <p className="m-0 text-legende text-attenue">
              {t('encaissement.ouverture.dernierFond', { montant: courte(dernierFond) })}
            </p>
          )}
          <Bouton
            variante="principal"
            disabled={fondLu === null}
            enCours={enCours}
            className="self-start"
            onClick={() => void ouvrir()}
          >
            {t('encaissement.ouverture.ouvrir', { montant: courte(fondLu ?? 0) })}
          </Bouton>
        </>
      ) : (
        <p className="m-0 text-corps text-encre">{t('encaissement.ouverture.sansDroit')}</p>
      )}
    </section>
  )
}

function FinEncaissement({
  etat,
  note,
  devise,
}: Readonly<{ etat: EtatEncaissement; note: CommandeDetail; devise: Devise }>) {
  const { t } = useTranslation()
  const naviguer = useNavigate()
  const rendu = etat.paiements.reduce((somme, paiement) => somme + paiement.monnaieRendue, 0)
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })
  return (
    <section className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-3.5 rounded-moyen border border-trait bg-surface p-8 text-center">
      <BadgeStatut ton="succes">{t('encaissement.fin.badge')}</BadgeStatut>
      <h1 className="m-0 text-titre-page text-encre">
        {note.table === undefined
          ? t('encaissement.fin.titre', {
              numero: t('caisse.note.numero', { numero: note.numero }),
            })
          : t('encaissement.fin.titreTable', { table: note.table.nom })}
      </h1>
      <span className="chiffres text-corps text-attenue">{courte(etat.total)}</span>
      {rendu > 0 && (
        <div
          role="status"
          aria-label={t('encaissement.rendu')}
          className="flex w-full items-center justify-between rounded-moyen bg-succes-fond px-5 py-4 text-succes"
        >
          <span className="text-corps-fort">{t('encaissement.rendu')}</span>
          <span className="chiffres text-montant-total">{courte(rendu)}</span>
        </div>
      )}
      <p className="m-0 text-legende text-attenue">{t('encaissement.fin.recu')}</p>
      <Bouton
        variante="principal"
        className="w-full min-h-bouton-encaisser text-titre-carte"
        onClick={() => void naviguer({ to: '/caisse' })}
      >
        {t('encaissement.fin.retour')}
      </Bouton>
    </section>
  )
}
