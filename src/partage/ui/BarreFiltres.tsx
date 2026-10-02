import { clsx } from 'clsx'

export interface Filtre<C extends string> {
  cle: C
  libelle: string
  nombre: number
}

/** Les filtres d'une liste, chacun avec son nombre, et la recherche à droite. */
export function BarreFiltres<C extends string>({
  filtres,
  actif,
  surChoisir,
  recherche,
}: Readonly<{
  filtres: Filtre<C>[]
  actif: C
  surChoisir: (cle: C) => void
  recherche: { libelle: string; valeur: string; surChanger: (valeur: string) => void }
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filtres.map((filtre) => (
        <button
          key={filtre.cle}
          type="button"
          aria-pressed={actif === filtre.cle}
          onClick={() => {
            surChoisir(filtre.cle)
          }}
          className={clsx(
            'flex min-h-cible-min items-center gap-1.5 rounded-normal px-3 text-libelle font-bold',
            actif === filtre.cle
              ? 'border border-accent bg-accent text-accent-texte'
              : 'border border-trait bg-surface text-encre',
          )}
        >
          {filtre.libelle}
          <span className="chiffres opacity-70">{filtre.nombre}</span>
        </button>
      ))}
      <span className="flex-1" />
      <input
        type="search"
        aria-label={recherche.libelle}
        placeholder={recherche.libelle}
        value={recherche.valeur}
        onChange={(evenement) => {
          recherche.surChanger(evenement.target.value)
        }}
        className="min-h-cible-min w-full rounded-normal border border-bordure-controle bg-surface px-3 text-corps text-encre sm:w-64"
      />
    </div>
  )
}
