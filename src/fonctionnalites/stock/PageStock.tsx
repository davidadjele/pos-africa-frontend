import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ClipboardList, History, PackagePlus, RotateCw, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EtablissementResume, EtatStock, LigneStock } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterDateHeure } from '../../partage/dates/formaterDate'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton, classesBouton } from '../../partage/ui/Bouton'
import { ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions, type ActionMenu } from '../../partage/ui/MenuActions'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { requeteEtablissements } from '../etablissements/requetes'
import { DialogueHistorique, DialoguePerte, DialogueSeuil } from './DialoguesStock'
import { estATraiter, libelleMouvement, quantiteSignee, rangStock, TONS_ETAT } from './presentation'
import { requeteStock, requeteStockATraiter } from './requetes'

type Filtre = 'tous' | 'aTraiter' | 'aCompter'
type Ouvert =
  | { type: 'perte' }
  | { type: 'seuil'; ligne: LigneStock }
  | { type: 'historique'; ligne: LigneStock }
  | null

/** L'établissement choisi : celui de l'adresse, sinon le premier visible. */
export function useEtablissementDuStock(etablissementId: string | undefined) {
  const etablissements = useQuery(requeteEtablissements(0))
  const etablissement: EtablissementResume | undefined =
    etablissements.data?.elements.find((candidat) => candidat.id === etablissementId) ??
    etablissements.data?.elements[0]
  return { etablissements, etablissement }
}

/**
 * Le stock d'un établissement : ce qui est à traiter d'abord (négatif, rupture, sous le seuil), puis ce qui reste à
 * compter. Réception, perte et inventaire selon les droits de chacun.
 */
