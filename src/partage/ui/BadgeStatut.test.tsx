import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BadgeStatut, type TonStatut } from './BadgeStatut'

describe('BadgeStatut', () => {
  it.each<[TonStatut, string, string[]]>([
    ['succes', 'Payée', ['text-succes', 'bg-succes-fond']],
    ['alerte', 'Stock faible', ['text-alerte-texte', 'bg-alerte-fond']],
    ['danger', '3 articles à envoyer', ['text-danger', 'bg-danger-fond']],
    ['info', 'Ma table', ['text-info', 'bg-info-fond']],
    ['neutre', 'Fermé', ['text-attenue', 'bg-fond']],
  ])('affiche le ton %s avec son mot sur un fond teinté', (ton, mot, classes) => {
    render(<BadgeStatut ton={ton}>{mot}</BadgeStatut>)

    expect(screen.getByText(mot)).toHaveClass(...classes)
  })

  it('est un badge rectangulaire compact, sans pastille ni point devant le mot', () => {
    render(<BadgeStatut ton="alerte">Addition demandée</BadgeStatut>)

    const badge = screen.getByText('Addition demandée')
    expect(badge).toHaveClass('rounded-petit', 'text-badge', 'h-5', 'px-1.5')
    expect(badge).not.toHaveClass('rounded-rond')
    expect(badge.children).toHaveLength(0)
  })
})
