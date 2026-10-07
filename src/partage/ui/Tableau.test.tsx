import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BadgeStatut } from './BadgeStatut'
import { Pagination, Tableau, type ColonneTableau } from './Tableau'

interface Etablissement {
  id: string
  code: string
  nom: string
  couverts: number
}

const COLONNES: ColonneTableau<Etablissement>[] = [
  { cle: 'code', entete: 'Code', rendu: (e) => e.code },
  { cle: 'nom', entete: 'Nom', rendu: (e) => <BadgeStatut ton="succes">{e.nom}</BadgeStatut> },
  { cle: 'couverts', entete: 'Couverts', rendu: (e) => e.couverts, numerique: true },
  { cle: 'ville', entete: 'Ville', rendu: () => 'Lomé', masqueeSurTelephone: true },
]

describe('Tableau', () => {
  it('présente les lignes sous des en-têtes, dans un cadre qui défile seul', () => {
    render(
      <Tableau
        libelle="Établissements"
        colonnes={COLONNES}
        lignes={[
          { id: '1', code: 'BE', nom: 'Bè Kpota', couverts: 42 },
          { id: '2', code: 'AG', nom: 'Agbalépédo', couverts: 18 },
        ]}
        cleLigne={(e) => e.id}
      />,
    )

    const tableau = screen.getByRole('table', { name: 'Établissements' })
    expect(tableau.parentElement).toHaveClass('overflow-x-auto', 'border-trait', 'rounded-moyen')
    expect(
      within(tableau)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Code', 'Nom', 'Couverts', 'Ville'])
    const lignes = within(tableau).getAllByRole('row')
    expect(lignes).toHaveLength(3)
    expect(screen.getByRole('row', { name: /Bè Kpota/ })).toHaveTextContent('BE')
  })

  it('aligne les nombres à droite en chiffres tabulaires', () => {
    render(
      <Tableau
        libelle="Établissements"
        colonnes={COLONNES}
        lignes={[{ id: '1', code: 'BE', nom: 'Bè Kpota', couverts: 42 }]}
        cleLigne={(e) => e.id}
      />,
    )

    expect(screen.getByRole('cell', { name: '42' })).toHaveClass('text-right', 'chiffres')
    expect(screen.getByRole('columnheader', { name: 'Couverts' })).toHaveClass('text-right')
  })

  it('peut masquer une colonne secondaire sur téléphone', () => {
    render(
      <Tableau
        libelle="Établissements"
        colonnes={COLONNES}
        lignes={[{ id: '1', code: 'BE', nom: 'Bè Kpota', couverts: 42 }]}
        cleLigne={(e) => e.id}
      />,
    )

    expect(screen.getByRole('cell', { name: 'Lomé' })).toHaveClass('hidden', 'md:table-cell')
  })
})

describe('Pagination', () => {
  it('n’apparaît pas quand tout tient sur une page', () => {
    const { container } = render(
      <Pagination page={0} taille={50} total={12} surChangerPage={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('situe la page et permet d’avancer ou de reculer', async () => {
    const surChangerPage = vi.fn()
    render(<Pagination page={1} taille={50} total={132} surChangerPage={surChangerPage} />)

    expect(screen.getByText('51–100 sur 132')).toHaveClass('chiffres')
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }))
    await userEvent.click(screen.getByRole('button', { name: 'Page précédente' }))

    expect(surChangerPage.mock.calls).toEqual([[2], [0]])
  })

  it('dit « plus de » quand le total n’est qu’un minimum, et laisse avancer', () => {
    render(<Pagination page={0} taille={50} total={1000} totalMinimum surChangerPage={vi.fn()} />)

    expect(screen.getByText('1–50 sur plus de 1 000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page suivante' })).toBeEnabled()
  })

  it('désactive ce qui sort des pages existantes', () => {
    render(<Pagination page={2} taille={50} total={132} surChangerPage={vi.fn()} />)

    expect(screen.getByText('101–132 sur 132')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page suivante' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeEnabled()
  })
})
