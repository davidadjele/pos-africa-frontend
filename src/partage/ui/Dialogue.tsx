import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Bouton } from './Bouton'

/**
 * Confirmation d'une action qui compte (suspendre, annuler une ligne envoyée). Jamais pour une
 * action anodine. Le focus reste dans le dialogue, Échap ferme sans agir.
 */
export function Dialogue({
  titre,
  consequence,
  libelleAnnuler,
  libelleConfirmer,
  tonConfirmation = 'principal',
  enCours = false,
  surAnnuler,
  surConfirmer,
  children,
}: {
  titre: string
  consequence: string
  libelleAnnuler: string
  libelleConfirmer: string
  tonConfirmation?: 'principal' | 'danger'
  enCours?: boolean
  surAnnuler: () => void
  surConfirmer: () => void
  children?: ReactNode
}) {
  const id = useId()
  const cadre = useRef<HTMLElement>(null)
  const boutonSur = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const origine = document.activeElement
    boutonSur.current?.focus()
    return () => {
      if (origine instanceof HTMLElement) origine.focus()
    }
  }, [])

  // Écouté sur le document : Échap doit fermer même si le focus a quitté le dialogue.
  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        evenement.preventDefault()
        surAnnuler()
        return
      }
      if (evenement.key !== 'Tab' || cadre.current === null) return
      const focalisables = Array.from(
        cadre.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select',
        ),
      )
      const premier = focalisables[0]
      const dernier = focalisables[focalisables.length - 1]
      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault()
        dernier?.focus()
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault()
        premier?.focus()
      }
    }
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
    }
  }, [surAnnuler])

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-voile sm:items-center sm:p-4">
      <section
        ref={cadre}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titre`}
        aria-describedby={`${id}-consequence`}
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-t-moyen bg-surface p-6 shadow-dialogue sm:rounded-moyen"
      >
        <h2 id={`${id}-titre`} className="m-0 text-titre-section text-encre">
          {titre}
        </h2>
        <p id={`${id}-consequence`} className="m-0 text-corps text-attenue">
          {consequence}
        </p>
        {children}
        <div className="flex flex-wrap justify-end gap-2">
          <Bouton ref={boutonSur} onClick={surAnnuler}>
            {libelleAnnuler}
          </Bouton>
          <Bouton
            variante={tonConfirmation === 'danger' ? 'confirmationDanger' : 'principal'}
            enCours={enCours}
            onClick={surConfirmer}
          >
            {libelleConfirmer}
          </Bouton>
        </div>
      </section>
    </div>
  )
}
