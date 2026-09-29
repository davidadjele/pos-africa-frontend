import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Power, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { DemandeTaxe, TaxeResume } from '../../partage/api/contrat'
import { ErreurApi } from '../../partage/api/ErreurApi'
import { useSession } from '../../partage/auth/useSession'
import { formaterTaux, lireTaux } from '../../partage/montants/taxes'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions } from '../../partage/ui/MenuActions'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { requeteTaxes } from './requetes'

type Edition = { mode: 'creation' } | { mode: 'modification'; taxe: TaxeResume }

export function PageTaxes() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { aLaPermission } = useSession()
  const peutGerer = aLaPermission('CATALOGUE_GERER')
  const requete = useQuery(requeteTaxes)
  const [edition, setEdition] = useState<Edition | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)

  async function basculer(taxe: TaxeResume) {
    setErreur(null)
    try {
      await appelerApi(`/taxes/${taxe.id}/${taxe.active ? 'desactivation' : 'reactivation'}`, {
        methode: 'POST',
      })
      setConfirmation(t(taxe.active ? 'taxes.desactivee' : 'taxes.reactivee', { nom: taxe.nom }))
      await clientRequetes.invalidateQueries({ queryKey: ['catalogue'] })
    } catch (refus) {
      // Refus attendu : il se dit avec le nom et le nombre de produits concernés.
      setErreur(
        refus instanceof ErreurApi && refus.code === 'TAXE_EN_USAGE'
          ? new Error(t('taxes.enUsage', { nom: taxe.nom, count: taxe.nbProduits }))
          : refus,
      )
    }
  }

  const colonnes: ColonneTableau<TaxeResume>[] = [
    {
      cle: 'nom',
      entete: t('taxes.colonnes.nom'),
      rendu: (taxe) => <span className="font-semibold">{taxe.nom}</span>,
    },
    {
      cle: 'taux',
      entete: t('taxes.colonnes.taux'),
      numerique: true,
      rendu: (taxe) => (
        <span className="chiffres text-montant-ligne">{formaterTaux(taxe.tauxPointsDeBase)}</span>
      ),
    },
    {
      cle: 'produits',
      entete: t('taxes.colonnes.produits'),
      rendu: (taxe) => t('taxes.nbProduits', { count: taxe.nbProduits }),
    },
    {
      cle: 'statut',
      entete: t('taxes.colonnes.statut'),
      rendu: (taxe) => (
        <BadgeStatut ton={taxe.active ? 'succes' : 'neutre'}>
          {taxe.active ? t('taxes.statut.active') : t('taxes.statut.desactivee')}
        </BadgeStatut>
      ),
    },
  ]
  if (peutGerer) {
    colonnes.push({
      cle: 'actions',
      entete: t('taxes.colonnes.actions'),
      rendu: (taxe) => (
        <div className="flex justify-end gap-2">
          {taxe.active && (
            <Bouton
              icone={Pencil}
              aria-label={t('taxes.modifierNomme', { nom: taxe.nom })}
              onClick={() => {
                setConfirmation(null)
                setEdition({ mode: 'modification', taxe })
              }}
            >
              {t('taxes.modifier')}
            </Bouton>
          )}
          <MenuActions
            libelle={t('taxes.plusDActions', { nom: taxe.nom })}
            actions={[
              {
                libelle: taxe.active ? t('taxes.desactiver') : t('taxes.reactiver'),
                icone: Power,
                ...(taxe.active ? { ton: 'danger' as const } : {}),
                surChoisir: () => void basculer(taxe),
              },
            ]}
          />
        </div>
      ),
    })
  }

  const taxes = requete.data
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-titre-page text-encre">{t('taxes.titre')}</h1>
          <p className="m-0 mt-1 text-corps text-attenue">{t('taxes.phrase')}</p>
        </div>
        {peutGerer && (
          <Bouton
            variante="principal"
            icone={Plus}
            onClick={() => {
              setConfirmation(null)
              setEdition({ mode: 'creation' })
            }}
          >
            {t('taxes.ajouter')}
          </Bouton>
        )}
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
      {erreur instanceof Error && !(erreur instanceof ErreurApi) ? (
        <Alerte ton="danger">{erreur.message}</Alerte>
      ) : (
        erreur !== null && <AlerteErreur erreur={erreur} />
      )}
      {requete.isPending && <Chargement texte={t('taxes.chargement')} />}
      {requete.isError && (
        <AlerteErreur
          erreur={requete.error}
          action={
            <Bouton icone={RotateCw} onClick={() => void requete.refetch()}>
              {t('commun.reessayer')}
            </Bouton>
          }
        />
      )}
      {taxes?.length === 0 && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide titre={t('taxes.vide.titre')} phrase={t('taxes.vide.phrase')} />
        </section>
      )}
      {taxes !== undefined && taxes.length > 0 && (
        <Tableau
          libelle={t('taxes.tableau')}
          colonnes={colonnes}
          lignes={taxes}
          cleLigne={(taxe) => taxe.id}
        />
      )}

      {edition !== null && (
        <DialogueTaxe
          edition={edition}
          surFermer={() => {
            setEdition(null)
          }}
          surEnregistre={(taxe) => {
            setConfirmation(
              t(edition.mode === 'creation' ? 'taxes.creee' : 'taxes.modifiee', { nom: taxe.nom }),
            )
            setEdition(null)
            void clientRequetes.invalidateQueries({ queryKey: ['catalogue'] })
          }}
        />
      )}
    </div>
  )
}

