import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  CategorieResume,
  DemandeProduit,
  ProduitResume,
  TaxeResume,
  TypeProduit,
} from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { useSession } from '../../partage/auth/useSession'
import { placerErreursServeur } from '../../partage/formulaires/erreursServeur'
import { messageErreur } from '../../partage/i18n/messageErreur'
import { formaterMontant, symboleDe, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { formaterTaux, taxeIncluse } from '../../partage/montants/taxes'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton, classesBouton } from '../../partage/ui/Bouton'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { COULEURS_CATEGORIE } from './couleurs'
import { requeteCategories, requeteProduit, requeteTaxes } from './requetes'

const TYPES: TypeProduit[] = ['PLAT', 'BOISSON', 'ARTICLE']
const CHAMPS = ['nom', 'categorieId', 'type', 'prix', 'taxeId'] as const

const schema = z.object({
  nom: z.string().trim().min(1, 'validation.obligatoire').max(100, 'validation.tropLong'),
  categorieId: z.string().min(1, 'validation.obligatoire'),
  type: z.enum(['PLAT', 'BOISSON', 'ARTICLE']),
  prix: z.string(),
  taxeId: z.string(),
  suiviStock: z.boolean(),
})

type Saisie = z.infer<typeof schema>

function valeursDe(
  produit: ProduitResume | undefined,
  devise: Devise,
  taxeParDefaut: string,
): Saisie {
  if (produit === undefined) {
    return {
      nom: '',
      categorieId: '',
      type: 'PLAT',
      prix: '',
      taxeId: taxeParDefaut,
      suiviStock: false,
    }
  }
  return {
    nom: produit.nom,
    categorieId: produit.categorie.id,
    type: produit.type,
    prix: formaterMontant({ unitesMineures: produit.prix, devise }, { forme: 'nombre' }),
    taxeId: produit.taxe?.id ?? '',
    suiviStock: produit.suiviStock,
  }
}

/** Création (sans identifiant) ou modification d'un produit de la carte. */
export function PageFicheProduit({ produitId }: Readonly<{ produitId?: string }>) {
  const { t } = useTranslation()
  const categories = useQuery(requeteCategories)
  const taxes = useQuery(requeteTaxes)
  const produit = useQuery({ ...requeteProduit(produitId ?? ''), enabled: produitId !== undefined })
  const pret =
    categories.data !== undefined &&
    taxes.data !== undefined &&
    (produitId === undefined || produit.data !== undefined)
  const erreur = categories.error ?? taxes.error ?? produit.error

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to="/gestion/produits"
          className="inline-flex min-h-cible-min items-center gap-1.5 text-libelle text-attenue"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          {t('produits.fiche.retour')}
        </Link>
        <h1 className="m-0 text-titre-page text-encre">
          {produitId === undefined || produit.data === undefined
            ? t('produits.fiche.titreCreation')
            : t('produits.fiche.titreModification', { nom: produit.data.nom })}
        </h1>
      </div>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      {!pret && erreur === null && <Chargement texte={t('produits.fiche.chargement')} />}
      {pret && (
        <FormulaireProduit
          categories={categories.data.filter(
            (categorie) => categorie.active || categorie.id === produit.data?.categorie.id,
          )}
          taxes={taxes.data.filter((taxe) => taxe.active || taxe.id === produit.data?.taxe?.id)}
          {...(produit.data === undefined ? {} : { produit: produit.data })}
        />
      )}
    </div>
  )
}

