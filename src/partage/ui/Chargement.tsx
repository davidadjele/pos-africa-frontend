/** Zone en cours de chargement, à la place de la liste qu'elle annonce : pas de spinner plein écran. */
export function Chargement({ texte }: { texte: string }) {
  return (
    <div
      aria-busy="true"
      className="flex flex-col gap-3 rounded-moyen border border-trait bg-surface p-4"
    >
      <p className="m-0 text-corps text-attenue">{texte}</p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-4 w-3/4 rounded-petit bg-fond" />
        <div className="h-4 w-1/2 rounded-petit bg-fond" />
        <div className="h-4 w-2/3 rounded-petit bg-fond" />
      </div>
    </div>
  )
}
