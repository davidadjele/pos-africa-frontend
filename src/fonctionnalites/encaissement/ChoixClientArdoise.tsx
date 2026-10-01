import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type { ClientEnCaisse } from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { DialogueClient } from '../ardoise/DialogueClient'
import { requeteClientsCaisse } from '../ardoise/requetes'

/** De combien la note ferait dépasser le plafond du client ; 0 s'il reste dessous ou n'en a pas. */
export function depassementPlafond(client: ClientEnCaisse, montant: number): number {
  return client.plafond === undefined ? 0 : Math.max(0, client.solde + montant - client.plafond)
}

/**
 * Le client qui paiera plus tard : on le cherche par nom ou téléphone, et l'on voit ce qu'il devra après cette note
 * avant de valider.
 */
export function ChoixClientArdoise({
  client,
  montant,
  devise,
  peutCreer,
  surChoisir,
}: Readonly<{
  client: ClientEnCaisse | null
  montant: number
  devise: Devise
  /** Ouvrir une ardoise demande le droit de vendre à crédit. */
  peutCreer: boolean
  surChoisir: (client: ClientEnCaisse) => void
}>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const clients = useQuery(requeteClientsCaisse)
  const [recherche, setRecherche] = useState('')
  const [creation, setCreation] = useState(false)
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })

  const motif = recherche.trim().toLowerCase()
  const visibles = (clients.data ?? []).filter(
    (candidat) =>
      motif === '' ||
      candidat.nom.toLowerCase().includes(motif) ||
      (candidat.telephone ?? '').includes(motif),
  )
  const apres = client === null ? 0 : client.solde + montant
  const depassement = client === null ? 0 : depassementPlafond(client, montant)

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
      <div className="flex min-w-0 flex-col overflow-hidden rounded-moyen border border-trait">
        <div className="flex flex-wrap gap-2 border-b border-trait p-2">
          <input
            type="search"
            aria-label={t('encaissement.ardoise.chercher')}
            placeholder={t('encaissement.ardoise.chercher')}
            value={recherche}
            onChange={(evenement) => {
              setRecherche(evenement.target.value)
            }}
            className="min-h-cible-min min-w-0 flex-1 rounded-normal border border-bordure-controle bg-surface px-3 text-corps text-encre"
          />
          {peutCreer && (
            <Bouton
              icone={UserPlus}
              onClick={() => {
                setCreation(true)
              }}
            >
              {t('ardoise.client.nouveau')}
            </Bouton>
          )}
        </div>
        {clients.isPending && <Chargement texte={t('encaissement.ardoise.chargement')} />}
        {clients.isError && <AlerteErreur erreur={clients.error} />}
        {clients.data?.length === 0 && (
          <p className="m-0 p-3 text-corps text-attenue">
            {t(peutCreer ? 'encaissement.ardoise.aucunCreer' : 'encaissement.ardoise.aucun')}
          </p>
        )}
        {clients.data !== undefined && clients.data.length > 0 && visibles.length === 0 && (
          <p className="m-0 p-3 text-corps text-attenue">{t('encaissement.ardoise.introuvable')}</p>
        )}
        {clients.data !== undefined && clients.data.length > 0 && (
          <div
            role="radiogroup"
            aria-label={t('encaissement.ardoise.client')}
            className="flex max-h-72 flex-col overflow-y-auto"
          >
            {visibles.map((candidat) => {
              const choisi = client?.id === candidat.id
              return (
                <button
                  key={candidat.id}
                  type="button"
                  role="radio"
                  aria-checked={choisi}
                  onClick={() => {
                    surChoisir(candidat)
                  }}
                  className={clsx(
                    'flex min-h-cible-caisse w-full items-center gap-3 border-b border-trait px-3 py-2 text-left last:border-b-0',
                    choisi ? 'bg-fond shadow-[inset_3px_0_0_var(--accent)]' : 'bg-surface',
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-corps-fort text-encre">{candidat.nom}</span>
                    {candidat.telephone !== undefined && (
                      <span className="text-legende text-attenue">{candidat.telephone}</span>
                    )}
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="chiffres text-montant-ligne text-encre">
                      {nombre(candidat.solde)}
                    </span>
                    <span className="text-legende text-attenue">
                      {candidat.plafond === undefined
                        ? t('ardoise.sansPlafond')
                        : t('encaissement.ardoise.plafond', {
                            plafond: nombre(candidat.plafond),
                          })}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {client === null ? (
        <p className="m-0 rounded-moyen border border-trait p-3 text-corps text-attenue">
          {t('encaissement.ardoise.choisir')}
        </p>
      ) : (
        <section
          aria-label={t('encaissement.ardoise.resume', { nom: client.nom })}
          className="flex flex-col gap-1 rounded-moyen border border-trait p-3"
        >
          <span className="text-corps-fort text-encre">{client.nom}</span>
          <span className="flex justify-between gap-3 text-corps text-encre">
            <span>{t('encaissement.ardoise.dejaDu')}</span>
            <span className="chiffres">{nombre(client.solde)}</span>
          </span>
          <span className="flex justify-between gap-3 text-corps text-encre">
            <span>{t('encaissement.ardoise.cetteNote')}</span>
            <span className="chiffres">+{nombre(montant)}</span>
          </span>
          <span className="mt-1 flex items-baseline justify-between gap-3 border-t border-encre pt-2">
            <span className="text-corps-fort text-encre">{t('encaissement.ardoise.apres')}</span>
            <span className="chiffres text-montant-total text-encre">{courte(apres)}</span>
          </span>
          {client.plafond !== undefined && (
            <span className="mt-1 flex flex-col gap-1">
              <span
                aria-hidden="true"
                className="h-1.5 w-full overflow-hidden rounded-petit bg-trait"
              >
                <span
                  className={clsx('block h-full', depassement > 0 ? 'bg-alerte' : 'bg-accent')}
                  style={{
                    width: `${String(Math.min(100, (apres / Math.max(1, client.plafond)) * 100))}%`,
                  }}
                />
              </span>
              <span className="text-legende text-attenue">
                {t('encaissement.ardoise.surPlafond', {
                  apres: nombre(apres),
                  plafond: courte(client.plafond),
                })}
              </span>
            </span>
          )}
          {depassement > 0 && (
            <div
              role="alert"
              className="mt-2 flex flex-col gap-0.5 rounded-normal border border-alerte-bord bg-alerte-fond px-3 py-2"
            >
              <span className="text-corps-fort text-alerte-texte">
                {t('encaissement.ardoise.depasse', { montant: courte(depassement) })}
              </span>
              <span className="text-legende text-alerte-texte">
                {t('encaissement.ardoise.depassePhrase')}
              </span>
            </div>
          )}
        </section>
      )}

      {creation && (
        <DialogueClient
          devise={devise}
          avecNote={false}
          surFermer={() => {
            setCreation(false)
          }}
          surEnregistrer={async (demande) => {
            const cree = await appelerCaisse<ClientEnCaisse>('/caisse/clients', {
              methode: 'POST',
              corps: demande,
            })
            await clientRequetes.invalidateQueries({ queryKey: requeteClientsCaisse.queryKey })
            setCreation(false)
            surChoisir(cree)
          }}
        />
      )}
    </div>
  )
}