function FormulaireProduit({
  categories,
  taxes,
  produit,
}: Readonly<{ categories: CategorieResume[]; taxes: TaxeResume[]; produit?: ProduitResume }>) {
  const { t } = useTranslation()
  const idTitre = useId()
  const navigate = useNavigate()
  const clientRequetes = useQueryClient()
  const { moi, aLaPermission } = useSession()
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  // À la création, la taxe proposée d'office est la seule active s'il n'y en a qu'une (la TVA).
  const taxeParDefaut = taxes.length === 1 ? (taxes[0]?.id ?? '') : ''
  const [version, setVersion] = useState(produit?.version)
  const [conflit, setConflit] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  // Le suivi du stock suit le type tant que la personne ne l'a pas choisi elle-même.
  const [suiviChoisi, setSuiviChoisi] = useState(produit !== undefined)
  const peutChangerPrix = produit === undefined || aLaPermission('PRIX_MODIFIER')
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Saisie>({
    resolver: zodResolver(schema),
    defaultValues: valeursDe(produit, devise, taxeParDefaut),
  })
  const [prix, taxeId, categorieId, nom] = useWatch({
    control,
    name: ['prix', 'taxeId', 'categorieId', 'nom'],
  })
  const montant = lireMontant(prix, devise)
  const taxe = taxes.find((candidate) => candidate.id === taxeId)
  const categorie = categories.find((candidate) => candidate.id === categorieId)

  async function envoyer(saisie: Saisie) {
    const prixLu = lireMontant(saisie.prix, devise)
    if (prixLu === null || prixLu <= 0) {
      setError('prix', { type: 'validation', message: t('produits.fiche.prixInvalide') })
      return
    }
    setErreur(null)
    setConflit(false)
    const corps: DemandeProduit = {
      nom: saisie.nom,
      categorieId: saisie.categorieId,
      type: saisie.type,
      prix: prixLu,
      ...(saisie.taxeId === '' ? {} : { taxeId: saisie.taxeId }),
      suiviStock: saisie.suiviStock,
      ...(version === undefined ? {} : { version }),
    }
    try {
      const enregistre = await appelerApi<ProduitResume>(
        produit === undefined ? '/produits' : `/produits/${produit.id}`,
        { methode: produit === undefined ? 'POST' : 'PUT', corps },
      )
      await clientRequetes.invalidateQueries({ queryKey: ['catalogue'] })
      await navigate({ to: '/gestion/produits', search: { enregistre: enregistre.nom } })
    } catch (refus) {
      if (
        produit !== undefined &&
        refus instanceof ErreurApi &&
        refus.code === 'CONFLIT_MODIFICATION'
      ) {
        const frais = await clientRequetes.query({ ...requeteProduit(produit.id), staleTime: 0 })
        reset(valeursDe(frais, devise, ''))
        setVersion(frais.version)
        setConflit(true)
        return
      }
      const restants = placerErreursServeur(refus, setError, { champs: CHAMPS })
      const toutSousLesChamps =
        refus instanceof ErreurApi && refus.reponse.champs !== undefined && restants.length === 0
      if (!toutSousLesChamps) setErreur(refus)
    }
  }

  const message = (cle: string | undefined) => (cle === undefined ? undefined : t(cle))
  const titre =
    produit === undefined
      ? t('produits.fiche.titreCreation')
      : t('produits.fiche.titreModification', { nom: produit.nom })
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <form
        noValidate
        aria-labelledby={idTitre}
        onSubmit={(evenement) => void handleSubmit(envoyer)(evenement)}
        className="flex max-w-3xl flex-1 flex-col gap-5 rounded-moyen border border-trait bg-surface p-4 md:p-6"
      >
        <h2 id={idTitre} className="sr-only">
          {titre}
        </h2>
        {conflit && (
          <Alerte ton="alerte">
            {messageErreur(
              new ErreurApi({ statut: 409, code: 'CONFLIT_MODIFICATION', message: '' }),
            )}
          </Alerte>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <ChampSaisie
            libelle={t('produits.fiche.nom')}
            obligatoire
            maxLength={100}
            erreur={message(errors.nom?.message)}
            {...register('nom')}
          />
          <ChampSelection
            libelle={t('produits.fiche.categorie')}
            aide={t('produits.fiche.categorieAide')}
            obligatoire
            options={[
              { valeur: '', libelle: '' },
              ...categories.map((candidate) => ({ valeur: candidate.id, libelle: candidate.nom })),
            ]}
            erreur={message(errors.categorieId?.message)}
            {...register('categorieId')}
          />
        </div>
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 p-0 text-libelle text-encre">
            {t('produits.fiche.type')} <span className="text-danger">*</span>
          </legend>
          <div className="flex gap-2">
            {TYPES.map((type) => (
              <label key={type} className="flex-1">
                <input
                  type="radio"
                  value={type}
                  className="peer sr-only"
                  {...register('type', {
                    onChange: () => {
                      if (!suiviChoisi) setValue('suiviStock', type !== 'PLAT')
                    },
                  })}
                />
                <span className="flex min-h-cible-min cursor-pointer items-center justify-center rounded-normal border border-bordure-controle bg-surface text-corps-fort text-encre peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-texte peer-focus-visible:outline-2 peer-focus-visible:outline-accent-vif">
                  {t(`typesProduit.${type}`)}
                </span>
              </label>
            ))}
          </div>
          <span className="text-legende text-attenue">{t('produits.fiche.typeAide')}</span>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <ChampSaisie
            libelle={t('produits.fiche.prix')}
            aide={
              peutChangerPrix ? t('produits.fiche.prixAide') : t('produits.fiche.prixSansDroit')
            }
            obligatoire
            inputMode="decimal"
            suffixe={symboleDe(devise)}
            className="chiffres text-montant-ligne"
            disabled={!peutChangerPrix}
            erreur={message(errors.prix?.message)}
            {...register('prix')}
          />
          <ChampSelection
            libelle={t('produits.fiche.taxe')}
            aide={
              taxe !== undefined && montant !== null && montant > 0
                ? t('produits.fiche.dontTaxe', {
                    taxe: taxe.nom,
                    montant: formaterMontant(
                      { unitesMineures: taxeIncluse(montant, taxe.tauxPointsDeBase), devise },
                      { forme: 'courte' },
                    ),
                  })
                : undefined
            }
            options={[
              { valeur: '', libelle: t('produits.aucuneTaxe') },
              ...taxes.map((candidate) => ({
                valeur: candidate.id,
                libelle: `${candidate.nom} ${formaterTaux(candidate.tauxPointsDeBase)}`,
              })),
            ]}
            erreur={message(errors.taxeId?.message)}
            {...register('taxeId')}
          />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-normal border border-trait p-3.5">
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-accent"
            {...register('suiviStock', {
              onChange: () => {
                setSuiviChoisi(true)
              },
            })}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-corps-fort text-encre">{t('produits.fiche.suiviStock')}</span>
            <span className="text-legende text-attenue">{t('produits.fiche.suiviStockAide')}</span>
          </span>
        </label>
        {erreur !== null && <AlerteErreur erreur={erreur} />}
        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/gestion/produits" className={classesBouton('secondaire')}>
            {t('commun.annuler')}
          </Link>
          <Bouton variante="principal" type="submit" enCours={isSubmitting}>
            {produit === undefined
              ? t('produits.fiche.enregistrerCreation')
              : t('produits.fiche.enregistrerModification')}
          </Bouton>
        </div>
      </form>
      <aside className="flex w-full flex-col gap-3 lg:w-75">
        <span className="text-libelle font-semibold text-attenue">
          {t('produits.fiche.apercu')}
        </span>
        <div
          aria-hidden="true"
          className={clsx(
            'flex h-25 flex-col justify-between rounded-normal border border-trait border-l-[5px] bg-surface p-3 pl-4',
            categorie === undefined ? 'border-l-trait' : COULEURS_CATEGORIE[categorie.couleur].bord,
          )}
        >
          <span className="text-corps text-encre">{nom === '' ? '—' : nom}</span>
          <span className="chiffres text-montant-tuile text-encre">
            {montant === null
              ? ''
              : formaterMontant({ unitesMineures: montant, devise }, { forme: 'nombre' })}
          </span>
        </div>
        <p className="m-0 rounded-moyen border border-trait bg-surface p-3 text-legende text-attenue">
          {t('produits.fiche.traceNote')}
        </p>
      </aside>
    </div>
  )
}
