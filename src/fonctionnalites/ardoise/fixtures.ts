import type {
  ArdoisesEtablissement,
  ClientArdoise,
  ClientEnCaisse,
  EcritureArdoise,
  FicheClient,
} from '../../partage/api/contrat'

const JOUR = 86_400_000

/** Il y a n jours, à l'heure du test : l'ancienneté se calcule depuis maintenant. */
export function ilYA(jours: number): string {
  return new Date(Date.now() - jours * JOUR).toISOString()
}

const DERNIERE_VENTE: EcritureArdoise = {
  id: 'e0000000-0000-4000-8000-000000000001',
  type: 'VENTE_A_CREDIT',
  montant: 13_500,
  soldeApres: 18_000,
  detail: 'n°42, T4',
  par: 'Yawa T.',
  autorisePar: 'Afi M.',
  le: ilYA(1),
}

export const KOMLAN: ClientArdoise = {
  id: 'c0000000-0000-4000-8000-000000000001',
  nom: 'Komlan D.',
  telephone: '+22890123456',
  plafond: 25_000,
  note: 'Paie chaque fin de mois.',
  solde: 18_000,
  actif: true,
  detteDepuis: ilYA(12),
  dernierMouvement: DERNIERE_VENTE,
}

export const EDEM: ClientArdoise = {
  id: 'c0000000-0000-4000-8000-000000000002',
  nom: 'Edem A., entreprise SOTRA',
  telephone: '+22822213040',
  plafond: 50_000,
  solde: 38_000,
  actif: true,
  detteDepuis: ilYA(45),
}

export const AMA: ClientArdoise = {
  id: 'c0000000-0000-4000-8000-000000000003',
  nom: 'Ama K.',
  solde: 0,
  actif: true,
}

export const ARDOISES: ArdoisesEtablissement = {
  aRecevoir: 56_000,
  debiteurs: 2,
  aRelancer: 38_000,
  clientsARelancer: 1,
  clients: [EDEM, KOMLAN, AMA],
}

export const FICHE_KOMLAN: FicheClient = {
  client: KOMLAN,
  ecritures: [
    DERNIERE_VENTE,
    {
      id: 'e0000000-0000-4000-8000-000000000002',
      type: 'VENTE_A_CREDIT',
      montant: 4_500,
      soldeApres: 4_500,
      detail: 'n°27',
      par: 'Afi M.',
      le: ilYA(12),
    },
  ],
}

export const KOMLAN_EN_CAISSE: ClientEnCaisse = {
  id: KOMLAN.id,
  nom: 'Komlan D.',
  telephone: '+22890123456',
  solde: 4_500,
  plafond: 25_000,
}

export const YAO_EN_CAISSE: ClientEnCaisse = {
  id: 'c0000000-0000-4000-8000-000000000004',
  nom: 'Yao S.',
  solde: 12_000,
}
