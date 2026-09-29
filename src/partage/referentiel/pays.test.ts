import { describe, expect, it } from 'vitest'
import {
  optionsDevises,
  optionsFuseaux,
  optionsPays,
  nomPays,
  PAYS_PAR_DEFAUT,
  reglagesDuPays,
  telephoneDuPays,
} from './pays'

describe('référentiel des pays', () => {
  it('part du Togo, en francs CFA, à l’heure de Lomé, en français', () => {
    expect(PAYS_PAR_DEFAUT).toEqual({
      pays: 'TG',
      devise: 'XOF',
      fuseauHoraire: 'Africa/Lome',
      langue: 'fr',
    })
  })

  it('nomme les pays dans la langue de l’interface', () => {
    expect(nomPays('TG', 'fr')).toBe('Togo')
    expect(nomPays('CI', 'fr')).toBe('Côte d’Ivoire')
    expect(nomPays('GH', 'en')).toBe('Ghana')
    expect(optionsPays('fr')).toContainEqual({ valeur: 'SN', libelle: 'Sénégal' })
  })

  it('propose la devise et le fuseau habituels d’un pays', () => {
    expect(reglagesDuPays('CI')).toEqual({ devise: 'XOF', fuseauHoraire: 'Africa/Abidjan' })
    expect(reglagesDuPays('CM')).toEqual({ devise: 'XAF', fuseauHoraire: 'Africa/Douala' })
    expect(reglagesDuPays('FR')).toBeUndefined()
  })

  it('libelle les devises et les fuseaux sans jargon', () => {
    expect(optionsDevises('fr')).toContainEqual({
      valeur: 'XOF',
      libelle: 'XOF, franc CFA (BCEAO)',
    })
    expect(optionsFuseaux()).toContainEqual({
      valeur: 'Africa/Lome',
      libelle: 'Lomé (Africa/Lome)',
    })
  })

  it('donne l’indicatif et un exemple de numéro local pour guider la saisie', () => {
    expect(telephoneDuPays('TG')).toEqual({ indicatif: '+228', exemple: '90 11 23 45' })
    expect(telephoneDuPays('BJ')).toEqual({ indicatif: '+229', exemple: '01 95 12 34 56' })
    expect(telephoneDuPays('FR')).toBeUndefined()
  })

  it('connaît le téléphone de chaque pays proposé', () => {
    for (const { valeur } of optionsPays('fr')) {
      expect(telephoneDuPays(valeur)?.indicatif).toMatch(/^\+[1-9][0-9]{0,2}$/)
    }
  })
})
