import type { EtablissementResume } from '../../partage/api/contrat'
import { ChampSelection } from '../../partage/ui/ChampSaisie'

/** Choisir l'établissement d'une page de gestion ; masqué quand il n'y en a qu'un. */
export function SelecteurEtablissement({
  etablissements,
  valeur,
  libelle,
  surChoisir,
}: Readonly<{
  etablissements: EtablissementResume[] | undefined
  valeur: string
  libelle: string
  surChoisir: (etablissementId: string) => void
}>) {
  if (etablissements === undefined || etablissements.length <= 1) return null
  return (
    <div className="w-60">
      <ChampSelection
        libelle={libelle}
        options={etablissements.map((candidat) => ({ valeur: candidat.id, libelle: candidat.nom }))}
        value={valeur}
        onChange={(evenement) => {
          surChoisir(evenement.target.value)
        }}
      />
    </div>
  )
}
