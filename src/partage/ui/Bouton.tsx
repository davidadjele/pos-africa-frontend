import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

export type VarianteBouton = 'principal' | 'secondaire' | 'danger'

const CLASSES_COMMUNES =
  'inline-flex items-center justify-center gap-2 rounded-normal border px-4 text-corps-fort font-texte transition-colors disabled:cursor-not-allowed'

const HAUTEURS: Record<VarianteBouton, string> = {
  principal: 'min-h-cible-caisse',
  secondaire: 'min-h-cible-min',
  danger: 'min-h-cible-min',
}

const COULEURS: Record<VarianteBouton, string> = {
  principal: 'border-accent bg-accent text-accent-texte hover:opacity-90',
  secondaire: 'border-bordure-controle bg-surface text-encre hover:bg-fond',
  danger: 'border-danger bg-surface text-danger hover:bg-danger-fond',
}

// L'état désactivé remplace les couleurs : un bouton éteint ne doit plus ressembler à une action.
const COULEURS_DESACTIVE = 'border-trait bg-fond text-attenue'

/** Classes d'un bouton, pour habiller aussi un lien de navigation (Link) en bouton. */
export function classesBouton(variante: VarianteBouton, desactive = false): string {
  return clsx(
    CLASSES_COMMUNES,
    HAUTEURS[variante],
    desactive ? COULEURS_DESACTIVE : COULEURS[variante],
  )
}

export interface ProprietesBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton
  icone?: LucideIcon
}

export function Bouton({
  variante = 'secondaire',
  icone: Icone,
  type = 'button',
  disabled = false,
  className,
  children,
  ...reste
}: ProprietesBouton) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={clsx(classesBouton(variante, disabled), className)}
      {...reste}
    >
      {Icone && <Icone aria-hidden="true" size={18} strokeWidth={2} />}
      {children}
    </button>
  )
}
