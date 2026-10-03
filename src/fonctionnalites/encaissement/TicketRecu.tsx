import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { OperateurMobileMoney, RecuCaisse, RecuEnLigne } from '../../partage/api/contrat'
import { formaterDate, formaterDateHeure, formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { formaterTaux } from '../../partage/montants/taxes'
import { CodeQr } from '../../partage/ui/CodeQr'
import { lienRecu } from '../recu/liens'

type PaiementRecu = RecuCaisse['paiements'][number]
type RemboursementRecu = RecuEnLigne['remboursements'][number]

/**
 * Le reçu tel qu'il sort de l'imprimante thermique, à la largeur du rouleau : noir sur blanc, sans couleur, lisible
 * une fois photocopié.
 */
export function TicketRecu({
  recu,
  operateurs,
  devise,
  fuseauHoraire,
  remboursements = [],
  avecQr = true,
}: Readonly<{
  recu: RecuCaisse
  operateurs: readonly OperateurMobileMoney[]
  devise: Devise
  fuseauHoraire: string
  /** Reçu en ligne : l'argent rendu depuis, à côté du reçu qui, lui, ne change pas. */
  remboursements?: readonly RemboursementRecu[]
  /** Le QR code mène au reçu en ligne : inutile quand on y est déjà. */
  avecQr?: boolean
}>) {
  const { t } = useTranslation()
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })
  const { etablissement } = recu
  return (
    <article
      aria-label={t('recu.ticket', { numero: recu.numero })}
      className={clsx(
        recu.largeur === 58 ? 'ticket-58' : 'ticket-80',
        'flex flex-col gap-0.5 bg-surface px-3 py-3 text-legende text-encre',
      )}
    >
      {recu.duplicata && (
        <p className="m-0 mb-1 border-2 border-encre text-center font-bold tracking-widest">
          {t('recu.duplicata')}
        </p>
      )}
      <div className="flex flex-col items-center text-center">
        <span className="text-corps-fort uppercase">{recu.entreprise}</span>
        <span>
          {[etablissement.adresse ?? etablissement.nom, etablissement.ville]
            .filter(Boolean)
            .join(', ')}
        </span>
        {etablissement.telephone !== undefined && (
          <span>{t('recu.telephone', { telephone: etablissement.telephone })}</span>
        )}
        {recu.numeroFiscal !== undefined && (
          <span>{t('recu.nif', { numero: recu.numeroFiscal })}</span>
        )}
        {etablissement.enTete !== undefined && <span className="mt-1">{etablissement.enTete}</span>}
      </div>
      <SeparateurTicket />
      <span className="font-bold">{t('recu.numero', { numero: recu.numero })}</span>
      <span>{formaterDateHeure(recu.emisLe, fuseauHoraire)}</span>
      <span>{t('recu.note', { note: recu.note })}</span>
      <span>{t('recu.servi', { serveur: recu.serveur, caissier: recu.caissier })}</span>
      <SeparateurTicket />
      {recu.lignes.map((ligne, rang) => (
        <LigneTicket
          key={`${ligne.nom}-${String(rang)}`}
          gauche={`${String(ligne.quantite)}× ${ligne.nom}`}
        >
          {ligne.offert ? t('recu.offert') : nombre(ligne.montant)}
        </LigneTicket>
      ))}
      {recu.remise > 0 && (
        <LigneTicket gauche={t('recu.remise')}>−{nombre(recu.remise)}</LigneTicket>
      )}
      <SeparateurTicket />
      <LigneTicket gauche={t('recu.total')} fort>
        {formaterMontant({ unitesMineures: recu.total, devise }, { forme: 'courte' })}
      </LigneTicket>
      {recu.taxes.map((taxe) => (
        <LigneTicket
          key={taxe.nom}
          gauche={t('recu.dontTaxe', {
            taxe: `${taxe.nom} ${formaterTaux(taxe.tauxPointsDeBase)}`,
          })}
        >
          {nombre(taxe.montant)}
        </LigneTicket>
      ))}
      <SeparateurTicket />
      {recu.paiements.map((paiement, rang) => (
        <Paiement
          key={`${paiement.mode}-${String(rang)}`}
          paiement={paiement}
          operateurs={operateurs}
          nombre={nombre}
        />
      ))}
      {remboursements.length > 0 && <SeparateurTicket />}
      {remboursements.map((remboursement, rang) => (
        <LigneTicket
          key={`${remboursement.le}-${String(rang)}`}
          gauche={t(remboursement.avoir === undefined ? 'recu.rembourse' : 'recu.rembourseAvoir', {
            date: formaterDate(remboursement.le, fuseauHoraire),
            heure: formaterHeure(remboursement.le, fuseauHoraire),
            mode: t(`recu.rembourseEn.${remboursement.mode}`),
            avoir: remboursement.avoir,
          })}
        >
          −{nombre(remboursement.montant)}
        </LigneTicket>
      ))}
      <SeparateurTicket />
      {etablissement.pied !== undefined && <p className="m-0 text-center">{etablissement.pied}</p>}
      {avecQr && (
        <div className="mt-2 flex flex-col items-center gap-1">
          <CodeQr
            texte={lienRecu(recu.jeton)}
            libelle={t('recu.enLigne.qr')}
            taille={recu.largeur === 58 ? 80 : 96}
          />
          <span>{t('recu.enLigne.legende')}</span>
        </div>
      )}
      <p className="m-0 mt-1 text-center">{t('recu.logiciel')}</p>
    </article>
  )
}

function Paiement({
  paiement,
  operateurs,
  nombre,
}: Readonly<{
  paiement: PaiementRecu
  operateurs: readonly OperateurMobileMoney[]
  nombre: (valeur: number) => string
}>) {
  const { t } = useTranslation()
  const operateur =
    operateurs.find((candidat) => candidat.code === paiement.operateur)?.libelle ??
    paiement.operateur ??
    ''
  const moyen = {
    ESPECES: t('encaissement.modes.ESPECES'),
    MOBILE_MONEY: operateur,
    CARTE: t('encaissement.modes.CARTE'),
    ARDOISE: t('encaissement.ardoise.de', { nom: paiement.client ?? '' }),
  }[paiement.mode]
  const libelle =
    paiement.reference === undefined
      ? moyen
      : t('recu.avecReference', { moyen, reference: paiement.reference })
  return (
    <>
      <LigneTicket gauche={libelle}>{nombre(paiement.montant)}</LigneTicket>
      {paiement.montantRecu !== undefined && (
        <span className="pl-2">
          {t('recu.rendu', {
            recu: nombre(paiement.montantRecu),
            rendu: nombre(paiement.monnaieRendue),
          })}
        </span>
      )}
      {paiement.doitEncore !== undefined && (
        <span className="pl-2">
          {t('recu.doitEncore', { montant: nombre(paiement.doitEncore) })}
        </span>
      )}
    </>
  )
}

export function LigneTicket({
  gauche,
  fort = false,
  children,
}: Readonly<{ gauche: string; fort?: boolean; children: ReactNode }>) {
  return (
    <span className={clsx('flex justify-between gap-2', fort && 'text-corps-fort')}>
      <span>{gauche}</span>
      <span className="chiffres shrink-0">{children}</span>
    </span>
  )
}

export function SeparateurTicket() {
  return <span aria-hidden="true" className="my-1 block border-t border-dashed border-encre" />
}
