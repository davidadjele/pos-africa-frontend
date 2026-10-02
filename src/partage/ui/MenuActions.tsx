import { clsx } from 'clsx'
import { Ellipsis, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

export interface ActionMenu {
  libelle: string
  icone: LucideIcon
  /** « danger » pour une action destructrice (désactiver), qui reste confirmée par un dialogue. */
  ton?: 'normal' | 'danger'
  surChoisir: () => void
}

/**
 * Actions secondaires d'une ligne, derrière un bouton « … » : la ligne garde la hauteur d'une
 * ligne de texte. Menu au sens ARIA : flèches pour parcourir, Échap pour fermer et revenir au bouton.
 */
export function MenuActions({
  libelle,
  actions,
}: Readonly<{ libelle: string; actions: ActionMenu[] }>) {
  const idMenu = useId()
  const [ouvert, setOuvert] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})
  const conteneur = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)
  const elements = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!ouvert) return
    elements.current[0]?.focus()
    function surClicExterieur(evenement: MouseEvent) {
      if (evenement.target instanceof Node && !conteneur.current?.contains(evenement.target))
        setOuvert(false)
    }
    // Positionné par rapport à la fenêtre : il suit mal un défilement, on le ferme plutôt.
    function surDeplacement() {
      setOuvert(false)
    }
    document.addEventListener('mousedown', surClicExterieur)
    window.addEventListener('scroll', surDeplacement, true)
    window.addEventListener('resize', surDeplacement)
    return () => {
      document.removeEventListener('mousedown', surClicExterieur)
      window.removeEventListener('scroll', surDeplacement, true)
      window.removeEventListener('resize', surDeplacement)
    }
  }, [ouvert])

  /**
   * Menu fixé à la fenêtre : dans un tableau qui défile horizontalement, un menu en position absolue
   * serait coupé sur la dernière ligne. Vers le haut quand la place manque en bas de l'écran.
   */
  function ouvrir() {
    const cadre = bouton.current?.getBoundingClientRect()
    if (cadre !== undefined) {
      const hauteurEstimee = actions.length * 48 + 16
      const versLeHaut =
        cadre.bottom + hauteurEstimee > window.innerHeight && cadre.top > hauteurEstimee
      setPosition({
        right: window.innerWidth - cadre.right,
        ...(versLeHaut
          ? { bottom: window.innerHeight - cadre.top + 4 }
          : { top: cadre.bottom + 4 }),
      })
    }
    setOuvert(true)
  }

  function fermer() {
    setOuvert(false)
    bouton.current?.focus()
  }

  function surTouche(evenement: KeyboardEvent<HTMLDivElement>) {
    if (evenement.key === 'Escape') {
      evenement.preventDefault()
      fermer()
      return
    }
    if (evenement.key === 'Tab') {
      setOuvert(false)
      return
    }
    if (evenement.key !== 'ArrowDown' && evenement.key !== 'ArrowUp') return
    evenement.preventDefault()
    const rang = elements.current.indexOf(document.activeElement as HTMLButtonElement | null)
    const pas = evenement.key === 'ArrowDown' ? 1 : -1
    elements.current[(rang + pas + actions.length) % actions.length]?.focus()
  }

  return (
    <div ref={conteneur} className="inline-flex">
      <button
        ref={bouton}
        type="button"
        aria-label={libelle}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idMenu : undefined}
        onClick={() => {
          if (ouvert) setOuvert(false)
          else ouvrir()
        }}
        className="inline-flex size-cible-min items-center justify-center rounded-normal border border-bordure-controle bg-surface text-encre hover:bg-fond"
      >
        <Ellipsis aria-hidden="true" size={18} />
      </button>
      {ouvert && (
        <div
          id={idMenu}
          role="menu"
          aria-label={libelle}
          tabIndex={-1}
          onKeyDown={surTouche}
          style={position}
          className="fixed z-20 flex min-w-56 flex-col rounded-normal border border-trait bg-surface py-1 shadow-flottante"
        >
          {actions.map(({ libelle: texte, icone: Icone, ton = 'normal', surChoisir }, rang) => (
            <button
              key={texte}
              ref={(element) => {
                elements.current[rang] = element
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOuvert(false)
                surChoisir()
              }}
              className={clsx(
                'flex min-h-cible-min items-center gap-3 px-3 text-left text-corps hover:bg-fond focus:bg-fond',
                ton === 'danger' ? 'text-danger' : 'text-encre',
              )}
            >
              <Icone aria-hidden="true" size={18} />
              {texte}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
