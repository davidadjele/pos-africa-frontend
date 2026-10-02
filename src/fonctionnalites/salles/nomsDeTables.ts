/** Même règle que le serveur (NomsDeTables) : l'aperçu annonce exactement ce qui sera créé. */
export function nomsDeTables(premier: string, nombre: number): string[] {
  // Les chiffres de fin, lus sans expression régulière pour éviter tout retour arrière.
  let debutChiffres = premier.length
  while (debutChiffres > 0 && /\d/.test(premier.charAt(debutChiffres - 1))) debutChiffres--
  if (debutChiffres < premier.length) {
    const prefixe = premier.slice(0, debutChiffres)
    const debut = Number(premier.slice(debutChiffres))
    return Array.from({ length: nombre }, (_, rang) => `${prefixe}${String(debut + rang)}`)
  }
  if (nombre === 1) return [premier]
  return Array.from({ length: nombre }, (_, rang) => `${premier} ${String(rang + 1)}`)
}

/** Premier nom proposé : « T » suivi du plus grand numéro déjà utilisé, plus un. */
export function suivantDe(noms: string[]): string {
  const numeros = noms
    .map((nom) => /^T(\d+)$/i.exec(nom)?.[1])
    .filter((numero): numero is string => numero !== undefined)
    .map(Number)
  return `T${String(numeros.length === 0 ? 1 : Math.max(...numeros) + 1)}`
}
