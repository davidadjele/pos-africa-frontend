import { clsx } from 'clsx'
import { initiales } from './requetes'

/** Initiales de l'employé, à la place d'une photo que la caisse n'a pas. */
export function Pastille({
  nomCourt,
  active = false,
}: Readonly<{ nomCourt: string; active?: boolean }>) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'flex size-10 shrink-0 items-center justify-center rounded-rond text-libelle font-bold',
        active ? 'bg-accent text-accent-texte' : 'bg-fond text-attenue',
      )}
    >
      {initiales(nomCourt)}
    </span>
  )
}
