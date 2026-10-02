/** Le reçu en ligne, sur l'adresse même de l'application : celle de la tablette qui l'a émis. */
export function lienRecu(jeton: string): string {
  return `${globalThis.location.origin}/r/${jeton}`
}

/** Une conversation WhatsApp ouverte au numéro, message prêt : le caissier n'a plus qu'à l'envoyer. */
export function lienWhatsApp(telephoneE164: string, message: string): string {
  return `https://wa.me/${telephoneE164.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`
}
