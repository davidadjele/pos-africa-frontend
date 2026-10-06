import { describe, expect, it } from 'vitest'
import type { GroupeCarte } from '../../partage/api/contrat'
import { basculer, groupesManquants, prixAvecChoix, choixDansLOrdre } from './choixOptions'

const CUISSON: GroupeCarte = {
  id: 'g-cuisson',
  nom: 'Cuisson',
  choixMultiple: false,
  obligatoire: true,
  choix: [
    { id: 'saignant', nom: 'Saignant', supplement: 0, epuise: false },
    { id: 'a-point', nom: 'À point', supplement: 0, epuise: false },
  ],
}
const SUPPLEMENTS: GroupeCarte = {
  id: 'g-supplements',
  nom: 'Suppléments',
  choixMultiple: true,
  obligatoire: false,
  maximum: 2,
  choix: [
    { id: 'oeuf', nom: 'Œuf', supplement: 200, epuise: false },
    { id: 'fromage', nom: 'Fromage', supplement: 300, epuise: false },
    { id: 'piment', nom: 'Piment', supplement: 0, epuise: true },
  ],
}
const GROUPES = [CUISSON, SUPPLEMENTS]

describe('choix des options en caisse', () => {
  it('remplace le choix d’un groupe à choix unique', () => {
    expect(basculer(GROUPES, ['saignant'], 'a-point')).toEqual(['a-point'])
  })

  it('ajoute et retire dans un groupe à choix multiple, sans dépasser le maximum', () => {
    const deux = basculer(GROUPES, basculer(GROUPES, [], 'oeuf'), 'fromage')
    expect(deux).toEqual(['oeuf', 'fromage'])
    expect(basculer(GROUPES, deux, 'oeuf')).toEqual(['fromage'])
  })

  it('ignore un choix épuisé', () => {
    expect(basculer(GROUPES, [], 'piment')).toEqual([])
  })

  it('dit quels groupes obligatoires attendent un choix', () => {
    expect(groupesManquants(GROUPES, ['oeuf']).map((groupe) => groupe.nom)).toEqual(['Cuisson'])
    expect(groupesManquants(GROUPES, ['a-point'])).toEqual([])
  })

  it('ajoute les suppléments au prix, et rend les choix dans l’ordre de la carte', () => {
    expect(prixAvecChoix(5000, GROUPES, ['fromage', 'oeuf', 'a-point'])).toBe(5500)
    expect(choixDansLOrdre(GROUPES, ['fromage', 'a-point', 'oeuf'])).toEqual([
      'a-point',
      'oeuf',
      'fromage',
    ])
  })
})
