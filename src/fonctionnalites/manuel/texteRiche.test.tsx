import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { texteRiche } from './texteRiche'

describe('texte riche du manuel', () => {
  it('met en gras les libellés de l’interface, entre doubles astérisques', () => {
    const { container } = render(<p>{texteRiche('Touchez **Encaisser**, puis **Valider**.')}</p>)
    expect(container.querySelector('p')).toHaveTextContent('Touchez Encaisser, puis Valider.')
    expect([...container.querySelectorAll('strong')].map((gras) => gras.textContent)).toEqual([
      'Encaisser',
      'Valider',
    ])
  })

  it('laisse un texte sans libellé tel quel, et un astérisque seul n’ouvre rien', () => {
    const { container } = render(<p>{texteRiche('Prix TTC* sans gras')}</p>)
    expect(container.querySelector('p')).toHaveTextContent('Prix TTC* sans gras')
    expect(container.querySelector('strong')).toBeNull()
  })
})
