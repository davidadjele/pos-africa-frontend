import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import type { AvoirCaisse, OperateurMobileMoney } from '../../partage/api/contrat'
import { formaterDate, formaterDateHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { LigneTicket, SeparateurTicket } from './TicketRecu'

/**
 * L'avoir remis au client avec l'argent rendu : noir sur blanc comme le reçu, avec la place de sa signature. Il
 * renvoie au reçu d'origine, et dit qui a remboursé et qui l'a accordé.
 */
export function TicketAvoir({
  avoir,
  operateurs,
  devise,
  fuseauHoraire,
}: Readonly<{
  avoir: AvoirCaisse
  operateurs: readonly OperateurMobileMoney[]
  devise: Devise
  fuseauHoraire: string
}>) {
  const { t } = useTranslation()
  const nombre = (valeur: number) =>
    formaterMontant({ unitesMineures: valeur, devise }, { forme: 'nombre' })
  const { etablissement } = avoir
  return (
    <article
      aria-label={t('avoir.ticket', { numero: avoir.numero })}
      className={clsx(
        avoir.largeur === 58 ? 'ticket-58' : 'ticket-80',
        'flex flex-col gap-0.5 bg-surface px-3 py-3 text-legende text-encre',
      )}
    >
      <p className="m-0 mb-1 border-2 border-encre text-center font-bold tracking-widest">
        {avoir.duplicata ? t('avoir.duplicata') : t('avoir.titre')}
      </p>
      <div className="flex flex-col items-center text-center">
        <span className="text-corps-fort uppercase">{avoir.entreprise}</span>
        <span>
          {[etablissement.adresse ?? etablissement.nom, etablissement.ville]
            .filter(Boolean)
            .join(', ')}
        </span>
        {avoir.numeroFiscal !== undefined && (
          <span>{t('recu.nif', { numero: avoir.numeroFiscal })}</span>
        )}
      </div>
      <SeparateurTicket />
      <span className="font-bold">{t('avoir.numero', { numero: avoir.numero })}</span>
      <span>{formaterDateHeure(avoir.emisLe, fuseauHoraire)}</span>
      {avoir.recu !== undefined && (
        <span>
          {t('avoir.surRecu', {
            recu: avoir.recu,
            date:
              avoir.recuEmisLe === undefined ? '' : formaterDate(avoir.recuEmisLe, fuseauHoraire),
          })}
        </span>
      )}
      <span>{t('recu.note', { note: avoir.note })}</span>
      <SeparateurTicket />
      {avoir.lignes.map((ligne, rang) => (
        <LigneTicket
          key={`${ligne.nom}-${String(rang)}`}
          gauche={`${String(ligne.quantite)}× ${ligne.nom}`}
        >
          −{nombre(ligne.montant)}
        </LigneTicket>
      ))}
      <span>
        {t('avoir.motif', {
          motif: avoir.detail ?? t(`remboursement.motifs.${avoir.motif}`).toLowerCase(),
        })}
      </span>
      <SeparateurTicket />
      <LigneTicket gauche={t('avoir.total')} fort>
        {formaterMontant({ unitesMineures: avoir.total, devise }, { forme: 'courte' })}
      </LigneTicket>
      {avoir.tva > 0 && <LigneTicket gauche={t('avoir.dontTva')}>{nombre(avoir.tva)}</LigneTicket>}
      <SeparateurTicket />
      {avoir.parts.map((part) => (
        <LigneTicket
          key={part.mode}
          gauche={
            part.mode === 'MOBILE_MONEY'
              ? (operateurs.find((candidat) => candidat.code === part.operateur)?.libelle ??
                t('encaissement.modes.MOBILE_MONEY'))
              : t(`encaissement.modes.${part.mode}`)
          }
        >
          {nombre(part.montant)}
        </LigneTicket>
      ))}
      <SeparateurTicket />
      <span>
        {avoir.approuvePar === undefined
          ? t('avoir.par', { nom: avoir.remboursePar })
          : t('avoir.parAccord', { nom: avoir.remboursePar, accord: avoir.approuvePar })}
      </span>
      <span className="mt-1">{t('avoir.signature')}</span>
      <span aria-hidden="true" className="block h-7 border-b border-dashed border-encre" />
      <p className="m-0 mt-1 text-center">{t('recu.logiciel')}</p>
    </article>
  )
}
