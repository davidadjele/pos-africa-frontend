import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RotateCw, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type { ErreurPlateforme } from '../../partage/api/contrat'
import { formaterDateHeure, formaterHeure } from '../../partage/dates/formaterDate'
import { messageErreur } from '../../partage/i18n/messageErreur'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut, type TonStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { FUSEAU_APPAREIL, requeteErreurs } from './requetes'

/** Le serveur refuse aussi moins : le début du code doit désigner une erreur, pas des centaines. */
const LONGUEUR_MIN_CODE = 8

function tonDuStatut(statut: number): TonStatut {
  if (statut >= 500) return 'danger'
  return statut === 423 || statut === 429 ? 'alerte' : 'neutre'
}

/**
 * Le support de la plateforme : retrouver l'erreur qu'un client a vue à partir du code affiché sous le
 * message, ou parcourir les erreurs des dernières 24 heures.
 */
export function PageSupport() {
  const { t } = useTranslation()
  const [saisie, setSaisie] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [tropCourt, setTropCourt] = useState(false)
  const recentes = useQuery(requeteErreurs(null))
  const recherche = useQuery({ ...requeteErreurs(code), enabled: code !== null })

  function chercher() {
    const lu = saisie.trim().toLowerCase()
    setTropCourt(lu.length < LONGUEUR_MIN_CODE)
    if (lu.length >= LONGUEUR_MIN_CODE) setCode(lu)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-titre-page text-encre">{t('plateforme.support.titre')}</h1>
        <p className="m-0 mt-1 text-legende text-attenue">{t('plateforme.support.phrase')}</p>
      </div>

      <form
        role="search"
        className="flex max-w-xl flex-wrap items-end gap-2"
        onSubmit={(evenement) => {
          evenement.preventDefault()
          chercher()
        }}
      >
        <div className="min-w-0 grow">
          <ChampSaisie
            libelle={t('plateforme.support.code')}
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            className="chiffres"
            value={saisie}
            erreur={tropCourt ? t('plateforme.support.codeTropCourt') : undefined}
            onChange={(evenement) => {
              setSaisie(evenement.target.value)
            }}
          />
        </div>
        <Bouton type="submit" variante="principal" icone={Search}>
          {t('plateforme.support.rechercher')}
        </Bouton>
      </form>

      {code !== null && (
        <Recherche
          requete={recherche}
          surReessayer={() => {
            void recherche.refetch()
          }}
        />
      )}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-titre-section text-encre">{t('plateforme.support.recentes')}</h2>
          <span className="text-legende text-attenue">
            {t('plateforme.support.recentesPhrase')}
          </span>
        </div>
        {recentes.isPending && <Chargement texte={t('plateforme.support.chargement')} />}
        {recentes.isError && <AlerteErreur erreur={recentes.error} />}
        {recentes.data?.length === 0 && (
          <section className="rounded-moyen border border-trait bg-surface p-6">
            <EtatVide
              titre={t('plateforme.support.aucuneRecente.titre')}
              phrase={t('plateforme.support.aucuneRecente.phrase')}
            />
          </section>
        )}
        {recentes.data !== undefined && recentes.data.length > 0 && (
          <TableauErreurs erreurs={recentes.data} />
        )}
      </section>
    </div>
  )
}

