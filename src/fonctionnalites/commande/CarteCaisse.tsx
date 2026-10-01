import { clsx } from 'clsx'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LigneCarteEtablissement, StockCaisse } from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { EtatVide } from '../../partage/ui/EtatVide'
import { COULEURS_CATEGORIE } from '../catalogue/couleurs'
import { sansStock, stockDuProduit } from './requetes'

/** La carte de l'établissement, par catégorie, au prix d'ici : toucher une tuile ajoute le produit. */
export function CarteCaisse({
  carte,
  devise,
  stock,
  surChoisir,
}: Readonly<{
  carte: LigneCarteEtablissement[]
  devise: Devise
  stock?: StockCaisse | undefined
  surChoisir: (ligne: LigneCarteEtablissement) => void
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

  const categories = new Map<string, { nom: string; nombre: number }>()
  for (const ligne of carte) {
    const actuelle = categories.get(ligne.categorie.id)
    categories.set(ligne.categorie.id, {
      nom: ligne.categorie.nom,
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 md:flex-row">
      <nav
        aria-label={t('caisse.carte.categories')}
        className="flex shrink-0 gap-1 overflow-x-auto rounded-moyen border border-trait bg-surface p-2 md:w-rail-largeur md:flex-col md:overflow-y-auto"
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
            surChoisir={() => {
              setCategorieId(id)
            }}
          />
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3.5">
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
                <Tuile stock={stock} ligne={ligne} devise={devise} surChoisir={surChoisir} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function OngletCategorie({
  actif,
  libelle,
  nombre,
  surChoisir,
}: Readonly<{ actif: boolean; libelle: string; nombre: number; surChoisir: () => void }>) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={surChoisir}
      className={clsx(
        'flex min-h-cible-caisse shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-normal px-3.5 text-left text-corps',
        actif
          ? 'bg-rail-actif-fond font-semibold text-rail-actif-texte'
          : 'text-encre hover:bg-fond',
      )}
    >
      <span>{libelle}</span>
      <span className="chiffres text-legende opacity-70">{nombre}</span>
    </button>
  )
}

/** La couleur de la catégorie n'est qu'un repère, le texte reste noir sur blanc. */
function Tuile({
  ligne,
  devise,
  stock,
  surChoisir,
}: Readonly<{
  ligne: LigneCarteEtablissement
  devise: Devise
  stock: StockCaisse | undefined
  surChoisir: (ligne: LigneCarteEtablissement) => void
}>) {
  const { t } = useTranslation()
  const article = stockDuProduit(stock, ligne.produitId)
  const vide = article !== undefined && sansStock(article)
  // En politique stricte, la caisse refuse ce qui n'a plus de stock : la tuile se grise comme une rupture.
  const bloquee = ligne.epuise || (vide && stock?.politique === 'STRICT')
  return (
    <button
      type="button"
      disabled={bloquee}
      onClick={() => {
        surChoisir(ligne)
      }}
      className={clsx(
        'flex h-25 w-full flex-col justify-between gap-2 rounded-normal border border-trait border-l-[5px] p-3 pl-3.5 text-left',
        COULEURS_CATEGORIE[ligne.categorie.couleur].bord,
        bloquee ? 'bg-fond opacity-60' : 'bg-surface hover:bg-fond',
      )}
    >
      <span className="text-corps leading-tight text-encre">{ligne.nom}</span>
      <span className="flex items-end justify-between gap-1.5">
        <span className="chiffres text-montant-tuile text-encre">
          {formaterMontant({ unitesMineures: ligne.prix, devise }, { forme: 'nombre' })}
        </span>
        {ligne.epuise ? (
          <BadgeStatut ton="neutre">{t('caisse.carte.epuise')}</BadgeStatut>
        ) : vide ? (
          <BadgeStatut ton="danger">{t('caisse.carte.plusEnStock')}</BadgeStatut>
        ) : (
          article?.faible === true &&
          article.quantite !== undefined && (
            <BadgeStatut ton="alerte">
              {t('caisse.carte.restants', { count: article.quantite })}
            </BadgeStatut>
          )
        )}
      </span>
    </button>
  )
}
