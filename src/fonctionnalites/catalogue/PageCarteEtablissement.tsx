import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, EyeOff, RotateCw, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type {
  DemandePrixEtablissement,
  EtablissementResume,
  LigneCarteEtablissement,
} from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterHeure } from '../../partage/dates/formaterDate'
import { formaterMontant, symboleDe, type Devise } from '../../partage/montants/formaterMontant'
import { lireMontant } from '../../partage/montants/lireMontant'
import { taxeIncluse } from '../../partage/montants/taxes'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut, type TonStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie, ChampSelection } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions, type ActionMenu } from '../../partage/ui/MenuActions'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { requeteEtablissements } from '../etablissements/requetes'
import { CarreCategorie } from './DialogueCategories'

function requeteCarte(etablissementId: string) {
  return {
    queryKey: ['catalogue', 'carte-etablissement', etablissementId],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      appelerApi<LigneCarteEtablissement[]>(`/etablissements/${etablissementId}/carte`, {
        signal,
      }),
  }
}

/** À traiter en tête : les ruptures, puis la carte dans l'ordre de la caisse, puis ce qui n'est pas proposé. */
function rang(ligne: LigneCarteEtablissement): number {
  if (!ligne.propose) return 2
  return ligne.epuise ? 0 : 1
}

/**
 * Carte d'un établissement : prix propre (propriétaire, administrateur), produit non proposé ici, et
 * rupture du jour, que le gérant déclare sur place.
 */
type Disponibilite = 'nonPropose' | 'epuise' | 'disponible'

const TONS_DISPONIBILITE: Record<Disponibilite, TonStatut> = {
  nonPropose: 'neutre',
  epuise: 'alerte',
  disponible: 'succes',
}

function etatDisponibilite(
  ligne: Pick<LigneCarteEtablissement, 'propose' | 'epuise'>,
): Disponibilite {
  if (!ligne.propose) return 'nonPropose'
  return ligne.epuise ? 'epuise' : 'disponible'
}

