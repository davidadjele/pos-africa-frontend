/** Date courte des tableaux (« 28/09/2026 »), dans le fuseau de l'entreprise, pas de l'appareil. */
export function formaterDate(instant: string, fuseauHoraire: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: fuseauHoraire,
  }).format(new Date(instant))
}

/** Heure seule (« 19:42 ») : une action du jour, comme une rupture. */
export function formaterHeure(instant: string, fuseauHoraire: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fuseauHoraire,
  }).format(new Date(instant))
}

/** Date et heure (« 28/09/2026, 20:41 ») : dernière activité, événements. Virgule plutôt que « · ». */
export function formaterDateHeure(instant: string, fuseauHoraire: string): string {
  const heure = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fuseauHoraire,
  }).format(new Date(instant))
  return `${formaterDate(instant, fuseauHoraire)}, ${heure}`
}

/** « mardi 29 septembre » : en-tête d'un groupe de lignes du même jour. */
export function formaterJour(instant: string, fuseauHoraire: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: fuseauHoraire,
  }).format(new Date(instant))
}

/** Minuit du jour en cours dans ce fuseau, en instant UTC : début de la période « Aujourd'hui ». */
export function debutDuJour(fuseauHoraire: string, maintenant: Date = new Date()): Date {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: fuseauHoraire,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(maintenant)
      .map((partie) => [partie.type, Number(partie.value)]),
  ) as Record<string, number>
  const annee = parties.year ?? 1970
  const mois = (parties.month ?? 1) - 1
  const jour = parties.day ?? 1
  // Écart entre l'heure locale et UTC à cet instant, en millisecondes entières.
  const localCommeUtc = Date.UTC(annee, mois, jour, parties.hour, parties.minute, parties.second)
  const ecart = localCommeUtc - Math.floor(maintenant.getTime() / 1000) * 1000
  return new Date(Date.UTC(annee, mois, jour) - ecart)
}
