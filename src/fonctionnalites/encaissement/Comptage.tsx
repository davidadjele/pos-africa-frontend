import { clsx } from 'clsx'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  cleCoupure,
  coupuresDe,
  totalCompte,
  type NatureCoupure,
} from '../../partage/montants/coupures'
import { formaterMontant, symboleDe, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'

const TOTAL = 'total'

/** Le comptage du tiroir en cours : par coupure, ou le total saisi pour une devise sans grille. */
export function useComptage(devise: Devise) {
  const [saisies, setSaisies] = useState<Record<string, string>>({})
  const coupures = coupuresDe(devise)
  const total =
    coupures === null
      ? (lireMontant(saisies[TOTAL] ?? '', devise) ?? 0)
      : totalCompte(
          Object.fromEntries(
            Object.entries(saisies).map(([cle, nombre]) => [cle, Number(nombre) || 0]),
          ),
        )
  return {
    devise,
    saisies,
    total,
    changer: (cle: string, valeur: string) => {
      setSaisies((actuelles) => ({ ...actuelles, [cle]: valeur }))
    },
  }
}

export type Comptage = ReturnType<typeof useComptage>

/**
 * Compter le tiroir : la grille des coupures, et à côté le total compté avec l'action qui le valide. L'attendu
 * n'apparaît pas ici : on compte ce qu'on a, pas ce qu'on devrait avoir.
 */
export function EtapeComptage({
  comptage,
  aide,
  action,
}: Readonly<{ comptage: Comptage; aide: string; action: ReactNode }>) {
  const { t } = useTranslation()
  const { devise, saisies, total, changer } = comptage
  const coupures = coupuresDe(devise)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
      <section
        aria-label={t('cloture.comptage')}
        className="grid min-h-0 min-w-0 flex-1 content-start gap-x-10 gap-y-4 overflow-y-auto rounded-moyen border border-trait bg-surface p-4 sm:p-5 xl:grid-cols-2"
      >
        {coupures === null ? (
          <ChampSaisie
            libelle={t('cloture.compte')}
            inputMode="numeric"
            suffixe={symboleDe(devise)}
            value={saisies[TOTAL] ?? ''}
            onChange={(evenement) => {
              changer(TOTAL, evenement.target.value)
            }}
          />
        ) : (
          (['billet', 'piece'] as const).map((nature) => {
            const valeurs = nature === 'billet' ? coupures.billets : coupures.pieces
            return valeurs.length === 0 ? null : (
              <div key={nature} className="flex flex-col">
                <h2 className="m-0 border-b border-trait pb-2 text-libelle font-bold text-attenue">
                  {t(nature === 'billet' ? 'cloture.billets' : 'cloture.pieces')}
                </h2>
                {valeurs.map((valeur) => (
                  <LigneCoupure
                    key={valeur}
                    nature={nature}
                    valeur={valeur}
                    nombre={saisies[cleCoupure(nature, valeur)] ?? ''}
                    devise={devise}
                    surChanger={(nombre) => {
                      changer(cleCoupure(nature, valeur), nombre)
                    }}
                  />
                ))}
              </div>
            )
          })
        )}
      </section>
      {/* En portrait, la page défile : le total et sa validation restent collés en bas, marge de la page comprise. */}
      <aside className="sticky -bottom-4 flex shrink-0 flex-col gap-3 rounded-moyen border border-trait bg-surface p-5 lg:static lg:w-ticket-largeur">
        <span className="text-legende text-attenue">{t('cloture.compte')}</span>
        <output aria-label={t('cloture.compte')} className="chiffres text-montant-total text-encre">
          {formaterMontant({ unitesMineures: total, devise }, { forme: 'courte' })}
        </output>
        <p className="m-0 text-legende text-attenue">{aide}</p>
        <div className="mt-auto flex flex-col pt-2">{action}</div>
      </aside>
    </div>
  )
}

