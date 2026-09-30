/** Temps passé à table (« 1 h 46 ») : ce qui compte en salle, pas l'heure d'ouverture. */
export function dureeDepuis(debut: string, maintenant: Date = new Date()): string {
  const minutes = Math.max(
    0,
    Math.floor((maintenant.getTime() - new Date(debut).getTime()) / 60_000),
  )
  return `${String(Math.floor(minutes / 60))} h ${String(minutes % 60).padStart(2, '0')}`
}
