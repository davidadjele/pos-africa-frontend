import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { DemandeReceptionStock, EtatStock, LigneStock } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { symboleDe, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton, classesBouton } from '../../partage/ui/Bouton'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { lireQuantite } from './DialoguesStock'
import { useEtablissementDuStock } from './PageStock'
import { requeteStock, requeteStockATraiter } from './requetes'

interface LigneSaisie {
  produit: LigneStock
  quantite: string
  cout: string
}

/** Une livraison de plusieurs produits ; le coût d'achat, facultatif, servira à la marge des rapports. */
export function PageReceptionStock({ etablissementId }: Readonly<{ etablissementId?: string }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const naviguer = useNavigate()
  const { moi } = useSession()
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const { etablissements, etablissement } = useEtablissementDuStock(etablissementId)
  const stock = useQuery({
    ...requeteStock(etablissement?.id ?? ''),
    enabled: etablissement !== undefined,
  })
  const [lignes, setLignes] = useState<LigneSaisie[]>([])
  const [reference, setReference] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  const valides = lignes.filter((ligne) => (lireQuantite(ligne.quantite) ?? 0) > 0)
  const unites = valides.reduce((somme, ligne) => somme + (lireQuantite(ligne.quantite) ?? 0), 0)
  // « 1 produit, 6 unités », « 2 produits, 72 unités » : chaque nombre accorde son nom.
  const resume = {
    produits: t('stock.reception.produits', { count: valides.length }),
    unites: t('stock.reception.unites', { count: unites }),
  }
  const restants = (stock.data?.lignes ?? []).filter(
    (candidat) => !lignes.some((ligne) => ligne.produit.produitId === candidat.produitId),
  )

  function changer(produitId: string, modification: Partial<LigneSaisie>) {
    setLignes((actuelles) =>
      actuelles.map((ligne) =>
        ligne.produit.produitId === produitId ? { ...ligne, ...modification } : ligne,
      ),
    )
  }

  async function enregistrer() {
    if (etablissement === undefined || valides.length === 0) return
    setEnCours(true)
    setErreur(null)
    const demande: DemandeReceptionStock = {
      ...(reference.trim() === '' ? {} : { reference: reference.trim() }),
      lignes: valides.map((ligne) => {
        const cout = ligne.cout.trim() === '' ? null : lireMontant(ligne.cout, devise)
        return {
          produitId: ligne.produit.produitId,
          quantite: lireQuantite(ligne.quantite) ?? 0,
          ...(cout === null ? {} : { coutUnitaire: cout }),
        }
      }),
    }
    try {
      const nouvel = await appelerApi<EtatStock>(
        `/etablissements/${etablissement.id}/stock/receptions`,
        { methode: 'POST', corps: demande },
      )
      clientRequetes.setQueryData(requeteStock(etablissement.id).queryKey, nouvel)
      void clientRequetes.invalidateQueries({ queryKey: requeteStockATraiter.queryKey })
      void naviguer({
        to: '/gestion/stock',
        search: {
          etablissement: etablissement.id,
          fait: t('stock.reception.fait', resume),
        },
      })
    } catch (echec) {
      setErreur(echec)
    } finally {
      setEnCours(false)
    }
  }

  if (etablissements.isPending || (etablissement !== undefined && stock.isPending)) {
    return <Chargement texte={t('stock.chargement')} />
  }
  if (etablissements.isError || stock.isError) {
    return <AlerteErreur erreur={etablissements.error ?? stock.error} />
  }
  if (etablissement === undefined) return null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-titre-page text-encre">{t('stock.reception.titre')}</h1>
        <p className="m-0 mt-1 text-corps text-attenue">
          {t('stock.reception.phrase', { etablissement: etablissement.nom })}
        </p>
      </div>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      <section className="flex flex-col rounded-moyen border border-trait bg-surface">
        <div className="grid gap-3 border-b border-trait p-4 sm:grid-cols-[minmax(0,1fr)_240px]">
          <ChampSelection
            libelle={t('stock.reception.ajouter')}
            options={[
              { valeur: '', libelle: t('stock.reception.choisir') },
              ...restants.map((candidat) => ({
                valeur: candidat.produitId,
                libelle: candidat.nom,
              })),
            ]}
            value=""
            onChange={(evenement) => {
              const produit = restants.find(
                (candidat) => candidat.produitId === evenement.target.value,
              )
              if (produit !== undefined) {
                setLignes((actuelles) => [...actuelles, { produit, quantite: '', cout: '' }])
              }
            }}
          />
          <ChampSaisie
            libelle={t('stock.reception.reference')}
            maxLength={60}
            value={reference}
            onChange={(evenement) => {
              setReference(evenement.target.value)
            }}
          />
        </div>
        {lignes.length === 0 ? (
          <p className="m-0 p-4 text-corps text-attenue">{t('stock.reception.aucune')}</p>
        ) : (
          <ul aria-label={t('stock.reception.liste')} className="m-0 list-none p-0">
            {lignes.map((ligne) => (
              <li
                key={ligne.produit.produitId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-trait p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_140px_180px_auto]"
              >
                <span className="col-span-2 flex flex-col self-center sm:col-span-1">
                  <span className="text-corps-fort text-encre">{ligne.produit.nom}</span>
                  <span className="text-legende text-attenue">{ligne.produit.categorie}</span>
                </span>
                <ChampSaisie
                  libelle={t('stock.reception.quantite')}
                  aria-label={t('stock.reception.quantiteDe', { nom: ligne.produit.nom })}
                  inputMode="numeric"
                  value={ligne.quantite}
                  onChange={(evenement) => {
                    changer(ligne.produit.produitId, {
                      quantite: evenement.target.value.replace(/\D/gu, ''),
                    })
                  }}
                />
                <ChampSaisie
                  libelle={t('stock.reception.cout')}
                  aria-label={t('stock.reception.coutDe', { nom: ligne.produit.nom })}
                  inputMode="numeric"
                  suffixe={symboleDe(devise)}
                  value={ligne.cout}
                  onChange={(evenement) => {
                    changer(ligne.produit.produitId, { cout: evenement.target.value })
                  }}
                />
                <Bouton
                  icone={X}
                  aria-label={t('stock.reception.retirer', { nom: ligne.produit.nom })}
                  onClick={() => {
                    setLignes((actuelles) =>
                      actuelles.filter(
                        (autre) => autre.produit.produitId !== ligne.produit.produitId,
                      ),
                    )
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-trait p-4">
          <span className="min-w-0 flex-1 text-legende text-attenue">
            {t('stock.reception.aide')}
          </span>
          <Link
            to="/gestion/stock"
            search={{ etablissement: etablissement.id }}
            className={classesBouton('secondaire')}
          >
            {t('commun.annuler')}
          </Link>
          <Bouton
            variante="principal"
            disabled={valides.length === 0}
            enCours={enCours}
            onClick={() => void enregistrer()}
          >
            {valides.length === 0
              ? t('stock.reception.enregistrerSans')
              : t('stock.reception.enregistrer', resume)}
          </Bouton>
        </div>
      </section>
    </div>
  )
}
