import { AlerteErreur } from './Alerte'
import { Chargement } from './Chargement'

/** Ce qu'une liste montre tant qu'elle n'a rien à lister : chargement, erreur, ou aucun élément. */
export function EtatsListe({
  requete,
  chargement,
  vide,
}: Readonly<{
  requete: {
    isPending: boolean
    isError: boolean
    error: unknown
    data?: readonly unknown[] | undefined
  }
  chargement: string
  vide: string
}>) {
  if (requete.isPending) return <Chargement texte={chargement} />
  if (requete.isError) return <AlerteErreur erreur={requete.error} />
  if (requete.data?.length === 0) return <p className="m-0 text-corps text-attenue">{vide}</p>
  return null
}
