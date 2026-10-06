import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, RotateCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { GroupeOptionResume } from '../../partage/api/contrat'
import { useSession } from '../../partage/auth/useSession'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { Alerte, AlerteErreur } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Bouton } from '../../partage/ui/Bouton'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { EtatVide } from '../../partage/ui/EtatVide'
import { MenuActions } from '../../partage/ui/MenuActions'
import { Tableau, type ColonneTableau } from '../../partage/ui/Tableau'
import { DialogueGroupeOptions } from './DialogueGroupeOptions'
import { requeteGroupesOptions } from './requetes'

type Edition = { mode: 'creation' } | { mode: 'modification'; groupe: GroupeOptionResume }

/** « Choix unique, obligatoire », « Choix multiple, 2 au plus ». */
export function regleDuGroupe(groupe: GroupeOptionResume, t: TFunction): string {
  if (!groupe.choixMultiple) {
    return t(
      groupe.obligatoire ? 'options.regle.uniqueObligatoire' : 'options.regle.uniqueFacultatif',
    )
  }
  const base = t(
    groupe.obligatoire ? 'options.regle.multipleObligatoire' : 'options.regle.multiple',
  )
  return groupe.maximum === undefined
    ? base
    : `${base}, ${t('options.regle.auPlus', { count: groupe.maximum })}`
}

/**
 * Les groupes d'options de la carte (cuisson, accompagnement, suppléments) : définis ici une fois, attachés aux
 * produits depuis leur fiche.
 */
export function PageOptions() {
  const { t } = useTranslation()
  const clientRequetes = useQueryClient()
  const { moi } = useSession()
  const devise = (moi?.entrepriseCourante?.devise ?? 'XOF') as Devise
  const requete = useQuery(requeteGroupesOptions)
  const [edition, setEdition] = useState<Edition | null>(null)
  const [aSupprimer, setASupprimer] = useState<GroupeOptionResume | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [refus, setRefus] = useState<string | null>(null)

  const choixEnTexte = (groupe: GroupeOptionResume) =>
    groupe.choix
      .map((choix) =>
        choix.supplement > 0
          ? `${choix.nom} +${formaterMontant({ unitesMineures: choix.supplement, devise }, { forme: 'nombre' })}`
          : choix.nom,
      )
      .join(', ')

  const colonnes: ColonneTableau<GroupeOptionResume>[] = [
    {
      cle: 'nom',
      entete: t('options.colonnes.groupe'),
      rendu: (groupe) => <span className="font-semibold">{groupe.nom}</span>,
    },
    {
      cle: 'regle',
      entete: t('options.colonnes.regle'),
      rendu: (groupe) => <BadgeStatut ton="neutre">{regleDuGroupe(groupe, t)}</BadgeStatut>,
    },
    { cle: 'choix', entete: t('options.colonnes.choix'), rendu: choixEnTexte },
    {
      cle: 'stock',
      entete: t('options.colonnes.stock'),
      masqueeSurTelephone: true,
      rendu: (groupe) => {
        const lies = groupe.choix.filter((choix) => choix.produitLieId !== undefined).length
        return lies === 0 ? t('options.aucunLie') : t('options.lies', { count: lies })
      },
    },
    {
      cle: 'produits',
      entete: t('options.colonnes.produits'),
      masqueeSurTelephone: true,
      rendu: (groupe) => t('options.nbProduits', { count: groupe.nbProduits }),
    },
    {
      cle: 'actions',
      entete: t('options.colonnes.actions'),
      rendu: (groupe) => (
        <div className="flex justify-end gap-2">
          <Bouton
            icone={Pencil}
            aria-label={t('options.modifierNomme', { nom: groupe.nom })}
            onClick={() => {
              setConfirmation(null)
              setRefus(null)
              setEdition({ mode: 'modification', groupe })
            }}
          >
            {t('options.modifier')}
          </Bouton>
          <MenuActions
            libelle={t('options.plusDActions', { nom: groupe.nom })}
            actions={[
              {
                libelle: t('options.supprimer'),
                icone: Trash2,
                ton: 'danger',
                surChoisir: () => {
                  setConfirmation(null)
                  // Refus attendu : il se dit avec le nombre de produits, sans attendre le serveur.
                  if (groupe.nbProduits > 0) {
                    setRefus(t('options.enUsage', { nom: groupe.nom, count: groupe.nbProduits }))
                  } else {
                    setRefus(null)
                    setASupprimer(groupe)
                  }
                },
              },
            ]}
          />
        </div>
      ),
    },
  ]

  async function actualiser(message: string) {
    setConfirmation(message)
    await clientRequetes.invalidateQueries({ queryKey: ['catalogue'] })
  }

  const groupes = requete.data
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-titre-page text-encre">{t('options.titre')}</h1>
          <p className="m-0 mt-1 max-w-3xl text-corps text-attenue">{t('options.phrase')}</p>
        </div>
        <Bouton
          variante="principal"
          icone={Plus}
          onClick={() => {
            setConfirmation(null)
            setRefus(null)
            setEdition({ mode: 'creation' })
          }}
        >
          {t('options.nouveau')}
        </Bouton>
      </div>

      {confirmation !== null && <Alerte ton="succes">{confirmation}</Alerte>}
      {refus !== null && <Alerte ton="danger">{refus}</Alerte>}
      {requete.isPending && <Chargement texte={t('options.chargement')} />}
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
      {groupes?.length === 0 && (
        <section className="rounded-moyen border border-trait bg-surface p-6">
          <EtatVide titre={t('options.vide.titre')} phrase={t('options.vide.phrase')} />
        </section>
      )}
      {groupes !== undefined && groupes.length > 0 && (
        <Tableau
          libelle={t('options.tableau')}
          colonnes={colonnes}
          lignes={groupes}
          cleLigne={(groupe) => groupe.id}
        />
      )}

      {edition !== null && (
        <DialogueGroupeOptions
          groupe={edition.mode === 'modification' ? edition.groupe : null}
          devise={devise}
          surFermer={() => {
            setEdition(null)
          }}
          surEnregistre={(groupe) => {
            setEdition(null)
            void actualiser(
              t(edition.mode === 'creation' ? 'options.cree' : 'options.modifie', {
                nom: groupe.nom,
              }),
            )
          }}
        />
      )}
      {aSupprimer !== null && (
        <DialogueSuppression
          groupe={aSupprimer}
          surFermer={() => {
            setASupprimer(null)
          }}
          surSupprime={() => {
            const nom = aSupprimer.nom
            setASupprimer(null)
            void actualiser(t('options.supprime', { nom }))
          }}
        />
      )}
    </div>
  )
}

function DialogueSuppression({
  groupe,
  surFermer,
  surSupprime,
}: Readonly<{ groupe: GroupeOptionResume; surFermer: () => void; surSupprime: () => void }>) {
  const { t } = useTranslation()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  return (
    <Dialogue
      titre={t('options.suppression.titre', { nom: groupe.nom })}
      consequence={t('options.suppression.consequence')}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={t('options.suppression.confirmer')}
      tonConfirmation="danger"
      enCours={enCours}
      surAnnuler={surFermer}
      surConfirmer={() => {
        setEnCours(true)
        appelerApi(`/groupes-options/${groupe.id}`, { methode: 'DELETE' })
          .then(surSupprime)
          .catch((refus: unknown) => {
            setErreur(refus)
            setEnCours(false)
          })
      }}
    >
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </Dialogue>
  )
}
