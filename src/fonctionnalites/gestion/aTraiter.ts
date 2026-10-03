import type {
  ARelancer,
  CaisseResume,
  EtablissementDuJour,
  StockATraiter,
  TableauDeBord,
} from '../../partage/api/contrat'

export type TonATraiter = 'danger' | 'alerte' | 'info'
export type CleATraiter =
  | 'caisseOubliee'
  | 'ecart'
  | 'stockNegatif'
  | 'rupture'
  | 'noteAncienne'
  | 'annulations'
  | 'stockFaible'
  | 'ardoises'

/** Où l'on agit sur ce point : la page le transforme en lien. */
export type Destination =
  | { vers: 'caisse'; ouvertureId: string }
  | { vers: 'stock'; etablissementId: string }
  | { vers: 'activite' }
  | { vers: 'ardoises' }
  | { vers: 'aucune' }

export interface PointATraiter {
  cle: CleATraiter
  ton: TonATraiter
  valeurs: Record<string, string | number>
  destination: Destination
  /** Plusieurs points de même clé (deux caisses oubliées) : la clé React les distingue. */
  identifiant: string
}

/** Chaque source peut manquer : le droit de la voir, ou l'écran, n'est pas donné à tous. */
export interface SourcesATraiter {
  maintenant: Date
  /** Journée de caisse en cours de chaque établissement. */
  journees: Record<string, string>
  caissesOuvertes?: CaisseResume[] | undefined
  caissesDuJour?: CaisseResume[] | undefined
  stock?: StockATraiter['produits'] | undefined
  ardoises?: Pick<ARelancer, 'nombre' | 'montant'> | undefined
  etablissements: Pick<
    EtablissementDuJour,
    'etablissementId' | 'nom' | 'plusAncienneLe' | 'plusAncienneNote'
  >[]
  annulations: TableauDeBord['annulations']
}

const RANG: Record<TonATraiter, number> = { danger: 0, alerte: 1, info: 2 }
/** Au-delà, une note ouverte n'est plus un service en cours : oubliée, ou partie sans payer. */
const NOTE_ANCIENNE_MINUTES = 3 * 60
/** Assez pour agir ; le reste se lit dans l'écran Stock. */
const PRODUITS_MAX = 3

function duree(minutes: number): string {
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  return reste === 0
    ? `${String(heures)} h`
    : `${String(heures)} h ${String(reste).padStart(2, '0')}`
}

/** Ce que le propriétaire doit traiter maintenant, du plus urgent au simple suivi. */
export function pointsATraiter(sources: SourcesATraiter): PointATraiter[] {
  const stock = sources.stock ?? []
  return [
    ...caissesOubliees(sources),
    ...ecarts(sources.caissesDuJour ?? []),
    ...produits(stock),
    ...notesAnciennes(sources),
    ...suivis(sources, stock),
  ].sort((a, b) => RANG[a.ton] - RANG[b.ton])
}

/** Une caisse encore ouverte d'un jour passé : personne ne l'a clôturée. */
function caissesOubliees(sources: SourcesATraiter): PointATraiter[] {
  return (sources.caissesOuvertes ?? [])
    .filter((caisse) => {
      const journee = sources.journees[caisse.etablissementId]
      return journee !== undefined && caisse.journee < journee
    })
    .map((caisse) => ({
      cle: 'caisseOubliee',
      ton: 'danger',
      identifiant: caisse.id,
      valeurs: {
        etablissement: caisse.etablissement,
        caisse: caisse.caisse,
        par: caisse.ouvertePar,
        ouverteLe: caisse.ouverteLe,
      },
      destination: { vers: 'caisse', ouvertureId: caisse.id },
    }))
}

function ecarts(caisses: CaisseResume[]): PointATraiter[] {
  return caisses
    .filter((caisse) => caisse.ecart !== undefined && caisse.ecart !== 0)
    .map((caisse) => ({
      cle: 'ecart',
      ton: 'danger',
      identifiant: caisse.id,
      valeurs: {
        ecart: caisse.ecart ?? 0,
        etablissement: caisse.etablissement,
        caisse: caisse.caisse,
        numero: caisse.numeroZ ?? 0,
      },
      destination: { vers: 'caisse', ouvertureId: caisse.id },
    }))
}

/** Le négatif puis la rupture, produit par produit : chacun appelle une action précise. */
function produits(stock: NonNullable<SourcesATraiter['stock']>): PointATraiter[] {
  return (
    [
      ['NEGATIF', 'stockNegatif', 'danger'],
      ['RUPTURE', 'rupture', 'alerte'],
    ] as const
  ).flatMap(([etat, cle, ton]) =>
    stock
      .filter((ligne) => ligne.etat === etat)
      .slice(0, PRODUITS_MAX)
      .map((produit) => ({
        cle,
        ton,
        identifiant: `${produit.produitId}-${produit.etablissementId}`,
        valeurs: {
          produit: produit.nom,
          etablissement: produit.etablissement,
          quantite: produit.quantite,
        },
        destination: { vers: 'stock', etablissementId: produit.etablissementId } as const,
      })),
  )
}

function notesAnciennes(sources: SourcesATraiter): PointATraiter[] {
  return sources.etablissements.flatMap((etablissement): PointATraiter[] => {
    if (etablissement.plusAncienneLe === undefined) return []
    const minutes = Math.floor(
      (sources.maintenant.getTime() - new Date(etablissement.plusAncienneLe).getTime()) / 60_000,
    )
    if (minutes < NOTE_ANCIENNE_MINUTES) return []
    return [
      {
        cle: 'noteAncienne',
        ton: 'alerte',
        identifiant: etablissement.etablissementId,
        valeurs: {
          etablissement: etablissement.nom,
          note: etablissement.plusAncienneNote ?? '',
          duree: duree(minutes),
        },
        destination: { vers: 'aucune' },
      },
    ]
  })
}

/** Ce qui se suit sans urgence : les annulations du jour, le stock faible, les ardoises à relancer. */
function suivis(
  sources: SourcesATraiter,
  stock: NonNullable<SourcesATraiter['stock']>,
): PointATraiter[] {
  const points: PointATraiter[] = []
  const { annulations, ardoises } = sources
  if (annulations.articles > 0) {
    points.push({
      cle: 'annulations',
      ton: 'alerte',
      identifiant: 'annulations',
      valeurs: {
        articles: annulations.articles,
        montant: annulations.montant,
        serveur: annulations.serveur ?? '',
        articlesDuServeur: annulations.articlesDuServeur,
      },
      destination: { vers: 'activite' },
    })
  }
  const faibles = stock.filter((ligne) => ligne.etat === 'FAIBLE')
  if (faibles.length > 0) {
    points.push({
      cle: 'stockFaible',
      ton: 'info',
      identifiant: 'stockFaible',
      valeurs: { nombre: faibles.length, produits: faibles.map((ligne) => ligne.nom).join(', ') },
      destination: { vers: 'stock', etablissementId: faibles[0]?.etablissementId ?? '' },
    })
  }
  if (ardoises !== undefined && ardoises.nombre > 0) {
    points.push({
      cle: 'ardoises',
      ton: 'info',
      identifiant: 'ardoises',
      valeurs: { montant: ardoises.montant, clients: ardoises.nombre },
      destination: { vers: 'ardoises' },
    })
  }
  return points
}
