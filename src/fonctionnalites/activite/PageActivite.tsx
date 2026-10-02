import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { RotateCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DomaineActivite,
  EvenementActivite,
  PageActivite as Page,
} from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import {
  debutDuJour,
  formaterDate,
  formaterHeure,
  formaterJour,
} from '../../partage/dates/formaterDate'
import type { Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { Pagination } from '../../partage/ui/Tableau'
import { requeteEtablissements } from '../etablissements/requetes'
import { auteurDe, detailActivite, PhraseActivite, type ContexteActivite } from './description'

const TAILLE_PAGE = 50
const JOUR = 24 * 60 * 60 * 1000
type Periode = 'jour' | 'semaine' | 'mois'
const DOMAINES: DomaineActivite[] = [
  'CARTE',
  'PERSONNEL',
  'TABLETTES',
  'CAISSE',
  'STOCK',
  'ARDOISE',
]

interface Filtres {
  periode: Periode
  etablissementId: string
  domaine: DomaineActivite | ''
  critiques: boolean
  page: number
}

function depuis(periode: Periode, fuseauHoraire: string): string {
  if (periode === 'jour') return debutDuJour(fuseauHoraire).toISOString()
  return new Date(Date.now() - (periode === 'semaine' ? 7 : 30) * JOUR).toISOString()
}

/** Les actions critiques de l'entreprise, ou du périmètre d'un gérant : qui, quand, ce qui a changé. */
export function PageActivite() {
  const { t } = useTranslation()
  const { moi } = useSession()
  const fuseauHoraire = moi?.entrepriseCourante?.fuseauHoraire ?? 'Africa/Lome'
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const [filtres, setFiltres] = useState<Filtres>({
    periode: 'semaine',
    etablissementId: '',
    domaine: '',
    critiques: true,
    page: 0,
  })
  // Figé à chaque changement de période : la clé de requête ne bouge pas à chaque rendu.
  const debut = useMemo(
    () => depuis(filtres.periode, fuseauHoraire),
    [filtres.periode, fuseauHoraire],
  )
  const etablissements = useQuery(requeteEtablissements(0))
  const parametres = new URLSearchParams({
    depuis: debut,
    critiques: String(filtres.critiques),
    page: String(filtres.page),
    taille: String(TAILLE_PAGE),
  })
  if (filtres.etablissementId !== '') parametres.set('etablissementId', filtres.etablissementId)
  if (filtres.domaine !== '') parametres.set('domaine', filtres.domaine)
  const activite = useQuery({
    queryKey: ['activite', parametres.toString()],
    queryFn: ({ signal }) => appelerApi<Page>(`/activite?${parametres.toString()}`, { signal }),
    placeholderData: keepPreviousData,
  })

  function filtrer(changement: Partial<Filtres>) {
    setFiltres((actuels) => ({ ...actuels, page: 0, ...changement }))
  }

  const contexte: ContexteActivite = {
    devise,
    fuseauHoraire,
    etablissements: new Map(
      (etablissements.data?.elements ?? []).map((etablissement) => [
        etablissement.id,
        etablissement.nom,
      ]),
    ),
  }
  const aujourdhui = formaterDate(new Date().toISOString(), fuseauHoraire)
  const groupes: { jour: string; evenements: EvenementActivite[] }[] = []
  for (const evenement of activite.data?.elements ?? []) {
    const date = formaterDate(evenement.survenuLe, fuseauHoraire)
    const libelle =
      date === aujourdhui
        ? `${t('activite.periodes.jour')}, ${formaterJour(evenement.survenuLe, fuseauHoraire)}`
        : formaterJour(evenement.survenuLe, fuseauHoraire)
    const dernier = groupes.at(-1)
    if (dernier?.jour === libelle) dernier.evenements.push(evenement)
    else groupes.push({ jour: libelle, evenements: [evenement] })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-3xl">
        <h1 className="m-0 text-titre-page text-encre">{t('activite.titre')}</h1>
        <p className="m-0 mt-1 text-corps text-attenue">{t('activite.phrase')}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <ChampSelection
            libelle={t('activite.periode')}
            options={(['jour', 'semaine', 'mois'] as const).map((periode) => ({
              valeur: periode,
              libelle: t(`activite.periodes.${periode}`),
            }))}
            value={filtres.periode}
            onChange={(evenement) => {
              filtrer({ periode: evenement.target.value as Periode })
            }}
          />
        </div>
        {(etablissements.data?.elements.length ?? 0) > 1 && (
          <div className="w-48">
            <ChampSelection
              libelle={t('activite.etablissement')}
              options={[
                { valeur: '', libelle: t('activite.tous') },
                ...(etablissements.data?.elements ?? []).map((etablissement) => ({
                  valeur: etablissement.id,
                  libelle: etablissement.nom,
                })),
              ]}
              value={filtres.etablissementId}
              onChange={(evenement) => {
                filtrer({ etablissementId: evenement.target.value })
              }}
            />
          </div>
        )}
        <div className="w-48">
          <ChampSelection
            libelle={t('activite.domaine')}
            options={[
              { valeur: '', libelle: t('activite.tous') },
              ...DOMAINES.map((domaine) => ({
                valeur: domaine,
                libelle: t(`activite.domaines.${domaine}`),
              })),
            ]}
            value={filtres.domaine}
            onChange={(evenement) => {
              filtrer({ domaine: evenement.target.value as DomaineActivite | '' })
            }}
          />
        </div>
        <span className="flex-1" />
        {[true, false].map((critiques) => (
          <button
            key={String(critiques)}
            type="button"
            aria-pressed={filtres.critiques === critiques}
            onClick={() => {
              filtrer({ critiques })
            }}
            className={clsx(
              'min-h-cible-min rounded-normal border px-3 text-libelle font-semibold',
              filtres.critiques === critiques
                ? 'border-accent bg-accent text-accent-texte'
                : 'border-trait bg-surface text-encre',
            )}
          >
            {critiques ? t('activite.critiquesSeulement') : t('activite.tout')}
          </button>
        ))}
      </div>

      {activite.isPending && <Chargement texte={t('activite.chargement')} />}
      {activite.isError && (
        <AlerteErreur
          erreur={activite.error}
          action={
            <Bouton icone={RotateCw} onClick={() => void activite.refetch()}>
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {activite.data?.total === 0 && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide titre={t('activite.vide.titre')} phrase={t('activite.vide.phrase')} />
        </section>
      )}
      {groupes.length > 0 && (
        <section
          aria-label={t('activite.liste')}
          className="overflow-hidden rounded-moyen border border-trait bg-surface"
        >
          {groupes.map((groupe) => (
            <div key={groupe.jour}>
              <h2 className="m-0 border-b border-trait bg-fond px-4 py-2.5 text-legende font-semibold text-attenue first-letter:uppercase">
                {groupe.jour}
              </h2>
              <ul className="m-0 list-none p-0">
                {groupe.evenements.map((evenement) => (
                  <LigneActivite
                    key={evenement.id}
                    evenement={auteurDe(evenement, t)}
                    contexte={contexte}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      {activite.data !== undefined && activite.data.total > TAILLE_PAGE && (
        <Pagination
          page={filtres.page}
          taille={TAILLE_PAGE}
          total={activite.data.total}
          surChangerPage={(page) => {
            setFiltres((actuels) => ({ ...actuels, page }))
          }}
        />
      )}
    </div>
  )
}

function LigneActivite({
  evenement,
  contexte,
}: Readonly<{ evenement: EvenementActivite; contexte: ContexteActivite }>) {
  const { t } = useTranslation()
  const detail = detailActivite(evenement, t, contexte)
  // Un employé de plusieurs établissements : l'action n'a pas d'établissement unique, on les cite tous.
  const siens = Array.isArray(evenement.details.etablissements)
    ? evenement.details.etablissements
        .map((id) => (typeof id === 'string' ? contexte.etablissements.get(id) : undefined))
        .filter((nom): nom is string => nom !== undefined)
    : []
  // Sans établissement : ceux des rôles cités, sinon toute la carte ou toute l'entreprise.
  const portee =
    evenement.domaine === 'CARTE' ? t('activite.touteLaCarte') : t('activite.touteLEntreprise')
  const ou = evenement.etablissementNom ?? (siens.length > 0 ? siens.join(', ') : portee)
  return (
    <li className="grid grid-cols-[56px_1fr] items-start gap-x-4 gap-y-1 border-b border-trait px-4 py-3 last:border-b-0 md:grid-cols-[64px_1fr_170px_110px] md:items-center">
      <span className="chiffres text-montant-ligne text-encre">
        {formaterHeure(evenement.survenuLe, contexte.fuseauHoraire)}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-corps text-encre">
          <PhraseActivite evenement={evenement} />
        </span>
        {detail !== null && <span className="chiffres text-legende text-attenue">{detail}</span>}
      </span>
      <span className="col-start-2 text-legende text-attenue md:col-start-auto">{ou}</span>
      <span className="col-start-2 md:col-start-auto">
        <BadgeStatut ton={evenement.critique ? 'alerte' : 'neutre'}>
          {evenement.critique ? t('activite.critique') : t('activite.information')}
        </BadgeStatut>
      </span>
    </li>
  )
}
