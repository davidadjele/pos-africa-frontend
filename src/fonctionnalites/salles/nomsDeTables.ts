const FIN_NUMEROTEE = /^(.*?)(\d+)$/

/** Même règle que le serveur (NomsDeTables) : l'aperçu annonce exactement ce qui sera créé. */
export function nomsDeTables(premier: string, nombre: number): string[] {
  const numerote = FIN_NUMEROTEE.exec(premier)
  if (numerote !== null) {
    const [, prefixe = '', chiffres = '0'] = numerote
    const debut = Number(chiffres)
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
