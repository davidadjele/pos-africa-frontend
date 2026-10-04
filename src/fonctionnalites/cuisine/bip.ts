let contexte: AudioContext | null = null

/**
 * Un bip court à l'arrivée d'un bon, produit sans fichier son. Le navigateur n'autorise le son qu'après un
 * geste : le premier toucher sur l'écran cuisine le débloque.
 */
export function jouerBip(): void {
  if (typeof AudioContext === 'undefined') return
  contexte ??= new AudioContext()
  void contexte.resume().catch(() => undefined)
  const oscillateur = contexte.createOscillator()
  const volume = contexte.createGain()
  oscillateur.frequency.value = 880
  volume.gain.value = 0.2
  oscillateur.connect(volume).connect(contexte.destination)
  oscillateur.start()
  oscillateur.stop(contexte.currentTime + 0.25)
}
