import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ChampSaisie, ChampSelection } from './ChampSaisie'

describe('ChampSaisie', () => {
  it('garde un libellé visible relié au champ', async () => {
    render(<ChampSaisie libelle="Nom de l’établissement" name="nom" />)

    const champ = screen.getByLabelText('Nom de l’établissement')
    await userEvent.type(champ, 'Bè Kpota')

    expect(champ).toHaveValue('Bè Kpota')
    expect(champ).toHaveClass('min-h-cible-min', 'border-bordure-controle', 'rounded-normal')
  })

  it('marque un champ obligatoire d’un astérisque décoratif et de l’attribut required', () => {
    render(<ChampSaisie libelle="Code" name="code" obligatoire />)

    const champ = screen.getByRole('textbox', { name: 'Code' })
    expect(champ).toBeRequired()
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true')
  })

  it('affiche un préfixe fixe devant la saisie, sans le mêler à la valeur', async () => {
    render(<ChampSaisie libelle="Téléphone" name="telephone" prefixe="+228" />)

    const champ = screen.getByRole('textbox', { name: 'Téléphone' })
    await userEvent.type(champ, '90 11 23 45')

    expect(screen.getByText('+228')).toBeVisible()
    expect(champ).toHaveValue('90 11 23 45')
  })

  it('relie l’aide au champ', () => {
    render(
      <ChampSaisie libelle="Code" name="code" aide="2 à 10 lettres ou chiffres, par exemple BE." />,
    )

    expect(screen.getByRole('textbox', { name: 'Code' })).toHaveAccessibleDescription(
      '2 à 10 lettres ou chiffres, par exemple BE.',
    )
  })

  it('en erreur, remplace l’aide par le message et signale le champ invalide', () => {
    render(
      <ChampSaisie
        libelle="Code"
        name="code"
        aide="2 à 10 lettres ou chiffres."
        erreur="Ce code est déjà utilisé."
      />,
    )

    const champ = screen.getByRole('textbox', { name: 'Code' })
    expect(champ).toHaveAttribute('aria-invalid', 'true')
    expect(champ).toHaveAccessibleDescription('Ce code est déjà utilisé.')
    expect(champ).toHaveClass('border-danger')
    expect(screen.getByText('Ce code est déjà utilisé.')).toHaveClass('text-danger')
    expect(screen.queryByText('2 à 10 lettres ou chiffres.')).not.toBeInTheDocument()
  })
})

describe('ChampSelection', () => {
  it('propose ses options sous un libellé visible', async () => {
    render(
      <ChampSelection
        libelle="Fuseau horaire"
        name="fuseauHoraire"
        options={[
          { valeur: 'Africa/Lome', libelle: 'Lomé' },
          { valeur: 'Africa/Abidjan', libelle: 'Abidjan' },
        ]}
        erreur="Choisissez un fuseau."
      />,
    )

    const liste = screen.getByRole('combobox', { name: 'Fuseau horaire' })
    await userEvent.selectOptions(liste, 'Africa/Abidjan')

    expect(liste).toHaveValue('Africa/Abidjan')
    expect(liste).toHaveAttribute('aria-invalid', 'true')
    expect(liste).toHaveAccessibleDescription('Choisissez un fuseau.')
  })
})
