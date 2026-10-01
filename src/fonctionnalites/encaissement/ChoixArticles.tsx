import { useTranslation } from 'react-i18next'
import type { OperateurMobileMoney } from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import {
  montantArticles,
  totalSelection,
  type ArticlePartageable,
} from '../../partage/montants/partage'
import { BadgeStatut, type TonStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Compteur } from '../../partage/ui/Compteur'
import { clsx } from 'clsx'

export type ArticleChoisissable = ArticlePartageable & { ligneId: string; nom: string }

/**
 * Choisir des articles à l'unité, chacun au montant que calcule le serveur : ceux qu'un client paie (partage par
 * articles) ou ceux qu'on lui rembourse. Une unité déjà réglée ne se choisit plus.
 */
export function ChoixArticles({
  articles,
  selection,
  devise,
  libelles,
  sousTitre,
  surChanger,
}: Readonly<{
  articles: readonly ArticleChoisissable[]
  selection: Record<string, number>
  devise: Devise
  libelles: {
    titre: string
    liste: string
    tout: string
    total: string
    regle: string
    tonRegle: TonStatut
  }
  sousTitre: (article: ArticleChoisissable) => string
  surChanger: (selection: Record<string, number>) => void
}>) {
  const { t } = useTranslation()
  const restants = (article: ArticleChoisissable) => article.quantite - article.payees
  return (
    <div className="flex flex-col rounded-moyen border border-trait">
      <div className="flex items-center justify-between gap-3 border-b border-trait px-3 py-2">
        <span className="text-corps-fort text-encre">{libelles.titre}</span>
        <Bouton
          className="shrink-0 whitespace-nowrap"
          onClick={() => {
            surChanger(
              Object.fromEntries(articles.map((article) => [article.ligneId, restants(article)])),
            )
          }}
        >
          {libelles.tout}
        </Bouton>
      </div>
      <ul aria-label={libelles.liste} className="m-0 list-none p-0">
        {articles.map((article) => {
          const choisies = selection[article.ligneId] ?? 0
          return (
            <li
              key={article.ligneId}
              className="flex flex-wrap items-center gap-3 border-b border-trait px-3 py-2 last:border-b-0"
            >
              <span className="flex min-w-0 basis-full flex-col sm:basis-0 sm:flex-1">
                <span className="text-corps-fort text-encre">{article.nom}</span>
                <span className="text-legende text-attenue">{sousTitre(article)}</span>
              </span>
              {restants(article) === 0 ? (
                <BadgeStatut ton={libelles.tonRegle}>{libelles.regle}</BadgeStatut>
              ) : (
                <Compteur
                  valeur={choisies}
                  libelleMoins={t('encaissement.partage.unDeMoins', { nom: article.nom })}
                  libellePlus={t('encaissement.partage.unDePlus', { nom: article.nom })}
                  moinsPossible={choisies > 0}
                  plusPossible={choisies < restants(article)}
                  surChanger={(valeur) => {
                    surChanger({ ...selection, [article.ligneId]: valeur })
                  }}
                />
              )}
              <span className="chiffres ml-auto w-16 text-right text-montant-ligne text-encre sm:ml-0">
                {choisies === 0
                  ? ''
                  : formaterMontant(
                      { unitesMineures: montantArticles(article, choisies), devise },
                      { forme: 'nombre' },
                    )}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex items-baseline justify-between border-t border-trait px-3 py-2">
        <span className="text-corps-fort text-encre">{libelles.total}</span>
        <output aria-label={libelles.total} className="chiffres text-montant-total text-encre">
          {formaterMontant(
            { unitesMineures: totalSelection(articles, selection), devise },
            { forme: 'courte' },
          )}
        </output>
      </div>
    </div>
  )
}

/** L'opérateur Mobile Money par lequel l'argent passe : à l'encaissement comme au remboursement. */
export function ChoixOperateur({
  operateurs,
  valeur,
  surChoisir,
}: Readonly<{
  operateurs: readonly OperateurMobileMoney[]
  valeur: string | null
  surChoisir: (code: string) => void
}>) {
  const { t } = useTranslation()
  return (
    <div
      role="radiogroup"
      aria-label={t('encaissement.operateur')}
      className="grid grid-cols-2 gap-2"
    >
      {operateurs.map((candidat) => (
        <button
          key={candidat.code}
          type="button"
          role="radio"
          aria-checked={valeur === candidat.code}
          onClick={() => {
            surChoisir(candidat.code)
          }}
          className={clsx(
            'min-h-cible-caisse rounded-normal bg-surface px-3 text-corps text-encre',
            valeur === candidat.code
              ? 'border-2 border-accent font-bold'
              : 'border border-bordure-controle',
          )}
        >
          {candidat.libelle}
        </button>
      ))}
    </div>
  )
}
