import { Check, Copy } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bouton } from './Bouton'

/**
 * Code d'accès temporaire (PIN, mot de passe), affiché une seule fois. Les groupes sont séparés
 * par la mise en page et non par des espaces ; le bouton copie le code exact.
 */
export function CodeSecret({
  libelle,
  code,
  copiable = true,
}: Readonly<{
  libelle: string
  code: string
  /** Faux pour un code à taper sur un autre appareil (tablette) plutôt qu'à coller. */
  copiable?: boolean
}>) {
  const { t } = useTranslation()
  const idLibelle = useId()
  const [copie, setCopie] = useState(false)
  const taille = /^\d+$/.test(code) ? 3 : 4
  const groupes: { debut: number; texte: string }[] = []
  for (let debut = 0; debut < code.length; debut += taille) {
    groupes.push({ debut, texte: code.slice(debut, debut + taille) })
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(code)
      setCopie(true)
    } catch {
      // Presse-papiers refusé (navigateur ancien, contexte non sécurisé) : le code reste lisible.
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-normal border border-trait bg-fond px-4 py-3">
      <span id={idLibelle} className="text-legende font-semibold text-attenue">
        {libelle}
      </span>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span data-code className="flex flex-wrap gap-x-3 text-montant-total text-encre">
          {groupes.map(({ debut, texte }) => (
            // Deux groupes identiques sont possibles (« 482 482 ») : leur position les distingue.
            <span key={debut} className="chiffres tracking-[0.08em]">
              {texte}
            </span>
          ))}
        </span>
        {copiable && (
          <Bouton
            icone={copie ? Check : Copy}
            aria-describedby={idLibelle}
            onClick={() => void copier()}
          >
            {copie ? t('commun.copie') : t('commun.copier')}
          </Bouton>
        )}
      </div>
    </div>
  )
}
