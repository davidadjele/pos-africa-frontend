import { Delete } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const CHIFFRES = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const CLASSES_TOUCHE =
  'min-h-cible-caisse rounded-moyen border border-trait bg-surface text-touche text-encre chiffres hover:bg-fond disabled:text-attenue'

/** Pavé numérique de caisse (code d'enregistrement, PIN) : grandes touches, utilisables au doigt. */
export function ClavierNumerique({
  surChiffre,
  surEffacer,
  desactive = false,
}: Readonly<{
  surChiffre: (chiffre: string) => void
  surEffacer: () => void
  desactive?: boolean
}>) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {CHIFFRES.map((chiffre) => (
        <button
          key={chiffre}
          type="button"
          disabled={desactive}
          className={CLASSES_TOUCHE}
          onClick={() => {
            surChiffre(chiffre)
          }}
        >
          {chiffre}
        </button>
      ))}
      <span aria-hidden="true" />
      <button
        type="button"
        disabled={desactive}
        className={CLASSES_TOUCHE}
        onClick={() => {
          surChiffre('0')
        }}
      >
        0
      </button>
      <button
        type="button"
        disabled={desactive}
        aria-label={t('clavier.effacer')}
        className={`${CLASSES_TOUCHE} flex items-center justify-center bg-fond`}
        onClick={surEffacer}
      >
        <Delete aria-hidden="true" size={24} />
      </button>
    </div>
  )
}
