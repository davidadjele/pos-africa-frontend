export type Devise = 'XOF' | 'XAF' | 'GHS' | 'NGN' | 'GNF' | 'EUR' | 'USD'

export interface Montant {
  /** Entier en unités mineures (centimes, ou francs pour les devises sans décimale). */
  unitesMineures: number
  devise: Devise
}

export type FormeMontant = 'longue' | 'courte' | 'nombre'

interface DescriptionDevise {
  decimales: number
  symbole: string
  symboleCourt: string
}

const DEVISES: Record<Devise, DescriptionDevise> = {
  XOF: { decimales: 0, symbole: 'FCFA', symboleCourt: 'F' },
  XAF: { decimales: 0, symbole: 'FCFA', symboleCourt: 'F' },
  GNF: { decimales: 0, symbole: 'FG', symboleCourt: 'FG' },
  GHS: { decimales: 2, symbole: 'GH₵', symboleCourt: 'GH₵' },
  NGN: { decimales: 2, symbole: '₦', symboleCourt: '₦' },
  EUR: { decimales: 2, symbole: '€', symboleCourt: '€' },
  USD: { decimales: 2, symbole: '$US', symboleCourt: '$' },
}

const ESPACE_FINE_INSECABLE = ' '
const ESPACE_INSECABLE = ' '
const SIGNE_MOINS = '−'

export function formaterMontant(
  { unitesMineures, devise }: Montant,
  { forme = 'longue' }: { forme?: FormeMontant } = {},
): string {
  if (!Number.isSafeInteger(unitesMineures)) {
    throw new RangeError(`Montant invalide : ${String(unitesMineures)} n'est pas un entier sûr.`)
  }
  const { decimales, symbole, symboleCourt } = DEVISES[devise]

  // Découpage sur la représentation décimale : aucune division flottante, donc aucun arrondi.
  const chiffres = Math.abs(unitesMineures)
    .toString()
    .padStart(decimales + 1, '0')
  const partieEntiere = chiffres.slice(0, chiffres.length - decimales)
  const partieDecimale = chiffres.slice(chiffres.length - decimales)

  const entiereGroupee = partieEntiere.replace(/\B(?=(\d{3})+$)/g, ESPACE_FINE_INSECABLE)
  const signe = unitesMineures < 0 ? SIGNE_MOINS : ''
  const nombre = signe + entiereGroupee + (decimales > 0 ? `,${partieDecimale}` : '')

  if (forme === 'nombre') return nombre
  return nombre + ESPACE_INSECABLE + (forme === 'courte' ? symboleCourt : symbole)
}
