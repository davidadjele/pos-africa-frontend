import { useEffect, useRef } from 'react'

const EVENEMENTS_ACTIVITE = ['pointerdown', 'keydown'] as const

/**
 * Tablette partagée : sans toucher ni frappe pendant le délai de l'établissement, la caisse se
 * verrouille, pour qu'un collègue ne vende pas au nom de celui qui est parti.
 */
export function useVerrouillageInactivite(delaiMinutes: number, verrouiller: () => void): void {
  const rappel = useRef(verrouiller)
  useEffect(() => {
    rappel.current = verrouiller
  }, [verrouiller])

  useEffect(() => {
    let minuterie: ReturnType<typeof setTimeout>
    const relancer = () => {
      clearTimeout(minuterie)
      minuterie = setTimeout(() => {
        rappel.current()
      }, delaiMinutes * 60_000)
    }
    relancer()
    for (const evenement of EVENEMENTS_ACTIVITE) window.addEventListener(evenement, relancer)
    return () => {
      clearTimeout(minuterie)
      for (const evenement of EVENEMENTS_ACTIVITE) window.removeEventListener(evenement, relancer)
    }
  }, [delaiMinutes])
}
