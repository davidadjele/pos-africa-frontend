import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErreurApi } from '../../partage/api/ErreurApi'
import type { PermissionCaisse } from '../../partage/api/contrat'
import { DialogueValidationGerant } from '../validation/DialogueValidationGerant'

interface DemandeValidation {
  permission: PermissionCaisse
  objetId: string
  titre: string
  contexte: string
}

/**
 * Action sensible : lancée telle quelle ; si le serveur exige la validation d'un gérant, son PIN est
 * demandé sur la tablette, puis l'action repart avec la validation obtenue (ADR 0004).
 */
export function useValidation() {
  const { t } = useTranslation()
  const [attente, setAttente] = useState<
    (DemandeValidation & { relancer: (id: string) => void; abandonner: () => void }) | null
  >(null)

  /** Rend le résultat de l'action, ou undefined si la validation a été abandonnée. */
  function executer<T>(
    appel: (validationId?: string) => Promise<T>,
    demande: DemandeValidation,
  ): Promise<T | undefined> {
    return appel().catch((echec: unknown) => {
      if (!(echec instanceof ErreurApi && echec.code === 'VALIDATION_REQUISE')) throw echec
      return new Promise<T | undefined>((resoudre, rejeter) => {
        setAttente({
          ...demande,
          relancer: (id) => {
            setAttente(null)
            appel(id).then(resoudre, rejeter)
          },
          abandonner: () => {
            setAttente(null)
            resoudre(undefined)
          },
        })
      })
    })
  }

  const dialogue =
    attente === null ? null : (
      <DialogueValidationGerant
        titre={attente.titre}
        contexte={attente.contexte}
        permission={attente.permission}
        objetId={attente.objetId}
        libelleAnnuler={t('commun.annuler')}
        surValide={(validation) => {
          attente.relancer(validation.id)
        }}
        surAnnuler={attente.abandonner}
      />
    )
  return { executer, dialogue }
}
