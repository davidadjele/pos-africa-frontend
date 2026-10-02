import { useMemo } from 'react'
import { encode } from 'uqr'

/** Un QR code dessiné en SVG, d'un seul tracé à la couleur du texte : il s'imprime net sur un ticket thermique. */
export function CodeQr({
  texte,
  libelle,
  taille = 96,
}: Readonly<{ texte: string; libelle: string; taille?: number }>) {
  const { size, trace } = useMemo(() => {
    const code = encode(texte, { border: 0 })
    const modules = code.data.flatMap((ligne, y) =>
      ligne.flatMap((noir, x) => (noir ? [`M${String(x)} ${String(y)}h1v1h-1z`] : [])),
    )
    return { size: code.size, trace: modules.join('') }
  }, [texte])
  return (
    <svg
      role="img"
      aria-label={libelle}
      width={taille}
      height={taille}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      shapeRendering="crispEdges"
      className="block"
    >
      <path d={trace} fill="currentColor" />
    </svg>
  )
}
