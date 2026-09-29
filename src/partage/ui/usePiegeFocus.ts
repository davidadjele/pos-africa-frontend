import { useEffect, type RefObject } from 'react'

/**
 * Dialogue modal : le focus part sur l'action sûre, reste dans le cadre (Tab), revient à son origine
 * à la fermeture, et Échap appelle `surEchap` (s'il existe).
 */
export function usePiegeFocus(
  cadre: RefObject<HTMLElement | null>,
  premierFocus: RefObject<HTMLElement | null>,
  surEchap: (() => void) | undefined,
): void {
  useEffect(() => {
    const origine = document.activeElement
    premierFocus.current?.focus()
    return () => {
      if (origine instanceof HTMLElement) origine.focus()
    }
  }, [premierFocus])

  // Écouté sur le document : Échap doit fermer même si le focus a quitté le dialogue.
  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        evenement.preventDefault()
        surEchap?.()
        return
      }
      if (evenement.key !== 'Tab' || cadre.current === null) return
      const focalisables = Array.from(
        cadre.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select',
        ),
      )
      const premier = focalisables[0]
      const dernier = focalisables.at(-1)
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
  }, [cadre, surEchap])
}
