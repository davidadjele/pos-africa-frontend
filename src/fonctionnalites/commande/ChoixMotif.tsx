import { clsx } from 'clsx'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChampSaisie } from '../../partage/ui/ChampSaisie'

/** Motif choisi, et précisé en toutes lettres pour « Autre ». */
export interface Motif<M extends string> {
  motif: M
  detail?: string
}

/**
 * État du choix d'un motif d'annulation : `valider()` montre ce qui manque et rend le motif complet,
 * ou null tant qu'il ne l'est pas.
 */
export function useChoixMotif<M extends string>() {
  const [motif, setMotif] = useState<M | null>(null)
  const [detail, setDetail] = useState('')
  const [tente, setTente] = useState(false)
  const detailManquant = motif === 'AUTRE' && detail.trim() === ''
  return {
    motif,
    detail,
    tente,
    detailManquant,
    setMotif,
    setDetail,
    valider(): Motif<M> | null {
      setTente(true)
      if (motif === null || detailManquant) return null
      return motif === 'AUTRE' ? { motif, detail: detail.trim() } : { motif }
    },
  }
}

/** @param prefixe clés de traduction des motifs : d'annulation, ou de remise */
export function ChoixMotif<M extends string>({
  motifs,
  choix,
  prefixe = 'caisse.motifs',
}: Readonly<{
  motifs: readonly M[]
  choix: ReturnType<typeof useChoixMotif<M>>
  prefixe?: string
}>) {
  const { t } = useTranslation()
  const id = useId()
  const manquant = choix.tente && choix.motif === null
  return (
    <>
      <fieldset
        className="m-0 flex flex-col gap-2 border-0 p-0"
        aria-describedby={manquant ? `${id}-erreur` : undefined}
      >
        <legend className="mb-2 p-0 text-libelle text-encre">
          {t('caisse.note.annulation.motif')}
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {motifs.map((candidat) => (
            <label
              key={candidat}
              className={clsx(
                'flex min-h-cible-caisse cursor-pointer items-center gap-2.5 rounded-normal border bg-surface px-3 text-corps text-encre',
                choix.motif === candidat ? 'border-2 border-accent font-bold' : 'border-trait',
              )}
            >
              <input
                type="radio"
                name={id}
                value={candidat}
                checked={choix.motif === candidat}
                onChange={() => {
                  choix.setMotif(candidat)
                }}
              />
              {t(`${prefixe}.${candidat}`)}
            </label>
          ))}
        </div>
        {manquant && (
          <p id={`${id}-erreur`} className="m-0 text-legende text-danger">
            {t('caisse.note.annulation.choisirMotif')}
          </p>
        )}
      </fieldset>
      {choix.motif === 'AUTRE' && (
        <ChampSaisie
          libelle={t('caisse.note.annulation.detail')}
          obligatoire
          maxLength={120}
          value={choix.detail}
          erreur={
            choix.tente && choix.detailManquant
              ? t('caisse.note.annulation.detailRequis')
              : undefined
          }
          onChange={(evenement) => {
            choix.setDetail(evenement.target.value)
          }}
        />
      )}
    </>
  )
}

/** Libellé d'un motif enregistré : le texte libre pour « Autre ». */
export function libelleMotif(
  motif: string,
  detail: string | undefined,
  t: (cle: string) => string,
  prefixe = 'caisse.motifs',
): string {
  return motif === 'AUTRE' && detail !== undefined ? detail : t(`${prefixe}.${motif}`)
}
