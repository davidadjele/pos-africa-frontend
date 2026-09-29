import { clsx } from 'clsx'
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

interface ProprietesCommunes {
  libelle: string
  aide?: string | undefined
  /** Message de validation : ce qu'il faut corriger. */
  erreur?: string | undefined
  obligatoire?: boolean
}

// 16 px sur téléphone : en dessous, iOS zoome sur le champ au focus.
const CLASSES_CONTROLE =
  'min-h-cible-min w-full rounded-normal border bg-surface px-3 font-texte text-[16px] text-encre hover:border-encre md:text-corps'

function Enveloppe({
  id,
  libelle,
  aide,
  erreur,
  obligatoire,
  children,
}: ProprietesCommunes & { id: string; children: ReactNode }) {
  const message = erreur ?? aide
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-libelle text-encre">
        {libelle}
        {obligatoire && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {message !== undefined && (
        <p
          id={`${id}-message`}
          className={clsx(
            'm-0 text-legende',
            erreur === undefined ? 'text-attenue' : 'text-danger',
          )}
        >
          {message}
        </p>
      )}
    </div>
  )
}

function attributsAccessibilite(id: string, { aide, erreur }: ProprietesCommunes) {
  return {
    'aria-invalid': erreur !== undefined ? true : undefined,
    'aria-describedby': (erreur ?? aide) !== undefined ? `${id}-message` : undefined,
  }
}

export function ChampSaisie({
  libelle,
  aide,
  erreur,
  obligatoire = false,
  prefixe,
  className,
  id: idFourni,
  ...reste
}: ProprietesCommunes &
  InputHTMLAttributes<HTMLInputElement> & {
    /** Texte fixe devant la saisie (indicatif téléphonique), hors de la valeur envoyée. */
    prefixe?: string | undefined
    ref?: React.Ref<HTMLInputElement>
  }) {
  const idGenere = useId()
  const id = idFourni ?? idGenere
  return (
    <Enveloppe id={id} libelle={libelle} aide={aide} erreur={erreur} obligatoire={obligatoire}>
      {/* Conteneur toujours présent : si le préfixe apparaît ou disparaît, l'input garde le focus. */}
      <div className="flex gap-2">
        {prefixe !== undefined && (
          <span className="chiffres flex min-h-cible-min items-center rounded-normal border border-trait bg-fond px-3 text-corps text-encre">
            {prefixe}
          </span>
        )}
        <input
          id={id}
          required={obligatoire}
          className={clsx(
            CLASSES_CONTROLE,
            'min-w-0 flex-1',
            erreur === undefined ? 'border-bordure-controle' : 'border-danger',
            className,
          )}
          {...attributsAccessibilite(id, { libelle, aide, erreur })}
          {...reste}
        />
      </div>
    </Enveloppe>
  )
}

export interface OptionSelection {
  valeur: string
  libelle: string
}

export function ChampSelection({
  libelle,
  aide,
  erreur,
  obligatoire = false,
  options,
  className,
  id: idFourni,
  ...reste
}: ProprietesCommunes &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: OptionSelection[]
    ref?: React.Ref<HTMLSelectElement>
  }) {
  const idGenere = useId()
  const id = idFourni ?? idGenere
  return (
    <Enveloppe id={id} libelle={libelle} aide={aide} erreur={erreur} obligatoire={obligatoire}>
      <select
        id={id}
        required={obligatoire}
        className={clsx(
          CLASSES_CONTROLE,
          erreur === undefined ? 'border-bordure-controle' : 'border-danger',
          className,
        )}
        {...attributsAccessibilite(id, { libelle, aide, erreur })}
        {...reste}
      >
        {options.map(({ valeur, libelle: texte }) => (
          <option key={valeur} value={valeur}>
            {texte}
          </option>
        ))}
      </select>
    </Enveloppe>
  )
}
