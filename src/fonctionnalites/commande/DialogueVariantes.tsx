import { clsx } from 'clsx'
import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { LigneCarteEtablissement } from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { Bouton } from '../../partage/ui/Bouton'
import { usePiegeFocus } from '../../partage/ui/usePiegeFocus'

/** Un produit à variantes : un toucher choisit « Demi » ou « Entier », sans bouton de confirmation. */
export function DialogueVariantes({
  produit,
  variantes,
  devise,
  surFermer,
  surChoisir,
}: Readonly<{
  produit: LigneCarteEtablissement
  variantes: readonly LigneCarteEtablissement[]
  devise: Devise
  surFermer: () => void
  surChoisir: (variante: LigneCarteEtablissement) => void
}>) {
  const { t } = useTranslation()
  const id = useId()
  const cadre = useRef<HTMLElement>(null)
  const boutonFermer = useRef<HTMLButtonElement>(null)
  usePiegeFocus(cadre, boutonFermer, surFermer)
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-voile sm:items-center sm:p-4">
      <section
        ref={cadre}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titre`}
        className="flex w-full max-w-xl flex-col gap-4 rounded-t-moyen bg-surface p-6 shadow-dialogue sm:rounded-moyen"
      >
        <h2 id={`${id}-titre`} className="m-0 text-titre-section text-encre">
          {produit.nom}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {variantes.map((variante) => (
            <button
              key={variante.produitId}
              type="button"
              disabled={variante.epuise}
              onClick={() => {
                surChoisir(variante)
              }}
              className={clsx(
                'flex min-h-21 flex-col items-start justify-center gap-1 rounded-moyen border px-4 py-3 text-left',
                variante.epuise
                  ? 'border-dashed border-trait bg-fond text-attenue'
                  : 'border-trait bg-surface text-encre hover:bg-fond',
              )}
            >
              <span className="text-titre-carte">{variante.libelleVariante ?? variante.nom}</span>
              <span className="chiffres text-montant-ligne text-attenue">
                {variante.epuise
                  ? t('caisse.carte.epuise')
                  : formaterMontant({ unitesMineures: variante.prix, devise }, { forme: 'courte' })}
              </span>
            </button>
          ))}
        </div>
        <Bouton ref={boutonFermer} className="self-end" onClick={surFermer}>
          {t('commun.annuler')}
        </Bouton>
      </section>
    </div>
  )
}
