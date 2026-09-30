import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { EvenementActivite } from '../../partage/api/contrat'
import { i18n } from '../../partage/i18n/i18n'
import { auteurDe, detailActivite, PhraseActivite, type ContexteActivite } from './description'

const t = i18n.getFixedT('fr')
// Espaces des montants et des taux : fine insécable entre milliers, insécable avant l'unité.
const FINE = '\u202f'
const INSEC = '\u00a0'
const CONTEXTE: ContexteActivite = {
  devise: 'XOF',
  fuseauHoraire: 'Africa/Lome',
  etablissements: new Map([['e-be', 'Bè Kpota']]),
}

function evenement(partiel: Partial<EvenementActivite>): EvenementActivite {
  return {
    id: 'a1',
    type: 'PRIX_MODIFIE',
    domaine: 'CARTE',
    critique: true,
    objetType: 'PRODUIT',
    objetId: 'p1',
    objetLibelle: 'Flag 65 cl',
    auteurNom: 'Tanti A.',
    survenuLe: '2026-09-29T18:10:00Z',
    details: {},
    detailsNoms: {},
    ...partiel,
  }
}

describe('description de l’activité', () => {
  it('écrit une phrase lisible, auteur et objet en gras', () => {
    const { container } = render(
      <PhraseActivite
        evenement={evenement({ type: 'PRIX_ETABLISSEMENT_MODIFIE', etablissementNom: 'Bè Kpota' })}
      />,
    )
    expect(container).toHaveTextContent('Tanti A. a changé le prix de Flag 65 cl à Bè Kpota')
    expect(container.querySelectorAll('strong')).toHaveLength(2)
  })

  it('montre un changement de prix, le prix de base quand il n’y a pas de prix propre', () => {
    expect(detailActivite(evenement({ details: { avant: 1000, apres: 1200 } }), t, CONTEXTE)).toBe(
      `1${FINE}000${INSEC}F → 1${FINE}200${INSEC}F`,
    )
    expect(
      detailActivite(
        evenement({ type: 'PRIX_ETABLISSEMENT_MODIFIE', details: { avant: 1200, apres: null } }),
        t,
        CONTEXTE,
      ),
    ).toBe(`1${FINE}200${INSEC}F → Prix de base`)
  })

  it('montre un changement de taux et de rôles', () => {
    expect(
      detailActivite(
        evenement({ type: 'TAUX_TAXE_MODIFIE', details: { avant: 1800, apres: 1900 } }),
        t,
        CONTEXTE,
      ),
    ).toBe(`18${INSEC}% → 19${INSEC}%`)
    expect(
      detailActivite(
        evenement({
          type: 'ROLES_MODIFIES',
          details: { avant: ['SERVEUR@e-be'], apres: ['CAISSIER@e-be', 'SERVEUR@e-autre'] },
        }),
        t,
        CONTEXTE,
      ),
    ).toBe(
      'Avant : Serveur à Bè Kpota. Après : Caissier à Bè Kpota, Serveur à un autre établissement.',
    )
  })

  it('attribue à l’équipe Tonti une action sans auteur dans l’entreprise', () => {
    // Sans auteur dans l'entreprise : créée depuis l'espace plateforme.
    const { auteurNom } = auteurDe(
      {
        id: 'a2',
        type: 'TAXE_CREEE',
        domaine: 'CARTE',
        critique: false,
        objetType: 'TAXE',
        objetId: 't1',
        objetLibelle: 'TVA',
        survenuLe: '2026-09-29T09:00:00Z',
        details: { taux: 1800 },
        detailsNoms: {},
      },
      t,
    )
    expect(auteurNom).toBe('Équipe Tonti')
  })

  it('traduit l’action validée par un gérant', () => {
    const { container } = render(
      <PhraseActivite
        evenement={auteurDe(
          evenement({
            type: 'VALIDATION_GERANT_UTILISEE',
            auteurNom: 'Kossi A.',
            objetLibelle: 'LIGNE_ANNULER_APRES_ENVOI',
            detailsNoms: { validateurId: 'Afi M.' },
          }),
          t,
        )}
      />,
    )
    expect(container).toHaveTextContent(
      'Kossi A. a obtenu la validation de Afi M. pour annuler des articles envoyés',
    )
  })

  it('détaille une annulation d’article envoyé : quantité, montant, où, motif, validation', () => {
    const annulation = (details: Record<string, unknown>, detailsNoms = {}) =>
      detailActivite(
        evenement({
          type: 'LIGNE_ANNULEE',
          domaine: 'CAISSE',
          objetLibelle: 'Attiéké poisson',
          details: { quantite: 1, montant: 3500, motif: 'NON_SERVIE', numero: 42, ...details },
          detailsNoms,
        }),
        t,
        CONTEXTE,
      )

    expect(annulation({ table: 'T4' }, { validateurId: 'Afi M.' })).toBe(
      `1 × 3${FINE}500${INSEC}F, T4, n°42. Motif : Non servie (trop d’attente). Validé par Afi M.`,
    )
    expect(annulation({ motif: 'AUTRE', detail: 'Renversé au service' })).toBe(
      `1 × 3${FINE}500${INSEC}F, n°42. Motif : Renversé au service.`,
    )
  })

  it('détaille l’annulation d’une note, un transfert et un changement de serveur', () => {
    const detail = (
      type: EvenementActivite['type'],
      details: Record<string, unknown>,
      detailsNoms = {},
    ) => detailActivite(evenement({ type, domaine: 'CAISSE', details, detailsNoms }), t, CONTEXTE)

    expect(
      detail(
        'NOTE_ANNULEE',
        { montant: 12600, motif: 'CLIENT_PARTI', numero: 42, table: 'T4' },
        { validateurId: 'Afi M.' },
      ),
    ).toBe(`12${FINE}600${INSEC}F, T4, n°42. Motif : Le client est parti. Validé par Afi M.`)
    expect(detail('TABLE_TRANSFEREE', { de: 'T4', vers: 'T5', numero: 42 })).toBe('T4 → T5, n°42')
    expect(detail('SERVEUR_CHANGE', { avant: 'Kossi A.', apres: 'Essi D.', numero: 42 })).toBe(
      'Kossi A. → Essi D., n°42',
    )
  })
})
