import { clsx } from 'clsx'
import { Minus, Search } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LigneCarteEtablissement, StockCaisse } from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { EtatVide } from '../../partage/ui/EtatVide'
import { COULEURS_CATEGORIE } from '../catalogue/couleurs'
import { sansStock, stockDuProduit } from './requetes'

/**
 * La carte de l'établissement, par catégorie, au prix d'ici : toucher une tuile ajoute le produit, « − » en retire
 * un tant qu'il n'est pas envoyé. La quantité déjà sur la note s'affiche sur la tuile.
 */
export function CarteCaisse({
  carte,
  devise,
  stock,
  quantites = {},
  surChoisir,
  surRetirer,
}: Readonly<{
  carte: LigneCarteEtablissement[]
  devise: Devise
  stock?: StockCaisse | undefined
  /** Quantités encore à envoyer, par produit. */
  quantites?: Partial<Record<string, number>>
  surChoisir: (ligne: LigneCarteEtablissement) => void
  surRetirer?: (ligne: LigneCarteEtablissement) => void
}>) {
  const { t } = useTranslation()
  const [categorieId, setCategorieId] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')

  if (carte.length === 0) {
    return (
      <section className="flex-1 rounded-moyen border border-trait bg-surface p-6">
        <EtatVide niveauTitre={2} titre={t('caisse.vide.titre')} phrase={t('caisse.vide.phrase')} />
      </section>
    )
  }

  const categories = new Map<
    string,
    { nom: string; couleur: LigneCarteEtablissement['categorie']['couleur']; nombre: number }
  >()
  for (const ligne of carte) {
    const actuelle = categories.get(ligne.categorie.id)
    categories.set(ligne.categorie.id, {
      nom: ligne.categorie.nom,
      couleur: ligne.categorie.couleur,
      nombre: (actuelle?.nombre ?? 0) + 1,
    })
  }
  const motif = recherche.trim().toLowerCase()
  const visibles = carte.filter(
    (ligne) =>
      (categorieId === null || ligne.categorie.id === categorieId) &&
      (motif === '' || ligne.nom.toLowerCase().includes(motif)),
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <nav
        aria-label={t('caisse.carte.categories')}
        className="flex shrink-0 gap-2 overflow-x-auto md:grid md:grid-cols-4 md:overflow-visible"
      >
        <OngletCategorie
          actif={categorieId === null}
          libelle={t('caisse.carte.tout')}
          nombre={carte.length}
          surChoisir={() => {
            setCategorieId(null)
          }}
        />
        {[...categories].map(([id, categorie]) => (
          <OngletCategorie
            key={id}
            actif={categorieId === id}
            libelle={categorie.nom}
            nombre={categorie.nombre}
            couleur={categorie.couleur}
            surChoisir={() => {
              setCategorieId(id)
            }}
          />
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <label className="flex min-h-cible-caisse items-center gap-2.5 rounded-normal border border-trait bg-surface px-3.5 text-attenue">
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            aria-label={t('caisse.carte.recherche')}
            placeholder={t('caisse.carte.recherche')}
            value={recherche}
            onChange={(evenement) => {
              setRecherche(evenement.target.value)
            }}
            className="min-w-0 flex-1 border-0 bg-transparent text-corps text-encre outline-none"
          />
        </label>
        {visibles.length === 0 ? (
          <p className="m-0 text-corps text-attenue">{t('caisse.carte.aucunResultat')}</p>
        ) : (
          <ul
            aria-label={t('caisse.carte.produits')}
            className="m-0 grid list-none grid-cols-2 content-start gap-2.5 overflow-y-auto p-0 sm:grid-cols-3 xl:grid-cols-4"
          >
            {visibles.map((ligne) => (
              <li key={ligne.produitId}>
                <Tuile
                  stock={stock}
                  ligne={ligne}
                  devise={devise}
                  quantite={quantites[ligne.produitId] ?? 0}
                  surChoisir={surChoisir}
                  surRetirer={surRetirer}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Une grande tuile teintée de la couleur de la catégorie ; « Tout » reste neutre. */
function OngletCategorie({
  actif,
  libelle,
  nombre,
  couleur,
  surChoisir,
}: Readonly<{
  actif: boolean
  libelle: string
  nombre: number
  couleur?: LigneCarteEtablissement['categorie']['couleur']
  surChoisir: () => void
}>) {
  const { t } = useTranslation()
  const teinte = couleur === undefined ? undefined : COULEURS_CATEGORIE[couleur]
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={surChoisir}
      className={clsx(
        'flex min-h-18 min-w-36 shrink-0 flex-col justify-between gap-1 rounded-moyen border-2 px-3.5 py-2.5 text-left',
        teinte === undefined ? 'bg-surface text-encre' : [teinte.fond, teinte.texte],
        actif ? 'border-accent' : 'border-transparent',
        teinte === undefined && !actif && 'border-trait',
      )}
    >
      <span className="text-titre-carte leading-tight">{libelle}</span>
      <span className="text-legende opacity-80">
        {t('caisse.carte.nombreProduits', { count: nombre })}
      </span>
    </button>
  )
}

/**
 * Toute la tuile ajoute le produit : une grande cible, même au pouce. « − » est un bouton à part, posé sur la tuile,
 * qui n'apparaît qu'une fois le produit sur la note.
 */
function Tuile({
  ligne,
  devise,
  stock,
  quantite,
  surChoisir,
  surRetirer,
}: Readonly<{
  ligne: LigneCarteEtablissement
  devise: Devise
  stock: StockCaisse | undefined
  quantite: number
  surChoisir: (ligne: LigneCarteEtablissement) => void
  surRetirer: ((ligne: LigneCarteEtablissement) => void) | undefined
}>) {
  const { t } = useTranslation()
  const idNom = useId()
  const article = stockDuProduit(stock, ligne.produitId)
  const vide = article !== undefined && sansStock(article)
  // En politique stricte, la caisse refuse ce qui n'a plus de stock : la tuile se grise comme une rupture.
  const bloquee = ligne.epuise || (vide && stock?.politique === 'STRICT')
  // Épuisé ce jour prime sur le stock ; un stock faible n'est signalé que s'il est compté.
  let badge: ReactNode = null
  if (ligne.epuise) {
    badge = <BadgeStatut ton="neutre">{t('caisse.carte.epuise')}</BadgeStatut>
  } else if (vide) {
    badge = <BadgeStatut ton="danger">{t('caisse.carte.plusEnStock')}</BadgeStatut>
  } else if (article?.faible === true && article.quantite !== undefined) {
    badge = (
      <BadgeStatut ton="alerte">
        {t('caisse.carte.restants', { count: article.quantite })}
      </BadgeStatut>
    )
  }
  const surLaNote = quantite > 0
  return (
    <div className="relative">
      <button
        type="button"
        disabled={bloquee}
        onClick={() => {
          surChoisir(ligne)
        }}
        className={clsx(
          'flex min-h-33 w-full flex-col gap-2 rounded-moyen border p-3.5 text-left',
          bloquee ? 'border-trait bg-fond opacity-60' : 'bg-surface hover:bg-fond',
          surLaNote ? 'border-2 border-accent' : !bloquee && 'border-trait',
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <span id={idNom} className="text-titre-carte leading-snug text-encre">
            {ligne.nom}
          </span>
          {surLaNote && (
            <span
              aria-label={t('caisse.carte.surLaNote', { count: quantite })}
              className="chiffres flex size-8 shrink-0 items-center justify-center rounded-normal bg-accent text-montant-ligne text-accent-texte"
            >
              {quantite}
            </span>
          )}
        </span>
        <span className="chiffres text-montant-tuile text-encre">
          {formaterMontant({ unitesMineures: ligne.prix, devise }, { forme: 'nombre' })}
        </span>
        <span className={clsx('mt-auto flex min-h-6 justify-end', surLaNote && 'pl-13')}>
          {badge}
        </span>
      </button>
      {surLaNote && surRetirer !== undefined && (
        <button
          type="button"
          aria-label={t('caisse.carte.retirerUn')}
          aria-describedby={idNom}
          onClick={() => {
            surRetirer(ligne)
          }}
          className="absolute bottom-3 left-3 flex size-cible-min items-center justify-center rounded-normal border border-bordure-controle bg-surface text-encre hover:bg-fond"
        >
          <Minus aria-hidden="true" size={20} />
        </button>
      )}
    </div>
  )
}
