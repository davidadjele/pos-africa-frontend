import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { formaterJournee, periodeDe, type ClePeriode, type Periode } from './periodes'

/** Les périodes proposées d'un clic ; « Choisir les dates » ouvre deux champs. */
export function ChoixPeriode({
  cles,
  cle,
  periode,
  journee,
  surChanger,
}: Readonly<{
  cles: ClePeriode[]
  cle: ClePeriode
  periode: Periode
  /** La journée de caisse en cours : point de départ des périodes. */
  journee: string
  surChanger: (cle: ClePeriode, periode: Periode) => void
}>) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={t('rapports.periode.titre')}
        className="flex flex-wrap items-center gap-1.5"
      >
        {cles.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={cle === candidate}
            onClick={() => {
              surChanger(candidate, candidate === 'DATES' ? periode : periodeDe(candidate, journee))
            }}
            className={clsx(
              'min-h-cible-min rounded-normal border px-3 text-libelle font-bold',
              cle === candidate
                ? 'border-accent bg-accent text-accent-texte'
                : 'border-trait bg-surface text-encre',
            )}
          >
            {t(`rapports.periode.${candidate}`)}
          </button>
        ))}
        {cle !== 'DATES' && (
          <span className="ml-1 text-legende text-attenue">
            {periode.du === periode.au
              ? formaterJournee(periode.du)
              : t('rapports.periode.du', {
                  du: formaterJournee(periode.du),
                  au: formaterJournee(periode.au),
                })}
          </span>
        )}
      </div>
      {cle === 'DATES' && (
        <div className="flex flex-wrap gap-3">
          <div className="w-44">
            <ChampSaisie
              libelle={t('rapports.periode.debut')}
              type="date"
              value={periode.du}
              max={periode.au}
              onChange={(evenement) => {
                if (evenement.target.value !== '')
                  surChanger('DATES', { ...periode, du: evenement.target.value })
              }}
            />
          </div>
          <div className="w-44">
            <ChampSaisie
              libelle={t('rapports.periode.fin')}
              type="date"
              value={periode.au}
              min={periode.du}
              max={journee}
              onChange={(evenement) => {
                if (evenement.target.value !== '')
                  surChanger('DATES', { ...periode, au: evenement.target.value })
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