function LigneCoupure({
  nature,
  valeur,
  nombre,
  devise,
  surChanger,
}: Readonly<{
  nature: NatureCoupure
  valeur: number
  nombre: string
  devise: Devise
  surChanger: (nombre: string) => void
}>) {
  const { t } = useTranslation()
  const libelle = formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })
  const quantite = Number(nombre) || 0
  return (
    <div className="grid grid-cols-[minmax(48px,1fr)_auto_minmax(56px,1fr)] items-center gap-2 border-b border-trait py-1.5 sm:gap-3">
      <span className="chiffres text-corps-fort text-encre">
        {formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })}
      </span>
      <span className="flex w-36 items-center rounded-normal border border-trait bg-surface sm:w-44">
        <button
          type="button"
          aria-label={t('cloture.moins', { valeur: libelle })}
          disabled={quantite <= 0}
          onClick={() => {
            surChanger(String(Math.max(0, quantite - 1)))
          }}
          className="size-cible-min shrink-0 text-titre-section text-attenue disabled:opacity-40"
        >
          −
        </button>
        <input
          aria-label={t('cloture.nombre', {
            nature: t(nature === 'billet' ? 'cloture.billet' : 'cloture.piece'),
            valeur: libelle,
          })}
          inputMode="numeric"
          placeholder="0"
          value={nombre}
          onChange={(evenement) => {
            surChanger(evenement.target.value.replace(/\D/gu, ''))
          }}
          className="chiffres w-full min-w-0 border-0 bg-transparent text-center text-montant-ligne text-encre outline-none placeholder:text-attenue"
        />
        <button
          type="button"
          aria-label={t('cloture.plus', { valeur: libelle })}
          onClick={() => {
            surChanger(String(quantite + 1))
          }}
          className="size-cible-min shrink-0 text-titre-section text-attenue"
        >
          +
        </button>
      </span>
      <span
        className={clsx(
          'chiffres text-right text-corps',
          quantite === 0 ? 'text-attenue' : 'text-encre',
        )}
      >
        {quantite === 0
          ? ''
          : formaterMontant({ unitesMineures: valeur * quantite, devise }, { forme: 'nombre' })}
      </span>
    </div>
  )
}

/** Attendu, compté et écart côte à côte, l'écart teinté selon son sens. */
export function ResultatEcart({
  libelleAttendu,
  attendu,
  compte,
  devise,
}: Readonly<{ libelleAttendu: string; attendu: number; compte: number; devise: Devise }>) {
  const { t } = useTranslation()
  const ecart = compte - attendu
  const courte = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'courte' })
  const sens = sensEcart(ecart)
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Chiffre libelle={libelleAttendu} valeur={courte(attendu)} />
      <Chiffre libelle={t('cloture.compte')} valeur={courte(compte)} />
      <span className={clsx('flex flex-col rounded-normal px-2.5 py-1.5', COULEURS_ECART[sens])}>
        <span className="text-legende font-semibold">{t(`cloture.${sens}`)}</span>
        <span className="chiffres text-montant-tuile">
          {SIGNES_ECART[sens]}
          {courte(Math.abs(ecart))}
        </span>
      </span>
    </div>
  )
}

type SensEcart = 'juste' | 'manque' | 'surplus'

export function sensEcart(ecart: number): SensEcart {
  if (ecart === 0) return 'juste'
  return ecart < 0 ? 'manque' : 'surplus'
}

/** « −500 », « +200 », « 0 » : le signe moins typographique, comme pour les montants. */
export const SIGNES_ECART: Record<SensEcart, string> = { juste: '', manque: '−', surplus: '+' }

const COULEURS_ECART: Record<SensEcart, string> = {
  juste: 'bg-succes-fond text-succes',
  manque: 'bg-danger-fond text-danger',
  surplus: 'bg-alerte-fond text-alerte-texte',
}

function Chiffre({ libelle, valeur }: Readonly<{ libelle: string; valeur: string }>) {
  return (
    <span className="flex flex-col px-1 py-1.5">
      <span className="text-legende text-attenue">{libelle}</span>
      <span className="chiffres text-montant-tuile text-encre">{valeur}</span>
    </span>
  )
}
