import { useQuery } from '@tanstack/react-query'
import type { EtablissementResume } from '../../partage/api/contrat'
import { requeteEtablissements } from './requetes'

/** L'établissement choisi : celui de l'adresse, sinon le premier visible. */
export function useEtablissementChoisi(etablissementId: string | undefined) {
  const etablissements = useQuery(requeteEtablissements(0))
  const etablissement: EtablissementResume | undefined =
    etablissements.data?.elements.find((candidat) => candidat.id === etablissementId) ??
    etablissements.data?.elements[0]
  return { etablissements, etablissement }
}