export function PageCarteEtablissement() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { moi, aLaPermission } = useSession()
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const etablissements = useQuery(requeteEtablissements(0))
  const [choisi, setChoisi] = useState<string | null>(null)
  const etablissement =
    etablissements.data?.elements.find((candidat) => candidat.id === choisi) ??
    etablissements.data?.elements[0]
  const carte = useQuery({
    ...requeteCarte(etablissement?.id ?? ''),
    enabled: etablissement !== undefined,
  })
  const [recherche, setRecherche] = useState('')
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [prixEnCours, setPrixEnCours] = useState<LigneCarteEtablissement | null>(null)

  async function agir(chemin: string, methode: 'POST' | 'DELETE', message: string) {
    if (etablissement === undefined) return
    setErreur(null)
    try {
      await appelerApi(`/etablissements/${etablissement.id}/carte/${chemin}`, { methode })
      setConfirmation(message)
      await clientRequetes.invalidateQueries({ queryKey: ['catalogue', 'carte-etablissement'] })
    } catch (refus) {
      setErreur(refus)
    }
  }

  function montant(unitesMineures: number) {
    return formaterMontant({ unitesMineures, devise }, { forme: 'courte' })
  }

  function actionPrincipale(ligne: LigneCarteEtablissement) {
    if (!ligne.propose) {
      return aLaPermission('CATALOGUE_GERER') ? (
        <Bouton
          aria-label={t('carteEtablissement.proposerNomme', { nom: ligne.nom })}
          onClick={() =>
            void agir(
              `${ligne.produitId}/proposition`,
              'POST',
              t('carteEtablissement.fait.propose', { nom: ligne.nom }),
            )
          }
        >
          {t('carteEtablissement.proposer')}
        </Bouton>
      ) : null
    }
    if (!aLaPermission('DISPONIBILITE_GERER')) return null
    return ligne.epuise ? (
      <Bouton
        aria-label={t('carteEtablissement.remettreNomme', { nom: ligne.nom })}
        onClick={() =>
          void agir(
            `${ligne.produitId}/rupture`,
            'DELETE',
            t('carteEtablissement.fait.remis', { nom: ligne.nom }),
          )
        }
      >
        {t('carteEtablissement.remettre')}
      </Bouton>
    ) : (
      <Bouton
        aria-label={t('carteEtablissement.epuiserNomme', { nom: ligne.nom })}
        onClick={() =>
          void agir(
            `${ligne.produitId}/rupture`,
            'POST',
            t('carteEtablissement.fait.epuise', { nom: ligne.nom }),
          )
        }
      >
        {t('carteEtablissement.epuiser')}
      </Bouton>
    )
  }

  function actionsSecondaires(ligne: LigneCarteEtablissement): ActionMenu[] {
    const actions: ActionMenu[] = []
    if (aLaPermission('PRIX_MODIFIER')) {
      actions.push({
        libelle: t('carteEtablissement.fixerPrix'),
        icone: Banknote,
        surChoisir: () => {
          setPrixEnCours(ligne)
        },
      })
    }
    if (ligne.propose && aLaPermission('CATALOGUE_GERER')) {
      actions.push({
        libelle: t('carteEtablissement.retirer'),
        icone: EyeOff,
        ton: 'danger',
        surChoisir: () =>
          void agir(
            `${ligne.produitId}/retrait`,
            'POST',
            t('carteEtablissement.fait.retire', { nom: ligne.nom }),
          ),
      })
    }
    return actions
  }

  function disponibilite(ligne: LigneCarteEtablissement) {
    return (
      <span className="flex flex-col items-start gap-1">
        <BadgeStatut ton={TONS_DISPONIBILITE[etatDisponibilite(ligne)]}>
          {t(`carteEtablissement.${etatDisponibilite(ligne)}`)}
        </BadgeStatut>
        {ligne.epuise && ligne.epuiseLe !== undefined && etablissement !== undefined && (
          <span className="whitespace-normal text-legende text-attenue">
            {t('carteEtablissement.epuiseDetail', {
              auteur: ligne.epuisePar ?? '',
              heure: formaterHeure(ligne.epuiseLe, etablissement.fuseauHoraire),
            })}
          </span>
        )}
      </span>
    )
  }

  const colonnes: ColonneTableau<LigneCarteEtablissement>[] = [
    {
      cle: 'produit',
      entete: t('carteEtablissement.colonnes.produit'),
      rendu: (ligne) => (
        <>
          <span
            className={ligne.propose ? 'block font-semibold' : 'block font-semibold text-attenue'}
          >
            {ligne.nom}
          </span>
          <span className="flex items-center gap-1.5 text-legende text-attenue">
            <CarreCategorie couleur={ligne.categorie.couleur} />
            <span>
              {ligne.categorie.nom}
              {/* Sur téléphone, les colonnes de prix sont masquées : le prix appliqué passe ici. */}
              <span className="chiffres md:hidden">, {montant(ligne.prix)}</span>
            </span>
          </span>
          <span className="mt-1 block md:hidden">{disponibilite(ligne)}</span>
        </>
      ),
    },
    {
      cle: 'prixBase',
      entete: t('carteEtablissement.colonnes.prixBase'),
      numerique: true,
      masqueeSurTelephone: true,
      rendu: (ligne) => (
        <span className={ligne.prixPropre ? 'chiffres text-attenue' : 'chiffres'}>
          {montant(ligne.prixBase)}
        </span>
      ),
    },
    {
      cle: 'prixIci',
      entete: t('carteEtablissement.colonnes.prixIci'),
      numerique: true,
      masqueeSurTelephone: true,
      rendu: (ligne) =>
        ligne.prixPropre ? (
          <span className="flex flex-col items-end gap-0.5">
            <span className="chiffres text-montant-ligne">{montant(ligne.prix)}</span>
            <BadgeStatut ton="info">{t('carteEtablissement.prixPropre')}</BadgeStatut>
          </span>
        ) : (
          <span className="text-legende text-attenue">{t('carteEtablissement.prixDeBase')}</span>
        ),
    },
    {
      cle: 'disponibilite',
      entete: t('carteEtablissement.colonnes.disponibilite'),
      masqueeSurTelephone: true,
      rendu: disponibilite,
    },
    {
      cle: 'actions',
      entete: t('carteEtablissement.colonnes.actions'),
      rendu: (ligne) => {
        const secondaires = actionsSecondaires(ligne)
        return (
          <div className="flex justify-end gap-2">
            {actionPrincipale(ligne)}
            {secondaires.length > 0 && (
              <MenuActions
                libelle={t('carteEtablissement.plusDActions', { nom: ligne.nom })}
                actions={secondaires}
              />
            )}
          </div>
        )
      },
    },
  ]

  const lignes = carte.data ?? []
  const motif = recherche.trim().toLowerCase()
  const visibles = lignes
    .map((ligne, ordre) => ({ ligne, ordre }))
    .filter(({ ligne }) => motif === '' || ligne.nom.toLowerCase().includes(motif))
    .sort((a, b) => rang(a.ligne) - rang(b.ligne) || a.ordre - b.ordre)
    .map(({ ligne }) => ligne)
  const compteurs = [
    t('carteEtablissement.compteurs.epuises', {
      count: lignes.filter((ligne) => ligne.propose && ligne.epuise).length,
    }),
    t('carteEtablissement.compteurs.prixPropres', {
      count: lignes.filter((ligne) => ligne.prixPropre).length,
    }),
    t('carteEtablissement.compteurs.nonProposes', {
      count: lignes.filter((ligne) => !ligne.propose).length,
    }),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="m-0 text-titre-page text-encre">
            {etablissement === undefined
              ? t('carteEtablissement.titreSansEtablissement')
              : t('carteEtablissement.titre', { etablissement: etablissement.nom })}
          </h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('carteEtablissement.phrase')}</p>
        </div>
        {etablissements.data !== undefined && etablissements.data.elements.length > 1 && (
          <div className="w-60">
            <ChampSelection
              libelle={t('carteEtablissement.etablissement')}
              options={etablissements.data.elements.map((candidat) => ({
                valeur: candidat.id,
                libelle: candidat.nom,
              }))}
              value={etablissement?.id ?? ''}
              onChange={(evenement) => {
                setChoisi(evenement.target.value)
                setConfirmation(null)
              }}
            />
          </div>
        )}
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
      {(etablissements.isError || carte.isError) && (
        <AlerteErreur
          erreur={etablissements.error ?? carte.error}
          action={
            <Bouton
              icone={RotateCw}
              onClick={() => {
                void etablissements.refetch()
                void carte.refetch()
              }}
            >
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {(etablissements.isPending || (etablissement !== undefined && carte.isPending)) && (
        <Chargement texte={t('carteEtablissement.chargement')} />
      )}
      {etablissements.data?.elements.length === 0 && (
        <p className="m-0 text-corps text-attenue">{t('carteEtablissement.aucunEtablissement')}</p>
      )}
      {carte.data?.length === 0 && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide
            titre={t('carteEtablissement.vide.titre')}
            phrase={t('carteEtablissement.vide.phrase')}
          />
        </section>
      )}
      {carte.data !== undefined && carte.data.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {compteurs.map((compteur) => (
              <span
                key={compteur}
                className="inline-flex min-h-9 items-center rounded-normal border border-trait bg-surface px-3 text-libelle text-encre"
              >
                {compteur}
              </span>
            ))}
            <span className="flex-1" />
            <label className="flex h-cible-min w-full max-w-xs items-center gap-2 rounded-normal border border-bordure-controle bg-surface px-3 text-attenue">
              <Search aria-hidden="true" size={16} />
              <input
                type="search"
                aria-label={t('carteEtablissement.recherche')}
                placeholder={t('carteEtablissement.recherche')}
                value={recherche}
                onChange={(evenement) => {
                  setRecherche(evenement.target.value)
                }}
                className="min-w-0 flex-1 border-0 bg-transparent text-corps text-encre outline-none"
              />
            </label>
          </div>
          {visibles.length === 0 ? (
            <p className="m-0 rounded-moyen border border-trait bg-surface p-6 text-corps text-attenue">
              {t('carteEtablissement.aucunResultat')}
            </p>
          ) : (
            <Tableau
              libelle={t('carteEtablissement.tableau')}
              colonnes={colonnes}
              lignes={visibles}
              cleLigne={(ligne) => ligne.produitId}
            />
          )}
        </>
      )}

      {prixEnCours !== null && etablissement !== undefined && (
        <DialoguePrix
          ligne={prixEnCours}
          etablissement={etablissement}
          devise={devise}
          surFermer={() => {
            setPrixEnCours(null)
          }}
          surEnregistre={() => {
            setConfirmation(t('carteEtablissement.fait.prix', { nom: prixEnCours.nom }))
            setPrixEnCours(null)
            void clientRequetes.invalidateQueries({
              queryKey: ['catalogue', 'carte-etablissement'],
            })
          }}
        />
      )}
    </div>
  )
}

