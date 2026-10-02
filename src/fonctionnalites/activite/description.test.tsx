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

  it('détaille une remise, un article offert et le retrait d’une remise', () => {
    const detail = (
      type: EvenementActivite['type'],
      details: Record<string, unknown>,
      detailsNoms = {},
    ) => detailActivite(evenement({ type, domaine: 'CAISSE', details, detailsNoms }), t, CONTEXTE)

    expect(
      detail('REMISE_APPLIQUEE', { montant: 360, taux: 1000, motif: 'CLIENT_FIDELE', numero: 42 }),
    ).toBe(`−360${INSEC}F, n°42. Motif : Client fidèle.`)
    expect(
      detail(
        'ARTICLE_OFFERT',
        { montant: 1200, quantite: 1, motif: 'GESTE_COMMERCIAL', numero: 42, table: 'T4' },
        { validateurId: 'Afi M.' },
      ),
    ).toBe(
      `1 × offert (1${FINE}200${INSEC}F), T4, n°42. Motif : Geste commercial. Validé par Afi M.`,
    )
    expect(detail('REMISE_RETIREE', { montant: 360, numero: 42 })).toBe(
      `−360${INSEC}F retiré, n°42`,
    )
  })

  it('donne le fond d’une ouverture de caisse', () => {
    expect(
      detailActivite(
        evenement({ type: 'CAISSE_OUVERTE', domaine: 'CAISSE', details: { fond: 20_000 } }),
        t,
        CONTEXTE,
      ),
    ).toBe(`Fond : 20${FINE}000${INSEC}F`)
  })

  it('détaille les mouvements d’espèces et les clôtures, avec leur écart', () => {
    const detail = (
      type: EvenementActivite['type'],
      details: Record<string, unknown>,
      detailsNoms = {},
    ) => detailActivite(evenement({ type, domaine: 'CAISSE', details, detailsNoms }), t, CONTEXTE)

    expect(detail('RETRAIT_CAISSE', { montant: 10_000, motif: 'Vers le coffre' })).toBe(
      `10${FINE}000${INSEC}F, motif : Vers le coffre`,
    )
    expect(
      detail('DEPENSE_CAISSE', { montant: 2500, motif: 'Glace' }, { validateurId: 'Afi M.' }),
    ).toBe(`2${FINE}500${INSEC}F, motif : Glace. Validé par Afi M.`)
    expect(detail('CLOTURE_CAISSE', { attendu: 15_700, compte: 15_700, ecart: 0 })).toBe(
      `Attendu 15${FINE}700${INSEC}F, compté 15${FINE}700${INSEC}F`,
    )
    expect(
      detail('ECART_CAISSE', {
        attendu: 15_700,
        compte: 15_000,
        ecart: -700,
        explication: 'Monnaie rendue en trop',
      }),
    ).toBe(
      `Attendu 15${FINE}700${INSEC}F, compté 15${FINE}000${INSEC}F, écart −700${INSEC}F : Monnaie rendue en trop`,
    )
    expect(
      detail('ECART_OUVERTURE_CAISSE', {
        attendu: 20_000,
        fond: 15_000,
        ecart: -5000,
        explication: 'Monnaie prêtée au bar',
      }),
    ).toBe(
      `Laissé 20${FINE}000${INSEC}F, compté 15${FINE}000${INSEC}F, écart −5${FINE}000${INSEC}F : Monnaie prêtée au bar`,
    )
  })

  it('détaille un remboursement : montant, mode, note, motif et validation', () => {
    expect(
      detailActivite(
        evenement({
          type: 'REMBOURSEMENT',
          domaine: 'CAISSE',
          details: {
            montant: 4500,
            mode: 'ESPECES',
            motif: 'ARTICLE_NON_CONFORME',
            numero: 42,
            table: 'T4',
          },
          detailsNoms: { validateurId: 'Afi M.' },
        }),
        t,
        CONTEXTE,
      ),
    ).toBe(
      `−4${FINE}500${INSEC}F en espèces, T4, n°42. Motif : Article non conforme. Validé par Afi M.`,
    )
  })

  it('détaille les réceptions, pertes, écarts d’inventaire et la politique de stock', () => {
    const detail = (type: EvenementActivite['type'], details: Record<string, unknown>) =>
      detailActivite(evenement({ type, domaine: 'STOCK', details }), t, CONTEXTE)

    expect(detail('RECEPTION_STOCK', { quantite: 48, apres: 72, reference: 'BL 2240' })).toBe(
      '+48, 72 en stock, BL 2240',
    )
    expect(detail('PERTE_STOCK', { quantite: 2, motif: 'CASSE', apres: 22 })).toBe(
      '−2, casse, 22 en stock',
    )
    expect(detail('ECART_INVENTAIRE', { attendu: 24, compte: 21, ecart: -3, motif: 'CASSE' })).toBe(
      'Enregistré 24, compté 21, écart −3 : casse',
    )
    expect(detail('POLITIQUE_STOCK_MODIFIEE', { avant: 'ENTREPRISE', apres: 'STRICT' })).toBe(
      'Celle de l’entreprise → Stricte',
    )
  })

  it('signale une vente sans stock enregistré', () => {
    expect(
      detailActivite(
        evenement({
          type: 'VENTE_SANS_STOCK',
          domaine: 'STOCK',
          details: { quantite: 2, apres: -1, detail: 'n°42, T4' },
        }),
        t,
        CONTEXTE,
      ),
    ).toBe('−2, −1 en stock, n°42, T4')
  })
  it('détaille une note mise sur l’ardoise, et le dépassement du plafond validé', () => {
    expect(
      detailActivite(
        evenement({
          type: 'VENTE_ARDOISE',
          domaine: 'ARDOISE',
          objetType: 'CLIENT',
          objetLibelle: 'Komlan D.',
          details: { montant: 13500, solde: 18000, note: 'n°42, T4' },
        }),
        t,
        CONTEXTE,
      ),
    ).toBe(`+13${FINE}500${INSEC}F, n°42, T4. Doit 18${FINE}000${INSEC}F.`)
    expect(
      detailActivite(
        evenement({
          type: 'PLAFOND_ARDOISE_DEPASSE',
          domaine: 'ARDOISE',
          objetType: 'CLIENT',
          objetLibelle: 'Komlan D.',
          details: {
            montant: 13500,
            solde: 33500,
            note: 'n°42, T4',
            plafond: 25000,
            depassement: 8500,
            validateurId: 'u-afi',
          },
          detailsNoms: { validateurId: 'Afi M.' },
        }),
        t,
        CONTEXTE,
      ),
    ).toBe(
      `+13${FINE}500${INSEC}F, n°42, T4. Doit 33${FINE}500${INSEC}F, plafond 25${FINE}000${INSEC}F dépassé de 8${FINE}500${INSEC}F. Validé par Afi M.`,
    )
  })

  it('montre le plafond d’ardoise avant et après', () => {
    expect(
      detailActivite(
        evenement({
          type: 'PLAFOND_ARDOISE_MODIFIE',
          domaine: 'ARDOISE',
          details: { avant: 'aucun', apres: 40000 },
        }),
        t,
        CONTEXTE,
      ),
    ).toBe(`Sans plafond → 40${FINE}000${INSEC}F`)
  })

  it('détaille un règlement d’ardoise', () => {
    expect(
      detailActivite(
        evenement({
          type: 'REGLEMENT_ARDOISE',
          domaine: 'ARDOISE',
          details: { montant: 10000, mode: 'ESPECES', solde: 8000 },
        }),
        t,
        CONTEXTE,
      ),
    ).toBe(`−10${FINE}000${INSEC}F en espèces. Doit encore 8${FINE}000${INSEC}F.`)
  })
})
