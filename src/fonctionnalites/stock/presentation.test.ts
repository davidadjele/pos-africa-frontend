import { describe, expect, it } from 'vitest'
import { i18n } from '../../partage/i18n/i18n'
import type { MouvementStockResume } from '../../partage/api/contrat'
import { detailMouvement, libelleMouvement } from './presentation'

const t = i18n.getFixedT('fr')
const mouvement = (partiel: Partial<MouvementStockResume>): MouvementStockResume => ({
  id: 'd0000000-0000-4000-8000-000000000001',
  type: 'VENTE',
  quantite: -2,
  quantiteApres: 10,
  par: 'Kossi A.',
  le: '2026-10-01T20:12:00Z',
  ...partiel,
})

describe('mouvements de stock', () => {
  it('dit d’où vient une vente ou un retour, et pourquoi un article est perdu', () => {
    expect(libelleMouvement(mouvement({ detail: 'n°42, T4' }), t)).toBe('Vente, n°42, T4')
    expect(detailMouvement(mouvement({ type: 'RETOUR', quantite: 1, detail: 'n°42, T4' }), t)).toBe(
      'n°42, T4',
    )
    expect(
      detailMouvement(mouvement({ type: 'PERTE', motif: 'ANNULE', detail: 'n°42, T4' }), t),
    ).toBe('Annulé, perdu, n°42, T4')
    expect(detailMouvement(mouvement({ type: 'RECEPTION', reference: 'BL 2240' }), t)).toBe(
      'BL 2240',
    )
  })
})