export function PageStock({
  etablissement: etablissementId,
  fait,
}: Readonly<{ etablissement?: string; fait?: string }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const naviguer = useNavigate()
  const { aLaPermission } = useSession()
  const { etablissements, etablissement } = useEtablissementDuStock(etablissementId)
  const stock = useQuery({
    ...requeteStock(etablissement?.id ?? ''),
    enabled: etablissement !== undefined,
  })
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<Ouvert>(null)
  const [confirmation, setConfirmation] = useState<string | null>(fait ?? null)
  const peutAjuster = aLaPermission('STOCK_AJUSTER')

  function apresAction(nouvel: EtatStock, message: string) {
    if (etablissement === undefined) return
    clientRequetes.setQueryData(requeteStock(etablissement.id).queryKey, nouvel)
    void clientRequetes.invalidateQueries({ queryKey: requeteStockATraiter.queryKey })
    setOuvert(null)
    setConfirmation(message)
  }

  const colonnes: ColonneTableau<LigneStock>[] = [
    {
      cle: 'produit',
      entete: t('stock.colonnes.produit'),
      rendu: (ligne) => (
        <>
          <span className="block font-semibold">{ligne.nom}</span>
          <span className="block text-legende text-attenue">{ligne.categorie}</span>
          {/* Sur téléphone, la colonne « État » est masquée : l'état passe sous le produit. */}
          <span className="mt-1 block md:hidden">
            <BadgeStatut ton={TONS_ETAT[ligne.etat]}>{t(`stock.etats.${ligne.etat}`)}</BadgeStatut>
          </span>
        </>
      ),
    },
    {
      cle: 'quantite',
      entete: t('stock.colonnes.quantite'),
      rendu: (ligne) =>
        ligne.quantite === undefined ? (
          <span className="text-legende text-attenue">{t('stock.nonCompte')}</span>
        ) : (
          <span className="flex items-baseline gap-1.5">
            <span
              className={clsx(
                'chiffres text-montant-ligne',
                ligne.quantite < 0 ? 'text-danger' : 'text-encre',
              )}
            >
              {quantiteSignee(ligne.quantite)}
            </span>
            {ligne.seuil > 0 && (
              <span className="text-legende text-attenue">
                {t('stock.seuilCourt', { seuil: ligne.seuil })}
              </span>
            )}
          </span>
        ),
    },
    {
      cle: 'etat',
      entete: t('stock.colonnes.etat'),
      masqueeSurTelephone: true,
      rendu: (ligne) => (
        <BadgeStatut ton={TONS_ETAT[ligne.etat]}>{t(`stock.etats.${ligne.etat}`)}</BadgeStatut>
      ),
    },
    {
      cle: 'mouvement',
      entete: t('stock.colonnes.mouvement'),
      masqueeSurTelephone: true,
      rendu: (ligne) =>
        ligne.dernierMouvement === undefined || etablissement === undefined ? (
          <span className="text-legende text-attenue">{t('stock.aucunMouvement')}</span>
        ) : (
          <span className="flex flex-col">
            <span className="text-corps text-encre">
              {libelleMouvement(ligne.dernierMouvement, t)}
            </span>
            <span className="text-legende text-attenue">
              {formaterDateHeure(ligne.dernierMouvement.le, etablissement.fuseauHoraire)}
            </span>
          </span>
        ),
    },
    {
      cle: 'actions',
      entete: t('stock.colonnes.actions'),
      rendu: (ligne) => {
        const actions: ActionMenu[] = [
          {
            libelle: t('stock.historique.action'),
            icone: History,
            surChoisir: () => {
              setOuvert({ type: 'historique', ligne })
            },
          },
        ]
        if (peutAjuster) {
          actions.push({
            libelle: t('stock.seuil.action'),
            icone: SlidersHorizontal,
            surChoisir: () => {
              setOuvert({ type: 'seuil', ligne })
            },
          })
        }
        return (
          <div className="flex justify-end">
            <MenuActions libelle={t('stock.plusDActions', { nom: ligne.nom })} actions={actions} />
          </div>
        )
      },
    },
  ]

  const lignes = stock.data?.lignes ?? []
  const motif = recherche.trim().toLowerCase()
  const visibles = lignes
    .map((ligne, ordre) => ({ ligne, ordre }))
    .filter(({ ligne }) => motif === '' || ligne.nom.toLowerCase().includes(motif))
    .filter(
      ({ ligne }) =>
        filtre === 'tous' ||
        (filtre === 'aTraiter' ? estATraiter(ligne.etat) : ligne.etat === 'A_COMPTER'),
    )
    .sort((a, b) => rangStock(a.ligne.etat) - rangStock(b.ligne.etat) || a.ordre - b.ordre)
    .map(({ ligne }) => ligne)
  const nombres: Record<Filtre, number> = {
    tous: lignes.length,
    aTraiter: lignes.filter((ligne) => estATraiter(ligne.etat)).length,
    aCompter: lignes.filter((ligne) => ligne.etat === 'A_COMPTER').length,
  }
  const recherchePage = etablissement === undefined ? {} : { etablissement: etablissement.id }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="m-0 text-titre-page text-encre">{t('stock.titre')}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('stock.phrase')}</p>
        </div>
        {etablissement !== undefined && (
          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {peutAjuster && (
              <Link
                to="/gestion/stock/inventaire"
                search={recherchePage}
                className={clsx(classesBouton('secondaire'), 'gap-2')}
              >
                <ClipboardList aria-hidden="true" size={18} />
                {t('stock.inventaire.action')}
              </Link>
            )}
            {peutAjuster && (
              <Bouton
                onClick={() => {
                  setOuvert({ type: 'perte' })
                }}
              >
                {t('stock.perte.action')}
              </Bouton>
            )}
            {aLaPermission('STOCK_RECEPTIONNER') && (
              <Link
                to="/gestion/stock/reception"
                search={recherchePage}
                className={clsx(classesBouton('principal'), 'gap-2')}
              >
                <PackagePlus aria-hidden="true" size={18} />
                {t('stock.reception.action')}
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {etablissements.data !== undefined && etablissements.data.elements.length > 1 && (
          <div className="w-60">
            <ChampSelection
              libelle={t('stock.etablissement')}
              options={etablissements.data.elements.map((candidat) => ({
                valeur: candidat.id,
                libelle: candidat.nom,
              }))}
              value={etablissement?.id ?? ''}
              onChange={(evenement) => {
                setConfirmation(null)
                void naviguer({
                  to: '/gestion/stock',
                  search: { etablissement: evenement.target.value },
                })
              }}
            />
          </div>
        )}
        {stock.data !== undefined && etablissement !== undefined && (
          <p className="m-0 text-legende text-attenue">
            {t('stock.politique', {
              etablissement: etablissement.nom,
              politique: t(`stock.politiques.${stock.data.politique}`),
            })}
          </p>
        )}
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
      {(etablissements.isError || stock.isError) && (
        <AlerteErreur
          erreur={etablissements.error ?? stock.error}
          action={
            <Bouton
              icone={RotateCw}
              onClick={() => {
                void etablissements.refetch()
                void stock.refetch()
              }}
            >
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {(etablissements.isPending || (etablissement !== undefined && stock.isPending)) && (
        <Chargement texte={t('stock.chargement')} />
      )}
      {stock.data?.lignes.length === 0 && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide titre={t('stock.vide.titre')} phrase={t('stock.vide.phrase')} />
        </section>
      )}
      {stock.data !== undefined && stock.data.lignes.length > 0 && etablissement !== undefined && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(['tous', 'aTraiter', 'aCompter'] as const).map((candidat) => (
              <button
                key={candidat}
                type="button"
                aria-pressed={filtre === candidat}
                onClick={() => {
                  setFiltre(candidat)
                }}
                className={clsx(
                  'flex min-h-cible-min items-center gap-1.5 rounded-normal px-3 text-libelle font-bold',
                  filtre === candidat
                    ? 'border border-accent bg-accent text-accent-texte'
                    : 'border border-trait bg-surface text-encre',
                )}
              >
                {t(`stock.filtres.${candidat}`)}
                <span className="chiffres opacity-70">{nombres[candidat]}</span>
              </button>
            ))}
            <span className="flex-1" />
            <input
              type="search"
              aria-label={t('stock.rechercher')}
              placeholder={t('stock.rechercher')}
              value={recherche}
              onChange={(evenement) => {
                setRecherche(evenement.target.value)
              }}
              className="min-h-cible-min w-full rounded-normal border border-bordure-controle bg-surface px-3 text-corps text-encre sm:w-64"
            />
          </div>
          <Tableau
            libelle={t('stock.tableau', { etablissement: etablissement.nom })}
            colonnes={colonnes}
            lignes={visibles}
            cleLigne={(ligne) => ligne.produitId}
          />
        </>
      )}

      {etablissement !== undefined && ouvert?.type === 'perte' && (
        <DialoguePerte
          etablissementId={etablissement.id}
          lignes={lignes}
          surFermer={() => {
            setOuvert(null)
          }}
          surFait={apresAction}
        />
      )}
      {etablissement !== undefined && ouvert?.type === 'seuil' && (
        <DialogueSeuil
          etablissementId={etablissement.id}
          ligne={ouvert.ligne}
          surFermer={() => {
            setOuvert(null)
          }}
          surFait={apresAction}
        />
      )}
      {etablissement !== undefined && ouvert?.type === 'historique' && (
        <DialogueHistorique
          etablissementId={etablissement.id}
          fuseauHoraire={etablissement.fuseauHoraire}
          ligne={ouvert.ligne}
          surFermer={() => {
            setOuvert(null)
          }}
        />
      )}
    </div>
  )
}
