import { useQuery } from '@tanstack/react-query'
import { useSession } from '../../partage/auth/useSession'
import { requeteEtablissements } from '../etablissements/requetes'
import { journeeLaPlusAvancee } from './periodes'

/**
 * La journée de caisse en cours dans le fuseau de l'établissement choisi, ou la plus avancée de tous : celui de
 * l'entreprise peut avoir une heure de retard sur un établissement, et ses notes sortiraient de « Aujourd'hui ».
 */
export function useJourneeCourante(etablissementId: string, actif = true): string {
  const { moi } = useSession()
  const etablissements = useQuery({ ...requeteEtablissements(0), enabled: actif })
  const fuseaux = (etablissements.data?.elements ?? [])
    .filter((etablissement) => etablissementId === '' || etablissement.id === etablissementId)
    .map((etablissement) => etablissement.fuseauHoraire)
  return journeeLaPlusAvancee(
    fuseaux.length > 0 ? fuseaux : [moi?.entrepriseCourante?.fuseauHoraire ?? 'Africa/Lome'],
  )
}
