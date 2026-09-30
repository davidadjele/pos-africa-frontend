import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { RotateCw, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerCaisse } from '../../partage/api/appelerCaisse'
import type { LigneCarteEtablissement } from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { COULEURS_CATEGORIE } from '../catalogue/couleurs'
import { requeteAppareil } from '../tablette/requetes'

/** Relue chaque minute : une rupture déclarée par le gérant grise la tuile sans recharger la caisse. */
const requeteCarteCaisse = {
  queryKey: ['caisse', 'carte'],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    appelerCaisse<LigneCarteEtablissement[]>('/caisse/carte', { signal }),
  refetchInterval: 60_000,
}

/**
 * Écran de caisse : la carte de l'établissement, par onglet de catégorie, au prix d'ici. Les tuiles
 * deviendront des actions avec la prise de commande ; la note en cours occupera le panneau de droite.
 */
export function EcranCaisse() {
  const { t } = useTranslation()
  const { data: appareil } = useQuery(requeteAppareil)
  // La garde de la route a déjà chargé l'appareil ; la devise ne manque qu'un instant au premier rendu.
  const devise = (appareil?.entreprise.devise ?? 'XOF') as Devise
  const carte = useQuery(requeteCarteCaisse)
  const [categorieId, setCategorieId] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')

  if (carte.isPending) return <Chargement texte={t('caisse.carte.chargement')} />
  if (carte.isError) {
    return (
      <AlerteErreur
        erreur={carte.error}
        action={
          <Bouton icone={RotateCw} onClick={() => void carte.refetch()}>
            {t('commun.reessayer')}
          </Bouton>
        }
      />
    )
  }
  if (carte.data.length === 0) {
    return (
      <section className="rounded-moyen border border-trait bg-surface p-6">
        <EtatVide niveauTitre={1} titre={t('caisse.vide.titre')} phrase={t('caisse.vide.phrase')} />
      </section>
    )
  }

  const categories = new Map<string, { nom: string; nombre: number }>()
  for (const ligne of carte.data) {
    const actuelle = categories.get(ligne.categorie.id)
    categories.set(ligne.categorie.id, {
      nom: ligne.categorie.nom,
      nombre: (actuelle?.nombre ?? 0) + 1,
    })
  }
  const motif = recherche.trim().toLowerCase()
  const visibles = carte.data.filter(
    (ligne) =>
      (categorieId === null || ligne.categorie.id === categorieId) &&
      (motif === '' || ligne.nom.toLowerCase().includes(motif)),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <nav
        aria-label={t('caisse.carte.categories')}
        className="flex shrink-0 gap-1 overflow-x-auto rounded-moyen border border-trait bg-surface p-2 md:w-rail-largeur md:flex-col md:overflow-y-auto"
      >
        <OngletCategorie
          actif={categorieId === null}
          libelle={t('caisse.carte.tout')}
          nombre={carte.data.length}
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
            className="m-0 grid list-none grid-cols-2 content-start gap-2.5 overflow-y-auto p-0 sm:grid-cols-3 lg:grid-cols-4"
          >
            {visibles.map((ligne) => (
              <Tuile key={ligne.produitId} ligne={ligne} devise={devise} />
            ))}
          </ul>
        )}
      </div>
      <aside className="hidden w-ticket-largeur shrink-0 flex-col rounded-moyen border border-trait bg-surface p-5 lg:flex">
        <EtatVide titre={t('caisse.note.titre')} phrase={t('caisse.note.phrase')} />
      </aside>
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

/** Tuile de produit ; la couleur de la catégorie n'est qu'un repère, le texte reste noir sur blanc. */
function Tuile({ ligne, devise }: Readonly<{ ligne: LigneCarteEtablissement; devise: Devise }>) {
  const { t } = useTranslation()
  return (
    <li
      aria-label={ligne.nom}
      className={clsx(
        'flex h-25 flex-col justify-between gap-2 rounded-normal border border-trait border-l-[5px] p-3 pl-3.5',
        COULEURS_CATEGORIE[ligne.categorie.couleur].bord,
        ligne.epuise ? 'bg-fond opacity-60' : 'bg-surface',
      )}
    >
      <span className="text-corps leading-tight text-encre">{ligne.nom}</span>
      <span className="flex items-end justify-between gap-1.5">
        <span className="chiffres text-montant-tuile text-encre">
          {formaterMontant({ unitesMineures: ligne.prix, devise }, { forme: 'nombre' })}
        </span>
        {ligne.epuise && <BadgeStatut ton="neutre">{t('caisse.carte.epuise')}</BadgeStatut>}
      </span>
    </li>
  )
}
