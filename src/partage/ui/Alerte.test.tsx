import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErreurApi } from '../api/ErreurApi'
import { Alerte, AlerteErreur } from './Alerte'

describe('Alerte', () => {
  it('annonce un message sur un fond teinté bordé, sans ombre', () => {
    render(<Alerte ton="succes">Maquis Chez Tanti a été créée.</Alerte>)

    const alerte = screen.getByRole('status')
    expect(alerte).toHaveTextContent('Maquis Chez Tanti a été créée.')
    expect(alerte).toHaveClass('bg-succes-fond', 'border', 'rounded-normal')
  })

  it('interrompt la lecture d’écran pour une erreur', () => {
    render(<Alerte ton="danger">Le serveur est injoignable.</Alerte>)

    expect(screen.getByRole('alert')).toHaveClass('bg-danger-fond', 'border-danger-bord')
  })
})

describe('AlerteErreur', () => {
  it('traduit le code et montre le traceId pour le support', () => {
    render(
      <AlerteErreur
        erreur={
          new ErreurApi({
            statut: 500,
            code: 'ERREUR_INTERNE',
            message: 'x',
            traceId: 'c0ffee42',
          })
        }
      />,
    )

    const alerte = screen.getByRole('alert')
    expect(alerte).toHaveTextContent('Une erreur inattendue est survenue.')
    expect(alerte).toHaveTextContent('Code pour le support : c0ffee42')
  })

  it('n’affiche pas de code quand il n’y en a pas', () => {
    render(
      <AlerteErreur
        erreur={new ErreurApi({ statut: 0, code: 'RESEAU_INDISPONIBLE', message: 'x' })}
      />,
    )

    expect(screen.getByRole('alert')).not.toHaveTextContent('Code pour le support')
  })
})
