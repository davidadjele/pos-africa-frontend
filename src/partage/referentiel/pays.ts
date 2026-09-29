import type { OptionSelection } from '../ui/ChampSaisie'

interface Pays {
  code: string
  devise: string
  fuseauHoraire: string
  indicatif: string
  /** Mobile au format local, tiré de libphonenumber (celle du backend) : il passe sa validation. */
  exempleTelephone: string
}

// Pays servis au lancement (Afrique de l'Ouest et centrale). Le backend accepte tout code ISO :
// cette liste ne sert qu'à proposer des valeurs cohérentes.
const PAYS: Pays[] = [
  {
    code: 'TG',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Lome',
    indicatif: '+228',
    exempleTelephone: '90 11 23 45',
  },
  {
    code: 'BJ',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Porto-Novo',
    indicatif: '+229',
    exempleTelephone: '01 95 12 34 56',
  },
  {
    code: 'BF',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Ouagadougou',
    indicatif: '+226',
    exempleTelephone: '70 12 34 56',
  },
  {
    code: 'CI',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Abidjan',
    indicatif: '+225',
    exempleTelephone: '01 23 45 67 89',
  },
  {
    code: 'ML',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Bamako',
    indicatif: '+223',
    exempleTelephone: '65 01 23 45',
  },
  {
    code: 'NE',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Niamey',
    indicatif: '+227',
    exempleTelephone: '93 12 34 56',
  },
  {
    code: 'SN',
    devise: 'XOF',
    fuseauHoraire: 'Africa/Dakar',
    indicatif: '+221',
    exempleTelephone: '70 123 45 67',
  },
  {
    code: 'GN',
    devise: 'GNF',
    fuseauHoraire: 'Africa/Conakry',
    indicatif: '+224',
    exempleTelephone: '601 12 34 56',
  },
  {
    code: 'GH',
    devise: 'GHS',
    fuseauHoraire: 'Africa/Accra',
    indicatif: '+233',
    exempleTelephone: '023 123 4567',
  },
  {
    code: 'NG',
    devise: 'NGN',
    fuseauHoraire: 'Africa/Lagos',
    indicatif: '+234',
    exempleTelephone: '0802 123 4567',
  },
  {
    code: 'CM',
    devise: 'XAF',
    fuseauHoraire: 'Africa/Douala',
    indicatif: '+237',
    exempleTelephone: '6 71 23 45 67',
  },
  {
    code: 'GA',
    devise: 'XAF',
    fuseauHoraire: 'Africa/Libreville',
    indicatif: '+241',
    exempleTelephone: '06 03 12 34',
  },
]

const DEVISES = ['XOF', 'XAF', 'GNF', 'GHS', 'NGN', 'EUR', 'USD']

const VILLES_FUSEAUX: Record<string, string> = {
  'Africa/Lome': 'Lomé',
  'Africa/Porto-Novo': 'Porto-Novo',
  'Africa/Ouagadougou': 'Ouagadougou',
  'Africa/Abidjan': 'Abidjan',
  'Africa/Bamako': 'Bamako',
  'Africa/Niamey': 'Niamey',
  'Africa/Dakar': 'Dakar',
  'Africa/Conakry': 'Conakry',
  'Africa/Accra': 'Accra',
  'Africa/Lagos': 'Lagos',
  'Africa/Douala': 'Douala',
  'Africa/Libreville': 'Libreville',
}

export const PAYS_PAR_DEFAUT = {
  pays: 'TG',
  devise: 'XOF',
  fuseauHoraire: 'Africa/Lome',
  langue: 'fr',
} as const

export function nomPays(code: string, langue: string): string {
  return new Intl.DisplayNames([langue], { type: 'region', fallback: 'code' }).of(code) ?? code
}

export function reglagesDuPays(
  code: string,
): { devise: string; fuseauHoraire: string } | undefined {
  const pays = PAYS.find((candidat) => candidat.code === code)
  return pays && { devise: pays.devise, fuseauHoraire: pays.fuseauHoraire }
}

export function optionsPays(langue: string): OptionSelection[] {
  return PAYS.map(({ code }) => ({ valeur: code, libelle: nomPays(code, langue) }))
}

export function optionsDevises(langue: string): OptionSelection[] {
  const noms = new Intl.DisplayNames([langue], { type: 'currency', fallback: 'code' })
  return DEVISES.map((code) => ({ valeur: code, libelle: `${code}, ${noms.of(code) ?? code}` }))
}

export function optionsFuseaux(): OptionSelection[] {
  return Object.entries(VILLES_FUSEAUX).map(([fuseau, ville]) => ({
    valeur: fuseau,
    libelle: `${ville} (${fuseau})`,
  }))
}

export function telephoneDuPays(code: string): { indicatif: string; exemple: string } | undefined {
  const pays = PAYS.find((candidat) => candidat.code === code)
  return pays && { indicatif: pays.indicatif, exemple: pays.exempleTelephone }
}
