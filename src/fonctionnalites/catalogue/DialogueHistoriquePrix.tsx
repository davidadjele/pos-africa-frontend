import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { appelerApi } from '../../partage/api/appelerApi'
import type { EvenementActivite } from '../../partage/api/contrat'
import { formaterDateHeure } from '../../partage/dates/formaterDate'
import { AlerteErreur } from '../../partage/ui/Alerte'
import { Chargement } from '../../partage/ui/Chargement'
import { Dialogue } from '../../partage/ui/Dialogue'
import { auteurDe, detailActivite, type ContexteActivite } from '../activite/description'

/** Prix de base et prix propres aux établissements (dans le périmètre), du plus récent au plus ancien. */
export function DialogueHistoriquePrix({
  produitId,
  nom,
  contexte,
  surFermer,
}: Readonly<{
  produitId: string
  nom: string
  contexte: ContexteActivite
  surFermer: () => void
}>) {
  const { t } = useTranslation()
  const historique = useQuery({
    queryKey: ['activite', 'prix', produitId],
    queryFn: ({ signal }) =>
      appelerApi<EvenementActivite[]>(`/activite/produits/${produitId}/prix`, { signal }),
  })
  return (
    <Dialogue
      titre={t('produits.historique.titre', { nom })}
      consequence={t('produits.historique.phrase')}
      libelleConfirmer={t('produits.historique.fermer')}
      surConfirmer={surFermer}
    >
      {historique.isPending && <Chargement texte={t('produits.chargement')} />}
      {historique.isError && <AlerteErreur erreur={historique.error} />}
      {historique.data?.length === 0 && (
        <p className="m-0 text-corps text-attenue">{t('produits.historique.vide')}</p>
      )}
      {historique.data !== undefined && historique.data.length > 0 && (
        <ul
          aria-label={t('produits.historique.liste')}
          className="m-0 max-h-80 list-none overflow-y-auto border-t border-trait p-0"
        >
          {historique.data.map((brut) => {
            const evenement = auteurDe(brut, t)
            return (
              <li
                key={evenement.id}
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b border-trait py-2.5"
              >
                <span className="text-legende text-attenue">
                  {formaterDateHeure(evenement.survenuLe, contexte.fuseauHoraire)}
                </span>
                <span className="chiffres text-right text-corps text-encre">
                  {detailActivite(evenement, t, contexte)}
                </span>
                <span className="text-legende text-encre">
                  <strong>{evenement.auteurNom}</strong>
                  {', '}
                  {evenement.etablissementNom ?? t('activite.touteLaCarte')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Dialogue>
  )
}
