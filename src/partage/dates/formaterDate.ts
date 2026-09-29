/** Date courte des tableaux (« 28/09/2026 »), dans le fuseau de l'entreprise, pas de l'appareil. */
export function formaterDate(instant: string, fuseauHoraire: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: fuseauHoraire,
  }).format(new Date(instant))
}
