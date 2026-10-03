import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  EspecesCaisse,
  MouvementResume,
  RapportZ,
  ReglementsCaisse,
  RemboursementsCaisse,
  TypeMouvement,
} from '../../partage/api/contrat'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { SIGNES_ECART, sensEcart } from './Comptage'

/*
 * Les parties du rapport Z et de la situation de caisse : les mêmes lignes à la clôture, sur l'écran de la caisse et
 * dans l'historique des caisses de la gestion.
 */

const TONS: Record<TypeMouvement, 'neutre' | 'alerte' | 'info'> = {
  RETRAIT: 'neutre',
  DEPENSE: 'alerte',
  APPORT: 'info',
}

/** Le corps du Z, des ventes au comptage ; l'explication de l'écart suit quand il y en a une. */
export function ContenuRapportZ({
  rapport,
  nombre,
}: Readonly<{ rapport: RapportZ; nombre: (valeur: number) => string }>) {
  const { t } = useTranslation()
  return (
    <>
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
      {rapport.reglementsArdoise.total > 0 && (
        <SectionZ titre={t('tiroir.reglements.titre')}>
          <DetailReglements reglements={rapport.reglementsArdoise} nombre={nombre} />
        </SectionZ>
      )}
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
          valeur={`${SIGNES_ECART[sensEcart(rapport.ecart)]}${nombre(Math.abs(rapport.ecart))}`}
        />
        <Montant libelle={t('cloture.z.fondLaisse')} valeur={nombre(rapport.fondLaisse)} />
      </SectionZ>
      {rapport.explication !== undefined && (
        <p className="m-0 mt-2 rounded-normal border border-alerte-bord bg-alerte-fond px-3 py-2 text-corps text-alerte-texte">
          <span className="block font-bold">{t('cloture.z.explication')}</span>
          {rapport.explication}
        </p>
      )}
    </>
  )
}

/** Les règlements d'ardoise, puis leur détail par mode : ce ne sont pas des ventes, la dette est déjà comptée. */
export function DetailReglements({
  reglements,
  nombre,
}: Readonly<{ reglements: ReglementsCaisse; nombre: (valeur: number) => string }>) {
  const { t } = useTranslation()
  const parMode = [
    ['ESPECES', reglements.especes],
    ['MOBILE_MONEY', reglements.mobileMoney],
    ['CARTE', reglements.carte],
  ] as const
  return (
    <>
      <Montant libelle={t('tiroir.reglements.titre')} valeur={nombre(reglements.total)} />
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

/** « +5 000 », « −2 500 », mais « 0 » tout court. */
export function signe(
  prefixe: '+' | '−',
  valeur: number,
  nombre: (valeur: number) => string,
): string {
  return valeur === 0 ? nombre(0) : `${prefixe}${nombre(valeur)}`
}

/** Une partie du rapport Z, sous son titre : chaque partie répond à une seule question. */
export function SectionZ({ titre, children }: Readonly<{ titre: string; children: ReactNode }>) {
  return (
    <div className="mt-3 flex flex-col border-t border-trait pt-3 first:mt-0 first:border-t-0 first:pt-0">
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
export function LignesRemboursements({
  remboursements,
  nombre,
}: Readonly<{ remboursements: RemboursementsCaisse; nombre: (valeur: number) => string }>) {
  const { t } = useTranslation()
  if (remboursements.total === 0) return null
  const parMode = [
    ['ESPECES', remboursements.especes],
    ['MOBILE_MONEY', remboursements.mobileMoney],
    ['CARTE', remboursements.carte],
    ['ARDOISE', remboursements.ardoise],
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
export function DetailEspeces({
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
      {especes.reglementsArdoise > 0 && (
        <Montant
          libelle={t('tiroir.especes.reglements')}
          valeur={signe('+', especes.reglementsArdoise, nombre)}
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

export function Montant({
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

export function LigneMouvement({
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
