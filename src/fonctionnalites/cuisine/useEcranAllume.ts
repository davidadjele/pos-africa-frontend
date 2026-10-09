import { useEffect } from 'react'

/**
 * Garde l'écran allumé tant que la page est affichée : une tablette de cuisine en veille raterait les bons. Le
 * système libère le verrou quand la page passe en arrière-plan ; il est redemandé au retour. Un navigateur sans
 * l'API, ou qui refuse (batterie faible), laisse la mise en veille habituelle.
 */
export function useEcranAllume() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    const { wakeLock } = navigator
    let verrou: WakeLockSentinel | null = null
    let affiche = true
    const demander = () => {
      if (!affiche || document.visibilityState !== 'visible') return
      wakeLock
        .request('screen')
        .then((obtenu) => {
          verrou = obtenu
        })
        .catch(() => undefined)
    }
    demander()
    document.addEventListener('visibilitychange', demander)
    return () => {
      affiche = false
      document.removeEventListener('visibilitychange', demander)
      void verrou?.release().catch(() => undefined)
    }
  }, [])
}
