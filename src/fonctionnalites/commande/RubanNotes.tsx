import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import type { NoteOuverte } from '../../partage/api/contrat'
import { formaterMontant, type Devise } from '../../partage/montants/formaterMontant'
import { BadgeStatut, type TonStatut } from '../../partage/ui/BadgeStatut'
import { requetePlan } from './requetes'

interface Entree {
  note: NoteOuverte
  /** « T4 », ou « n°12 » pour une note sans table */
  repere: string
}

/** Ce qui attend sur la note, du plus pressé au moins pressé ; rien si tout est à jour. */
function etatDe(note: NoteOuverte): { cle: string; ton: TonStatut } | null {
  if (note.aEnvoyer > 0) return { cle: 'aEnvoyer', ton: 'alerte' }
  if (note.aServir > 0) {
    return { cle: note.canal === 'SUR_PLACE' ? 'aServir' : 'aRemettre', ton: 'alerte' }
  }
  if (note.additionDemandeeLe !== undefined) return { cle: 'addition', ton: 'info' }
  return null
}

/**
 * Les notes ouvertes de l'établissement, en bas de la prise de commande : on passe d'une table à l'autre en un
 * geste, sans revenir au plan. Chaque note dit ce qui l'attend.
 */
export function RubanNotes({
  noteCourante,
  devise,
}: Readonly<{ noteCourante: string; devise: Devise }>) {
  const { t } = useTranslation()
  const plan = useQuery(requetePlan)
  if (plan.data === undefined) return null
  const entrees: Entree[] = [
    ...plan.data.salles.flatMap((salle) =>
      salle.tables.flatMap((table) =>
        table.note === undefined ? [] : [{ note: table.note, repere: table.nom }],
      ),
    ),
    ...plan.data.sansTable.map((note) => ({ note, repere: `n°${String(note.numero)}` })),
  ]
  if (entrees.length === 0) return null
  return (
    <nav
      aria-label={t('caisse.ruban.titre')}
      className="hidden shrink-0 items-center gap-2.5 overflow-x-auto border-t border-trait bg-surface px-4 py-2.5 lg:flex"
    >
      <span className="shrink-0 text-legende font-bold uppercase tracking-wide text-attenue">
        {t('caisse.ruban.titre')}
      </span>
      {entrees.map(({ note, repere }) => {
        const etat = etatDe(note)
        const courante = note.id === noteCourante
        return (
          <Link
            key={note.id}
            to="/caisse/notes/$commandeId"
            params={{ commandeId: note.id }}
            aria-current={courante ? 'page' : undefined}
            className={clsx(
              'flex min-h-cible-caisse shrink-0 items-center gap-2.5 rounded-moyen border bg-surface py-1.5 pr-3 pl-1.5 text-encre no-underline',
              courante ? 'border-2 border-accent' : 'border-trait hover:bg-fond',
            )}
          >
            <span
              className={clsx(
                'flex size-10 items-center justify-center rounded-normal text-corps-fort',
                courante ? 'bg-accent text-accent-texte' : 'bg-accent-doux',
              )}
            >
              {repere}
            </span>
            <span className="flex flex-col">
              <span className="text-libelle font-semibold">{note.serveur}</span>
              <span className="chiffres text-legende text-attenue">
                {formaterMontant({ unitesMineures: note.total, devise }, { forme: 'courte' })}
              </span>
            </span>
            {etat !== null && (
              <BadgeStatut ton={etat.ton}>{t(`caisse.ruban.${etat.cle}`)}</BadgeStatut>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
