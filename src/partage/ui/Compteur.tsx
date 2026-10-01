/** Un nombre à régler au doigt : − et + de part et d'autre, chacun avec son libellé accessible. */
export function Compteur({
  valeur,
  libelleMoins,
  libellePlus,
  moinsPossible,
  plusPossible,
  surChanger,
}: Readonly<{
  valeur: number
  libelleMoins: string
  libellePlus: string
  moinsPossible: boolean
  plusPossible: boolean
  surChanger: (valeur: number) => void
}>) {
  return (
    <span className="flex items-center rounded-normal border border-trait">
      <button
        type="button"
        aria-label={libelleMoins}
        disabled={!moinsPossible}
        onClick={() => {
          surChanger(valeur - 1)
        }}
        className="size-cible-min text-titre-section text-attenue disabled:opacity-40"
      >
        −
      </button>
      <span className="chiffres min-w-10 text-center text-montant-ligne text-encre">{valeur}</span>
      <button
        type="button"
        aria-label={libellePlus}
        disabled={!plusPossible}
        onClick={() => {
          surChanger(valeur + 1)
        }}
        className="size-cible-min text-titre-section text-attenue disabled:opacity-40"
      >
        +
      </button>
    </span>
  )
}
