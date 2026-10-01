import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DemandeInventaire,
  EcartInventaire,
  EtatStock,
  MotifStock,
} from '../../partage/api/contrat'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton, classesBouton } from '../../partage/ui/Bouton'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { lireQuantite } from './DialoguesStock'
import { useEtablissementDuStock } from './PageStock'
import { quantiteSignee } from './presentation'
import { requeteStock, requeteStockATraiter } from './requetes'

const MOTIFS_ECART: MotifStock[] = [
  'CASSE',
  'VOL',
  'ERREUR_SAISIE',
  'LIVRAISON_NON_SAISIE',
  'AUTRE',
]

interface Justification {
  motif: MotifStock | ''
  detail: string
}

/**
 * Inventaire en deux temps, comme la clôture de caisse : on compte sans voir le stock enregistré, puis on justifie
 * chaque écart. Un produit laissé vide n'est pas compté et garde son stock.
 */
export function PageInventaireStock({ etablissementId }: Readonly<{ etablissementId?: string }>) {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const naviguer = useNavigate()
  const { etablissements, etablissement } = useEtablissementDuStock(etablissementId)
  const stock = useQuery({
    ...requeteStock(etablissement?.id ?? ''),
    enabled: etablissement !== undefined,
  })
  const [comptes, setComptes] = useState<Record<string, string>>({})
  const [ecarts, setEcarts] = useState<EcartInventaire[] | null>(null)
  const [justifications, setJustifications] = useState<Record<string, Justification>>({})
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)

  const lignesComptees = (stock.data?.lignes ?? []).flatMap((ligne) => {
    const compte = lireQuantite(comptes[ligne.produitId] ?? '')
    return compte === null ? [] : [{ produitId: ligne.produitId, compte }]
  })
  const aJustifier = (ecarts ?? []).filter((ecart) => !ecart.initial && ecart.ecart !== 0)
  const manquants = aJustifier.filter((ecart) => {
    const justification = justifications[ecart.produitId]
    return (
      justification === undefined ||
      justification.motif === '' ||
      (justification.motif === 'AUTRE' && justification.detail.trim() === '')
    )
  })

  async function envoyer<T>(chemin: string, demande: DemandeInventaire): Promise<T | null> {
    if (etablissement === undefined) return null
    setEnCours(true)
    setErreur(null)
    try {
      return await appelerApi<T>(`/etablissements/${etablissement.id}/stock/${chemin}`, {
        methode: 'POST',
        corps: demande,
      })
    } catch (echec) {
      setErreur(echec)
      return null
    } finally {
      setEnCours(false)
    }
  }

  async function valider() {
    if (etablissement === undefined || ecarts === null || manquants.length > 0) return
    const nouvel = await envoyer<EtatStock>('inventaires', {
      lignes: lignesComptees.map((ligne) => {
        const justification = justifications[ligne.produitId]
        const motif = justification?.motif ?? ''
        return {
          ...ligne,
          ...(motif === '' ? {} : { motif }),
          ...(motif === 'AUTRE' && justification !== undefined
            ? { detail: justification.detail.trim() }
            : {}),
        }
      }),
    })
    if (nouvel === null) return
    clientRequetes.setQueryData(requeteStock(etablissement.id).queryKey, nouvel)
    void clientRequetes.invalidateQueries({ queryKey: requeteStockATraiter.queryKey })
    const premiers = ecarts.filter((ecart) => ecart.initial).length
    const parties = [
      ...(aJustifier.length > 0
        ? [t('stock.inventaire.ecarts', { count: aJustifier.length })]
        : []),
      ...(premiers > 0 ? [t('stock.inventaire.premiers', { count: premiers })] : []),
    ]
    void naviguer({
      to: '/gestion/stock',
      search: {
        etablissement: etablissement.id,
        fait: t('stock.inventaire.fait', {
          resume: parties.length === 0 ? t('stock.inventaire.toutJuste') : parties.join(', '),
        }),
      },
    })
  }

  if (etablissements.isPending || (etablissement !== undefined && stock.isPending)) {
    return <Chargement texte={t('stock.chargement')} />
  }
  if (etablissements.isError || stock.isError) {
    return <AlerteErreur erreur={etablissements.error ?? stock.error} />
  }
  if (etablissement === undefined) return null

  const colonnes: ColonneTableau<EcartInventaire>[] = [
    {
      cle: 'produit',
      entete: t('stock.colonnes.produit'),
      rendu: (ecart) => <span className="font-semibold">{ecart.nom}</span>,
    },
    {
      cle: 'attendu',
      entete: t('stock.inventaire.attendu'),
      numerique: true,
      rendu: (ecart) =>
        ecart.attendu === undefined ? (
          ''
        ) : (
          <span className="chiffres">{quantiteSignee(ecart.attendu)}</span>
        ),
    },
    {
      cle: 'compte',
      entete: t('stock.inventaire.compte'),
      numerique: true,
      rendu: (ecart) => <span className="chiffres">{ecart.compte}</span>,
    },
    {
      cle: 'ecart',
      entete: t('stock.inventaire.ecart'),
      rendu: (ecart) =>
        ecart.ecart === undefined ? (
          <BadgeStatut ton="info">{t('stock.inventaire.premier')}</BadgeStatut>
        ) : ecart.ecart === 0 ? (
          <BadgeStatut ton="succes">{t('stock.inventaire.juste')}</BadgeStatut>
        ) : (
          <BadgeStatut ton={ecart.ecart < 0 ? 'danger' : 'info'}>
            {quantiteSignee(ecart.ecart, true)}
          </BadgeStatut>
        ),
    },
    {
      cle: 'motif',
      entete: t('stock.inventaire.motif'),
      rendu: (ecart) => {
        if (ecart.initial || ecart.ecart === 0) {
          return <span className="text-legende text-attenue">{t('stock.inventaire.rien')}</span>
        }
        const justification = justifications[ecart.produitId] ?? { motif: '', detail: '' }
        const changer = (modification: Partial<Justification>) => {
          setJustifications((actuelles) => ({
            ...actuelles,
            [ecart.produitId]: { ...justification, ...modification },
          }))
        }
        return (
          <div className="flex min-w-48 flex-col gap-2">
            <ChampSelection
              libelle={t('stock.inventaire.motifDe', { nom: ecart.nom })}
              libelleMasque
              options={[
                { valeur: '', libelle: t('stock.inventaire.choisirMotif') },
                ...MOTIFS_ECART.map((motif) => ({
                  valeur: motif,
                  libelle: t(`stock.motifs.${motif}`),
                })),
              ]}
              value={justification.motif}
              onChange={(evenement) => {
                changer({ motif: evenement.target.value as MotifStock | '' })
              }}
            />
            {justification.motif === 'AUTRE' && (
              <ChampSaisie
                libelle={t('stock.inventaire.detailDe', { nom: ecart.nom })}
                libelleMasque
                placeholder={t('stock.perte.detail')}
                maxLength={120}
                value={justification.detail}
                onChange={(evenement) => {
                  changer({ detail: evenement.target.value })
                }}
              />
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-titre-page text-encre">
          {t('stock.inventaire.titre', { etablissement: etablissement.nom })}
        </h1>
        <p className="m-0 mt-1 text-corps text-attenue">
          {ecarts === null ? t('stock.inventaire.etape1') : t('stock.inventaire.etape2')}
        </p>
      </div>
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      {ecarts === null ? (
        <section className="flex flex-col rounded-moyen border border-trait bg-surface">
          <ul
            aria-label={t('stock.inventaire.liste')}
            className="m-0 grid list-none gap-x-8 p-0 px-4 lg:grid-cols-2"
          >
            {(stock.data?.lignes ?? []).map((ligne) => (
              <li
                key={ligne.produitId}
                className="flex items-center gap-3 border-b border-trait py-2.5"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-corps-fort text-encre">{ligne.nom}</span>
                  <span className="text-legende text-attenue">{ligne.categorie}</span>
                </span>
                <div className="w-28">
                  <ChampSaisie
                    libelle={t('stock.inventaire.compteDe', { nom: ligne.nom })}
                    libelleMasque
                    inputMode="numeric"
                    placeholder="—"
                    value={comptes[ligne.produitId] ?? ''}
                    onChange={(evenement) => {
                      setComptes((actuels) => ({
                        ...actuels,
                        [ligne.produitId]: evenement.target.value.replace(/\D/gu, ''),
                      }))
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-3 p-4">
            <span className="min-w-0 flex-1 text-legende text-attenue">
              {t('stock.inventaire.comptes', { count: lignesComptees.length })}
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
              disabled={lignesComptees.length === 0}
              enCours={enCours}
              onClick={() =>
                void envoyer<EcartInventaire[]>('inventaires/ecarts', {
                  lignes: lignesComptees,
                }).then((reponse) => {
                  if (reponse !== null) setEcarts(reponse)
                })
              }
            >
              {t('stock.inventaire.voirEcarts')}
            </Bouton>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <Tableau
            libelle={t('stock.inventaire.tableau')}
            colonnes={colonnes}
            lignes={ecarts}
            cleLigne={(ecart) => ecart.produitId}
          />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="min-w-0 flex-1 text-legende text-attenue">
              {manquants.length > 0
                ? t('stock.inventaire.pourValider', {
                    liste: manquants.map((ecart) => ecart.nom).join(', '),
                  })
                : t('stock.inventaire.trace')}
            </span>
            <Bouton
              onClick={() => {
                setEcarts(null)
              }}
            >
              {t('stock.inventaire.recompter')}
            </Bouton>
            <Bouton
              variante="principal"
              disabled={manquants.length > 0}
              enCours={enCours}
              onClick={() => void valider()}
            >
              {t('stock.inventaire.valider')}
            </Bouton>
          </div>
        </section>
      )}
    </div>
  )
}
