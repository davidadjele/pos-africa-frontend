import type {
  CaisseResume,
  DetailCaisse,
  HistoriqueCaisses,
  RapportVentes,
} from '../../partage/api/contrat'

const JOURS = [
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
]
const TOTAUX = [152_500, 214_000, 298_500, 261_000, 98_500, 117_000, 143_000]

export const RAPPORT: RapportVentes = {
  du: '2026-09-25',
  au: '2026-10-01',
  precedentDu: '2026-09-18',
  precedentAu: '2026-09-24',
  indicateurs: {
    chiffreAffaires: 1_284_500,
    notes: 362,
    panierMoyen: 3548,
    remises: 28_400,
    remboursements: 9000,
    notesRemboursees: 2,
    // Marge hors taxe : 494 400 TTC à 18 % font 419 000 HT.
    marge: 130_600,
    cout: 288_400,
    coutConnu: 494_400,
  },
  precedent: {
    chiffreAffaires: 1_146_900,
    notes: 338,
    panierMoyen: 3393,
    remises: 12_000,
    remboursements: 4500,
    notesRemboursees: 1,
  },
  parJour: JOURS.map((journee, rang) => {
    const total = TOTAUX[rang] ?? 0
    const carte = Math.round(total * 0.07)
    const ardoise = Math.round(total * 0.07)
    const mobileMoney = Math.round(total * 0.31)
    return {
      journee,
      total,
      especes: total - carte - ardoise - mobileMoney,
      mobileMoney,
      carte,
      ardoise,
    }
  }),
  parHeure: [
    {
      heure: 12,
      notes: 40,
      total: 128_000,
      especes: 98_000,
      mobileMoney: 30_000,
      carte: 0,
      ardoise: 0,
    },
    {
      heure: 20,
      notes: 120,
      total: 452_000,
      especes: 250_000,
      mobileMoney: 150_000,
      carte: 40_000,
      ardoise: 12_000,
    },
  ],
  parMode: [
    { mode: 'ESPECES', montant: 702_500, operateurs: [] },
    {
      mode: 'MOBILE_MONEY',
      montant: 398_000,
      operateurs: [
        { operateur: 'FLOOZ', montant: 251_000 },
        { operateur: 'TMONEY', montant: 147_000 },
      ],
    },
    { mode: 'CARTE', montant: 96_500, operateurs: [] },
    { mode: 'ARDOISE', montant: 87_500, operateurs: [] },
  ],
  parProduit: [
    {
      produitId: 'f1000000-0000-4000-8000-000000000001',
      nom: 'Flag 65 cl',
      categorieId: 'ca700000-0000-4000-8000-000000000001',
      categorie: 'Bières',
      couleur: 'OCRE',
      quantite: 412,
      montant: 494_400,
      cout: 288_400,
      marge: 130_600,
      quantiteCoutConnu: 400,
    },
    {
      produitId: 'f1000000-0000-4000-8000-000000000002',
      nom: 'Poulet braisé',
      categorieId: 'ca700000-0000-4000-8000-000000000002',
      categorie: 'Grillades',
      couleur: 'BRIQUE',
      quantite: 58,
      montant: 261_000,
    },
  ],
  parCategorie: [
    {
      categorieId: 'ca700000-0000-4000-8000-000000000001',
      nom: 'Bières',
      couleur: 'OCRE',
      quantite: 412,
      montant: 494_400,
    },
    {
      categorieId: 'ca700000-0000-4000-8000-000000000002',
      nom: 'Grillades',
      couleur: 'BRIQUE',
      quantite: 58,
      montant: 261_000,
    },
  ],
  remisesSurNotes: 6200,
  parServeur: [
    {
      serveurId: '5e000000-0000-4000-8000-000000000001',
      nom: 'Kossi A.',
      notes: 148,
      montant: 512_000,
    },
    {
      serveurId: '5e000000-0000-4000-8000-000000000002',
      nom: 'Afi M.',
      notes: 121,
      montant: 438_500,
    },
  ],
  parEtablissement: [
    {
      etablissementId: 'e7000000-0000-4000-8000-000000000001',
      nom: 'Bè Kpota',
      notes: 250,
      montant: 884_000,
    },
    {
      etablissementId: 'e7000000-0000-4000-8000-000000000002',
      nom: 'Agbalépédo',
      notes: 112,
      montant: 400_500,
    },
  ],
  annulations: { articles: 6, montant: 6000, serveur: 'Kossi A.', articlesDuServeur: 4 },
  ardoise: { montant: 87_500, clients: 3 },
}

