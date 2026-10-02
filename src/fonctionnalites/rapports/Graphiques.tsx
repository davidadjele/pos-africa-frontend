import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import type { HistoriqueCaisses, RapportVentes } from '../../partage/api/contrat'
import { FOND_MODE, MODES } from './couleurs'
import { formaterJourCourt } from './periodes'

type Jour = RapportVentes['parJour'][number]
type Heure = RapportVentes['parHeure'][number]
type EcartJour = HistoriqueCaisses['parJour'][number]

/** « +500 », « −2 000 », « 0 » : le signe typographique devant la valeur absolue. */
export function signe(valeur: number, nombre: (valeur: number) => string): string {
  if (valeur > 0) return `+${nombre(valeur)}`
  if (valeur < 0) return `−${nombre(-valeur)}`
  return nombre(0)
}

/** Le petit carré de légende : jamais une pastille ronde. */
export function Carre({ fond }: Readonly<{ fond: string }>) {
  return <span aria-hidden="true" className={clsx('size-2.5 shrink-0 rounded-petit', fond)} />
}

export function LegendeModes() {
  const { t } = useTranslation()
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-legende text-attenue">
      {MODES.map((mode) => (
        <li key={mode} className="flex items-center gap-1.5">
          <Carre fond={FOND_MODE[mode]} />
          {t(`encaissement.modes.${mode}`)}
        </li>
      ))}
    </ul>
  )
}

function milliers(valeur: number): string {
  return valeur >= 1000 ? `${String(Math.round(valeur / 1000))} k` : String(valeur)
}

/** Les ventes de chaque jour, empilées par mode de paiement ; le meilleur jour en gras. */
export function HistogrammeJours({ jours }: Readonly<{ jours: Jour[] }>) {
  const { t } = useTranslation()
  const plusHaut = Math.max(1, ...jours.map((jour) => jour.total))
  const meilleur = jours.reduce<Jour | undefined>(
    (retenu, jour) => (retenu === undefined || jour.total > retenu.total ? jour : retenu),
    undefined,
  )
  return (
    <ol
      aria-label={t('rapports.ventes.parJour')}
      className="m-0 flex h-64 list-none items-end gap-1.5 p-0 sm:gap-3"
    >
      {jours.map((jour) => (
        <li
          key={jour.journee}
          aria-label={`${formaterJourCourt(jour.journee)} : ${String(jour.total)}`}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
        >
          <span className="chiffres text-legende text-attenue">{milliers(jour.total)}</span>
          <span
            className="flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-t-petit"
            style={{ height: `${String((jour.total / plusHaut) * 100)}%` }}
          >
            {MODES.map((mode) => {
              const montant = {
                ESPECES: jour.especes,
                MOBILE_MONEY: jour.mobileMoney,
                CARTE: jour.carte,
                ARDOISE: jour.ardoise,
              }[mode]
              return (
                <span
                  key={mode}
                  className={clsx('block w-full', FOND_MODE[mode])}
                  style={{
                    height: `${String(jour.total === 0 ? 0 : (montant / jour.total) * 100)}%`,
                  }}
                />
              )
            })}
          </span>
          <span
            className={clsx(
              'truncate text-legende',
              meilleur?.journee === jour.journee && jour.total > 0
                ? 'font-bold text-encre'
                : 'text-attenue',
            )}
          >
            {formaterJourCourt(jour.journee)}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** L'affluence : le chiffre d'affaires de chaque heure où l'on a encaissé. */
export function HistogrammeHeures({ heures }: Readonly<{ heures: Heure[] }>) {
  const { t } = useTranslation()
  const plusHaut = Math.max(1, ...heures.map((heure) => heure.total))
  return (
    <ol
      aria-label={t('rapports.ventes.parHeure')}
      className="m-0 flex h-64 list-none items-end gap-1 p-0"
    >
      {heures.map((heure) => (
        <li
          key={heure.heure}
          aria-label={`${String(heure.heure)} h : ${String(heure.total)}`}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
        >
          <span className="chiffres text-legende text-attenue">{milliers(heure.total)}</span>
          <span
            className="block w-full max-w-10 rounded-t-petit bg-graphique-carte"
            style={{ height: `${String((heure.total / plusHaut) * 100)}%` }}
          />
          <span className="chiffres text-legende text-attenue">{`${String(heure.heure)} h`}</span>
        </li>
      ))}
    </ol>
  )
}

/** La part de chaque mode dans les ventes, d'un seul trait. */
export function BarreModes({ parMode }: Readonly<{ parMode: RapportVentes['parMode'] }>) {
  const total = parMode.reduce((somme, mode) => somme + mode.montant, 0)
  if (total === 0) return null
  return (
    <span aria-hidden="true" className="flex h-3.5 w-full overflow-hidden rounded-petit">
      {parMode.map((mode) => (
        <span
          key={mode.mode}
          className={clsx('block h-full', FOND_MODE[mode.mode])}
          style={{ width: `${String((mode.montant / total) * 100)}%` }}
        />
      ))}
    </span>
  )
}

/** Les écarts de caisse par jour autour d'un axe : le manque en dessous, le surplus au-dessus. */
export function EcartsParJour({
  jours,
  nombre,
}: Readonly<{ jours: EcartJour[]; nombre: (valeur: number) => string }>) {
  const { t } = useTranslation()
  const plusFort = Math.max(1, ...jours.map((jour) => Math.abs(jour.ecart)))
  return (
    <ol
      aria-label={t('rapports.caisses.ecartsParJour')}
      className="m-0 flex list-none gap-1 p-0 sm:gap-2"
    >
      {jours.map((jour) => {
        // Au-delà d'une semaine, le numéro du jour suffit : les barres tiennent sur un téléphone.
        const etiquette =
          jours.length > 7
            ? jour.journee.slice(8).replace(/^0/, '')
            : formaterJourCourt(jour.journee)
        const hauteur = `${String(Math.max(8, (Math.abs(jour.ecart) / plusFort) * 100))}%`
        let libelle = signe(jour.ecart, nombre)
        if (jour.cloturees === 0) libelle = t('rapports.caisses.aucune')
        else if (jour.ecart === 0) libelle = t('rapports.caisses.juste')
        return (
          <li
            key={jour.journee}
            aria-label={`${formaterJourCourt(jour.journee)} : ${libelle}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <span className="chiffres h-4 text-legende text-alerte-texte">
              {jour.ecart > 0 ? `+${nombre(jour.ecart)}` : ''}
            </span>
            <span className="flex h-12 w-full items-end justify-center">
              {jour.ecart > 0 && (
                <span
                  className="block w-full max-w-7 rounded-petit bg-graphique-surplus"
                  style={{ height: hauteur }}
                />
              )}
            </span>
            <span className="block h-px w-full bg-bordure-controle" />
            <span className="flex h-12 w-full items-start justify-center">
              {jour.ecart < 0 && (
                <span
                  className="block w-full max-w-7 rounded-petit bg-graphique-manque"
                  style={{ height: hauteur }}
                />
              )}
              {jour.ecart === 0 && jour.cloturees > 0 && (
                <span className="mt-0.5 block h-1 w-full max-w-7 rounded-petit bg-graphique-juste" />
              )}
            </span>
            <span className="chiffres h-4 text-legende text-danger">
              {jour.ecart < 0 ? `−${nombre(-jour.ecart)}` : ''}
            </span>
            <span className="truncate text-legende text-attenue">{etiquette}</span>
          </li>
        )
      })}
    </ol>
  )
}
