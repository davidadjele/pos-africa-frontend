import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { ProduitResume } from '../../partage/api/contrat'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { Bouton } from '../../partage/ui/Bouton'
import { ChampSelection } from '../../partage/ui/ChampSaisie'
import { regleDuGroupe } from './PageOptions'
import { requeteGroupesOptions, requeteProduit } from './requetes'

/**
 * Les groupes d'options proposés en caisse avec ce produit, dans leur ordre. Chaque changement est enregistré
 * aussitôt : il ne dépend pas du reste de la fiche.
 */
export function SectionOptionsProduit({ produit }: Readonly<{ produit: ProduitResume }>) {
  const { t } = useTranslation()
  const id = useId()
  const clientRequetes = useQueryClient()
  const groupes = useQuery(requeteGroupesOptions)
  const [attaches, setAttaches] = useState<string[]>(produit.groupesOptionIds)
  const [erreur, setErreur] = useState<unknown>(null)
  // Un enregistrement à la fois : le suivant part de la liste que le serveur a confirmée.
  const [enCours, setEnCours] = useState(false)
  const parId = new Map((groupes.data ?? []).map((groupe) => [groupe.id, groupe]))
  const disponibles = (groupes.data ?? []).filter((groupe) => !attaches.includes(groupe.id))

  async function enregistrer(groupeIds: string[]) {
    if (enCours) return
    setEnCours(true)
    setErreur(null)
    const avant = attaches
    setAttaches(groupeIds)
    try {
      const frais = await appelerApi<ProduitResume>(`/produits/${produit.id}/options`, {
        methode: 'PUT',
        corps: { groupeIds },
      })
      clientRequetes.setQueryData(requeteProduit(produit.id).queryKey, frais)
      void clientRequetes.invalidateQueries({ queryKey: requeteGroupesOptions.queryKey })
    } catch (refus) {
      setAttaches(avant)
      setErreur(refus)
    } finally {
      setEnCours(false)
    }
  }

  function deplacer(rang: number, pas: -1 | 1) {
    const suivants = [...attaches]
    const [un] = suivants.splice(rang, 1)
    if (un !== undefined) suivants.splice(rang + pas, 0, un)
    void enregistrer(suivants)
  }

  return (
    <section
      aria-labelledby={`${id}-titre`}
      className="flex flex-col gap-3 rounded-moyen border border-trait bg-surface p-4 md:p-6"
    >
      <div>
        <h2 id={`${id}-titre`} className="m-0 text-titre-carte text-encre">
          {t('options.fiche.titre')}
        </h2>
        <p className="m-0 mt-1 text-legende text-attenue">{t('options.fiche.phrase')}</p>
      </div>
      {attaches.length === 0 ? (
        <p className="m-0 text-corps text-attenue">{t('options.fiche.aucun')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {attaches.map((groupeId, rang) => {
            const groupe = parId.get(groupeId)
            const nom = groupe?.nom ?? '…'
            return (
              <li
                key={groupeId}
                className="flex items-center gap-2 rounded-normal border border-trait px-3 py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-corps-fort text-encre">{nom}</span>
                  {groupe !== undefined && (
                    <span className="text-legende text-attenue">{regleDuGroupe(groupe, t)}</span>
                  )}
                </span>
                <Bouton
                  icone={ChevronUp}
                  aria-label={t('options.fiche.monter', { nom })}
                  disabled={enCours || rang === 0}
                  onClick={() => {
                    deplacer(rang, -1)
                  }}
                />
                <Bouton
                  icone={ChevronDown}
                  aria-label={t('options.fiche.descendre', { nom })}
                  disabled={enCours || rang === attaches.length - 1}
                  onClick={() => {
                    deplacer(rang, 1)
                  }}
                />
                <Bouton
                  icone={X}
                  aria-label={t('options.fiche.retirer', { nom })}
                  disabled={enCours}
                  onClick={() => void enregistrer(attaches.filter((un) => un !== groupeId))}
                />
              </li>
            )
          })}
        </ul>
      )}
      {disponibles.length > 0 && (
        <ChampSelection
          libelle={t('options.fiche.ajouter')}
          value=""
          disabled={enCours}
          options={[
            { valeur: '', libelle: t('options.fiche.choisir') },
            ...disponibles.map((groupe) => ({ valeur: groupe.id, libelle: groupe.nom })),
          ]}
          onChange={(evenement) => {
            if (evenement.target.value !== '')
              void enregistrer([...attaches, evenement.target.value])
          }}
        />
      )}
      {erreur !== null && <AlerteErreur erreur={erreur} />}
    </section>
  )
}
