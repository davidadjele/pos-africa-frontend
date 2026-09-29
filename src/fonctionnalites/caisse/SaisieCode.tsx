import { useTranslation } from 'react-i18next'
import { ClavierNumerique } from '../../partage/ui/ClavierNumerique'

export const LONGUEUR_MIN_PIN = 4
export const LONGUEUR_MAX_PIN = 6
/** Longueur du PIN généré par le système (GenerateurCodes côté backend). */
export const LONGUEUR_PIN_TEMPORAIRE = 6

/**
 * Points de saisie et pavé numérique d'un PIN : le code lui-même n'est jamais affiché. Le PIN
 * temporaire a toujours 6 chiffres : ses cases sont annoncées. Un code choisi (4 à 6 chiffres) ne
 * montre que les chiffres tapés, pour ne pas révéler sa longueur à qui regarde l'écran.
 */
export function SaisieCode({
  libelle,
  code,
  longueur,
  surChanger,
  desactive = false,
}: Readonly<{
  libelle: string
  code: string
  /** Longueur connue du code attendu (PIN temporaire), sinon aucune case vide n'est montrée. */
  longueur?: number
  surChanger: (code: string) => void
  desactive?: boolean
}>) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3">
        <span className="text-corps-fort text-encre">{libelle}</span>
        <div
          role="status"
          aria-label={t('caisse.prise.chiffresSaisis', { count: code.length })}
          className="flex h-4 items-center gap-3.5"
        >
          {Array.from({ length: Math.max(longueur ?? 0, code.length) }, (_, rang) => (
            <span
              key={rang}
              data-case
              aria-hidden="true"
              className={`size-3.5 rounded-rond border-2 ${
                rang < code.length ? 'border-accent bg-accent' : 'border-bordure-controle'
              }`}
            />
          ))}
        </div>
      </div>
      <ClavierNumerique
        desactive={desactive}
        surChiffre={(chiffre) => {
          if (code.length < (longueur ?? LONGUEUR_MAX_PIN)) surChanger(code + chiffre)
        }}
        surEffacer={() => {
          surChanger(code.slice(0, -1))
        }}
      />
    </div>
  )
}
