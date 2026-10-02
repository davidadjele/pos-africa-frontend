import type { RecuCaisse } from '../../partage/api/contrat'

export const RECU: RecuCaisse = {
  numero: 'BE-000127',
  duplicata: false,
  jeton: 'k3F9qL2mX7aP0bQ1cR2dS3eT4fU5gV6hW7iX8jY9kZ0',
  emisLe: '2026-10-01T21:05:00Z',
  entreprise: 'Maquis Chez Tanti',
  numeroFiscal: '1000123456',
  etablissement: {
    nom: 'Bè Kpota',
    adresse: 'Bè Kpota, rue 154',
    ville: 'Lomé',
    telephone: '+22890112345',
    enTete: 'Bienvenue au maquis !',
    pied: 'Merci et à bientôt !',
  },
  largeur: 80,
  impressionAuto: false,
  note: 'n°42, T4',
  serveur: 'Kossi A.',
  caissier: 'Yawa T.',
  lignes: [
    { quantite: 1, nom: 'Flag 65 cl', montant: 1200, offert: false },
    { quantite: 2, nom: 'Poulet braisé', montant: 9000, offert: false },
  ],
  remise: 0,
  total: 10_200,
  taxes: [{ nom: 'TVA', tauxPointsDeBase: 1800, montant: 1556 }],
  paiements: [
    {
      mode: 'MOBILE_MONEY',
      montant: 5000,
      monnaieRendue: 0,
      operateur: 'FLOOZ',
      reference: '7F3K29',
    },
    { mode: 'ESPECES', montant: 5200, montantRecu: 10_000, monnaieRendue: 4800 },
  ],
}
