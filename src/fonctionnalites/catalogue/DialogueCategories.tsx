import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Pencil, Power } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { CategorieResume, CouleurCategorie, DemandeCategorie } from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { MenuActions } from '../../partage/ui/MenuActions'
import { usePiegeFocus } from '../../partage/ui/usePiegeFocus'
import { COULEURS_CATEGORIE, PALETTE } from './couleurs'
import { requeteCategories } from './requetes'

/**
 * Catégories de la carte : leur ordre est celui des onglets de la caisse, leur couleur repère les
 * produits sur les tuiles. Création et modification dans le même formulaire, sous la liste.
 */
export function DialogueCategories({ surFermer }: Readonly<{ surFermer: () => void }>) {
  const { t } = useTranslation()
  const id = useId()
  const cadre = useRef<HTMLElement>(null)
  const boutonFermer = useRef<HTMLButtonElement>(null)
  usePiegeFocus(cadre, boutonFermer, surFermer)
  const clientRequetes = useQueryClient()
  const requete = useQuery(requeteCategories)
  const [edition, setEdition] = useState<CategorieResume | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)

  async function agir(action: () => Promise<unknown>, categorie?: CategorieResume) {
    setErreur(null)
    try {
      await action()
      await clientRequetes.invalidateQueries({ queryKey: ['catalogue'] })
    } catch (refus) {
      // Refus attendu : il se dit avec le nom et le nombre de produits concernés.
      setErreur(
        categorie !== undefined && refus instanceof ErreurApi && refus.code === 'CATEGORIE_EN_USAGE'
          ? new Error(t('categories.enUsage', { nom: categorie.nom, count: categorie.nbProduits }))
          : refus,
      )
    }
  }

  function deplacer(categories: CategorieResume[], rang: number, pas: -1 | 1) {
    const ids = categories.map((categorie) => categorie.id)
    const [deplacee] = ids.splice(rang, 1)
    if (deplacee === undefined) return
    ids.splice(rang + pas, 0, deplacee)
    void agir(() => appelerApi('/categories/ordre', { methode: 'PUT', corps: { ids } }))
  }

  const categories = requete.data
  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-voile sm:items-center sm:p-4">
      <section
        ref={cadre}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titre`}
        aria-describedby={`${id}-phrase`}
        className="flex max-h-dvh w-full max-w-[760px] flex-col overflow-auto rounded-t-moyen bg-surface shadow-dialogue sm:rounded-moyen"
      >
        <div className="flex items-start gap-3 p-6 pb-3">
          <div className="flex-1">
            <h2 id={`${id}-titre`} className="m-0 text-titre-section text-encre">
              {t('categories.titre')}
            </h2>
            <p id={`${id}-phrase`} className="m-0 mt-1 text-corps text-attenue">
              {t('categories.phrase')}
            </p>
          </div>
          <Bouton ref={boutonFermer} onClick={surFermer}>
            {t('categories.fermer')}
          </Bouton>
        </div>
        {erreur !== null && (
          <div className="px-6 pb-3">
            {erreur instanceof Error && !(erreur instanceof ErreurApi) ? (
              <Alerte ton="danger">{erreur.message}</Alerte>
            ) : (
              <AlerteErreur erreur={erreur} />
            )}
          </div>
        )}
        {requete.isPending && (
          <div className="px-6">
            <Chargement texte={t('produits.chargement')} />
          </div>
        )}
        {categories !== undefined && categories.length > 0 && (
          <ol
            aria-label={t('categories.liste')}
            className="m-0 list-none border-t border-trait px-3 py-0"
          >
            {categories.map((categorie, rang) => (
              <li
                key={categorie.id}
                className="flex min-h-13 items-center gap-3 border-b border-trait px-3 py-1"
              >
                <span className="flex flex-col">
                  <button
                    type="button"
                    aria-label={t('categories.monter', { nom: categorie.nom })}
                    disabled={rang === 0}
                    className="flex h-6 w-8 items-center justify-center text-attenue disabled:opacity-30"
                    onClick={() => {
                      deplacer(categories, rang, -1)
                    }}
                  >
                    <ChevronUp aria-hidden="true" size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('categories.descendre', { nom: categorie.nom })}
                    disabled={rang === categories.length - 1}
                    className="flex h-6 w-8 items-center justify-center text-attenue disabled:opacity-30"
                    onClick={() => {
                      deplacer(categories, rang, 1)
                    }}
                  >
                    <ChevronDown aria-hidden="true" size={16} />
                  </button>
                </span>
                <CarreCategorie couleur={categorie.couleur} taille="grand" />
                <span className="flex-1 text-corps-fort text-encre">{categorie.nom}</span>
                {!categorie.active && (
                  <BadgeStatut ton="neutre">{t('categories.desactivee')}</BadgeStatut>
                )}
                <span className="text-legende text-attenue">
                  {t('categories.nbProduits', { count: categorie.nbProduits })}
                </span>
                <Bouton
                  icone={Pencil}
                  aria-label={t('categories.modifierNomme', { nom: categorie.nom })}
                  onClick={() => {
                    setEdition(categorie)
                  }}
                >
                  {t('categories.modifier')}
                </Bouton>
                <MenuActions
                  libelle={t('produits.plusDActions', { nom: categorie.nom })}
                  actions={[
                    {
                      libelle: categorie.active
                        ? t('categories.desactiver')
                        : t('categories.reactiver'),
                      icone: Power,
                      ...(categorie.active ? { ton: 'danger' as const } : {}),
                      surChoisir: () =>
                        void agir(
                          () =>
                            appelerApi(
                              `/categories/${categorie.id}/${categorie.active ? 'desactivation' : 'reactivation'}`,
                              { methode: 'POST' },
                            ),
                          categorie,
                        ),
                    },
                  ]}
                />
              </li>
            ))}
          </ol>
        )}
        <FormulaireCategorie
          key={edition?.id ?? 'nouvelle'}
          categorie={edition}
          surAnnuler={() => {
            setEdition(null)
          }}
          surEnregistre={() => {
            setEdition(null)
            void clientRequetes.invalidateQueries({ queryKey: ['catalogue'] })
          }}
        />
        <p className="m-0 px-6 pb-6 text-legende text-attenue">{t('categories.regle')}</p>
      </section>
    </div>
  )
}

function FormulaireCategorie({
  categorie,
  surAnnuler,
  surEnregistre,
}: Readonly<{
  categorie: CategorieResume | null
  surAnnuler: () => void
  surEnregistre: () => void
}>) {
  const { t } = useTranslation()
  const id = useId()
  const [nom, setNom] = useState(categorie?.nom ?? '')
  const [couleur, setCouleur] = useState<CouleurCategorie>(categorie?.couleur ?? 'OCRE')
  const [erreurNom, setErreurNom] = useState<string | undefined>(undefined)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  async function enregistrer() {
    if (nom.trim() === '') {
      setErreurNom(t('validation.obligatoire'))
      return
    }
    setErreurNom(undefined)
    setEnCours(true)
    setErreur(null)
    const corps: DemandeCategorie = {
      nom: nom.trim(),
      couleur,
      ...(categorie === null ? {} : { version: categorie.version }),
    }
    try {
      await appelerApi(categorie === null ? '/categories' : `/categories/${categorie.id}`, {
        methode: categorie === null ? 'POST' : 'PUT',
        corps,
      })
      setNom('')
      setEnCours(false)
      surEnregistre()
    } catch (refus) {
      setErreur(refus)
      setEnCours(false)
    }
  }

  const titre =
    categorie === null
      ? t('categories.nouvelle')
      : t('categories.modification', { nom: categorie.nom })
  return (
    <form
      aria-label={titre}
      noValidate
      onSubmit={(evenement) => {
        evenement.preventDefault()
        void enregistrer()
      }}
      className="m-6 mb-4 flex flex-col gap-4 rounded-moyen border border-trait bg-fond p-4"
    >
      <span className="text-corps-fort text-encre">{titre}</span>
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-60">
          <ChampSaisie
            libelle={t('categories.nom')}
            obligatoire
            maxLength={60}
            value={nom}
            erreur={erreurNom}
            onChange={(evenement) => {
              setNom(evenement.target.value)
            }}
          />
        </div>
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend id={`${id}-couleur`} className="mb-1.5 p-0 text-libelle text-encre">
            {t('categories.couleur')}
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {PALETTE.map((teinte) => (
              <label
                key={teinte}
                className="flex cursor-pointer flex-col items-center gap-1 text-legende text-attenue"
              >
                <input
                  type="radio"
                  name={`${id}-couleur`}
                  value={teinte}
                  checked={couleur === teinte}
                  onChange={() => {
                    setCouleur(teinte)
                  }}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={clsx(
                    'size-10 rounded-normal border peer-checked:outline-2 peer-checked:outline-offset-2 peer-checked:outline-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent-vif',
                    COULEURS_CATEGORIE[teinte].fond,
                    COULEURS_CATEGORIE[teinte].bord,
                  )}
                />
                {t(`couleurs.${teinte}`)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <div className="flex justify-end gap-2">
        {categorie !== null && <Bouton onClick={surAnnuler}>{t('categories.annuler')}</Bouton>}
        <Bouton variante="principal" type="submit" enCours={enCours}>
          {categorie === null ? t('categories.ajouter') : t('categories.enregistrer')}
        </Bouton>
      </div>
    </form>
  )
}

/** Repère de couleur d'une catégorie, jamais seul porteur d'information (le nom l'accompagne). */
export function CarreCategorie({
  couleur,
  taille = 'petit',
}: Readonly<{ couleur: CouleurCategorie; taille?: 'petit' | 'grand' }>) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'shrink-0 rounded-petit border',
        taille === 'petit' ? 'size-3' : 'size-4',
        COULEURS_CATEGORIE[couleur].fond,
        COULEURS_CATEGORIE[couleur].bord,
      )}
    />
  )
}
