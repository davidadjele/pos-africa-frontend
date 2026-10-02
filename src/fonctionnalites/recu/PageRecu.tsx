import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { RecuEnLigne } from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { useImpression } from '../../partage/impression/useImpression'
import type { Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BarreHaute } from '../../partage/ui/BarreHaute'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { TicketRecu } from '../encaissement/TicketRecu'

/** Le reçu que le client ouvre depuis WhatsApp ou le QR code de son ticket, sans compte. */
export function PageRecu({ jeton }: Readonly<{ jeton: string }>) {
  const { t } = useTranslation()
  const { imprimer, zone } = useImpression()
  const lecture = useQuery({
    queryKey: ['recu-en-ligne', jeton],
    queryFn: () => appelerApi<RecuEnLigne>(`/public/recus/${encodeURIComponent(jeton)}`),
    retry: false,
  })
  const enLigne = lecture.data
  const ticket =
    enLigne === undefined ? null : (
      <TicketRecu
        recu={enLigne.recu}
        operateurs={enLigne.operateurs}
        devise={enLigne.devise as Devise}
        fuseauHoraire={enLigne.fuseauHoraire}
        remboursements={enLigne.remboursements}
        avecQr={false}
      />
    )
  const { etablissement } = enLigne?.recu ?? {}

  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <BarreHaute
        {...(enLigne === undefined
          ? {}
          : {
              contexte: {
                titre: enLigne.recu.entreprise,
                detail: [etablissement?.nom, etablissement?.ville].filter(Boolean).join(', '),
              },
            })}
      />
      <main className="mx-auto flex w-full max-w-md flex-col gap-3 p-4">
        {lecture.isPending && <Chargement texte={t('recu.enLigne.chargement')} />}
        {lecture.isError &&
          (lecture.error instanceof ErreurApi && lecture.error.statut === 404 ? (
            <article className="rounded-moyen border border-trait bg-surface p-6">
              <EtatVide
                niveauTitre={1}
                titre={t('recu.enLigne.introuvable')}
                phrase={t('recu.enLigne.introuvablePhrase')}
              />
            </article>
          ) : (
            <AlerteErreur erreur={lecture.error} />
          ))}
        {enLigne !== undefined && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="m-0 text-titre-page text-encre">{t('recu.enLigne.titre')}</h1>
              <span className="chiffres text-corps text-attenue">{enLigne.recu.numero}</span>
            </div>
            <Bouton
              variante="principal"
              icone={Printer}
              onClick={() => {
                imprimer(ticket)
              }}
            >
              {t('recu.enLigne.imprimer')}
            </Bouton>
            <div className="flex justify-center rounded-moyen border border-trait bg-surface py-3">
              {ticket}
            </div>
          </>
        )}
      </main>
      {zone}
    </div>
  )
}
