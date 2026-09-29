/** Date courte des tableaux (« 28/09/2026 »), dans le fuseau de l'entreprise, pas de l'appareil. */
export function formaterDate(instant: string, fuseauHoraire: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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
