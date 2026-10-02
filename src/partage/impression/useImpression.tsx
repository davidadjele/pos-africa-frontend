import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Imprimer un ticket : il est rendu dans une zone que seule l'impression montre, puis le navigateur imprime. Le seul
 * endroit qui sait comment on imprime : une impression directe (ESC/POS) le remplacera.
 */
export function useImpression() {
  const [contenu, setContenu] = useState<ReactNode>(null)

  useEffect(() => {
    if (contenu === null) return
    const terminer = () => {
      setContenu(null)
    }
    globalThis.addEventListener('afterprint', terminer, { once: true })
    globalThis.print()
    return () => {
      globalThis.removeEventListener('afterprint', terminer)
    }
  }, [contenu])

  const zone =
    contenu === null
      ? null
      : createPortal(
          <div className="zone-impression" aria-hidden="true">
            {contenu}
          </div>,
          document.body,
        )
  return { imprimer: setContenu, zone }
}
