import { clsx } from 'clsx'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, Ref } from 'react'

export type VarianteBouton = 'principal' | 'secondaire' | 'danger' | 'confirmationDanger'

const CLASSES_COMMUNES =
  'inline-flex items-center justify-center gap-2 rounded-normal border px-4 text-corps-fort font-texte transition-colors disabled:cursor-not-allowed'

const HAUTEURS: Record<VarianteBouton, string> = {
  principal: 'min-h-cible-caisse',
  secondaire: 'min-h-cible-min',
  danger: 'min-h-cible-min',
  confirmationDanger: 'min-h-cible-min',
}

const COULEURS: Record<VarianteBouton, string> = {
  principal: 'border-accent bg-accent text-accent-texte hover:opacity-90',
  secondaire: 'border-bordure-controle bg-surface text-encre hover:bg-fond',
  danger: 'border-danger bg-surface text-danger hover:bg-danger-fond',
  // Réservé au bouton qui confirme une action destructrice dans un dialogue.
  confirmationDanger: 'border-danger bg-danger text-surface hover:opacity-90',
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
  /** Action lancée : le bouton garde sa couleur, n'agit plus et l'annonce (aria-busy). */
  enCours?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Bouton({
  variante = 'secondaire',
  icone: Icone,
  type = 'button',
  disabled = false,
  enCours = false,
  className,
  children,
  ...reste
}: ProprietesBouton) {
  const IconeAffichee = enCours ? LoaderCircle : Icone
  return (
    <button
      type={type}
      disabled={disabled || enCours}
      aria-busy={enCours || undefined}
      className={clsx(classesBouton(variante, disabled), enCours && 'cursor-wait', className)}
      {...reste}
    >
      {IconeAffichee && (
        <IconeAffichee
          aria-hidden="true"
          size={18}
          strokeWidth={2}
          className={enCours ? 'animate-spin' : undefined}
        />
      )}
      {children}
    </button>
  )
}
