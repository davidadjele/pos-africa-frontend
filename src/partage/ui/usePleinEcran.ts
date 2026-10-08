import { useCallback, useSyncExternalStore } from 'react'

/** Safari sur iPad n'expose l'API qu'avec le préfixe webkit. */
interface DocumentWebkit {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | undefined
}

interface ElementWebkit {
  webkitRequestFullscreen?: () => Promise<void> | undefined
}

const EVENEMENTS = ['fullscreenchange', 'webkitfullscreenchange']

function elementPleinEcran(): Element | null {
  return document.fullscreenElement ?? (document as DocumentWebkit).webkitFullscreenElement ?? null
}

function abonner(prevenir: () => void) {
  for (const evenement of EVENEMENTS) document.addEventListener(evenement, prevenir)
  return () => {
    for (const evenement of EVENEMENTS) document.removeEventListener(evenement, prevenir)
  }
}

const estActif = () => elementPleinEcran() !== null

/**
 * Le plein écran de la page entière, pour la caisse et la cuisine. Il suit aussi les sorties par Échap ou par le geste
 * du système. Le navigateur peut refuser (pas de geste récent, réglage) : la page reste alors telle quelle.
 */
export function usePleinEcran() {
  const actif = useSyncExternalStore(abonner, estActif, () => false)
  const disponible =
    document.fullscreenEnabled || (document as DocumentWebkit).webkitFullscreenEnabled === true

  const basculer = useCallback(async () => {
    // Les types du DOM supposent l'API standard partout ; sur iPad, seule la variante webkit existe.
    const racine: Partial<Pick<HTMLElement, 'requestFullscreen'>> & ElementWebkit =
      document.documentElement
    const doc: Partial<Pick<Document, 'exitFullscreen'>> & DocumentWebkit = document
    try {
      if (elementPleinEcran() === null) {
        await (racine.requestFullscreen?.() ?? racine.webkitRequestFullscreen?.())
      } else {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
      }
    } catch {
      // Refusé par le navigateur : rien à afficher, le bouton reste dans son état.
    }
  }, [])

  return { disponible, actif, basculer }
}
