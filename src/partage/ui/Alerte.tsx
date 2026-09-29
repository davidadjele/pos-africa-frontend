import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ErreurApi } from '../api/ErreurApi'
import { messageErreur } from '../i18n/messageErreur'

export type TonAlerte = 'succes' | 'alerte' | 'danger' | 'info'

const CLASSES_TONS: Record<TonAlerte, string> = {
  succes: 'border-succes bg-succes-fond',
  alerte: 'border-alerte-bord bg-alerte-fond',
  danger: 'border-danger-bord bg-danger-fond',
  info: 'border-info bg-info-fond',
}

/** Bandeau de message dans la page : retour d'action, erreur de chargement, conflit. */
export function Alerte({
  ton,
  children,
  action,
}: Readonly<{
  ton: TonAlerte
  children: ReactNode
  action?: ReactNode
}>) {
  return (
    <div
      role={ton === 'danger' ? 'alert' : 'status'}
      className={clsx(
        'flex flex-wrap items-center justify-between gap-3 rounded-normal border px-4 py-3 text-corps text-encre',
        CLASSES_TONS[ton],
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  )
}

/** Erreur d'API : message traduit depuis le code, et traceId à donner au support. */
export function AlerteErreur({
  erreur,
  action,
}: Readonly<{ erreur: unknown; action?: ReactNode }>) {
  const { t } = useTranslation()
  const traceId = erreur instanceof ErreurApi ? erreur.reponse.traceId : undefined
  return (
    <Alerte ton="danger" action={action}>
      <p className="m-0">{messageErreur(erreur)}</p>
      {traceId !== undefined && (
        <p className="m-0 mt-1 text-legende text-attenue">
          {t('commun.codeSupport')} <span className="chiffres select-all">{traceId}</span>
        </p>
      )}
    </Alerte>
  )
}
