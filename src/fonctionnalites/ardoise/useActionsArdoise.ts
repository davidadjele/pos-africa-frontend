import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { appelerApi } from '../../partage/api/appelerApi'

/**
 * Ce qui suit une action sur une ardoise : la liste relue, le message de confirmation, ou l'erreur. Le dialogue
 * ouvert se referme dans les deux cas.
 */
export function useActionsArdoise(etablissementId: string | undefined, fermerDialogue: () => void) {
  const clientRequetes = useQueryClient()
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function apres(message: string) {
    if (etablissementId === undefined) return
    await clientRequetes.invalidateQueries({ queryKey: ['ardoises', etablissementId] })
    fermerDialogue()
    setConfirmation(message)
  }

  /** Fermer ou rouvrir l'ardoise d'un client. */
  async function basculer(
    clientId: string,
    action: 'desactivation' | 'reactivation',
    message: string,
  ) {
    if (etablissementId === undefined) return
    setEnCours(true)
    setErreur(null)
    try {
      await appelerApi(`/etablissements/${etablissementId}/clients/${clientId}/${action}`, {
        methode: 'POST',
      })
      await apres(message)
    } catch (echec) {
      setErreur(echec)
      fermerDialogue()
    } finally {
      setEnCours(false)
    }
  }

  return { confirmation, setConfirmation, enCours, erreur, apres, basculer }
}
