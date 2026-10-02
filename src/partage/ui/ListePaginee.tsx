import type { UseQueryResult } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlerteErreur } from './Alerte'
import { Bouton } from './Bouton'
import { Chargement } from './Chargement'
import { Pagination, Tableau, type ColonneTableau } from './Tableau'

/**
 * Une liste paginée du serveur : son chargement, son erreur avec « Réessayer », son état vide, puis le tableau et
 * la pagination.
 */
export function ListePaginee<T>({
  requete,
  chargement,
  vide,
  libelle,
  colonnes,
  cleLigne,
  page,
  taille,
  surChangerPage,
}: Readonly<{
  requete: UseQueryResult<{ elements: T[]; total: number }>
  chargement: string
  /** À la place du tableau quand la liste est vide ; null quand un formulaire y prend déjà place. */
  vide: ReactNode
  libelle: string
  colonnes: ColonneTableau<T>[]
  cleLigne: (ligne: T) => string
  page: number
  taille: number
  surChangerPage: (page: number) => void
}>) {
  const { t } = useTranslation()
  if (requete.isPending) return <Chargement texte={chargement} />
  if (requete.isError) {
    return (
      <AlerteErreur
        erreur={requete.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void requete.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  }
  if (requete.data.total === 0) {
    return vide === null ? null : (
      <section className="rounded-moyen border border-trait bg-surface p-6">{vide}</section>
    )
  }
  return (
    <>
      <Tableau
        libelle={libelle}
        colonnes={colonnes}
        lignes={requete.data.elements}
        cleLigne={cleLigne}
      />
      <Pagination
        page={page}
        taille={taille}
        total={requete.data.total}
        surChangerPage={surChangerPage}
      />
    </>
  )
}
