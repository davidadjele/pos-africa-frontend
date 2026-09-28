import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export type TonStatut = 'succes' | 'alerte' | 'danger' | 'info' | 'neutre'

const CLASSES_TONS: Record<TonStatut, string> = {
  succes: 'bg-succes-fond text-succes',
  alerte: 'bg-alerte-fond text-alerte-texte',
  danger: 'bg-danger-fond text-danger',
  info: 'bg-info-fond text-info',
  neutre: 'bg-fond text-attenue',
}

export function BadgeStatut({ ton, children }: { ton: TonStatut; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex h-5 items-center whitespace-nowrap rounded-petit px-1.5 font-texte text-badge',
        CLASSES_TONS[ton],
      )}
    >
      {children}
    </span>
  )
}