function Recherche({
  requete,
  surReessayer,
}: Readonly<{
  requete: UseQueryResult<ErreurPlateforme[]>
  surReessayer: () => void
}>) {
  const { t } = useTranslation()
  if (requete.isPending) return <Chargement texte={t('plateforme.support.recherche')} />
  if (requete.isError)
    return (
      <AlerteErreur
        erreur={requete.error}
        action={
          <Bouton icone={RotateCw} onClick={surReessayer}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  const trouvees = requete.data
  if (trouvees.length === 0)
    return (
      <section className="rounded-moyen border border-trait bg-surface p-6">
        <EtatVide
          titre={t('plateforme.support.introuvable.titre')}
          phrase={t('plateforme.support.introuvable.phrase')}
        />
      </section>
    )
  return (
    <div className="flex flex-col gap-3">
      {trouvees.map((erreur) => (
        <FicheErreur key={`${erreur.traceId}-${erreur.le}`} erreur={erreur} />
      ))}
    </div>
  )
}

function quiADeclenche(erreur: ErreurPlateforme, t: TFunction): string {
  if (erreur.personne === undefined) return t('plateforme.support.inconnu')
  if (erreur.appareilNom === undefined) return erreur.personne
  return t('plateforme.support.surTablette', {
    personne: erreur.personne,
    tablette: erreur.appareilNom,
  })
}

function FicheErreur({ erreur }: Readonly<{ erreur: ErreurPlateforme }>) {
  const { t } = useTranslation()
  // Ce que le client a lu : la même traduction que dans son interface.
  const vu = messageErreur(new ErreurApi({ statut: erreur.statut, code: erreur.code, message: '' }))
  const titre = t(`plateforme.support.libelles.${erreur.statut >= 500 ? 'interne' : 'client'}`)
  const qui = quiADeclenche(erreur, t)
  return (
    <section
      aria-labelledby={`erreur-${erreur.traceId}`}
      className="flex flex-col gap-3 rounded-moyen border border-trait bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <BadgeStatut ton={tonDuStatut(erreur.statut)}>{erreur.statut}</BadgeStatut>
        <h2 id={`erreur-${erreur.traceId}`} className="m-0 text-titre-carte text-encre">
          {titre}
        </h2>
        <span className="text-legende text-attenue">{erreur.code}</span>
      </div>
      <dl className="m-0 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-corps">
        <dt className="text-attenue">{t('plateforme.support.quand')}</dt>
        <dd className="m-0 font-semibold">{formaterDateHeure(erreur.le, FUSEAU_APPAREIL)}</dd>
        <dt className="text-attenue">{t('plateforme.support.entreprise')}</dt>
        <dd className="m-0 font-semibold">
          {erreur.entrepriseId === undefined || erreur.entrepriseNom === undefined ? (
            <span className="font-normal text-attenue">
              {t('plateforme.support.horsEntreprise')}
            </span>
          ) : (
            <>
              <Link
                to="/plateforme/entreprises/$entrepriseId"
                params={{ entrepriseId: erreur.entrepriseId }}
                className="text-encre underline"
              >
                {erreur.entrepriseNom}
              </Link>
              {erreur.etablissementNom !== undefined && `, ${erreur.etablissementNom}`}
            </>
          )}
        </dd>
        <dt className="text-attenue">{t('plateforme.support.qui')}</dt>
        <dd className="m-0 font-semibold">{qui}</dd>
        <dt className="text-attenue">{t('plateforme.support.action')}</dt>
        <dd className="chiffres m-0 font-semibold break-all">
          {erreur.methode} {erreur.chemin}
        </dd>
        <dt className="text-attenue">{t('plateforme.support.messageVu')}</dt>
        <dd className="m-0">{vu}</dd>
        <dt className="text-attenue">{t('plateforme.support.codeComplet')}</dt>
        <dd className="chiffres m-0 break-all">{erreur.traceId}</dd>
      </dl>
      <p className="m-0 border-t border-trait pt-3 text-legende text-attenue">
        {t('plateforme.support.journaux')}
      </p>
    </section>
  )
}

function TableauErreurs({ erreurs }: Readonly<{ erreurs: ErreurPlateforme[] }>) {
  const { t } = useTranslation()
  const colonnes: ColonneTableau<ErreurPlateforme>[] = [
    {
      cle: 'heure',
      entete: t('plateforme.support.colonnes.heure'),
      rendu: (e) => <span className="chiffres">{formaterHeure(e.le, FUSEAU_APPAREIL)}</span>,
    },
    {
      cle: 'entreprise',
      entete: t('plateforme.support.colonnes.entreprise'),
      rendu: (e) =>
        e.entrepriseNom ?? (
          <span className="text-attenue">{t('plateforme.support.horsEntreprise')}</span>
        ),
    },
    {
      cle: 'erreur',
      entete: t('plateforme.support.colonnes.erreur'),
      rendu: (e) => (
        <span className="flex flex-wrap items-center gap-2">
          <BadgeStatut ton={tonDuStatut(e.statut)}>{e.statut}</BadgeStatut>
          <span className="text-legende text-attenue">{e.code}</span>
        </span>
      ),
    },
    {
      cle: 'action',
      entete: t('plateforme.support.colonnes.action'),
      masqueeSurTelephone: true,
      rendu: (e) => (
        <span className="chiffres break-all">
          {e.methode} {e.chemin}
        </span>
      ),
    },
    {
      cle: 'code',
      entete: t('plateforme.support.colonnes.code'),
      masqueeSurTelephone: true,
      rendu: (e) => <span className="chiffres">{e.traceId.slice(0, 12)}</span>,
    },
  ]
  return (
    <Tableau
      libelle={t('plateforme.support.recentes')}
      colonnes={colonnes}
      lignes={erreurs}
      cleLigne={(e) => `${e.traceId}-${e.le}`}
    />
  )
}
