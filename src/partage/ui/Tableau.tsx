import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bouton } from './Bouton'

export interface ColonneTableau<T> {
  cle: string
  entete: string
  rendu: (ligne: T) => ReactNode
  /** Montants, quantités : alignés à droite en chiffres tabulaires. */
  numerique?: boolean
  masqueeSurTelephone?: boolean
}

export function Tableau<T>({
  libelle,
  colonnes,
  lignes,
  cleLigne,
}: {
  libelle: string
  colonnes: ColonneTableau<T>[]
  lignes: T[]
  cleLigne: (ligne: T) => string
}) {
  const classesColonne = (colonne: ColonneTableau<T>) =>
    clsx(
      'px-4 whitespace-nowrap',
      colonne.numerique && 'text-right',
      colonne.masqueeSurTelephone && 'hidden md:table-cell',
    )
  return (
    // Le tableau défile dans son cadre, jamais la page.
    <div className="overflow-x-auto rounded-moyen border border-trait bg-surface">
      <table aria-label={libelle} className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            {colonnes.map((colonne) => (
              <th
                key={colonne.cle}
                scope="col"
                className={clsx(
                  classesColonne(colonne),
                  'h-10 border-b border-trait text-left text-libelle text-attenue',
                  colonne.numerique && 'text-right',
                )}
              >
                {colonne.entete}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr
              key={cleLigne(ligne)}
              className="border-b border-trait last:border-b-0 hover:bg-fond"
            >
              {colonnes.map((colonne) => (
                <td
                  key={colonne.cle}
                  className={clsx(
                    classesColonne(colonne),
                    'h-13 text-encre',
                    colonne.numerique && 'chiffres text-montant-ligne',
                  )}
                >
                  {colonne.rendu(ligne)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({
  page,
  taille,
  total,
  surChangerPage,
}: {
  page: number
  taille: number
  total: number
  surChangerPage: (page: number) => void
}) {
  const { t } = useTranslation()
  if (total <= taille) return null
  const debut = page * taille + 1
  const fin = Math.min(total, (page + 1) * taille)
  return (
    <nav
      aria-label={t('pagination.libelle')}
      className="flex flex-wrap items-center justify-end gap-3"
    >
      <span className="chiffres text-libelle text-attenue">
        {t('pagination.resume', { debut, fin, total })}
      </span>
      <Bouton
        icone={ChevronLeft}
        disabled={page === 0}
        onClick={() => {
          surChangerPage(page - 1)
        }}
      >
        {t('pagination.precedente')}
      </Bouton>
      <Bouton
        disabled={fin >= total}
        onClick={() => {
          surChangerPage(page + 1)
        }}
      >
        {t('pagination.suivante')}
        <ChevronRight aria-hidden="true" size={18} />
      </Bouton>
    </nav>
  )
}
