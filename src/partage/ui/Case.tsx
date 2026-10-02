import { useId } from 'react'

/** Une case à cocher avec son libellé et une phrase d'aide sous le libellé. */
export function Case({
  libelle,
  aide,
  ...reste
}: Readonly<
  { libelle: string; aide: string } & React.InputHTMLAttributes<HTMLInputElement> & {
      ref?: React.Ref<HTMLInputElement>
    }
>) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        aria-describedby={`${id}-aide`}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-accent"
        {...reste}
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="cursor-pointer text-corps font-semibold text-encre">
          {libelle}
        </label>
        <p id={`${id}-aide`} className="m-0 text-legende text-attenue">
          {aide}
        </p>
      </div>
    </div>
  )
}
