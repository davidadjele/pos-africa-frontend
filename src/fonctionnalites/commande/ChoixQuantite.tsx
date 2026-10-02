import { useTranslation } from 'react-i18next'
import { Bouton } from '../../partage/ui/Bouton'

/** Combien d'unités d'une ligne : au moins 1, au plus la quantité de la ligne. */
export function ChoixQuantite({
  question,
  libelleMoins,
  libellePlus,
  quantite,
  maximum,
  surChanger,
}: Readonly<{
  question: string
  libelleMoins: string
  libellePlus: string
  quantite: number
  maximum: number
  surChanger: (quantite: number) => void
}>) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-libelle text-encre">{question}</span>
      <Bouton
        aria-label={libelleMoins}
        disabled={quantite <= 1}
        className="h-14 w-14 text-titre-section"
        onClick={() => {
          surChanger(quantite - 1)
        }}
      >
        −
      </Bouton>
      <output className="chiffres w-12 text-center text-touche">{quantite}</output>
      <Bouton
        aria-label={libellePlus}
        disabled={quantite >= maximum}
        className="h-14 w-14 text-titre-section"
        onClick={() => {
          surChanger(quantite + 1)
        }}
      >
        +
      </Bouton>
      <span className="text-libelle text-attenue">
        {t('caisse.note.annulation.sur', { count: maximum })}
      </span>
    </div>
  )
}
