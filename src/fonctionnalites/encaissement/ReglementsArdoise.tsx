import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type {
  ClientEnCaisse,
  DemandeReglement,
  OperateurMobileMoney,
} from '../../partage/api/contrat'
import { formaterMontant, symboleDe, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { EtatsListe } from '../../partage/ui/EtatsListe'
import { JOURS_RELANCE, joursDepuis } from '../ardoise/presentation'
import { requeteClientsCaisse } from '../ardoise/requetes'
import { ChoixOperateur } from './ChoixArticles'
import { requeteOuvertureCaisse, requeteSituation } from './requetes'

type ModeReglement = DemandeReglement['mode']
const MODES: ModeReglement[] = ['ESPECES', 'MOBILE_MONEY', 'CARTE']

/** L'onglet « Ardoises » de la caisse : les clients qui doivent, et l'encaissement de leur règlement. */
export function ReglementsArdoise({ devise }: Readonly<{ devise: Devise }>) {
  const { t } = useTranslation()
  const clients = useQuery(requeteClientsCaisse)
  const caisse = useQuery(requeteOuvertureCaisse)
  const [recherche, setRecherche] = useState('')
  const [choisi, setChoisi] = useState<ClientEnCaisse | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  // Chaque règlement encaissé repart d'un formulaire neuf, avec un nouvel identifiant.
  const [encaisses, setEncaisses] = useState(0)
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })

  const debiteurs = (clients.data ?? [])
    .filter((client) => client.solde > 0)
    .sort((a, b) => (a.detteDepuis ?? '￿').localeCompare(b.detteDepuis ?? '￿'))
  const motif = recherche.trim().toLowerCase()
  const visibles = debiteurs.filter(
    (client) =>
      motif === '' ||
      client.nom.toLowerCase().includes(motif) ||
      (client.telephone ?? '').includes(motif),
  )
  const totalDu = debiteurs.reduce((somme, client) => somme + client.solde, 0)

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-moyen border border-trait bg-surface lg:min-h-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-trait p-3">
          <input
            type="search"
            aria-label={t('ardoise.rechercher')}
            placeholder={t('ardoise.rechercher')}
            value={recherche}
            onChange={(evenement) => {
              setRecherche(evenement.target.value)
            }}
            className="min-h-cible-min min-w-0 flex-1 rounded-normal border border-bordure-controle bg-surface px-3 text-corps text-encre"
          />
          {debiteurs.length > 0 && (
            <span className="text-legende text-attenue">
              {t('ardoise.caisse.doivent', { count: debiteurs.length, montant: courte(totalDu) })}
            </span>
          )}
        </div>
        {(clients.isPending || clients.isError || debiteurs.length === 0) && (
          <div className="p-3">
            <EtatsListe
              requete={clients}
              chargement={t('encaissement.ardoise.chargement')}
              vide={t('ardoise.caisse.aucun')}
            />
            {clients.data !== undefined && clients.data.length > 0 && debiteurs.length === 0 && (
              <p className="m-0 text-corps text-attenue">{t('ardoise.caisse.aucun')}</p>
            )}
          </div>
        )}
        {visibles.length > 0 && (
          <ul
            aria-label={t('ardoise.caisse.liste')}
            className="m-0 flex list-none flex-col overflow-y-auto p-0"
          >
            {visibles.map((client) => (
              <li key={client.id} className="border-t border-trait">
                <button
                  type="button"
                  aria-pressed={choisi?.id === client.id}
                  onClick={() => {
                    setChoisi(client)
                    setConfirmation(null)
                  }}
                  className={clsx(
                    'flex min-h-cible-caisse w-full items-center gap-3 px-4 py-2 text-left',
                    choisi?.id === client.id
                      ? 'bg-fond shadow-[inset_3px_0_0_var(--accent)]'
                      : 'bg-surface',
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-corps-fort text-encre">{client.nom}</span>
                    {client.telephone !== undefined && (
                      <span className="text-legende text-attenue">{client.telephone}</span>
                    )}
                  </span>
                  {client.detteDepuis !== undefined && (
                    <BadgeStatut
                      ton={joursDepuis(client.detteDepuis) > JOURS_RELANCE ? 'alerte' : 'neutre'}
                    >
                      {t('ardoise.depuis', { count: joursDepuis(client.detteDepuis) })}
                    </BadgeStatut>
                  )}
                  <span className="chiffres w-24 text-right text-montant-ligne text-encre">
                    {formaterMontant({ unitesMineures: client.solde, devise }, { forme: 'nombre' })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="flex shrink-0 flex-col gap-3 lg:w-[440px]">
        {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
        {choisi === null ? (
          <p className="m-0 rounded-moyen border border-trait bg-surface p-5 text-corps text-attenue">
            {t('ardoise.caisse.choisir')}
          </p>
        ) : (
          <FormulaireReglement
            key={`${choisi.id}-${String(encaisses)}`}
            client={choisi}
            devise={devise}
            operateurs={caisse.data?.operateurs ?? []}
            surRegle={(apres, montant) => {
              setEncaisses((nombre) => nombre + 1)
              setChoisi(apres.solde > 0 ? apres : null)
              setConfirmation(
                apres.solde > 0
                  ? t('ardoise.caisse.regle', {
                      montant: courte(montant),
                      nom: apres.nom,
                      reste: courte(apres.solde),
                    })
                  : t('ardoise.caisse.solde', { montant: courte(montant), nom: apres.nom }),
              )
            }}
          />
        )}
      </aside>
    </div>
  )
}

function FormulaireReglement({
  client,
  devise,
  operateurs,
  surRegle,
}: Readonly<{
  client: ClientEnCaisse
  devise: Devise
  operateurs: OperateurMobileMoney[]
  surRegle: (apres: ClientEnCaisse, montant: number) => void
}>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const [mode, setMode] = useState<ModeReglement>('ESPECES')
  const [montant, setMontant] = useState('')
  const [recu, setRecu] = useState('')
  const [operateur, setOperateur] = useState<string | null>(
    operateurs.length === 1 ? (operateurs[0]?.code ?? null) : null,
  )
  const [reference, setReference] = useState('')
  // Tiré une fois : renvoyé après une coupure réseau, le règlement n'est pas compté deux fois.
  const [id] = useState(() => globalThis.crypto.randomUUID())
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })

  const montantLu = lireMontant(montant, devise) ?? 0
  const recuLu = recu.trim() === '' ? montantLu : (lireMontant(recu, devise) ?? 0)
  const tropGrand = montantLu > client.solde
  const manques = [
    ...(mode === 'ESPECES' && recuLu < montantLu ? [t('ardoise.caisse.manques.recu')] : []),
    ...(mode === 'MOBILE_MONEY' && operateur === null ? [t('encaissement.manques.operateur')] : []),
    ...(mode === 'MOBILE_MONEY' && reference.trim() === ''
      ? [t('encaissement.manques.reference')]
      : []),
  ]
  const valide = montantLu > 0 && !tropGrand && manques.length === 0

  async function encaisser() {
    if (!valide) return
    setEnCours(true)
    setErreur(null)
    const demande: DemandeReglement = {
      id,
      mode,
      montant: montantLu,
      ...(mode === 'ESPECES' ? { montantRecu: recuLu } : {}),
      ...(mode === 'MOBILE_MONEY' && operateur !== null ? { operateur } : {}),
      ...(mode !== 'ESPECES' && reference.trim() !== '' ? { reference: reference.trim() } : {}),
    }
    try {
      const apres = await appelerCaisse<ClientEnCaisse>(`/caisse/clients/${client.id}/reglements`, {
        methode: 'POST',
        corps: demande,
      })
      void clientRequetes.invalidateQueries({ queryKey: requeteClientsCaisse.queryKey })
      void clientRequetes.invalidateQueries({ queryKey: requeteSituation.queryKey })
      surRegle(apres, montantLu)
    } catch (echec) {
      setErreur(echec)
      if (echec instanceof ErreurApi && echec.code === 'CAISSE_FERMEE') {
        void clientRequetes.invalidateQueries({ queryKey: requeteOuvertureCaisse.queryKey })
      }
    } finally {
      setEnCours(false)
    }
  }

  return (
    <section
      aria-label={t('ardoise.caisse.reglementDe', { nom: client.nom })}
      className="flex flex-col gap-3 rounded-moyen border border-trait bg-surface p-5"
    >
      <div className="flex flex-col">
        <h2 className="m-0 text-titre-section text-encre">
          {t('ardoise.caisse.reglementDe', { nom: client.nom })}
        </h2>
        <span className="text-corps text-attenue">
          {t('ardoise.caisse.doit', { montant: courte(client.solde) })}
        </span>
      </div>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <div
        role="radiogroup"
        aria-label={t('ardoise.caisse.mode')}
        className="grid grid-cols-3 gap-2"
      >
        {MODES.map((candidat) => (
          <button
            key={candidat}
            type="button"
            role="radio"
            aria-checked={mode === candidat}
            onClick={() => {
              setMode(candidat)
            }}
            className={clsx(
              'min-h-cible-caisse rounded-normal bg-surface px-2 text-corps text-encre',
              mode === candidat ? 'border-2 border-accent font-bold' : 'border border-trait',
            )}
          >
            {t(`encaissement.modes.${candidat}`)}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <ChampSaisie
            libelle={t('ardoise.caisse.montant')}
            inputMode="numeric"
            suffixe={symboleDe(devise)}
            value={montant}
            erreur={
              tropGrand ? t('ardoise.caisse.auPlus', { montant: courte(client.solde) }) : undefined
            }
            onChange={(evenement) => {
              setMontant(evenement.target.value)
            }}
          />
        </div>
        <Bouton
          className="min-h-cible-min"
          onClick={() => {
            setMontant(String(client.solde))
          }}
        >
          {t('ardoise.caisse.tout', {
            montant: formaterMontant({ unitesMineures: client.solde, devise }, { forme: 'nombre' }),
          })}
        </Bouton>
      </div>
      {mode === 'ESPECES' && (
        <>
          <ChampSaisie
            libelle={t('encaissement.recu')}
            inputMode="numeric"
            suffixe={symboleDe(devise)}
            placeholder={montant}
            value={recu}
            onChange={(evenement) => {
              setRecu(evenement.target.value)
            }}
          />
          {recuLu > montantLu && (
            <p className="m-0 text-corps-fort text-succes">
              {t('ardoise.caisse.rendu', { montant: courte(recuLu - montantLu) })}
            </p>
          )}
        </>
      )}
      {mode === 'MOBILE_MONEY' && (
        <ChoixOperateur operateurs={operateurs} valeur={operateur} surChoisir={setOperateur} />
      )}
      {mode !== 'ESPECES' && (
        <ChampSaisie
          libelle={
            mode === 'MOBILE_MONEY'
              ? t('encaissement.reference')
              : t('encaissement.referenceFacultative')
          }
          obligatoire={mode === 'MOBILE_MONEY'}
          maxLength={60}
          value={reference}
          onChange={(evenement) => {
            setReference(evenement.target.value)
          }}
        />
      )}
      <span className="flex items-baseline justify-between border-t border-encre pt-2">
        <span className="text-corps-fort text-encre">{t('encaissement.ardoise.apres')}</span>
        <span className="chiffres text-montant-total text-encre">
          {courte(Math.max(0, client.solde - montantLu))}
        </span>
      </span>
      {manques.length > 0 && montantLu > 0 && (
        <p className="m-0 text-legende text-attenue">
          {t('encaissement.manques.pourValider', { liste: manques.join(', ') })}
        </p>
      )}
      <Bouton
        variante="principal"
        disabled={!valide}
        enCours={enCours}
        className="min-h-bouton-encaisser text-titre-carte"
        onClick={() => void encaisser()}
      >
        {t('ardoise.caisse.encaisser', {
          montant: courte(montantLu),
          mode: t(`encaissement.modesEn.${mode}`),
        })}
      </Bouton>
    </section>
  )
}