function DialoguePrix({
  ligne,
  etablissement,
  devise,
  surFermer,
  surEnregistre,
}: Readonly<{
  ligne: LigneCarteEtablissement
  etablissement: EtablissementResume
  devise: Devise
  surFermer: () => void
  surEnregistre: () => void
}>) {
  const { t } = useTranslation()
  const [saisie, setSaisie] = useState(
    formaterMontant({ unitesMineures: ligne.prix, devise }, { forme: 'nombre' }),
  )
  const [erreurPrix, setErreurPrix] = useState<string | undefined>(undefined)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const prix = lireMontant(saisie, devise)

  async function envoyer(corps: DemandePrixEtablissement) {
    setEnCours(true)
    setErreur(null)
    try {
      await appelerApi(`/etablissements/${etablissement.id}/carte/${ligne.produitId}/prix`, {
        methode: 'PUT',
        corps,
      })
      surEnregistre()
    } catch (refus) {
      setErreur(refus)
      setEnCours(false)
    }
  }

  function enregistrer() {
    if (prix === null || prix <= 0) {
      setErreurPrix(t('produits.fiche.prixInvalide'))
      return
    }
    void envoyer({ prix })
  }

  return (
    <Dialogue
      titre={t('carteEtablissement.dialoguePrix.titre', {
        nom: ligne.nom,
        etablissement: etablissement.nom,
      })}
      consequence={t('carteEtablissement.dialoguePrix.consequence', {
        prix: formaterMontant({ unitesMineures: ligne.prixBase, devise }, { forme: 'courte' }),
        etablissement: etablissement.nom,
      })}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('carteEtablissement.dialoguePrix.enregistrer')}
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={enregistrer}
    >
      <ChampSaisie
        libelle={t('carteEtablissement.dialoguePrix.prix', { etablissement: etablissement.nom })}
        obligatoire
        inputMode="decimal"
        suffixe={symboleDe(devise)}
        className="chiffres text-montant-ligne"
        value={saisie}
        erreur={erreurPrix}
        aide={
          prix !== null && prix > 0 && ligne.nomTaxe !== undefined
            ? t('produits.fiche.dontTaxe', {
                taxe: ligne.nomTaxe,
                montant: formaterMontant(
                  { unitesMineures: taxeIncluse(prix, ligne.tauxTaxePointsDeBase), devise },
                  { forme: 'courte' },
                ),
              })
            : undefined
        }
        onChange={(evenement) => {
          setSaisie(evenement.target.value)
        }}
      />
      <p className="m-0 rounded-normal border border-trait bg-fond p-3 text-legende text-attenue">
        {t('carteEtablissement.dialoguePrix.note', { etablissement: etablissement.nom })}
      </p>
      {ligne.prixPropre && (
        <div>
          <Bouton
            disabled={enCours}
            // Sans prix : le serveur revient au prix de base.
            onClick={() => void envoyer({})}
          >
            {t('carteEtablissement.dialoguePrix.revenir')}
          </Bouton>
        </div>
      )}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}
