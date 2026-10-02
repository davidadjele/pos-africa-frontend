export type ClePeriode = 'AUJOURDHUI' | 'HIER' | 'SEPT_JOURS' | 'CE_MOIS' | 'MOIS_DERNIER' | 'DATES'

/** Journées au format « 2026-10-01 », bornes comprises. */
export interface Periode {
  du: string
  au: string
}

const JOUR = 24 * 60 * 60 * 1000
/** Même bascule que le serveur (JourneeCommerciale) : un service fini à 2 h reste sur sa journée. */
const HEURE_BASCULE = 4

/** La journée de caisse en cours dans ce fuseau. */
export function journeeCourante(fuseauHoraire: string, maintenant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseauHoraire,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(maintenant.getTime() - HEURE_BASCULE * 60 * 60 * 1000))
}

function versDate(journee: string): Date {
  return new Date(`${journee}T00:00:00Z`)
}

function versJournee(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function decaler(journee: string, jours: number): string {
  return versJournee(new Date(versDate(journee).getTime() + jours * JOUR))
}

export function periodeDe(cle: Exclude<ClePeriode, 'DATES'>, journee: string): Periode {
  const date = versDate(journee)
  switch (cle) {
    case 'AUJOURDHUI':
      return { du: journee, au: journee }
    case 'HIER':
      return { du: decaler(journee, -1), au: decaler(journee, -1) }
    case 'SEPT_JOURS':
      return { du: decaler(journee, -6), au: journee }
    case 'CE_MOIS':
      return { du: `${journee.slice(0, 8)}01`, au: journee }
    case 'MOIS_DERNIER': {
      const premier = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1))
      const dernier = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0))
      return { du: versJournee(premier), au: versJournee(dernier) }
    }
  }
}

export function nombreDeJours(periode: Periode): number {
  return Math.round((versDate(periode.au).getTime() - versDate(periode.du).getTime()) / JOUR) + 1
}

/** « +12 % » : arrondi au point près ; rien quand la période d'avant n'a rien vendu. */
export function variation(actuel: number, precedent: number): number | null {
  if (precedent === 0) return null
  return Math.round(((actuel - precedent) / precedent) * 100)
}

/** « jeu. 25 » : l'étiquette d'une journée sous une barre de graphique. */
export function formaterJourCourt(journee: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(versDate(journee))
}

/** « jeu. 25 sept. » : une journée dans une phrase. */
export function formaterJournee(journee: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(versDate(journee))
}