function DialogueTaxe({
  edition,
  surFermer,
  surEnregistre,
}: Readonly<{
  edition: Edition
  surFermer: () => void
  surEnregistre: (taxe: TaxeResume) => void
}>) {
  const { t } = useTranslation()
  const existante = edition.mode === 'modification' ? edition.taxe : null
  const [nom, setNom] = useState(existante?.nom ?? '')
  const [taux, setTaux] = useState(
    existante === null ? '' : formaterTaux(existante.tauxPointsDeBase).replace(/\s%$/, ''),
  )
  const [erreurNom, setErreurNom] = useState<string | undefined>(undefined)
  const [erreurTaux, setErreurTaux] = useState<string | undefined>(undefined)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const points = lireTaux(taux)
  const changement = existante !== null && points !== null && points !== existante.tauxPointsDeBase

  async function enregistrer() {
    const nomSaisi = nom.trim()
    setErreurNom(nomSaisi === '' ? t('validation.obligatoire') : undefined)
    setErreurTaux(points === null ? t('taxes.formulaire.tauxInvalide') : undefined)
    if (nomSaisi === '' || points === null) return
    setEnCours(true)
    setErreur(null)
    const corps: DemandeTaxe = {
      nom: nomSaisi,
      tauxPointsDeBase: points,
      ...(existante === null ? {} : { version: existante.version }),
    }
    try {
      surEnregistre(
        await appelerApi<TaxeResume>(existante === null ? '/taxes' : `/taxes/${existante.id}`, {
          methode: existante === null ? 'POST' : 'PUT',
          corps,
        }),
      )
    } catch (refus) {
      setErreur(refus)
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre={
        existante === null
          ? t('taxes.formulaire.titreCreation')
          : t('taxes.formulaire.titreModification', { nom: existante.nom })
      }
      consequence={t('taxes.formulaire.consequence')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={
        existante === null ? t('taxes.formulaire.creer') : t('taxes.formulaire.enregistrer')
      }
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => void enregistrer()}
    >
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <ChampSaisie
          libelle={t('taxes.formulaire.nom')}
          obligatoire
          maxLength={60}
          value={nom}
          erreur={erreurNom}
          onChange={(evenement) => {
            setNom(evenement.target.value)
          }}
        />
        <ChampSaisie
          libelle={t('taxes.formulaire.taux')}
          obligatoire
          inputMode="decimal"
          suffixe="%"
          className="chiffres"
          value={taux}
          erreur={erreurTaux}
          onChange={(evenement) => {
            setTaux(evenement.target.value)
          }}
        />
      </div>
      {changement && (
        <Alerte ton="alerte">
          <p className="m-0 font-semibold">
            {t('taxes.formulaire.changement', {
              avant: formaterTaux(existante.tauxPointsDeBase),
              apres: formaterTaux(points),
              produits: t('taxes.nbProduits', { count: existante.nbProduits }),
            })}
          </p>
          <p className="m-0 mt-1">{t('taxes.formulaire.changementPhrase')}</p>
        </Alerte>
      )}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}
