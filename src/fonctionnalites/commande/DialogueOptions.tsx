import { clsx } from 'clsx'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { ChoixCarte, GroupeCarte, LigneCarteEtablissement } from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { Alerte } from '../../partage/ui/Alerte'
import { BadgeStatut } from '../../partage/ui/BadgeStatut'
import { Dialogue } from '../../partage/ui/Dialogue'
import { basculer, choixDansLOrdre, groupesManquants, prixAvecChoix } from './choixOptions'

function regleEnCaisse(groupe: GroupeCarte, t: TFunction): string {
  if (!groupe.choixMultiple) return t('caisse.options.unSeul')
  return groupe.maximum === undefined
    ? t('caisse.options.plusieurs')
    : t('caisse.options.auPlus', { count: groupe.maximum })
}

/** « +200 F », « Inclus », ou « Épuisé » quand le produit lié est en rupture. */
function prixDuChoix(choix: ChoixCarte, devise: Devise, t: TFunction): string {
  if (choix.epuise) return t('caisse.options.epuise')
  if (choix.supplement === 0) return t('caisse.options.inclus')
  return `+${formaterMontant({ unitesMineures: choix.supplement, devise }, { forme: 'courte' })}`
}

/**
 * Les options d'un produit, choisies avant de l'ajouter à la note, ou modifiées sur une ligne pas encore envoyée.
 * Un groupe obligatoire sans choix est rappelé au moment de valider, plutôt qu'un bouton grisé sans explication.
 */
export function DialogueOptions({
  produit,
  devise,
  choisisAuDepart = [],
  modification = false,
  surFermer,
  surValider,
}: Readonly<{
  produit: LigneCarteEtablissement
  devise: Devise
  choisisAuDepart?: readonly string[]
  /** Sur une ligne de la note : « Enregistrer » plutôt que « Ajouter ». */
  modification?: boolean
  surFermer: () => void
  surValider: (optionIds: string[]) => void
}>) {
  const { t } = useTranslation()
  const [choisis, setChoisis] = useState<string[]>([...choisisAuDepart])
  const [manquants, setManquants] = useState<GroupeCarte[]>([])
  const groupes = produit.options
  const prix = formaterMontant(
    { unitesMineures: prixAvecChoix(produit.prix, groupes, choisis), devise },
    { forme: 'courte' },
  )

  return (
    <Dialogue
      large
      titre={produit.nom}
      consequence={t('caisse.options.phrase', {
        prix: formaterMontant({ unitesMineures: produit.prix, devise }, { forme: 'courte' }),
      })}
      libelleAnnuler={t('commun.annuler')}
      libelleConfirmer={
        modification ? t('commun.enregistrer') : t('caisse.options.ajouter', { prix })
      }
      surAnnuler={surFermer}
      surConfirmer={() => {
        const absents = groupesManquants(groupes, choisis)
        setManquants(absents)
        if (absents.length === 0) surValider(choixDansLOrdre(groupes, choisis))
      }}
    >
      {manquants.length > 0 && (
        <Alerte ton="alerte">
          {t('caisse.options.choisissez', {
            groupes: manquants.map((groupe) => groupe.nom).join(', '),
          })}
        </Alerte>
      )}
      {groupes.map((groupe) => (
        <div key={groupe.id} role="group" aria-label={groupe.nom} className="flex flex-col gap-2">
          <span className="flex items-center gap-2">
            <span className="text-corps-fort text-encre">{groupe.nom}</span>
            <BadgeStatut ton={groupe.obligatoire ? 'alerte' : 'neutre'}>
              {groupe.obligatoire
                ? t('caisse.options.obligatoire')
                : t('caisse.options.facultatif')}
            </BadgeStatut>
            <span className="text-legende text-attenue">{regleEnCaisse(groupe, t)}</span>
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {groupe.choix.map((choix) => {
              const pris = choisis.includes(choix.id)
              return (
                <button
                  key={choix.id}
                  type="button"
                  aria-pressed={pris}
                  disabled={choix.epuise && !pris}
                  onClick={() => {
                    setManquants([])
                    setChoisis(basculer(groupes, choisis, choix.id))
                  }}
                  className={clsx(
                    'flex min-h-cible-caisse flex-col items-start justify-center gap-0.5 rounded-normal px-3 py-2 text-left',
                    pris
                      ? 'border-2 border-accent bg-accent-doux'
                      : 'border border-trait bg-surface',
                    choix.epuise && !pris && 'border-dashed bg-fond text-attenue',
                  )}
                >
                  <span className="text-corps-fort">{choix.nom}</span>
                  <span className="chiffres text-legende text-attenue">
                    {prixDuChoix(choix, devise, t)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </Dialogue>
  )
}