export const CAISSE_FERMEE: CaisseResume = {
  id: 'ca15e000-0000-4000-8000-000000000001',
  etablissementId: 'e7000000-0000-4000-8000-000000000001',
  etablissement: 'Bè Kpota',
  caisse: 'Caisse 1, bar',
  statut: 'FERMEE',
  numeroZ: 14,
  journee: '2026-09-30',
  ouverteLe: '2026-09-30T07:05:00Z',
  ouvertePar: 'Yawa T.',
  clotureeLe: '2026-10-01T02:14:00Z',
  clotureePar: 'Afi M.',
  ventes: 264_500,
  ecart: -600,
}

export const HISTORIQUE: HistoriqueCaisses = {
  synthese: { cloturees: 5, ouvertes: 1, ecartCumule: -2100, avecEcart: 3 },
  parJour: JOURS.map((journee) => ({
    journee,
    cloturees: journee === '2026-10-01' ? 0 : 1,
    ecart: { '2026-09-28': -2000, '2026-09-29': 500, '2026-09-30': -600 }[journee] ?? 0,
  })),
  caisses: [
    {
      id: 'ca15e000-0000-4000-8000-000000000002',
      etablissementId: 'e7000000-0000-4000-8000-000000000001',
      etablissement: 'Bè Kpota',
      caisse: 'Caisse 2, terrasse',
      statut: 'OUVERTE',
      journee: '2026-10-01',
      ouverteLe: '2026-10-01T07:02:00Z',
      ouvertePar: 'Afi M.',
    },
    CAISSE_FERMEE,
  ],
}

export const DETAIL_Z: DetailCaisse = {
  caisse: CAISSE_FERMEE,
  rapportZ: {
    numero: 14,
    ouverteLe: '2026-09-30T07:05:00Z',
    clotureeLe: '2026-10-01T02:14:00Z',
    clotureePar: 'Afi M.',
    ventes: {
      notes: 62,
      especes: 158_500,
      mobileMoney: 94_000,
      carte: 12_000,
      ardoise: 6900,
      total: 271_400,
      remboursements: { total: 4500, especes: 4500, mobileMoney: 0, carte: 0, ardoise: 0 },
    },
    reglementsArdoise: { total: 4500, especes: 4500, mobileMoney: 0, carte: 0 },
    remises: 7850,
    annulations: 6000,
    articlesAnnules: 3,
    tva: 40_347,
    especes: {
      fond: 20_000,
      recues: 212_000,
      rendues: 53_500,
      remboursements: 4500,
      reglementsArdoise: 4500,
      apports: 0,
      retraits: 40_000,
      depenses: 2500,
      attendu: 136_000,
    },
    compte: 135_400,
    ecart: -600,
    explication: 'Erreur de rendu sur un billet de 1 000, signalée par Yawa.',
    fondLaisse: 20_000,
  },
  mouvements: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      type: 'DEPENSE',
      montant: 2500,
      motif: 'Glace pour les bières',
      effectuePar: 'Afi M.',
      effectueLe: '2026-09-30T09:14:00Z',
    },
  ],
  remboursements: [
    {
      operationId: '40000000-0000-4000-8000-000000000001',
      le: '2026-09-30T22:05:00Z',
      note: 'n°48, T4',
      montant: 4500,
      motif: 'ARTICLE_NON_CONFORME',
      par: 'Afi M.',
    },
  ],
}
