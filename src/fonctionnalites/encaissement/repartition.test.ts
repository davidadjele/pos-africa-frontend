import { describe, expect, it } from 'vitest'
import { repartirRemboursement } from './repartition'

describe('repartirRemboursement', () => {
  const modes = [
    { mode: 'ESPECES' as const, paye: 600, rembourse: 0, remboursable: 600 },
    { mode: 'ARDOISE' as const, paye: 500, rembourse: 0, remboursable: 500 },
  ]

  it('rend d’abord sur l’ardoise, les espèces en dernier', () => {
    expect(repartirRemboursement(1100, modes)).toEqual([
      { mode: 'ARDOISE', montant: 500 },
      { mode: 'ESPECES', montant: 600 },
    ])
    expect(repartirRemboursement(300, modes)).toEqual([{ mode: 'ARDOISE', montant: 300 }])
  })

  it('dit quand la note ne permet pas de rendre autant', () => {
    expect(repartirRemboursement(1200, modes)).toBeNull()
    expect(repartirRemboursement(0, modes)).toEqual([])
  })
})
