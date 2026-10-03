import { describe, expect, it } from 'vitest'
import { pointsATraiter, type SourcesATraiter } from './aTraiter'

const MAINTENANT = new Date('2026-10-02T20:45:00Z')

const SOURCES: SourcesATraiter = {
  maintenant: MAINTENANT,
  journees: { e1: '2026-10-02', e2: '2026-10-02' },
  caissesOuvertes: [
    {
      id: 'c1',
      etablissementId: 'e2',
      etablissement: 'Agbalépédo',
      caisse: 'Caisse 1',
      statut: 'OUVERTE',
      journee: '2026-10-01',
      ouverteLe: '2026-10-01T09:02:00Z',
      ouvertePar: 'Sena K.',
    },
    {
      id: 'c2',
      etablissementId: 'e1',
      etablissement: 'Bè Kpota',
      caisse: 'Caisse 2, terrasse',
      statut: 'OUVERTE',
      journee: '2026-10-02',
      ouverteLe: '2026-10-02T11:30:00Z',
      ouvertePar: 'Yawa T.',
    },
  ],
  caissesDuJour: [
    {
      id: 'c3',
      etablissementId: 'e1',
      etablissement: 'Bè Kpota',
      caisse: 'Caisse 1, bar',
      statut: 'FERMEE',
      numeroZ: 15,
      journee: '2026-10-02',
      ouverteLe: '2026-10-02T07:00:00Z',
      ouvertePar: 'Afi M.',
      clotureeLe: '2026-10-02T15:00:00Z',
      clotureePar: 'Afi M.',
      ventes: 120_000,
      ecart: -1500,
    },
  ],
  stock: [
    {
      produitId: 'p1',
      nom: 'Castel 65 cl',
      etablissementId: 'e1',
      etablissement: 'Bè Kpota',
      etat: 'NEGATIF',
      quantite: -2,
    },
    {
      produitId: 'p2',
      nom: 'Flag 65 cl',
      etablissementId: 'e2',
      etablissement: 'Agbalépédo',
      etat: 'RUPTURE',
      quantite: 0,
    },
    {
      produitId: 'p3',
      nom: 'Youki 33 cl',
      etablissementId: 'e1',
      etablissement: 'Bè Kpota',
      etat: 'FAIBLE',
      quantite: 3,
    },
    {
      produitId: 'p4',
      nom: 'Eau 1,5 l',
      etablissementId: 'e1',
      etablissement: 'Bè Kpota',
      etat: 'FAIBLE',
      quantite: 2,
    },
  ],
  ardoises: { nombre: 5, montant: 42_500 },
  etablissements: [
    {
      etablissementId: 'e1',
      nom: 'Bè Kpota',
      plusAncienneLe: '2026-10-02T17:00:00Z',
      plusAncienneNote: 'n°42, T4',
    },
    {
      etablissementId: 'e2',
      nom: 'Agbalépédo',
      plusAncienneLe: '2026-10-02T19:30:00Z',
      plusAncienneNote: 'n°9',
    },
  ],
  annulations: { articles: 3, montant: 4800, serveur: 'Kossi A.', articlesDuServeur: 2 },
}

describe('À traiter', () => {
  it('range l’urgent d’abord : caisse oubliée, écart, stock négatif, puis ce qui se surveille', () => {
    expect(pointsATraiter(SOURCES).map((point) => [point.cle, point.ton])).toEqual([
      ['caisseOubliee', 'danger'],
      ['ecart', 'danger'],
      ['stockNegatif', 'danger'],
      ['rupture', 'alerte'],
      ['noteAncienne', 'alerte'],
      ['annulations', 'alerte'],
      ['stockFaible', 'info'],
      ['ardoises', 'info'],
    ])
  })

  it('ne retient qu’une note ouverte depuis plus de 3 heures', () => {
    const note = pointsATraiter(SOURCES).find((point) => point.cle === 'noteAncienne')
    expect(note?.valeurs).toMatchObject({
      etablissement: 'Bè Kpota',
      note: 'n°42, T4',
      duree: '3 h 45',
    })
  })

  it('ne dit rien quand tout va bien, ou quand une source n’est pas permise', () => {
    expect(
      pointsATraiter({
        maintenant: MAINTENANT,
        journees: {},
        etablissements: [],
        annulations: { articles: 0, montant: 0, articlesDuServeur: 0 },
      }),
    ).toEqual([])
  })
})
